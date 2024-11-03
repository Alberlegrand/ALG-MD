import fs from 'fs';
import path from 'path';
import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import config from '../../config.cjs';

const sessions = {};  // Pour stocker toutes les sessions de semi-bots actives
const sessionDir = path.resolve(__dirname, '../sessions');  // Répertoire des fichiers de sessions
const prefix = config.PREFIX || '.';  // Préfixe prédéfini pour les commandes

// Création du répertoire de session s'il n'existe pas
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir);
}

// Fonction pour charger une session existante pour un numéro
async function loadSession(phoneNumber) {
    const sessionPath = path.join(sessionDir, `${phoneNumber}.json`);
    if (fs.existsSync(sessionPath)) {
        return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    }
    return null;
}

// Sauvegarder une session dans un fichier
function saveSession(phoneNumber, session) {
    const sessionPath = path.join(sessionDir, `${phoneNumber}.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
}

// Fonction pour gérer les erreurs
function handleError(error, Matrix, m) {
    console.error('Erreur:', error);
    Matrix.sendMessage(m.from, { text: "Une erreur est survenue, veuillez réessayer plus tard." }, { quoted: m });
}

// Fonction pour initialiser une session pour un numéro spécifique
async function initializeSession(phoneNumber) {
    try {
        const authState = await useMultiFileAuthState(path.join(sessionDir, phoneNumber));
        const socket = makeWASocket({ auth: authState.state });

        // Sauvegarde des mises à jour d'authentification
        socket.ev.on('creds.update', () => saveSession(phoneNumber, authState.state.creds));

        // Gestion de la connexion et reconnexion
        socket.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const shouldReconnect = lastDisconnect.error?.output?.statusCode !== 401;
                if (shouldReconnect) initializeSession(phoneNumber);
            }
        });

        // Stocker la session dans l'objet global
        sessions[phoneNumber] = socket;
        console.log(`Session initialisée pour ${phoneNumber}`);
    } catch (error) {
        console.error(`Erreur d'initialisation pour ${phoneNumber}:`, error);
    }
}

// Ajouter un "semi-bot" en créant une nouvelle session pour un numéro
async function addSemiBot(phoneNumber) {
    if (sessions[phoneNumber]) {
        return `Le numéro ${phoneNumber} est déjà activé en tant que semi-bot.`;
    }
    await initializeSession(phoneNumber);
    return `Le numéro ${phoneNumber} a été activé en tant que semi-bot.`;
}

// Fonction pour gérer les commandes des "semi-bots"
async function handleSemiBotCommand(socket, message) {
    const { from, body } = message;
    const [cmd, ...args] = body.trim().split(' ');

    // Vérification du préfixe prédéfini
    if (!cmd.startsWith(prefix)) return;

    // Extraction de la commande sans le préfixe
    const command = cmd.slice(prefix.length).toLowerCase();

    try {
        switch (command) {
            case 'task':
                await socket.sendMessage(from, { text: 'Tâche exécutée par le semi-bot.' });
                break;
            case 'status':
                await socket.sendMessage(from, { text: 'Je suis un semi-bot en ligne.' });
                break;
            default:
                await socket.sendMessage(from, { text: "Commande non reconnue." });
        }
    } catch (error) {
        console.error(`Erreur lors de l'exécution de la commande ${command}:`, error);
        await socket.sendMessage(from, { text: "Une erreur est survenue lors de l'exécution de la commande." });
    }
}

// Plugin principal pour gérer l'ajout de "semi-bots" et les commandes
const semiBotPlugin = async (m, Matrix) => {
    const text = m.body.toLowerCase();
    const adminNumber = config.ADMIN_NUMBER;

    // Commande pour ajouter un "semi-bot"
    if (m.sender === adminNumber) {
        const [cmd, phoneNumber] = text.split(' ');
        
        if (cmd === `${prefix}addbot` && phoneNumber) {
            try {
                const response = await addSemiBot(phoneNumber);
                await Matrix.sendMessage(m.from, { text: response }, { quoted: m });
            } catch (error) {
                handleError(error, Matrix, m);
            }
            return;
        }
    }

    // Vérifier si l'expéditeur est un semi-bot et gérer ses commandes
    if (sessions[m.sender]) {
        const socket = sessions[m.sender];
        await handleSemiBotCommand(socket, m);
    } else {
        await Matrix.sendMessage(m.from, { text: "Vous n'êtes pas autorisé à utiliser cette commande." }, { quoted: m });
    }
};

// Exporter le plugin
export default semiBotPlugin;