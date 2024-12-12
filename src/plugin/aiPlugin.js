import fs from 'fs';
import fetch from 'node-fetch';

const chatHistoryFile = './chatHistory.json'; // Fichier pour stocker l'historique des conversations
const cohereApiKey = "Dqd4ydlUAKG5wSrXYySxdrNZNDsFEr5kFfcIjtf2"; // Clé API Cohere

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

// Fonction pour répondre automatiquement avec Cohere
async function queryCohere(prompt) {
    try {
        const response = await fetch('https://api.cohere.ai/generate', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${cohereApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'command-xlarge-nightly',
                prompt: prompt,
                max_tokens: 500,
                temperature: 0.7,
                k: 0,
                p: 1,
                stop_sequences: []
            })
        });

        const data = await response.json();

        if (response.status !== 200) {
            console.error('Erreur API Cohere :', data);
            throw new Error('Erreur API Cohere');
        }

        return data.generations[0].text.trim();
    } catch (error) {
        console.error('Error querying Cohere:', error);
        throw error;
    }
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

    const formattedPrompt = messages.map(msg => msg.content).join('\n');

    console.log("Prompt envoyé :", formattedPrompt); // Debugging

    try {
        const answer = await queryCohere(formattedPrompt);

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
