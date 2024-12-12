const fs = require('fs');
const fetch = require('node-fetch');

const chatHistoryFile = './chatHistory.json'; // Fichier pour stocker l'historique des conversations

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
        const response = await fetch('https://api-inference.huggingface.co/models/meta-llama/Llama-3.3-70B-Instruct', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer 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`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: messages.map(msg => msg.content).join('\n'),
                parameters: { max_length: 500 }
            })
        });

        const responseData = await response.json();
        const answer = responseData[0]?.generated_text || "Sorry, I couldn't generate a response.";

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

module.exports = aiPlugin;
