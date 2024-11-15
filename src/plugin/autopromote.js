import config from '../../config.cjs';

const autopromote = async (m, gss) => {
  try {
    const botNumber = await gss.decodeJid(gss.user.id);
    const prefix = config.PREFIX;

    // Utilisation de regex pour capturer la commande après le préfixe
    const regex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = m.body.match(regex);
    const cmd = match ? match[1].toLowerCase() : '';

    const validCommands = ['autopromote', 'promotebot', 'makesuperadmin'];

    if (!validCommands.includes(cmd)) return;

    if (!m.isGroup) return m.reply("*❌ THIS COMMAND CAN ONLY BE USED IN GROUPS*");

    const groupMetadata = await gss.groupMetadata(m.from);
    const participants = groupMetadata.participants;

    // Vérifier si le bot est déjà super admin
    const botParticipant = participants.find(p => p.id === botNumber);
    if (botParticipant?.admin === 'superadmin') {
      return m.reply("*✅ BOT IS ALREADY A SUPER ADMIN.*");
    }

    // Vérifier les administrateurs actuels
    const currentAdmins = participants.filter(p => p.admin);

    if (currentAdmins.length === 0) {
      return m.reply("*❌ NO ADMIN FOUND IN THIS GROUP.*");
    }

    // Promouvoir le bot via un des administrateurs actuels
    const promotingAdmin = currentAdmins[0].id;
    await gss.groupParticipantsUpdate(m.from, [botNumber], 'promote')
      .then(() => m.reply(`*✅ BOT PROMOTED SUCCESSFULLY TO SUPER ADMIN BY @${promotingAdmin.split('@')[0]}.*`))
      .catch(() => m.reply('*❌ FAILED TO PROMOTE BOT.*'));
  } catch (error) {
    console.error('Error:', error);
    m.reply('*❌ AN ERROR OCCURRED WHILE PROCESSING THE COMMAND.*');
  }
};

export default autopromote;