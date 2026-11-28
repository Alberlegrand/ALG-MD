import dotenv from 'dotenv';
dotenv.config();

process.on('uncaughtException', (err) => console.error('⚠️ [Erreur Système]', err.message || err));
process.on('unhandledRejection', (reason) => console.error('⚠️ [Rejet Promesse]', reason?.message || reason));

import {
    makeWASocket,
    Browsers,
    fetchLatestBaileysVersion,
    DisconnectReason,
    useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Handler, Callupdate, GroupUpdate } from './src/event/index.js';
import initDailyBriefing from './src/assistant/dailyBriefing.js';
import { setupWebDashboard } from './src/assistant/webDashboard.js';
import { sendWelcomeMessage } from './src/assistant/interactive.js';
import { fileURLToPath } from 'url';
import express from 'express';
import pino from 'pino';
import fs from 'fs';
import NodeCache from 'node-cache';
import path from 'path';
import chalk from 'chalk';
import moment from 'moment-timezone';
import axios from 'axios';
import { gzipSync, gunzipSync } from 'node:zlib';
import config from './config.cjs';
import pkg from './lib/autoreact.cjs';
const { emojis, doReact } = pkg;

const sessionName = "session";
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Garde le processus Node.js actif en permanence
setInterval(() => {}, 1000 * 60 * 60);

let currentMatrix = null;
let currentQR = null;
let currentPairingCode = null;
let botStatus = 'disconnected';
let connectedUser = null;

const orange = chalk.bold.hex("#FFA500");
const lime = chalk.bold.hex("#32CD32");
let useQR = true;
let initialConnection = true;
const PORT = process.env.PORT || 3000;

const isDevelopment = (process.env.NODE_ENV || 'development').toLowerCase() === 'development';
const MAIN_LOGGER = pino({
    level: isDevelopment ? 'trace' : 'info',
    timestamp: () => `,"time":"${new Date().toJSON()}"`
});
const logger = MAIN_LOGGER.child({});
logger.level = isDevelopment ? 'trace' : 'info';

const msgRetryCounterCache = new NodeCache();
const sentMessagesCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionDir = path.join(__dirname, 'session');
const credsPath = path.join(sessionDir, 'creds.json');
const sessionBundlePrefix = 'ALG-MD&v2:';

if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

function decodeSessionPayload(value) {
    const raw = value.trim();
    const candidates = [];

    if (raw.startsWith(sessionBundlePrefix)) {
        try {
            const compressed = Buffer.from(raw.slice(sessionBundlePrefix.length), 'base64');
            candidates.push(gunzipSync(compressed).toString('utf8'));
        } catch (_) {
            return null;
        }
    } else {
        const encoded = raw.startsWith('ALG-MD&') ? raw.slice('ALG-MD&'.length) : raw;
        candidates.push(raw, encoded);
        try {
            candidates.push(Buffer.from(encoded, 'base64').toString('utf8'));
        } catch (_) {}
    }

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (_) {}
    }

    return null;
}

async function restoreSessionPayload(value) {
    const payload = decodeSessionPayload(value);
    if (!payload || typeof payload !== 'object') return false;

    if (payload.version === 2 && Array.isArray(payload.files)) {
        const files = new Map();
        for (const entry of payload.files) {
            if (!Array.isArray(entry) || entry.length !== 2) {
                throw new Error('Bundle de session invalide.');
            }
            const [name, contents] = entry;
            if (typeof name !== 'string' || !/^[A-Za-z0-9._-]+\.json$/.test(name) || typeof contents !== 'string') {
                throw new Error('Fichier invalide dans le bundle de session.');
            }
            JSON.parse(contents);
            files.set(name, contents);
        }

        const credsRaw = files.get('creds.json');
        if (!credsRaw) throw new Error('Le bundle de session ne contient pas creds.json.');
        const creds = JSON.parse(credsRaw);
        if (!creds?.registered && !creds?.me) {
            throw new Error('Le bundle de session ne contient pas de credentials enregistrés.');
        }

        for (const entry of await fs.promises.readdir(sessionDir, { withFileTypes: true })) {
            if (entry.isFile() && /^[A-Za-z0-9._-]+\.json$/.test(entry.name)) {
                await fs.promises.unlink(path.join(sessionDir, entry.name));
            }
        }
        await Promise.all([...files].map(([name, contents]) =>
            fs.promises.writeFile(path.join(sessionDir, name), contents)
        ));
        return 'bundle';
    }

    if (payload.registered || payload.me) {
        await fs.promises.writeFile(credsPath, JSON.stringify(payload));
        return 'legacy';
    }

    return false;
}

async function downloadSessionData() {
    if (!config.SESSION_ID || config.SESSION_ID === "Your Session Id" || config.SESSION_ID.trim() === "") {
        return false;
    }

    try {
        const rawSession = config.SESSION_ID.trim();
        const restored = await restoreSessionPayload(rawSession);
        if (restored === 'bundle') {
            console.log("🔒 Session complète restaurée depuis SESSION_ID.");
            return true;
        }
        if (restored === 'legacy') {
            console.warn("⚠️ SESSION_ID ancien format : seul creds.json a été restauré, pas les clés Baileys.");
            return true;
        }

        const sessdata = rawSession.startsWith('ALG-MD&') ? rawSession.slice('ALG-MD&'.length) : rawSession;
        const url = sessdata.startsWith('http') ? sessdata : `https://pastebin.com/raw/${sessdata}`;
        console.log("Téléchargement de la session depuis :", url);
        const response = await axios.get(url, { timeout: 10000 });
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        const downloaded = await restoreSessionPayload(data);
        if (downloaded === 'bundle') {
            console.log("🔒 Session complète téléchargée et restaurée.");
            return true;
        }
        if (downloaded === 'legacy') {
            console.warn("⚠️ Session distante ancien format : seul creds.json a été restauré, pas les clés Baileys.");
            return true;
        }
        throw new Error('La session téléchargée n’est ni un bundle ALG-MD v2 ni un fichier credentials valide.');
    } catch (error) {
        console.error('Erreur lors du chargement de la session:', error.message || error);
        return false;
    }
}

function persistSessionToEnv() {
    try {
        if (!fs.existsSync(credsPath)) return;
        const files = fs.readdirSync(sessionDir, { withFileTypes: true })
            // Baileys can rebuild these snapshots; excluding them keeps SESSION_ID small enough for deployment variables.
            .filter(entry =>
                entry.isFile() &&
                /^[A-Za-z0-9._-]+\.json$/.test(entry.name) &&
                !entry.name.startsWith('app-state-sync-version-')
            )
            .map(entry => [entry.name, fs.readFileSync(path.join(sessionDir, entry.name), 'utf8')]);
        const credsRaw = files.find(([name]) => name === 'creds.json')?.[1];
        if (!credsRaw) return;
        const creds = JSON.parse(credsRaw);
        if (!creds?.registered && !creds?.me) return;
        const bundle = gzipSync(Buffer.from(JSON.stringify({ version: 2, files }), 'utf8')).toString('base64');
        const sessionString = `${sessionBundlePrefix}${bundle}`;

        const envPath = path.join(__dirname, '.env');
        if (!fs.existsSync(envPath)) {
            console.warn("⚠️ Fichier .env absent : la session complète n’a pas pu être exportée. Conservez le dossier session/ sur un stockage persistant.");
            return;
        }

        let envContent = fs.readFileSync(envPath, 'utf8');
        if (/^[ \t]*SESSION_ID[ \t]*=/m.test(envContent)) {
            envContent = envContent.replace(/^[ \t]*SESSION_ID[ \t]*=.*$/m, `SESSION_ID=${sessionString}`);
        } else {
            envContent = `SESSION_ID=${sessionString}\n` + envContent;
        }
        fs.writeFileSync(envPath, envContent);
        console.log("💾 [Persistance] Session complète (credentials + clés) sauvegardée dans .env.");
    } catch (e) {
        console.error("Erreur persistance session:", e.message);
    }
}

async function start() {
    try {
        if (currentMatrix) {
            try {
                currentMatrix.ev.removeAllListeners();
                currentMatrix.end();
            } catch (_) {}
            currentMatrix = null;
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const isRegistered = Boolean(state.creds?.registered || state.creds?.me);
        if (state.creds?.me && !state.creds?.registered) {
            state.creds.registered = true;
            await saveCreds();
        }

        let version = [2, 3000, 1043857760];
        let isLatest = true;
        try {
            const vRes = await Promise.race([
                fetchLatestBaileysVersion(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout version")), 3000))
            ]);
            version = vRes.version;
            isLatest = vRes.isLatest;
        } catch (_) {}
        console.log(`🤖 ALG-MD using WA v${version.join('.')}, isLatest: ${isLatest}`);

        const Matrix = makeWASocket({
            version,
            logger: pino({ level: isDevelopment ? 'debug' : 'silent' }),
            printQRInTerminal: !isRegistered && useQR,
            browser: Browsers.ubuntu('Chrome'),
            auth: state,
            msgRetryCounterCache,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            patchMessageBeforeSending: (message) => {
                const requiresPatch = !!(
                    message.buttonsMessage ||
                    message.templateMessage ||
                    message.listMessage ||
                    message.interactiveMessage
                );
                if (requiresPatch && !message.viewOnceMessage) {
                    message = {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadataVersion: 2,
                                    deviceListMetadata: {},
                                },
                                ...message
                            }
                        }
                    };
                }
                return message;
            },
            getMessage: async (key) => {
                if (key?.id && sentMessagesCache.has(key.id)) {
                    return sentMessagesCache.get(key.id);
                }
                return undefined;
            }
        });
        const sendMessage = Matrix.sendMessage.bind(Matrix);
        Matrix.sendMessage = async (...args) => {
            const sent = await sendMessage(...args);
            if (sent?.key?.id && sent.message) {
                sentMessagesCache.set(sent.key.id, sent.message);
            }
            return sent;
        };
        const relayMessage = Matrix.relayMessage.bind(Matrix);
        Matrix.relayMessage = async (jid, message, options = {}) => {
            if (options?.messageId && message) {
                sentMessagesCache.set(options.messageId, message);
            }
            return relayMessage(jid, message, options);
        };
        Matrix.cacheMessage = (id, message) => {
            if (id && message) {
                sentMessagesCache.set(id, message);
            }
        };
        currentMatrix = Matrix;

        Matrix.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                currentQR = qr;
                botStatus = 'disconnected';
                console.log(chalk.cyan("📲 Nouveau code QR généré ! Scannez-le ou utilisez le code de jumelage sur le web."));
            }
            if (connection === 'close') {
                botStatus = 'disconnected';
                connectedUser = null;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = statusCode === DisconnectReason.loggedOut;
                const isConflict = statusCode === DisconnectReason.connectionReplaced || (lastDisconnect?.error?.message && lastDisconnect.error.message.includes('conflict'));
                console.log(chalk.yellow(`⚠️ Connexion fermée (${lastDisconnect?.error?.message || statusCode}). Reconnexion : ${!isLoggedOut}`));
                
                // IMPORTANT : Ne JAMAIS supprimer la session lors d'un restart de jumelage (code 515) ou conflit.
                // On supprime UNIQUEMENT si l'appareil a été déconnecté explicitement (code 401 / loggedOut).
                if (isLoggedOut) {
                    console.log(chalk.red("🔒 Appareil déconnecté (Logged out). Réinitialisation de la session locale..."));
                    try {
                        if (fs.existsSync(sessionDir)) {
                            fs.rmSync(sessionDir, { recursive: true, force: true });
                            fs.mkdirSync(sessionDir, { recursive: true });
                        }
                    } catch (_) {}
                    currentQR = null;
                    currentPairingCode = null;
                }

                const delay = isConflict ? 8000 : 3000;
                setTimeout(() => start(), delay);
            } else if (connection === 'open') {
                botStatus = 'connected';
                currentQR = null;
                currentPairingCode = null;
                connectedUser = Matrix.user;
                console.log(
                    chalk.greenBright.bold("🌟 ALG-MD-CONNECTED 🌟") +
                    chalk.white("\nStatus: ") + chalk.green("Successful ✅") +
                    chalk.cyanBright("\n🎉 Connected as: ") + chalk.yellow(Matrix.user?.name || Matrix.user?.id)
                );

                // Envoi du message de connexion interactif avec boutons vers le menu
                try {
                    await sendWelcomeMessage(Matrix, Matrix.user.id);
                } catch (err) {
                    console.error("Erreur envoi message de bienvenue:", err.message);
                }

                // Initialisation du briefing quotidien proactif
                try {
                    initDailyBriefing(Matrix);
                } catch (err) {
                    console.error("Erreur daily briefing:", err.message);
                }
                // Persistance automatique de la session dans .env
                await persistSessionToEnv();
            }
        });

        Matrix.ev.on('creds.update', async () => {
            await saveCreds();
            await persistSessionToEnv();
        });

        // Un seul listener messages.upsert pour éviter la concurrence et les ralentissements
        Matrix.ev.on("messages.upsert", async (chatUpdate) => {
            try {
                // Mise en cache des messages pour répondre aux requêtes de retry de déchiffrement WhatsApp (E2EE)
                for (const item of chatUpdate.messages || []) {
                    if (item.key?.id && item.message) {
                        sentMessagesCache.set(item.key.id, item.message);
                    }
                }

                // 1. Exécution du Handler principal (Commandes + Assistant IA + Menu)
                await Handler(chatUpdate, Matrix, logger);

                const msg = chatUpdate.messages?.[0];
                if (!msg?.message) return;

                // 2. Réaction automatique sur les messages normaux (si activé)
                if (!msg.key.fromMe && config.AUTO_REACT && emojis?.length) {
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    await doReact(randomEmoji, msg, Matrix).catch(() => {});
                }

                // 3. Statuts WhatsApp : Auto-vu et Auto-réaction
                if (msg.key.remoteJid === 'status@broadcast') {
                    if (config.AUTO_STATUS_SEEN) {
                        await Matrix.readMessages([msg.key]).catch(() => {});
                    }
                    const statusEmojis = ['💚', '🔥', '😊', '🎉', '👍', '💫', '🥳', '✨', '😎', '🌟', '❤️', '😂', '🤔', '😅', '🙌', '👏'];
                    const randomEmoji = statusEmojis[Math.floor(Math.random() * statusEmojis.length)];
                    await Matrix.sendMessage(
                        msg.key.remoteJid,
                        { react: { key: msg.key, text: randomEmoji } },
                        { statusJidList: [msg.key.participant, Matrix.user.id] }
                    ).catch(() => {});
                }
            } catch (err) {
                console.error("Erreur dans le traitement de messages.upsert :", err.message || err);
            }
        });

        Matrix.ev.on("call", async (json) => await Callupdate(json, Matrix));
        Matrix.ev.on("group-participants.update", async (messag) => await GroupUpdate(Matrix, messag));

        if (config.MODE === "public") {
            Matrix.public = true;
        } else if (config.MODE === "private") {
            Matrix.public = false;
        }

    } catch (error) {
        console.error('⚠️ [Erreur dans start]:', error.message || error);
        setTimeout(() => start(), 5000);
    }
}



async function init() {
    let hasValidSession = false;
    let hasAuthFiles = false;
    if (fs.existsSync(credsPath)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            if (creds && (creds.registered || creds.me)) {
                hasValidSession = true;
                hasAuthFiles = fs.readdirSync(sessionDir, { withFileTypes: true })
                    .some(entry => entry.isFile() && /^(session|pre-key|sender-key-memory)-.*\.json$/.test(entry.name));
            }
        } catch (_) {}
    }

    if (hasValidSession && hasAuthFiles) {
        console.log("🔒 Session enregistrée et fichiers de clés trouvés, démarrage du bot.");
        useQR = false;
        await start();
    } else {
        const sessionDownloaded = await downloadSessionData();
        if (sessionDownloaded) {
            console.log("🔒 Session téléchargée, démarrage du bot.");
            useQR = false;
            await start();
        } else if (hasValidSession) {
            console.warn("⚠️ Session locale sans fichiers de clés Baileys; démarrage avec la session locale, mais le chiffrement peut échouer.");
            useQR = false;
            await start();
        } else {
            console.log("Pas de session active enregistrée, initialisation de la connexion WhatsApp...");
            useQR = true;
            await start();
        }
    }
}

const botContext = {
    getMatrix: () => currentMatrix,
    getState: () => ({
        status: botStatus,
        phoneNumber: (config.PAIRING_NUMBER || process.env.PAIRING_NUMBER || "").trim(),
        pairingCode: currentPairingCode,
        rawQR: currentQR,
        user: connectedUser
    }),
    requestPairingCode: async (phoneNumber) => {
        if (!currentMatrix) throw new Error("Client WhatsApp non initialisé.");
        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (!cleanNumber || cleanNumber.length < 8) throw new Error("Numéro de téléphone invalide (minimum 8 chiffres avec indicatif).");
        botStatus = 'pairing';
        let code = await currentMatrix.requestPairingCode(cleanNumber);
        code = code?.match(/.{1,4}/g)?.join('-') || code;
        currentPairingCode = code;
        console.log(chalk.black.bgGreenBright(`\n════════════════════════════════════════════════`));
        console.log(chalk.black.bgGreenBright(`  🔑 CODE DE JUMELAGE GÉNÉRÉ : ${code}  `));
        console.log(chalk.black.bgGreenBright(`  Pour le numéro : +${cleanNumber}             `));
        console.log(chalk.black.bgGreenBright(`════════════════════════════════════════════════\n`));
        return code;
    },
    restartConnection: async () => {
        currentQR = null;
        currentPairingCode = null;
        botStatus = 'disconnected';
        connectedUser = null;
        if (currentMatrix) {
            try { currentMatrix.end(); } catch (_) {}
        }
        try {
            if (fs.existsSync(credsPath)) {
                const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
                if (!creds?.registered) {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                    fs.mkdirSync(sessionDir, { recursive: true });
                }
            }
        } catch (_) {}
        await start();
    }
};

setupWebDashboard(app, botContext);

init();

function startServer(portToTry) {
    const server = app.listen(portToTry, () => {
        console.log(`Server is running on port ${portToTry}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`⚠️ Port ${portToTry} déjà utilisé, basculement sur ${Number(portToTry) + 1}...`);
            startServer(Number(portToTry) + 1);
        } else {
            console.error('Express server error:', err.message);
        }
    });
}

startServer(PORT);
