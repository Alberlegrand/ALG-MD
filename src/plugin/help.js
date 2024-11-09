import moment from 'moment-timezone';
import fs from 'fs';
import os from 'os';
import pkg, { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import config from '../../config.cjs';

const { generateWAMessageFromContent, proto } = pkg;

// 1. Constants and Configurations
const PREFIX = config.PREFIX;
const MODE = config.MODE === 'public' ? 'public' : 'private';

// 2. Memory and Uptime Information
const totalMemoryBytes = os.totalmem();
const freeMemoryBytes = os.freemem();

const byteToKB = 1 / 1024;
const byteToMB = byteToKB / 1024;
const byteToGB = byteToMB / 1024;

function formatBytes(bytes) {
  try {
    if (bytes >= Math.pow(1024, 3)) return (bytes * byteToGB).toFixed(2) + ' GB';
    if (bytes >= Math.pow(1024, 2)) return (bytes * byteToMB).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes * byteToKB).toFixed(2) + ' KB';
    return bytes.toFixed(2) + ' bytes';
  } catch (error) {
    await Matrix.sendMessage(m.from, 'Erreur dans le formatage de la mémoire.', { quoted: m });
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
    await Matrix.sendMessage(m.from, 'Erreur dans le calcul de l\'uptime du bot.', { quoted: m });
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
    await Matrix.sendMessage(m.from, 'Erreur dans la génération du message de bienvenue.', { quoted: m });
  }
}

const test = async (m, Matrix) => {
  try {
    let selectedListId;
    const selectedButtonId = m?.message?.templateButtonReplyMessage?.selectedId;
    const interactiveResponseMessage = m?.message?.interactiveResponseMessage;

    if (interactiveResponseMessage) {
      const paramsJson = interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
      if (paramsJson) {
        try {
          const params = JSON.parse(paramsJson);
          selectedListId = params.id;
        } catch (error) {
          await Matrix.sendMessage(m.from, 'Erreur de parsing des paramètres.', { quoted: m });
        }
      }
    }

    const selectedId = selectedListId || selectedButtonId;
    const match = m.body.match(new RegExp(`^${PREFIX}\\s*(\\w+)`, 'i'));
    const cmd = match ? match[1].toLowerCase() : '';

    const validCommands = ['list', 'help', 'menu'];

    if (validCommands.includes(cmd)) {
      try {
        const uptimeMsg = getUptimeMessage();
        const msgContent = generateWAMessageFromContent(m.from, {
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
                  textMessage: proto.Message.TextMessage.create({
                    text: "Bienvenue sur ALG-MD",
                  }),
                }),
                contextInfo: { quotedMessage: m.message, mentionedJid: [m.sender] }
              }),
            },
          },
        }, {});

        await Matrix.relayMessage(msgContent.key.remoteJid, msgContent.message, { messageId: msgContent.key.id });
      } catch (error) {
        await Matrix.sendMessage(m.from, 'Erreur lors de l\'envoi du message interactif.', { quoted: m });
      }
    }

    if (selectedId === "View All Menu") {
      const greeting = getGreeting();
      const response = `hey ${m.pushName} ${greeting}
╭─────────────━┈⊷
│🪀 ʙᴏᴛ ɴᴀᴍᴇ: *ALG-MD*
│🪀 ᴠᴇʀꜱɪᴏɴ: 2.2.3
│🪀 ᴏᴡɴᴇʀ : *ALG*      
│🪀 ᴘʟᴀᴛғᴏʀᴍ: *${os.platform()}*
│🪀 ᴍᴏᴅᴇ: *${config.MODE}*
│🪀 ᴘʀᴇғɪx: [${PREFIX}]
╰─────────────━┈⊷ 
╭━❮ 𝙲𝙾𝙽𝚅𝙴𝚁𝚃𝙴𝚁 ❯━╮
✰ ${PREFIX}ATTP
✰ ${PREFIX}ATTP2
✰ ${PREFIX}ATTP3
...
╰━━━━━━━━━━━━━━━⪼`;
      await Matrix.sendMessage(m.from, response, { quoted: m });
    }
  } catch (error) {
    await Matrix.sendMessage(m.from, 'Erreur inattendue dans la fonction principale.', { quoted: m });
  }
};

export default test;