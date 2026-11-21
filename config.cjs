// config.js
const fs = require("fs");
try {
    require("dotenv").config();
} catch (_) {
    if (fs.existsSync(".env")) {
        const envContent = fs.readFileSync(".env", "utf8");
        envContent.split(/\r?\n/).forEach(line => {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match && !process.env[match[1]]) {
                let value = (match[2] || "").trim();
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                process.env[match[1]] = value;
            }
        });
    }
}

const config = {
  SESSION_ID: process.env.SESSION_ID || "",
  PREFIX: process.env.PREFIX || '.',
  AUTO_STATUS_SEEN: process.env.AUTO_STATUS_SEEN !== undefined ? process.env.AUTO_STATUS_SEEN === 'true' : true,
  AUTO_STATUS_LIKE: process.env.AUTO_STATUS_LIKE !== undefined ? process.env.AUTO_STATUS_LIKE === 'true' : true, 
  AUTO_STATUS_REPLY: process.env.AUTO_STATUS_REPLY !== undefined ? process.env.AUTO_STATUS_REPLY === 'true' : true,
  STATUS_READ_MSG: process.env.STATUS_READ_MSG || '',
  AUTO_DL: process.env.AUTO_DL !== undefined ? process.env.AUTO_DL === 'true' : false,
  AUTO_READ: process.env.AUTO_READ !== undefined ? process.env.AUTO_READ === 'true' : false,
  AUTO_TYPING: process.env.AUTO_TYPING !== undefined ? process.env.AUTO_TYPING === 'true' : false,
  AUTO_RECORDING: process.env.AUTO_RECORDING !== undefined ? process.env.AUTO_RECORDING === 'true' : false,
  ALWAYS_ONLINE: process.env.ALWAYS_ONLINE !== undefined ? process.env.ALWAYS_ONLINE === 'true' : false,
ANTI_DELETE: process.env.ANTI_DELETE !== undefined ? process.env.ANTI_DELETE === 'true' : false,
  AUTO_REACT: process.env.AUTO_REACT !== undefined ? process.env.AUTO_REACT === 'true' : false,
  AUTO_BLOCK: process.env.AUTO_BLOCK !== undefined ? process.env.AUTO_BLOCK === 'true' : true,
ADMIN_NUMBER: process.env.ADMIN_NUMBER || "50944727644",
  REJECT_CALL: process.env.REJECT_CALL !== undefined ? process.env.REJECT_CALL === 'true' : false, 
  NOT_ALLOW: process.env.NOT_ALLOW !== undefined ? process.env.NOT_ALLOW === 'true' : true,
  MODE: process.env.MODE || "public",
  OWNER_NAME: process.env.OWNER_NAME || "✪⏤͟͞★⃝ꪶ‎ 𝐌𝐫 𝐀𝐥𝐛𝐞𝐫𝐧𝐨𖥘✪͜͡➺",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "509444727644",
  PAIRING_NUMBER: process.env.PAIRING_NUMBER || "",
  GEMINI_KEY: process.env.GEMINI_KEY || process.env.GEMINI_API_KEY || "",
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "",
  AI_ASSISTANT_ENABLED: process.env.AI_ASSISTANT_ENABLED !== undefined ? process.env.AI_ASSISTANT_ENABLED === 'true' : true,
  AI_ASSISTANT_NAME: process.env.AI_ASSISTANT_NAME || "ALG Assistant",
  AI_MODEL: process.env.AI_MODEL || "gemini-1.5-flash",
  MORNING_BRIEFING: process.env.MORNING_BRIEFING !== undefined ? process.env.MORNING_BRIEFING === 'true' : false,
  BRIEFING_TIME: process.env.BRIEFING_TIME || "30 7 * * *",
  WELCOME: process.env.WELCOME !== undefined ? process.env.WELCOME === 'true' : false, 
};


module.exports = config;
