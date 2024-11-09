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

// Format bytes to human-readable format
function formatBytes(bytes) {
  if (bytes >= Math.pow(1024, 3)) return (bytes * byteToGB).toFixed(2) + ' GB';
  if (bytes >= Math.pow(1024, 2)) return (bytes * byteToMB).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes * byteToKB).toFixed(2) + ' KB';
  return bytes.toFixed(2) + ' bytes';
}

// Calculate bot uptime
function getUptimeMessage() {
  const uptime = process.uptime();
  const day = Math.floor(uptime / (24 * 3600));
  const hours = Math.floor((uptime % (24 * 3600)) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  return {
    text: `*I am alive now since ${day}d ${hours}h ${minutes}m ${seconds}s*`,
    detailed: `*☀️ ${day} Day*\n*🕐 ${hours} Hour*\n*⏰ ${minutes} Minutes*\n*⏱️ ${seconds} Seconds*\n`
  };
}

// 3. Time-based Greetings
function getGreeting() {
  const timeNow = moment().tz("Port-au-Prince, Haiti").format("HH:mm:ss");
  if (timeNow < "05:00:00") return "Good Morning 🌄";
  if (timeNow < "11:00:00") return "Good Morning 🌄";
  if (timeNow < "15:00:00") return "Good Afternoon 🌅";
  if (timeNow < "18:00:00") return "Good Evening 🌃";
  return "Good Night 🌌";
}

// 4. Main Function
const test = async (m, Matrix) => {
  // Get selected button ID or list ID from message
  let selectedListId;
  const selectedButtonId = m?.message?.templateButtonReplyMessage?.selectedId;
  const interactiveResponseMessage = m?.message?.interactiveResponseMessage;

  if (interactiveResponseMessage) {
    const paramsJson = interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
    if (paramsJson) {
      const params = JSON.parse(paramsJson);
      selectedListId = params.id;
    }
  }

  const selectedId = selectedListId || selectedButtonId;
  const cmd = m.body.startsWith(PREFIX) ? m.body.slice(PREFIX.length).split(' ')[0].toLowerCase() : '';
  const validCommands = ['list', 'help', 'menu'];

  // Handle valid commands
  if (validCommands.includes(cmd)) {
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
              ...(await prepareWAMessageMedia({ image: fs.readFileSync('./src/hitdev.jpg') }, { upload: Matrix.waUploadToServer }))
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: [
                { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "ALIVE", id: `${PREFIX}alive` }) },
                { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PING", id: `${PREFIX}ping` }) },
                { name: "single_select", buttonParamsJson: JSON.stringify({ title: "𝚻𝚫𝚸 𝐅𝚯𝚪 𝚯𝚸𝚵𝚴 𝚳𝚵𝚴𝐔", sections: [{ title: "*️𝐇𝐀𝐈𝐓𝐈𝐀𝐍 𝐈𝐓 𝐃𝐞𝐯𝐞𝐥𝐨𝐩𝐞𝐫 ALLMENU️*", rows: [ /* menu items */ ] }]}),
              ]
            }),
            contextInfo: { quotedMessage: m.message, mentionedJid: [m.sender] }
          }),
        },
      },
    }, {});

    await Matrix.relayMessage(msgContent.key.remoteJid, msgContent.message, { messageId: msgContent.key.id });
  }

  // Respond based on selected item
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
    await Matrix.sendMessage(response);
  }
};

export default test;