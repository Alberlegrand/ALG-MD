import fs from 'fs';
import path from 'path';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import config from '../../config.cjs';

const sessions = {};  // Contient les sessions actives
const sessionDir = path.resolve(__dirname, '../sessions'); // Dossier pour stocker les sessions

// Fonction pour charger une session existante
async function loadSession(phoneNumber) {
    const sessionPath = path.join(sessionDir, `${phoneNumber}.json`);
    if (fs.existsSync(sessionPath)) {
        return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    }
    return null;
}

// Sauvegarder la session
function saveSession(phoneNumber, session) {
    const sessionPath = path.join(sessionDir, `${phoneNumber}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
}

// Initialiser une nouvelle session pour un numéro
async function initializeSession(phoneNumber) {
    const authState = await useMultiFileAuthState(path.join(sessionDir, phoneNumber));
    const socket = makeWASocket({ auth: authState.state });

    socket.ev.on('creds.update', () => saveSession(phoneNumber, authState.state.creds));
    socket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
            if (shouldReconnect) initializeSession(phoneNumber);
        }
    });

    sessions[phoneNumber] = socket;
    console.log(`Session initialisée pour ${phoneNumber}`);
}

// Ajouter un utilisateur en tant que "semi-bot"
async function addSemiBot(phoneNumber) {
    if (sessions[phoneNumber]) {
        return `Le numéro ${phoneNumber} est déjà activé en tant que semi-bot.`;
    }
    await initializeSession(phoneNumber);
    return `Le numéro ${phoneNumber} a été activé en tant que semi-bot.`;
}

// Fonction pour traiter les messages des "semi-bots"
async function handleSemiBotCommand(socket, message) {
    const { from, body } = message;
    const command = body.split(' ')[0].toLowerCase();

    if (command === '.task') {
        await socket.sendMessage(from, { text: 'Tâche exécutée par le semi-bot.' });
    } else if (command === '.status') {
        await socket.sendMessage(from, { text: 'Je suis un semi-bot en ligne.' });
    } else {
        await socket.sendMessage(from, { text: "Commande non reconnue." });
    }
}

// Plugin principal pour gérer l'ajout de "semi-bots"
const semiBotPlugin = async (m, Matrix) => {
    const text = m.body.toLowerCase();
    const adminNumber = config.ADMIN_NUMBER;

    if (m.sender === adminNumber) {
        const [cmd, phoneNumber] = text.split(' ');
        if (cmd === '.addbot' && phoneNumber) {
            const response = await addSemiBot(phoneNumber);
            await Matrix.sendMessage(m.from, { text: response }, { quoted: m });
            return;
        }
    }

    // Si l'utilisateur est un semi-bot, gérer ses commandes
    if (sessions[m.sender]) {
        const socket = sessions[m.sender];
        await handleSemiBotCommand(socket, m);
    } else {
        await Matrix.sendMessage(m.from, { text: "Vous n'êtes pas autorisé à utiliser cette commande." }, { quoted: m });
    }
};

// Exporter le plugin
export default semiBotPlugin;