import { promises as fs } from 'fs';
import path from 'path';
import config from '../../config.cjs';
import { sleep } from '../lib';
import pkg from '@whiskeysockets/baileys';

const { generateWAMessageFromContent, proto } = pkg;
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const hackProgressFile = path.resolve(__dirname, '../hack_progress.json');

// Fonction pour lire l'état de progression de piratage
async function readHackProgress() {
    try {
        const data = await fs.readFile(hackProgressFile, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return {}; // retourne un objet vide si le fichier n'existe pas encore
    }
}

// Fonction pour écrire la progression de piratage
async function writeHackProgress(progress) {
    try {
        await fs.writeFile(hackProgressFile, JSON.stringify(progress, null, 2));
    } catch (err) {
        console.error('Erreur d\'écriture du fichier de progression:', err);
    }
}

// Fonction pour mettre à jour la progression de piratage
async function updateHackProgress(progress, sender, stage) {
    if (!progress[sender]) {
        progress[sender] = [];
    }
    progress[sender].push(stage);
    if (progress[sender].length > 10) {
        progress[sender].shift();
    }
    await writeHackProgress(progress);
}

// Fonction principale pour le plugin de piratage
const hackPlugin = async (m, Matrix) => {
    const progress = await readHackProgress();
    const text = m.body.toLowerCase();

    const prefix = config.PREFIX;
    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = m.body.match(commandRegex);

    const cmd = match ? match[1].toLowerCase() : '';
    const prompt = match ? m.body.slice(match[0].length).trim() : '';

    // On vérifie que la commande est bien "hack"
    if (cmd === 'hack') {
        await m.React("💻");

        // Initialisation de l'animation de piratage
        const hackSteps = [
            "Injecting Malware...",
            " █ 10%", " █ █ 20%", " █ █ █ 30%", " █ █ █ █ 40%", " █ █ █ █ █ 50%",
            " █ █ █ █ █ █ 60%", " █ █ █ █ █ █ █ 70%", " █ █ █ █ █ █ █ █ 80%",
            " █ █ █ █ █ █ █ █ █ 90%", " █ █ █ █ █ █ █ █ █ █ 100%",
            "System hijacking in progress...",
            "Connecting to server: error 404 not found.",
            "Device successfully connected... Receiving data...",
            "Data hijacked from device: 100% completed.",
            "Erasing all evidence and cleaning up malware...",
            "HACKING COMPLETED",
            "SENDING LOG DOCUMENTS...",
            "SUCCESSFULLY SENT DATA AND DISCONNECTED."
        ];

        try {
            for (const step of hackSteps) {
                await Matrix.sendMessage(m.from, { text: step }, { quoted: m });
                await updateHackProgress(progress, m.sender, step); // Enregistre chaque étape
                await sleep(1000);
            }

            await Matrix.sendMessage(m.from, { text: 'BACKLOGS CLEARED' }, { quoted: m });
            await m.React("✅");
        } catch (err) {
            await Matrix.sendMessage(m.from, { text: "Erreur lors de la simulation de piratage." }, { quoted: m });
            console.error('Erreur:', err);
            await m.React("❌");
        }
    }
};

export default hackPlugin;