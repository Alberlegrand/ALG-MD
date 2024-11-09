import moment from 'moment-timezone';
import fs from 'fs';
import os from 'os';
import pkg, { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import config from '../../config.cjs';

const { generateWAMessageFromContent, proto } = pkg;

// 1. Constants and Configurations
const PREFIX = config.PREFIX;
const MODE = config.MODE === 'public' ? 'public' : 'private';

// Utilisation d'une fonction pour l'envoi d'erreurs
async function sendErrorMessage(Matrix, m, error) {
  const errorMsg = `❌ Une erreur s'est produite : ${error.message}`;
  await Matrix.sendMessage(m.from, { text: errorMsg });
}

// 2. Memory and Uptime Information
function formatBytes(bytes) {
  try {
    if (bytes >= Math.pow(1024, 3)) return (bytes / Math.pow(1024, 3)).toFixed(2) + ' GB';
    if (bytes >= Math.pow(1024, 2)) return (bytes / Math.pow(1024, 2)).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' bytes';
  } catch (error) {
    console.error('Erreur dans formatBytes:', error);
    throw error; // Relancer pour capturer dans le bloc appelant
  }
}

function getUptimeMessage() {
  try {
    const uptime = process.uptime();
    const day = Math.floor(uptime / (24 * 3600));
    const hours = Math.floor((uptime % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return {
      text: `*I am alive now since ${day}d ${hours}h ${minutes}m ${seconds}s*`,
      detailed: `*☀️ ${day} Day*\n*🕐 ${hours} Hour*\n*⏰ ${minutes} Minutes*\n*⏱️ ${seconds} Seconds*\n`
    };
  } catch (error) {
    console.error('Erreur dans getUptimeMessage:', error);
    throw error;
  }
}

function getGreeting() {
  try {
    const timeNow = moment().tz("Port-au-Prince, Haiti").format("HH:mm:ss");
    if (timeNow < "05:00:00") return "Good Morning 🌄";
    if (timeNow < "11:00:00") return "Good Morning 🌄";
    if (timeNow < "15:00:00") return "Good Afternoon 🌅";
    if (timeNow < "18:00:00") return "Good Evening 🌃";
    return "Good Night 🌌";
  } catch (error) {
    console.error('Erreur dans getGreeting:', error);
    throw error;
  }
}

// 3. Main Function
const test = async (m, Matrix) => {
  try {
    // Initialisation des paramètres
    let selectedListId;
    const selectedButtonId = m?.message?.templateButtonReplyMessage?.selectedId;
    const interactiveResponseMessage = m?.message?.interactiveResponseMessage;

    if (interactiveResponseMessage) {
      const paramsJson = interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
      if (paramsJson) {
        selectedListId = JSON.parse(paramsJson).id;
      }
    }

    const selectedId = selectedListId || selectedButtonId;

    // Extraction de la commande
    const match = m.body.match(new RegExp(`^${PREFIX}\\s*(\\w+)`, 'i'));
    const cmd = match ? match[1].toLowerCase() : '';

    // Commandes valides
    const validCommands = ['list', 'help', 'menu'];

    if (validCommands.includes(cmd)) {
      const uptimeMsg = getUptimeMessage();
      const msgContent = await generateWAMessageFromContent(m.from, {
        viewOnceMessage: {
          message: {
            interactiveMessage: proto.Message.InteractiveMessage.create({
              body: proto.Message.InteractiveMessage.Body.create({
                text: `╭─────────────━┈⊷
│🪀 ʙᴏᴛ ɴᴀᴍᴇ: *ALG-MD* 
│🪀 ᴠᴇʀꜱɪᴏɴ: 2.2.0
│🪀 ᴏᴡɴᴇʀ : *ALG-MD*      
│🪀 ɴᴜᴍʙᴇʀ: 50944727644
│🪀 ᴘʟᴀᴛғᴏʀᴍ: *${os.platform()}*
│🪀 ᴍᴏᴅᴇ: *${MODE}*
│🪀 ᴘʀᴇғɪx: [${PREFIX}]
╰─────────────━┈⊷`
              }),
              footer: proto.Message.InteractiveMessage.Footer.create({
                text: "©POWERED BY 𝐇𝐀𝐈𝐓𝐈𝐀𝐍 𝐈𝐓 𝐃𝐞𝐯𝐞𝐥𝐨𝐩𝐞𝐫"
              }),
              header: proto.Message.InteractiveMessage.Header.create({
                ...(await prepareWAMessageMedia({ image: fs.readFileSync('./src/hitdev.jpg') }, { upload: Matrix.waUploadToServer }))
              }),
              nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: [
                  { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "ALIVE", id: `${PREFIX}alive` }) },
                  { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PING", id: `${PREFIX}ping` }) },
                ]
              }),
              contextInfo: { quotedMessage: m.message, mentionedJid: [m.sender] }
            }),
          },
        },
      }, {});

      await Matrix.relayMessage(msgContent.key.remoteJid, msgContent.message, { messageId: msgContent.key.id });
    }

  } catch (error) {
    // Envoi de l'erreur sur WhatsApp
    await sendErrorMessage(Matrix, m, error);
  }
};

export default test;