const fs = require('fs-extra');

// Charger les variables d'environnement depuis un fichier .env s'il existe
if (fs.existsSync('.env')) {
    require('dotenv').config({ path: __dirname + '/.env' });
}

// Configuration globale
const config = {
    audio: process.env.AUDIO || "",
    video: process.env.VIDEO || "",
    port: process.env.PORT || 3000,
    appUrl: process.env.APP_URL || "",
    email: process.env.EMAIL || "hitdeveloper2023@gmail.com",
    location: process.env.LOCATION || "Port-au-Prince, Haiti",
    mongodb: process.env.MONGODB_URI || "",
    allowJids: process.env.ALLOW_JID || "null",
    blockJids: process.env.BLOCK_JID || "null",
    DATABASE_URL: process.env.DATABASE_URL || "",
    timezone: process.env.TZ || process.env.TIME_ZONE || "America/Port-au-Prince",
    github: process.env.GITHUB || "https://github.com/HITDeveloper2023/HITDEV-MD",
    gurl: process.env.GURL || "https://whatsapp.com/channel/0029VaDAkV9FHWqAMMHvb40b",
    website: process.env.WEBSITE || "https://whatsapp.com/channel/0029VaDAkV9FHWqAMMHvb40b",
    THUMB_IMAGE: process.env.THUMB_IMAGE || "https://telegra.ph/file/09bb04e12ce3828e9cd2e.jpg",
    devs: process.env.DEVS || "50944727644",
    sudo: process.env.SUDO ? process.env.SUDO.replace(/[\s+]/g, '') : "null",
    owner: process.env.OWNER_NUMBER ? process.env.OWNER_NUMBER.replace(/[\s+]/g, '') : "50947989665",

    // Bot settings
    style: process.env.STYLE || '5',
    flush: process.env.FLUSH || "false",
    gdbye: process.env.GOODBYE || "false",
    wlcm: process.env.WELCOME || "false",
    warncount: process.env.WARN_COUNT || 3,
    disablepm: process.env.DISABLE_PM || "false",
    disablegroup: process.env.DISABLE_GROUPS || "false",
    MsgsInLog: process.env.MSGS_IN_LOG || "false",
    userImages: process.env.USER_IMAGES || "text",
    waPresence: process.env.WAPRESENCE || "null",

    // Auto read messages & commands
    readcmds: process.env.READ_COMMAND || "false",
    readmessage: process.env.READ_MESSAGE || "false",
    readmessagefrom: process.env.READ_MESSAGE_FROM || "null,923xxxxxxxx",

    // Auto save & read status
    read_status: process.env.AUTO_READ_STATUS || "false",
    save_status: process.env.AUTO_SAVE_STATUS || "false",
    save_status_from: process.env.SAVE_STATUS_FROM || "null,923xxxxxxxx",
    read_status_from: process.env.READ_STATUS_FROM || "50944727644,923xxxxxxxx",

    api_smd: process.env.API_SMD || "https://api-smd.onrender.com",
    scan: process.env.SCAN_URL || "https://hitdev-md-vtsf.onrender.com",
    SESSION_ID: process.env.SESSION_ID || "",

    // Additional settings
    menu: process.env.MENU || "",
    HANDLERS: process.env.PREFIX || ".",
    HANDLERS: process.env.PLUGINS || "5",
    BRANCH: process.env.BRANCH || "main",
    VERSION: process.env.VERSION || "1.0",
    caption: process.env.CAPTION || "『© 𝐇𝐀𝐈𝐓𝐈𝐀𝐍 𝐈𝐓 𝐃𝐞𝐯𝐞𝐥𝐨𝐩𝐞𝐫』",
    author: process.env.PACK_AUTHOR || "",
    packname: process.env.PACK_NAME || "",
    botname: process.env.BOT_NAME || "MARKET-EXPRESS",
    ownername: process.env.OWNER_NAME || "𝐌𝐫 𝐀𝐥𝐛𝐞𝐫𝐧𝐨",
    errorChat: process.env.ERROR_CHAT || "",
    KOYEB_API: process.env.KOYEB_API || "false",
    REMOVE_BG_KEY: process.env.REMOVE_BG_KEY || "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    HEROKU_API_KEY: process.env.HEROKU_API_KEY || "",
    HEROKU_APP_NAME: process.env.HEROKU_APP_NAME || "",
    antilink_values: process.env.ANTILINK_VALUES || "all",
    HEROKU: process.env.HEROKU_APP_NAME && process.env.HEROKU_API_KEY,

    WORKTYPE: process.env.WORKTYPE || process.env.MODE || "private",
    LANG: (process.env.THEME || "HITDEV").toUpperCase(),

    ELEVENLAB_API_KEY: process.env.ELEVENLAB_API_KEY || "",
    aitts_Voice_Id: process.env.AITTS_ID || "37",
    rank: "updated",
    isMongodb: false
};

// Exporter la configuration
module.exports = config;

// Watch for changes to this file and reload the configuration
let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log(`Configuration file '${__filename}' updated.`);
    delete require.cache[file];
    require(file);
});
