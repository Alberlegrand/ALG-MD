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

  // Vérifiez si le message vient des statuts
  if (msg.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_LIKE) {
    const me = await Matrix.user.id;

    // Tableau d'emojis pour les réactions aléatoires (plus de 20)
    const emojis = [
      '💚', '🔥', '😊', '🎉', '👍', '💫', '🥳', '✨', 
      '😎', '🌟', '❤️', '😂', '🤔', '😅', '🙌', '👏',
      '💪', '🤩', '🎶', '💜', '👀', '🤗', '🪄', '😋',
      '🤝', '🥰', '😻', '🆒', '🙈', '😇','🎈','😇','🥳','🧐','🥶','☠️','🤓','🤖','👽','🐼','🇭🇹'
    ];

    // Choisir un emoji aléatoire
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    // Envoyer la réaction
    await Matrix.sendMessage(
      msg.key.remoteJid,
      { react: { key: msg.key, text: randomEmoji } },
      { statusJidList: [msg.key.participant, me] }
    );
  }
});


// Anti-Delete - Simple et compatible
const textMessagesMap = new Map();
const mediaMessagesMap = new Map();

// Vérifie si l'Anti-Delete est activé dans la configuration
if (config.ANTI_DELETE) {
  Matrix.ev.on("messages.upsert", async (messageEvent) => {
    const { messages } = messageEvent;
    const newMessage = messages[0]; // Récupère le premier message

    // Ne rien faire si le message est vide
    if (!newMessage.message) return;

    const chatId = newMessage.key.remoteJid; // ID du chat

    // Ignorer les messages envoyés par le bot lui-même
    if (!newMessage.key.fromMe) {
      // Stocke les messages texte et médias pour détection ultérieure
      if (newMessage.message.conversation) {
        textMessagesMap.set(newMessage.key.id, newMessage);
      } else if (newMessage.message.imageMessage || newMessage.message.videoMessage ||
        newMessage.message.audioMessage || newMessage.message.documentMessage ||
        newMessage.message.stickerMessage) {
        mediaMessagesMap.set(newMessage.key.id, {
          type: newMessage.message.imageMessage ? "image" :
            newMessage.message.videoMessage ? "video" :
              newMessage.message.audioMessage ? "audio" :
                newMessage.message.documentMessage ? "document" : "sticker",
          fileUrl: newMessage.message.imageMessage?.url ||
            newMessage.message.videoMessage?.url ||
            newMessage.message.audioMessage?.url ||
            newMessage.message.documentMessage?.url ||
            newMessage.message.stickerMessage?.url,
          mimeType: newMessage.message.imageMessage?.mimetype ||
            newMessage.message.videoMessage?.mimetype ||
            newMessage.message.audioMessage?.mimetype ||
            newMessage.message.documentMessage?.mimetype || null,
        });
      }

      // Gère les messages supprimés
      if (newMessage.message.protocolMessage &&
        newMessage.message.protocolMessage.type === 0) {
        const deletedMessageKey = newMessage.message.protocolMessage.key;

        // Récupère les informations sur le message supprimé
        const deletedTextMessage = textMessagesMap.get(deletedMessageKey.id);
        const deletedMediaMessage = mediaMessagesMap.get(deletedMessageKey.id);
        const deleterId = deletedTextMessage?.key.participant || deletedTextMessage?.key.remoteJid || newMessage.key.remoteJid;

        if (deletedMediaMessage) {
          // Envoie une alerte pour les médias supprimés
          const alertText = `*[ANTI-DELETE]*\n\n*Supprimé par:* @${deleterId.split('@')[0]}\n*Type de message:* ${deletedMediaMessage.type}`;
          let mediaAlert = {};

          // Crée une réponse basée sur le type de média
          if (deletedMediaMessage.type === "image") {
            mediaAlert = { image: { url: deletedMediaMessage.fileUrl } };
          } else if (deletedMediaMessage.type === "video") {
            mediaAlert = { video: { url: deletedMediaMessage.fileUrl } };
          } else if (deletedMediaMessage.type === "audio") {
            mediaAlert = { audio: { url: deletedMediaMessage.fileUrl } };
          } else if (deletedMediaMessage.type === "document") {
            mediaAlert = { document: { url: deletedMediaMessage.fileUrl } };
          } else if (deletedMediaMessage.type === "sticker") {
            mediaAlert = { sticker: { url: deletedMediaMessage.fileUrl } };
          }

          await Matrix.sendMessage(chatId, {
            text: alertText,
            mentions: [deleterId],
            ...mediaAlert,
          });

          mediaMessagesMap.delete(deletedMessageKey.id);
        } else if (deletedTextMessage) {
          // Envoie une alerte pour les messages texte supprimés
          const alertText = `*[ANTI-DELETE]*\n\n*Supprimé par:* @${deleterId.split('@')[0]}\n*Message supprimé:* ${deletedTextMessage.message.conversation || "Inconnu"}`;

          await Matrix.sendMessage(chatId, {
            text: alertText,
            mentions: [deleterId],
          });

          textMessagesMap.delete(deletedMessageKey.id);
        }
      }
    }
  });
}




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
