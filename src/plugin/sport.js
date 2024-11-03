import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import pkg from '@whiskeysockets/baileys';
const { generateWAMessageFromContent, proto } = pkg;
import config from '../../config.cjs';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const chatHistoryFile = path.resolve(__dirname, '../ai_chat_history.json');

const aiSystemPrompt = "You are a helpful assistant for sports inquiries.";

async function readChatHistoryFromFile() {
    try {
        const data = await fs.readFile(chatHistoryFile, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

async function writeChatHistoryToFile(chatHistory) {
    try {
        await fs.writeFile(chatHistoryFile, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
        console.error('Error writing chat history to file:', err);
    }
}

async function updateChatHistory(chatHistory, sender, message) {
    if (!chatHistory[sender]) {
        chatHistory[sender] = [];
    }
    chatHistory[sender].push(message);
    if (chatHistory[sender].length > 20) {
        chatHistory[sender].shift();
    }
    await writeChatHistoryToFile(chatHistory);
}

async function deleteChatHistory(chatHistory, userId) {
    delete chatHistory[userId];
    await writeChatHistoryToFile(chatHistory);
}

const sportsPlugin = async (m, Matrix) => {
    const chatHistory = await readChatHistoryFromFile();
    const text = m.body.toLowerCase();

    if (text === "/forget") {
        await deleteChatHistory(chatHistory, m.sender);
        await Matrix.sendMessage(m.from, { text: 'Conversation deleted successfully' }, { quoted: m });
        return;
    }

    const prefix = config.PREFIX;
    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = m.body.match(commandRegex);

    const cmd = match ? match[1].toLowerCase() : '';
    const prompt = match ? m.body.slice(match[0].length).trim() : '';

    const validCommands = ['sports', 'team', 'score'];

    if (validCommands.includes(cmd)) {
        if (!prompt) {
            await Matrix.sendMessage(m.from, { text: 'Please provide a team name.' }, { quoted: m });
            return;
        }

        try {
            await m.React("🤖");

            // Utiliser l'API V1 de The Sports DB pour rechercher des équipes
            const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(prompt)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.teams || data.teams.length === 0) {
                await Matrix.sendMessage(m.from, { text: 'No teams found.' }, { quoted: m });
                return;
            }

            const team = data.teams[0];
            const teamInfo = `Team Name: ${team.strTeam}\n` +
                             `Team Badge: ${team.strBadge}\n` +
                             `Stadium: ${team.strStadium}\n` +
                             `Description: ${team.strDescriptionEN}`;

            await Matrix.sendMessage(m.from, { text: teamInfo }, { quoted: m });
            await m.React("✅");

            // Enregistrer l'historique de la conversation
            await updateChatHistory(chatHistory, m.sender, { role: "user", content: prompt });
            await updateChatHistory(chatHistory, m.sender, { role: "assistant", content: teamInfo });
        } catch (err) {
            await Matrix.sendMessage(m.from, { text: "An error occurred while processing your request." }, { quoted: m });
            console.error('Error: ', err);
            await m.React("❌");
        }
    }
};

export default sportsPlugin;