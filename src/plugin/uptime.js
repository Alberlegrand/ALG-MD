import config from '../../config.cjs';

const uptime = async (m, sock) => {
  const prefix = config.PREFIX;
  
  // Utilisation d'une regex pour extraire la commande même avec des espaces en trop
  const match = m.body.match(new RegExp(`^${prefix}\\s*(\\w+)`, 'i'));
  const cmd = match ? match[1].toLowerCase() : '';

  // Si la commande est "uptime", on continue
  if (cmd === "uptime") {
    const uptimeSeconds = process.uptime(); // Durée en secondes depuis le démarrage du bot
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    // Formatage du message pour afficher le temps d'exécution
    const uptimeMessage = `*🧿 Uptime ALG-MD 🪀: ${days} jours, ${hours} heures, ${minutes} minutes, et ${seconds} secondes*`;

    await sock.sendMessage(m.from, { text: uptimeMessage }, { quoted: m });
  }
};

export default uptime;
