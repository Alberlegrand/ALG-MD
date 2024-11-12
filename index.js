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
        console.error('Please add your session to SESSION_ID env !!');
        return false;
    }
    const sessdata = config.SESSION_ID.split("ALG-MD&")[1];
    const url = `https://pastebin.com/raw/${sessdata}`;
    try {
        const response = await axios.get(url);
        const data = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        await fs.promises.writeFile(credsPath, data);
        console.log("🔒 Session Successfully Loaded !!");
        return true;
    } catch (error) {
       // console.error('Failed to download session data:', error);
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

Matrix.ev.on('messages.upsert', async (update) => {
const msg = update.messages[0];
if (msg.key.remoteJid === 'status@broadcast') {
const me = await  Matrix.user.id
await Matrix.sendMessage(msg.key.remoteJid, { react: { key: msg.key, text: '❤️'}}, { statusJidList: [msg.key.participant, me] });
}
});


Matrix.ev.on('messages.upsert', async (chatUpdate) => {
    try {
        const alg = chatUpdate.messages[0];
        if (!alg || !alg.message) return;
        if (alg.key.fromMe) return;
        
        // Si le message est un statut et qu'il est configuré pour être vu automatiquement
        if (alg.key && alg.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_SEEN) {
            // Récupère tous les contacts
            const contacts = await Matrix.store.contacts.all();
            
            // Parcours de chaque contact pour marquer le statut comme vu
            for (const contact of contacts) {
                const contactJid = contact.jid;
                
                if (contactJid && contactJid !== Matrix.user.jid) {  // Évite de se marquer soi-même
                    await Matrix.readMessages([{ remoteJid: 'status@broadcast', participant: contactJid }]);
                }
            }
            
        }
    } catch (err) {
        console.error('Erreur lors de la gestion de l’événement messages.upsert:', err);
    }
});

        
        Matrix.ev.on('messages.upsert', async (chatUpdate) => {
    try {
        const alg = chatUpdate.messages[0];
        const fromJid = alg.key.participant || alg.key.remoteJid;
        if (!alg || !alg.message) return;
        if (alg.key.fromMe) return;
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
