import { promises as fs } from 'fs';
import path from 'path';
import config from '../../config.cjs'; // Pour obtenir le préfixe et autres configurations

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const registeredUsersFile = path.resolve(__dirname, '../registered_users.json'); // Fichier pour stocker les utilisateurs enregistrés

// Lecture et écriture de la liste des utilisateurs enregistrés
async function readRegisteredUsers() {
    try {
        const data = await fs.readFile(registeredUsersFile, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

async function writeRegisteredUsers(users) {
    try {
        await fs.writeFile(registeredUsersFile, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('Erreur lors de l\'écriture du fichier des utilisateurs enregistrés :', err);
    }
}

async function addUser(user) {
    const users = await readRegisteredUsers();
    if (!users[user]) {
        users[user] = { status: "semi-bot" };
        await writeRegisteredUsers(users);
        return `Utilisateur ${user} enregistré comme semi-bot.`;
    } else {
        return `Utilisateur ${user} est déjà enregistré.`;
    }
}

async function handleCommand(m, Matrix) {
    const users = await readRegisteredUsers();
    const prefix = config.PREFIX;
    const text = m.body.toLowerCase();

    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = m.body.match(commandRegex);
    const cmd = match ? match[1].toLowerCase() : '';
    const args = match ? m.body.slice(match[0].length).trim() : '';

    // Vérifier si l'utilisateur est enregistré
    if (!users[m.sender]) {
        await Matrix.sendMessage(m.from, { text: "Vous n'êtes pas autorisé à utiliser cette commande." }, { quoted: m });
        return;
    }

    // Commandes disponibles pour le semi-bot
    const validCommands = ['help', 'status', 'info'];

    if (validCommands.includes(cmd)) {
        switch (cmd) {
            case 'help':
                await Matrix.sendMessage(m.from, { text: 'Commandes disponibles : .status, .info' }, { quoted: m });
                break;
            case 'status':
                await Matrix.sendMessage(m.from, { text: `Votre statut : ${users[m.sender].status}` }, { quoted: m });
                break;
            case 'info':
                await Matrix.sendMessage(m.from, { text: "Je suis un assistant semi-bot pour des tâches spécifiques." }, { quoted: m });
                break;
            default:
                await Matrix.sendMessage(m.from, { text: "Commande non reconnue." }, { quoted: m });
        }
    } else if (cmd === 'register' && args) {
        const response = await addUser(args);
        await Matrix.sendMessage(m.from, { text: response }, { quoted: m });
    } else {
        await Matrix.sendMessage(m.from, { text: "Commande non autorisée ou non valide." }, { quoted: m });
    }
}

const semiBotPlugin = async (m, Matrix) => {
    try {
        await handleCommand(m, Matrix);
    } catch (err) {
        await Matrix.sendMessage(m.from, { text: "Erreur lors de l'exécution de la commande." }, { quoted: m });
        console.error('Erreur dans semiBotPlugin:', err);
    }
};

export default semiBotPlugin;