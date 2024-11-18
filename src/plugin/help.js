import moment from 'moment-timezone';
import fs from 'fs';
import os from 'os';
import pkg, { prepareWAMessageMedia } from '@whiskeysockets/baileys';
const { generateWAMessageFromContent, proto } = pkg;
import config from '../../config.cjs';

// Get total memory and free memory in bytes
const totalMemoryBytes = os.totalmem();
const freeMemoryBytes = os.freemem();

// Define unit conversions
const byteToKB = 1 / 1024;
const byteToMB = byteToKB / 1024;
const byteToGB = byteToMB / 1024;

// Function to format bytes to a human-readable format
function formatBytes(bytes) {
  if (bytes >= Math.pow(1024, 3)) {
    return (bytes * byteToGB).toFixed(2) + ' GB';
  } else if (bytes >= Math.pow(1024, 2)) {
    return (bytes * byteToMB).toFixed(2) + ' MB';
  } else if (bytes >= 1024) {
    return (bytes * byteToKB).toFixed(2) + ' KB';
  } else {
    return bytes.toFixed(2) + ' bytes';
  }
}

// Bot Process Time
const uptime = process.uptime();
const day = Math.floor(uptime / (24 * 3600)); // Calculate days
const hours = Math.floor((uptime % (24 * 3600)) / 3600); // Calculate hours
const minutes = Math.floor((uptime % 3600) / 60); // Calculate minutes
const seconds = Math.floor(uptime % 60); // Calculate seconds

// Uptime message
const uptimeMessage = `*I am alive now since ${day}d ${hours}h ${minutes}m ${seconds}s*`;
const runMessage = `*☀️ ${day} Day*\n*🕐 ${hours} Hour*\n*⏰ ${minutes} Minutes*\n*⏱️ ${seconds} Seconds*\n`;

const xtime = moment.tz("Africa/Moçambique").format("HH:mm:ss");
const xdate = moment.tz("Africa/Moçambique").format("DD/MM/YYYY");
const time2 = moment().tz("Africa/Moçambique").format("HH:mm:ss");
let pushwish = "";

// Determine time-based message
if (time2 < "05:00:00") {
  pushwish = `Good Morning 🌄`;
} else if (time2 < "11:00:00") {
  pushwish = `Good Morning 🌄`;
} else if (time2 < "15:00:00") {
  pushwish = `Good Afternoon 🌅`;
} else if (time2 < "18:00:00") {
  pushwish = `Good Evening 🌃`;
} else {
  pushwish = `Good Night 🌌`;
}

const test = async (m, Matrix) => {
  let selectedListId;
  const selectedButtonId = m?.message?.templateButtonReplyMessage?.selectedId;
  const interactiveResponseMessage = m?.message?.interactiveResponseMessage;

  // Retrieve selected button or list ID
  if (interactiveResponseMessage) {
    const paramsJson = interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson;
    if (paramsJson) {
      const params = JSON.parse(paramsJson);
      selectedListId = params.id;
    }
  }
  const selectedId = selectedListId || selectedButtonId;

  const prefix = config.PREFIX;
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

  const mode = config.MODE === 'public' ? 'public' : 'private';
  const pref = config.PREFIX;

  const validCommands = ['list', 'help', 'menu'];

  // Check if the command is valid
  if (validCommands.includes(cmd)) {
    const msg = generateWAMessageFromContent(m.from, {
      viewOnceMessage: {
        message: {
          "messageContextInfo": {
            "deviceListMetadata": {},
            "deviceListMetadataVersion": 2
          },
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({
              text: `╭─────────────━┈⊷
│🪀 ʙᴏᴛ ɴᴀᴍᴇ: *${config.BOT_NAME}* 
│🪀 ᴠᴇʀꜱɪᴏɴ: 2.2.0
│🪀 ᴏᴡɴᴇʀ : *${config.OWNER_NAME}*      
│🪀 ɴᴜᴍʙᴇʀ: ${config.OWNER_NUMBER}
│🪀 ᴘʟᴀᴛғᴏʀᴍ: *${os.platform()}*
│🪀 ᴍᴏᴅᴇ: *${mode}*
│🪀 ᴘʀᴇғɪx: [${pref}]
╰─────────────━┈⊷`
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: "©POWERED BY 𝐇𝐀𝐈𝐓𝐈𝐀𝐍 𝐈𝐓 𝐆𝐫𝐨𝐮𝐩𝐬"
            }),
            header: proto.Message.InteractiveMessage.Header.create({
              ...(await prepareWAMessageMedia({ image: fs.readFileSync('./src/hitdev.jpg') }, { upload: Matrix.waUploadToServer })),
              title: ``,
              gifPlayback: true,
              subtitle: "",
              hasMediaAttachment: false  
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: [
                {
                  "name": "quick_reply",
                  "buttonParamsJson": JSON.stringify({
                    display_text: "ALIVE",
                    id: `${prefix}alive`
                  })
                },
                {
                  "name": "quick_reply",
                  "buttonParamsJson": JSON.stringify({
                    display_text: "PING",
                    id: `${prefix}ping`
                  })
                },
                {
                  "name": "single_select",
                  "buttonParamsJson": `{"title":"𝚻𝚫𝚸 𝐅𝚯𝚪 𝚯𝚸𝚵𝚴 𝚳𝚵𝚴𝐔","sections":[{"title":"*️𝐇𝐀𝐈𝐓𝐈𝐀𝐍 𝐈𝐓 𝐆𝐫𝐨𝐮𝐩𝐬 ALLMENU️*","highlight_label":"️ALLMENU️","rows":[{"header":"","title":"*ALL MENU*","description":"️𝐇𝐀𝐈𝐓𝐈𝐀𝐍 𝐈𝐓 𝐆𝐫𝐨𝐮𝐩𝐬 ALLMENU️","id":"View All Menu"}]}}`
                }
              ]
            }),
          }),
        },
      },
    });

    await Matrix.relayMessage(msg.key.remoteJid, msg.message, {
      messageId: msg.key.id
    });
  }
};

export default test;

