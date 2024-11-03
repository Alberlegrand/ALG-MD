import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import pkg from '@whiskeysockets/baileys';
const { generateWAMessageFromContent, proto } = pkg;
import config from '../../config.cjs';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const sportsHistoryFile = path.resolve(__dirname, '../sports_chat_history.json');

const aiSystemPrompt = "You are a helpful assistant for providing live sports updates.";

async function readSportsHistoryFromFile() {
    try {
        const data = await fs.readFile(sportsHistoryFile, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

async function writeSportsHistoryToFile(sportsHistory) {
    try {
        await fs.writeFile(sportsHistoryFile, JSON.stringify(sportsHistory, null, 2));
    } catch (err) {
        console.error('Error writing sports history to file:', err);
    }
}

async function updateSportsHistory(sportsHistory, sender, message) {
    if (!sportsHistory[sender]) {
        sportsHistory[sender] = [];
    }
    sportsHistory[sender].push(message);
    if (sportsHistory[sender].length > 20) {
        sportsHistory[sender].shift();
    }
    await writeSportsHistoryToFile(sportsHistory);
}

async function deleteSportsHistory(sportsHistory, userId) {
    delete sportsHistory[userId];
    await writeSportsHistoryToFile(sportsHistory);
}

const sportsLivePlugin = async (m, Matrix) => {
    const sportsHistory = await readSportsHistoryFromFile();
    const text = m.body.toLowerCase();

    if (text === "/forget") {
        await deleteSportsHistory(sportsHistory, m.sender);
        await Matrix.sendMessage(m.from, { text: 'Sports conversation deleted successfully.' }, { quoted: m });
        return;
    }

    const prefix = config.PREFIX;
    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = m.body.match(commandRegex);

    const cmd = match ? match[1].toLowerCase() : '';
    const prompt = match ? m.body.slice(match[0].length).trim() : '';

    const validCommands = ['live', 'scores', 'updates'];

    if (validCommands.includes(cmd)) {
        try {
            // API de The Sports DB
            const sportsApiUrl = `https://www.thesportsdb.com/api/v1/json/${config.SPORTS_API_KEY}/latestsoccerresults.php`;
            const response = await fetch(sportsApiUrl);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const liveGames = data.latestSoccerResults || []; // Adapté à la structure de The Sports DB

            if (liveGames.length > 0) {
                let message = '🏅 **Matchs en Direct :**\n';
                liveGames.forEach(game => {
                    message += `📅 ${game.date} - ${game.strHomeTeam} vs ${game.strAwayTeam} | Score: ${game.intHomeScore} - ${game.intAwayScore}\n`;
                });
                await Matrix.sendMessage(m.from, { text: message }, { quoted: m });
            } else {
                await Matrix.sendMessage(m.from, { text: 'Aucun match en direct actuellement.' }, { quoted: m });
            }
        } catch (err) {
            await Matrix.sendMessage(m.from, { text: "An error occurred while processing your request." }, { quoted: m });
            console.error('Error: ', err);
        }
    }
};

export default sportsLivePlugin;