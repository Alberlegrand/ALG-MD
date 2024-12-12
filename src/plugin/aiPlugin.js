import fs from 'fs';
import fetch from 'node-fetch';

const chatHistoryFile = './chatHistory.json'; // Fichier pour stocker l'historique des conversations
const HUGGING_FACE_API_URL = "https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill";
const HUGGING_FACE_API_KEY = "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"; // Remplacez par une clé d'API valide

// Fonction pour lire l'historique des chats
async function readChatHistoryFromFile() {
    try {
        if (fs.existsSync(chatHistoryFile)) {
            const data = fs.readFileSync(chatHistoryFile, 'utf8');
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('Error reading chat history:', error);
        return {};
    }
}

// Fonction pour écrire l'historique des chats dans un fichier
async function writeChatHistoryToFile(chatHistory) {
    try {
        fs.writeFileSync(chatHistoryFile, JSON.stringify(chatHistory, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing chat history:', error);
    }
}

// Fonction pour enrichir l'historique des conversations
async function enrichTraining(chatHistory, sender, newMessage) {
    if (!chatHistory[sender]) {
        chatHistory[sender] = [];
    }
    chatHistory[sender].push(newMessage);

    // Limiter l'historique à 100 messages par utilisateur
    if (chatHistory[sender].length > 100) {
        chatHistory[sender].shift();
    }

    await writeChatHistoryToFile(chatHistory);
}

// Fonction pour vérifier si un message est envoyé par un bot
function isMessageFromBot(sender) {
    return sender.includes('bot') || sender.includes('Bot') || sender.includes('BOT');
}

// Fonction pour répondre automatiquement
async function autoRespond(m, chatHistory, Matrix) {
    if (isMessageFromBot(m.sender)) {
        console.log(`Message ignored from bot sender: ${m.sender}`);
        return; // Ignorer les messages envoyés par des bots
    }

    const senderChatHistory = chatHistory[m.sender] || [];
    const prompt = m.body;

    try {
        // Construire la requête pour Hugging Face
        const response = await fetch(HUGGING_FACE_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGING_FACE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt
            })
        });

        if (!response.ok) {
            const errorDetails = await response.json();
            console.error('Hugging Face API error details:', errorDetails);
            throw new Error(`Hugging Face API Error: ${response.status} - ${response.statusText}`);
        }

        const responseData = await response.json();
        const answer = responseData.generated_text || "Désolé, je n'ai pas pu générer de réponse.";

        // Enrichir l'historique avec la nouvelle interaction
        await enrichTraining(chatHistory, m.sender, { role: "assistant", content: answer });

        // Envoyer la réponse
        await Matrix.sendMessage(m.from, { text: answer }, { quoted: m });
    } catch (err) {
        console.error('Error in autoRespond:', err);
        await Matrix.sendMessage(m.from, { text: "Une erreur s'est produite lors du traitement de votre demande." }, { quoted: m });
    }
}

// Fonction principale du plugin
const aiPlugin = async (m, Matrix) => {
    const chatHistory = await readChatHistoryFromFile();

    try {
        // Répondre automatiquement à tous les messages
        await autoRespond(m, chatHistory, Matrix);
    } catch (err) {
        console.error('Error in aiPlugin:', err);
    }
};

export default aiPlugin;
