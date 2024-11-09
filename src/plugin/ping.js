import config from '../../config.cjs';

const ping = async (m, sock) => {
  const prefix = config.PREFIX;
  
  // Utilisation d'une regex pour extraire la commande même avec des espaces en trop
  const match = m.body.match(new RegExp(`^${prefix}\\s*(\\w+)`, 'i'));
  const cmd = match ? match[1].toLowerCase() : '';

  // Si la commande est "ping", on continue
  if (cmd === "ping") {
    const start = Date.now();
    await m.React('⤵️');
    const end = Date.now();
    const responseTime = (end - start) / 1000;

    const text = `*🧿 Ping ALG-MD 🪀: ${responseTime.toFixed(2)} ms*`;
    await sock.sendMessage(m.from, { text }, { quoted: m });
  }
};

export default ping;