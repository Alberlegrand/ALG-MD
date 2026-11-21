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
import { fileURLToPath } from 'url';
import express from 'express';
import pino from 'pino';
import fs from 'fs';
import NodeCache from 'node-cache';
import path from 'path';
import chalk from 'chalk';
import moment from 'moment-timezone';
import axios from 'axios';
import config from './config.cjs';
import pkg from './lib/autoreact.cjs';
const { emojis, doReact } = pkg;

const sessionName = "session";
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

const MAIN_LOGGER = pino({
    timestamp: () => `,"time":"${new Date().toJSON()}"`
});
const logger = MAIN_LOGGER.child({});
logger.level = "trace";

const msgRetryCounterCache = new NodeCache();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sessionDir = path.join(__dirname, 'session');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

async function downloadSessionData() {
    if (!config.SESSION_ID || config.SESSION_ID === "Your Session Id" || config.SESSION_ID.trim() === "") {
        return false;
    }

    try {
        const rawSession = config.SESSION_ID.trim();

        // 1. Session déjà au format JSON brut
        if (rawSession.startsWith('{') && rawSession.endsWith('}')) {
            await fs.promises.writeFile(credsPath, rawSession);
            console.log("🔒 Session JSON chargée directement avec succès !");
            return true;
        }

        // 2. Format avec préfixe (ex: ALG-MD&...)
        const sessdata = rawSession.includes("ALG-MD&") ? rawSession.split("ALG-MD&")[1] : rawSession;

        // 3. Essayer de décoder en Base64
        try {
            const decoded = Buffer.from(sessdata, 'base64').toString('utf-8');
            if (decoded.startsWith('{') && decoded.endsWith('}')) {
                await fs.promises.writeFile(credsPath, decoded);
                console.log("🔒 Session Base64 décodée et chargée avec succès !");
                return true;
            }
        } catch (_) {}

        // 4. Téléchargement depuis Pastebin en fallback
        const url = sessdata.startsWith('http') ? sessdata : `https://pastebin.com/raw/${sessdata}`;
        console.log("Téléchargement de la session depuis :", url);
        const response = await axios.get(url, { timeout: 10000 });
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        await fs.promises.writeFile(credsPath, data);
        console.log("🔒 Session téléchargée et chargée avec succès !");
        return true;
    } catch (error) {
        console.error('Erreur lors du chargement de la session:', error.message || error);
        return false;
    }
}

async function start() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
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

        const pairingNumber = (config.PAIRING_NUMBER || process.env.PAIRING_NUMBER || "").trim();
        const shouldPair = Boolean(pairingNumber && !state.creds?.registered);

        const Matrix = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: true,
            browser: Browsers.macOS('Desktop'),
            auth: state,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            getMessage: async () => ({ conversation: "ALG-MD whatsapp user bot" })
        });
        currentMatrix = Matrix;

        Matrix.ev.on('connection.update', (update) => {
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
                console.log(chalk.yellow(`⚠️ Connexion fermée (${lastDisconnect?.error?.message || statusCode}). Reconnexion : ${!isLoggedOut}`));
                
                // IMPORTANT : Ne JAMAIS supprimer la session lors d'un restart de jumelage (code 515).
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

                setTimeout(() => start(), 3000);
            } else if (connection === 'open') {
                botStatus = 'connected';
                currentQR = null;
                currentPairingCode = null;
                connectedUser = Matrix.user;
                if (initialConnection) {

                    // Message de connexion dans la console
                    console.log(
                        chalk.greenBright.bold("🌟 ALG-MD-CONNECTED 🌟") +
                        chalk.white("\nStatus: ") + chalk.green("Successful ✅") +
                        chalk.cyanBright("\n🎉 JOIN FOR MORE UPDATES 🎉") +
                        chalk.blue("\n📢 Channel: ") + chalk.underline.blue("https://whatsapp.com/channel/0029VaDAkV9FHWqAMMHvb40b")
                    );

                    // Envoi du message de connexion dans Matrix
                    Matrix.sendMessage(Matrix.user.id, {
                        text: `🌟 ALG-MD-CONNECTED 🌟\nStatus: Successful ✅\n🎉 JOIN FOR MORE UPDATES 🎉\n📢 Channel: https://whatsapp.com/channel/0029VaDAkV9FHWqAMMHvb40b`
                    });

                    // Initialisation du briefing quotidien proactif
                    initDailyBriefing(Matrix);

                    initialConnection = false;
                } else {
                    console.log(chalk.blue("♻️ Connection reestablished after restart."));
                }
            }
        });

        Matrix.ev.on('creds.update', saveCreds);

        Matrix.ev.on("messages.upsert", async chatUpdate => await Handler(chatUpdate, Matrix, logger));
        Matrix.ev.on("call", async (json) => await Callupdate(json, Matrix));
        Matrix.ev.on("group-participants.update", async (messag) => await GroupUpdate(Matrix, messag));

        if (config.MODE === "public") {
            Matrix.public = true;
        } else if (config.MODE === "private") {
            Matrix.public = false;
        }

        Matrix.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const alg = chatUpdate.messages[0];
                console.log(alg);
                if (!alg.key.fromMe && config.AUTO_REACT) {
                    console.log(alg);
                    if (alg.message) {
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        await doReact(randomEmoji, alg, Matrix);
                    }
                }
            } catch (err) {
                console.error('Error during auto reaction:', err);
            }
        });

       Matrix.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg?.message) return;

      // Réaction automatique sur les statuts
      if (msg.key.remoteJid === 'status@broadcast') {
        const emojis = ['💚', '🔥', '😊', '🎉', '👍', '💫', '🥳', '✨', '😎', '🌟', '❤️', '😂', '🤔', '😅', '🙌', '👏'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        try {
          await Matrix.sendMessage(
            msg.key.remoteJid,
            { react: { key: msg.key, text: randomEmoji } },
            { statusJidList: [msg.key.participant, Matrix.user.id] }
          );
          console.log(`✅ Réaction envoyée sur statut : ${randomEmoji}`);
        } catch (err) {
          console.error("❌ Erreur lors de l'envoi de la réaction statut:", err.message);
        }
      }
    });

        Matrix.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                const alg = chatUpdate.messages[0];
                const fromJid = alg.key.participant || alg.key.remoteJid;
                if (!alg || !alg.message){
                    console.warn('Message vide, message système ou clé manquante, aucune action.');
                    return;
                }
               // if (alg.key.fromMe) return;
                if (alg.message?.protocolMessage || alg.message?.ephemeralMessage || alg.message?.reactionMessage) return;
                if (alg.key && alg.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_SEEN) {
                    await Matrix.readMessages([alg.key]);

                    if (config.AUTO_STATUS_REPLY) {
                        const customMessage = config.STATUS_READ_MSG || '✅ Auto Status Seen Bot By ALG-MD';
                        //await Matrix.sendMessage(fromJid, { text: customMessage }, { quoted: alg });
                    }
                }
            } catch (err) {
                console.error('Error handling messages.upsert event:', err);
            }
        });

    } catch (error) {
        console.error('⚠️ [Erreur dans start]:', error.message || error);
        setTimeout(() => start(), 5000);
    }
}



async function init() {
    let hasValidSession = false;
    if (fs.existsSync(credsPath)) {
        try {
            const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            if (creds && creds.registered) {
                hasValidSession = true;
                console.log("🔒 Session enregistrée trouvée, démarrage du bot.");
            }
        } catch (_) {}
    }

    if (hasValidSession) {
        await start();
    } else {
        const sessionDownloaded = await downloadSessionData();
        if (sessionDownloaded) {
            console.log("🔒 Session téléchargée, démarrage du bot.");
            await start();
        } else {
            console.log("Pas de session active enregistrée, initialisation de la connexion WhatsApp...");
            useQR = true;
            await start();
        }
    }
}

const botContext = {
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
