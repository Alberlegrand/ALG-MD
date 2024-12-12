import fs from 'fs';
import fetch from 'node-fetch';

const chatHistoryFile = './chatHistory.json'; // Fichier pour stocker l'historique des conversations
const OPENAI_API_KEY = "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";

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

// Fonction pour formater l'historique des conversations
async function formatChatHistory(history) {
    return history.map(entry => `${entry.role}: ${entry.content}`).join('\n');
}

// Fonction pour répondre automatiquement
async function autoRespond(m, chatHistory, Matrix) {
    const aiSystemPrompt = `
You are acting as [USER]. Respond with a tone and style matching previous interactions. 
Make the responses helpful, concise, and in line with [USER]'s conversation history.
`;

    const senderChatHistory = chatHistory[m.sender] || [];
    const prompt = m.body;

    // Construire la requête avec l'historique enrichi
    const messages = [
        { role: "system", content: aiSystemPrompt },
        ...senderChatHistory,
        { role: "user", content: prompt }
    ];

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4", // Utilisez le modèle GPT-4 ou GPT-3.5 selon vos besoins
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        const responseData = await response.json();
        const answer = responseData.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";

        // Enrichir l'historique avec la nouvelle interaction
        await enrichTraining(chatHistory, m.sender, { role: "assistant", content: answer });

        // Envoyer la réponse
        await Matrix.sendMessage(m.from, { text: answer }, { quoted: m });
    } catch (err) {
        console.error('Error in autoRespond:', err);
        await Matrix.sendMessage(m.from, { text: "An error occurred while processing your request." }, { quoted: m });
    }
}

// Fonction principale du plugin
const aiPlugin = async (m, Matrix) => {
    const chatHistory = await readChatHistoryFromFile();

    // Répondre automatiquement à tous les messages
    await autoRespond(m, chatHistory, Matrix);
};

export default aiPlugin;
