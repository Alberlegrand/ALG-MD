const config = require('../config');

module.exports = {
    execute: async (sock, message, args) => {
        const remoteJid = message.key.remoteJid;
        const greetingWords = ['hello', 'hi', 'hey', 'bonjour', 'salut']; // Liste des mots de salutation

        // Vérifier si le message contient un mot de salutation
        const isGreeting = args.some(arg => greetingWords.includes(arg.toLowerCase()));

        if (isGreeting) {
            const response = `Salut! Comment puis-je vous aider aujourd'hui?`; // Réponse personnalisée
            await sock.sendMessage(remoteJid, { text: response });
        } else {
            const response = `Je ne reconnais pas cette commande. Essayez par exemple: ${config.HANDLERS}hello bonjour`; // Réponse par défaut si ce n'est pas une salutation
            await sock.sendMessage(remoteJid, { text: response });
        }
    }
};
