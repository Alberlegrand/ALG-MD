import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import pkg from '@whiskeysockets/baileys';
const { generateWAMessageFromContent, proto } = pkg;

const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill";
const HUGGING_FACE_API_KEY = process.env.HUGGING_FACE_API_KEY; // Secure the API key using environment variables
const OWNER_ID = '50944727644@s.whatsapp.net'; // ID de l'utilisateur principal

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const chatHistoryFile = path.resolve(__dirname, '../chatHistory.json');

const systemPrompt = "you are a helpful assistant.";

// Fonction pour lire l'historique des chats
async function readChatHistoryFromFile() {
    try {
        const data = await fs.readFile(chatHistoryFile, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

// Fonction pour écrire l'historique des chats
async function writeChatHistoryToFile(chatHistory) {
    try {
        await fs.writeFile(chatHistoryFile, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
        console.error('Error writing chat history to file:', err);
    }
}

// Fonction pour mettre à jour l'historique des chats
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

// Fonction pour supprimer l'historique des chats
async function deleteChatHistory(chatHistory, userId) {
    delete chatHistory[userId];
    await writeChatHistoryToFile(chatHistory);
}

const aiPlugin = async (m, Matrix) => {
    const chatHistory = await readChatHistoryFromFile();
    const text = m.body.toLowerCase();

    if (text === "/forget") {
        await deleteChatHistory(chatHistory, m.sender);
        await Matrix.sendMessage(m.from, { text: 'Conversation deleted successfully' }, { quoted: m });
        return;
    }

    const prefix = '.'; // Préfixe pour les commandes

    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = m.body.match(commandRegex);

    const cmd = match ? match[1].toLowerCase() : '';
    const prompt = match ? m.body.slice(match[0].length).trim() : '';

    const validCommands = ['bf', 'al', 'jean'];

    if (validCommands.includes(cmd)) {
        if (!prompt) {
            await Matrix.sendMessage(m.from, { text: 'Please provide a prompt.' }, { quoted: m });
            return;
        }

        try {
            const senderChatHistory = chatHistory[m.sender] || [];
            const messages = [
                { role: "system", content: systemPrompt },
                ...senderChatHistory,
                { role: "user", content: prompt }
            ];

            await m.React("🧠");

            const response = await fetch(HUGGING_FACE_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HUGGING_FACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ inputs: prompt })
            });

            if (!response.ok) {
                const errorDetails = await response.json();
                console.error('Hugging Face API error details:', errorDetails);
                throw new Error(`Hugging Face API Error: ${response.status} - ${response.statusText}`);
            }

            const responseData = await response.json();
            const answer = responseData?.generated_text || "Sorry, I couldn't generate a valid response.";

            await updateChatHistory(chatHistory, m.sender, { role: "user", content: prompt });
            await updateChatHistory(chatHistory, m.sender, { role: "assistant", content: answer });

            const codeMatch = answer.match(/```([\s\S]*?)```/);

            if (codeMatch) {
                const code = codeMatch[1];

                const msg = generateWAMessageFromContent(m.from, {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {},
                            interactiveMessage: proto.Message.InteractiveMessage.create({
                                body: proto.Message.InteractiveMessage.Body.create({ text: answer }),
                                footer: proto.Message.InteractiveMessage.Footer.create({ text: "> Powered by ALG-MD" }),
                                header: proto.Message.InteractiveMessage.Header.create({ title: "", subtitle: "" })
                            })
                        }
                    }
                }, {});

                await Matrix.relayMessage(msg.key.remoteJid, msg.message, {
                    messageId: msg.key.id
                });
            } else {
                await Matrix.sendMessage(m.from, { text: answer }, { quoted: m });
            }

            await m.React("✅");
        } catch (err) {
            await Matrix.sendMessage(m.from, { text: "An error occurred while processing your request." }, { quoted: m });
            console.error('Error: ', err);
            await m.React("❌");
        }
    }
};

export default aiPlugin;
