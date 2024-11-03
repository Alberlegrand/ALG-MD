import config from '../../config.cjs';

const ownerContact = async (m, gss) => {
    const ownernumber = config.OWNER_NUMBER;
    const prefix = config.PREFIX;

    // Utilisation d'une expression régulière pour capturer la commande après le préfixe
    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i'); // Capture le premier mot après le préfixe
    const match = m.body.match(commandRegex);
    
    // Vérifie si une correspondance a été trouvée
    const cmd = match ? match[1].toLowerCase() : '';
    const text = match ? m.body.slice(match[0].length).trim() : '';

    if (cmd === 'owner') {
        try {
            await gss.sendContact(m.from, [ownernumber], m);
            await m.React("✅");
        } catch (error) {
            console.error('Error sending owner contact:', error);
            m.reply('Error sending owner contact.');
            await m.React("❌");
        }
    }
};

export default ownerContact;