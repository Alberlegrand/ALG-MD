import config from '../../config.cjs';

const autopromote = async (m, gss) => {
  try {
    const botNumber = await gss.decodeJid(gss.user.id);
    const prefix = config.PREFIX;

    const regex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = m.body.match(regex);
    const cmd = match ? match[1].toLowerCase() : '';

    const validCommands = ['autopromote', 'promotebot', 'makeadmin'];
    if (!validCommands.includes(cmd)) return;

    if (!m.isGroup) return m.reply("*❌ THIS COMMAND CAN ONLY BE USED IN GROUPS*");

    const groupMetadata = await gss.groupMetadata(m.from);
    const participants = groupMetadata.participants;

    // Vérifier si le bot est déjà admin
    const botParticipant = participants.find(p => p.id === botNumber);
    if (botParticipant?.admin) {
      return m.reply("*✅ BOT IS ALREADY AN ADMIN.*");
    }

    // Récupérer et afficher les administrateurs et super administrateurs
    const superAdmins = participants.filter(p => p.admin === 'superadmin');
    const admins = participants.filter(p => p.admin);

    // Afficher la liste des super administrateurs et administrateurs
    const superAdminNames = superAdmins.map(admin => `@${admin.id.split('@')[0]}`).join(', ') || 'No super admins found';
    const adminNames = admins.map(admin => `@${admin.id.split('@')[0]}`).join(', ') || 'No admins found';
    
    m.reply(`*📝 LIST OF ADMINS AND SUPER ADMINS IN THIS GROUP:*\n\n*Super Admins:* ${superAdminNames}\n*Admins:* ${adminNames}`);

    // Si aucun super admin n'est trouvé
    if (superAdmins.length === 0) {
      return m.reply("*❌ NO SUPER ADMIN FOUND IN THIS GROUP TO PROMOTE THE BOT.*");
    }

    // Promouvoir le bot via un super admin
    const promotingSuperAdmin = superAdmins[0].id;
    await gss.groupParticipantsUpdate(m.from, [botNumber], 'promote')
      .then(() => m.reply(`*✅ BOT PROMOTED TO ADMIN BY SUPER ADMIN @${promotingSuperAdmin.split('@')[0]}.*`))
      .catch((err) => {
        console.error('Promotion error:', err);
        m.reply(`*❌ FAILED TO PROMOTE BOT TO ADMIN. ERROR: ${err.message}*`);
      });
  } catch (error) {
    console.error('Error:', error);
    m.reply(`*❌ AN ERROR OCCURRED: ${error.message}*`);
  }
};

export default autopromote;