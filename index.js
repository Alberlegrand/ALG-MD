const config = require('./config');
const { DisconnectReason, makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const handleCommand = require('./commands');

async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if (connection === 'open') {
                console.log('opened connection');
                const myProfileJid = config.owner + '@s.whatsapp.net';
                await sock.sendMessage(myProfileJid, { text: 'Le bot est maintenant connecté.' });
            }
        });

        sock.ev.on('messages.upsert', async (m) => {
            try {
                console.log(JSON.stringify(m, undefined, 2));
                const message = m.messages[0];
                const remoteJid = message.key.remoteJid;
                const messageText = message.message?.conversation || message.message?.extendedTextMessage?.text;

                if (messageText && messageText.startsWith(config.HANDLERS)) {
                    await handleCommand(sock, message, messageText.slice(config.HANDLERS.length).trim());
                }
            } catch (error) {
                console.error('Error in message processing:', error);
                await sock.sendMessage(message.key.remoteJid, { text: 'An error occurred while processing your message.' });
            }
        });
    } catch (error) {
        console.error('Error in WhatsApp connection:', error);
    }
}

// Lancer la connexion à WhatsApp
connectToWhatsApp();
