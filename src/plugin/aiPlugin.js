import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import pkg from '@whiskeysockets/baileys';
const { generateWAMessageFromContent, proto } = pkg;
import config from '../../config.cjs';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const chatHistoryFile = path.resolve(__dirname, '../ai_chat_history.json');

const aiSystemPrompt = "You are a helpful assistant for various inquiries.";

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
    if (chatHistory[sender].length > 50) {
        chatHistory[sender].shift();
    }
    await writeChatHistoryToFile(chatHistory);
}

async function deleteChatHistory(chatHistory, userId) {
    delete chatHistory[userId];
    await writeChatHistoryToFile(chatHistory);
}

async function formatChatHistory(chatHistory) {
    return chatHistory.map(entry => {
        return `[${entry.role.toUpperCase()}]: ${entry.content}`;
    }).join('\n');
}

const aiPlugin = async (m, Matrix) => {
    const chatHistory = await readChatHistoryFromFile();
    const text = m.body.toLowerCase();

    if (text === "/forget") {
        await deleteChatHistory(chatHistory, m.sender);
        await Matrix.sendMessage(m.from, { text: 'Conversation deleted successfully' }, { quoted: m });
        return;
    }

    if (text === "/history") {
        const senderChatHistory = chatHistory[m.sender] || [];
        if (senderChatHistory.length === 0) {
            await Matrix.sendMessage(m.from, { text: 'No conversation history found.' }, { quoted: m });
        } else {
            const formattedHistory = await formatChatHistory(senderChatHistory);
            await Matrix.sendMessage(m.from, { text: `Your Chat History:\n\n${formattedHistory}` }, { quoted: m });
        }
        return;
    }

    const prefix = config.PREFIX;

    const commandRegex = new RegExp(`^${prefix}\s*(\S+)`, 'i');
    const match = m.body.match(commandRegex);

    const cmd = match ? match[1].toLowerCase() : '';
    const prompt = match ? m.body.slice(match[0].length).trim() : '';

    const validCommands = ['ai', 'gpt', 'chat', 'ask'];

    if (validCommands.includes(cmd)) {
        if (!prompt) {
            await Matrix.sendMessage(m.from, { text: 'Please provide a prompt.' }, { quoted: m });
            return;
        }

        try {
            await m.React("🤖");

            // Utiliser Hugging Face API
            const response = await fetch('https://api-inference.huggingface.co/models/distilgpt2', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer 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`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: `${aiSystemPrompt}\nUser: ${prompt}`,
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();
            const answer = responseData[0]?.generated_text || "Sorry, I couldn't generate a response.";

            await updateChatHistory(chatHistory, m.sender, { role: "user", content: prompt });
            await updateChatHistory(chatHistory, m.sender, { role: "assistant", content: answer });

            await Matrix.sendMessage(m.from, { text: answer }, { quoted: m });
            await m.React("✅");
        } catch (err) {
            await Matrix.sendMessage(m.from, { text: "An error occurred while processing your request." }, { quoted: m });
            console.error('Error: ', err);
            await m.React("❌");
        }
    }
};

export default aiPlugin;
