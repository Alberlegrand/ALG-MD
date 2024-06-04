// commands/menu.js
const os = require('os');
const config = require('../config');

module.exports = {
    execute: async (sock, message, args) => {
        try {
            const prettyBytes = (await import('pretty-bytes')).default;

            const uptime = process.uptime();
            const uptimeStr = new Date(uptime * 1000).toISOString().substr(11, 8);
            const time = new Date().toLocaleString('en-US', { timeZone: config.timezone });

            const menuMessage = `
                
            ╭────《  *${config.botname}*  》────⊷
            │ ╭──────✧❁✧──────◆
            │ │ Theme:- ALG
            │ │ Owner:- ${config.ownername}
            │ │ Plugins:- 5
            │ │ Uptime:- ${uptimeStr}
            │ │ OS: ${os.type()} ${os.release()}
            │ │ Time:- ${time}
            │ │ Date:- 
            │ ╰──────✧❁✧──────◆
            ╰══════════════════⊷
            `;
            await sock.sendMessage(message.key.remoteJid, { text: menuMessage });
        } catch (error) {
            console.error('Error in menu command:', error);
            await sock.sendMessage(message.key.remoteJid, { text: 'An error occurred while generating the menu.' });
        }
    }
};
