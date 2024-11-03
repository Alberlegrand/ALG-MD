import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import config from '../../config.cjs';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const sessionDir = path.resolve(__dirname, '../sessions');
const prefix = config.PREFIX || '.';

// Vérifie que le répertoire de sessions existe, sinon le crée
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir);
}

// Objets de sessions pour suivre chaque instance de bot
const sessions = {};

// Fonction pour initialiser une session pour un numéro donné
async function initializeSession(phoneNumber) {
    const sessionPath = path.join(sessionDir, `${phoneNumber}`);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const socket = makeWASocket({ auth: state });

    // Écoute des événements de mise à jour des credentials et sauvegarde
    socket.ev.on('creds.update', saveCreds);

    // Gestion des événements de connexion
    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
            if (shouldReconnect) await initializeSession(phoneNumber);
        }
    });

    // Enregistrement de la session dans l'objet de sessions
    sessions[phoneNumber] = socket;
    return socket;
}

// Fonction pour ajouter un semi-bot
async function addSemiBot(phoneNumber) {
    if (sessions[phoneNumber]) {
        return `Le numéro ${phoneNumber} est déjà activé en tant que semi-bot.`;
    }
    
    try {
        const socket = await initializeSession(phoneNumber);
        return `Le numéro ${phoneNumber} est activé en tant que semi-bot.`;
    } catch (error) {
        console.error(`Erreur lors de l'initialisation du semi-bot pour ${phoneNumber}:`, error);
        return `Échec de l'activation du semi-bot pour le numéro ${phoneNumber}.`;
    }
}

// Gestion des commandes pour un semi-bot spécifique
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

// Plugin principal pour la gestion des semi-bots et des commandes
const semiBotPlugin = async (m, Matrix) => {
    const text = m.body.toLowerCase();
    const adminNumber = config.ADMIN_NUMBER;
    const [cmd, phoneNumber] = text.split(' ');

    // Commande pour ajouter un nouveau semi-bot (par l'admin uniquement)
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

    // Vérifie si le message est envoyé par un semi-bot et gère les commandes spécifiques
    if (sessions[m.sender]) {
        const socket = sessions[m.sender];
        await handleSemiBotCommand(socket, m);
    } else {
        await Matrix.sendMessage(m.from, { text: "Vous n'êtes pas autorisé à utiliser cette commande." }, { quoted: m });
    }
};

export default semiBotPlugin;