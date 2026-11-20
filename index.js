import dotenv from 'dotenv';
dotenv.config();

import {
    makeWASocket,
    Browsers,
    fetchLatestBaileysVersion,
    DisconnectReason,
    useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import { Handler, Callupdate, GroupUpdate } from './src/event/index.js';
import initDailyBriefing from './src/assistant/dailyBriefing.js';
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

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

const sessionDir = path.join(__dirname, 'session');
const credsPath = path.join(sessionDir, 'creds.json');

if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

async function downloadSessionData() {
    if (!config.SESSION_ID) {
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
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`🤖 ALG-MD using WA v${version.join('.')}, isLatest: ${isLatest}`);

        const Matrix = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: useQR,
            browser: ["ALG-MD", "safari", "3.3"],
            auth: state,
            getMessage: async (key) => {
                if (store) {
                    const msg = await store.loadMessage(key.remoteJid, key.id);
                    return msg.message || undefined;
                }
                return { conversation: "ALG-MD whatsapp user bot" };
            }
        });

        // Gestion du code de jumelage (Pairing Code)
        const pairingNumber = config.PAIRING_NUMBER || process.env.PAIRING_NUMBER;
        if (pairingNumber && !state.creds?.registered) {
            useQR = false;
            setTimeout(async () => {
                try {
                    let code = await Matrix.requestPairingCode(pairingNumber.replace(/[^0-9]/g, ''));
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    console.log(chalk.black.bgGreenBright(`\n🔑 CODE DE JUMELAGE WHATSAPP : ${code}\n`));
                    console.log(chalk.cyan(`👉 Entrez ce code dans WhatsApp > Appareils connectés > Lier avec un numéro de téléphone.\n`));
                } catch (err) {
                    console.error("Erreur lors de la demande du code de jumelage:", err.message || err);
                }
            }, 3000);
        }

        Matrix.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                    start();
                }
            } else if (connection === 'open') {
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
        console.error('Critical Error:', error);
        process.exit(1);
    }
}



async function init() {
    if (fs.existsSync(credsPath)) {
        console.log("🔒 Session file found, proceeding without QR code.");
        await start();
    } else {
        const sessionDownloaded = await downloadSessionData();
        if (sessionDownloaded) {
            console.log("🔒 Session downloaded, starting bot.");
            await start();
        } else {
            console.log("No session found or downloaded, QR code will be printed for authentication.");
            useQR = true;
            await start();
        }
    }
}

init();

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
