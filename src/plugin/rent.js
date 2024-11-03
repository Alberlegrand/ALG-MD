import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { generateWAMessageFromContent, proto, makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import config from '../../config.cjs';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const sessionDir = path.resolve(__dirname, '../sessions');
const prefix = config.PREFIX || '.';

// Création du répertoire de session s'il n'existe pas
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir);
}

// Initialisation des sessions
const sessions = {};

// Charger une session existante pour un numéro
async function loadSession(phoneNumber) {
    const sessionPath = path.join(sessionDir, `${phoneNumber}.json`);
    try {
        const authState = await useMultiFileAuthState(sessionPath);
        return authState;
    } catch (err) {
        console.error(`Erreur de chargement de session pour ${phoneNumber}:`, err);
        return null;
    }
}

// Sauvegarder une session dans un fichier
async function saveSession(phoneNumber, authState) {
    const sessionPath = path.join(sessionDir, `${phoneNumber}.json`);
    try {
        await fs.writeFile(sessionPath, JSON.stringify(authState.creds, null, 2));
    } catch (err) {
        console.error(`Erreur de sauvegarde de session pour ${phoneNumber}:`, err);
    }
}

// Initialiser une session pour un numéro spécifique
async function initializeSession(phoneNumber) {
    const authState = await loadSession(phoneNumber);
    if (!authState) {
        console.error(`Session pour ${phoneNumber} non trouvée`);
        return null;
    }

    const socket = makeWASocket({ auth: authState.state });

    socket.ev.on('creds.update', async () => {
        await saveSession(phoneNumber, authState.state);
    });

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) initializeSession(phoneNumber);
        }
    });

    sessions[phoneNumber] = socket;
    return socket;
}

// Commande pour ajouter un nouveau semi-bot
async function addSemiBot(phoneNumber) {
    if (sessions[phoneNumber]) {
        return `Le numéro ${phoneNumber} est déjà activé en tant que semi-bot.`;
    }

    const socket = await initializeSession(phoneNumber);
    if (!socket) {
        return `Échec de l'activation du semi-bot pour le numéro ${phoneNumber}.`;
    }
    return `Le numéro ${phoneNumber} est activé en tant que semi-bot.`;
}

// Commande du semi-bot pour gérer les actions avec le préfixe
async function handleSemiBotCommand(socket, m) {
    const { from, body } = m;
    const [cmd, ...args] = body.trim().split(' ');

    if (!cmd.startsWith(prefix)) return;

    const command = cmd.slice(prefix.length).toLowerCase();
    const prompt = args.join(' ');

    try {
        switch (command) {
            case 'task':
                await socket.sendMessage(from, { text: `Tâche demandée : ${prompt}` });
                break;
            case 'status':
                await socket.sendMessage(from, { text: 'Je suis un semi-bot en ligne.' });
                break;
            default:
                await socket.sendMessage(from, { text: "Commande non reconnue." });
        }
    } catch (error) {
        console.error(`Erreur lors de la commande ${command}:`, error);
        await socket.sendMessage(from, { text: "Erreur lors de l'exécution de la commande." });
    }
}

// Plugin principal pour l'ajout de semi-bots et les commandes
const semiBotPlugin = async (m, Matrix) => {
    const text = m.body.toLowerCase();
    const adminNumber = config.ADMIN_NUMBER;
    const [cmd, phoneNumber] = text.split(' ');

    if (m.sender === adminNumber && cmd === `${prefix}addbot` && phoneNumber) {
        try {
            const response = await addSemiBot(phoneNumber);
            await Matrix.sendMessage(m.from, { text: response }, { quoted: m });
        } catch (error) {
            console.error('Erreur d’ajout de semi-bot:', error);
            await Matrix.sendMessage(m.from, { text: "Erreur lors de l'ajout du semi-bot." }, { quoted: m });
        }
        return;
    }

    if (sessions[m.sender]) {
        const socket = sessions[m.sender];
        await handleSemiBotCommand(socket, m);
    } else {
        await Matrix.sendMessage(m.from, { text: "Vous n'êtes pas autorisé à utiliser cette commande." }, { quoted: m });
    }
};

export default semiBotPlugin;