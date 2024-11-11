import config from '../../config.cjs';
import pkg, { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import Jimp from 'jimp';

const { generateWAMessageFromContent, proto } = pkg;

const alive = async (m, Matrix) => {
  try {
    // Calcul de l'uptime
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    const timeString = `${String(days).padStart(2, '0')}-${String(hours).padStart(2, '0')}-${String(minutes).padStart(2, '0')}-${String(seconds).padStart(2, '0')}`;

    const prefix = config.PREFIX;

    // Extraction de la commande
    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)\\s*(.*)`);
    const match = m.body.match(commandRegex);
    const cmd = match ? match[1].toLowerCase() : '';

    if (['alive', 'uptime', 'runtime'].includes(cmd)) {
      const width = 800;
      const height = 500;
      const image = new Jimp(width, height, 'black');
      const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
      image.print(font, 0, 0, { text: timeString, alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER, alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE }, width, height);
      const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

      const uptimeMessage = `*🧿ALG-MD🪀 Status Overview*\n___________________________\n*🌅 ${days} Day(s)*\n*📟 ${hours} Hour(s)*\n*🔭 ${minutes} Minute(s)*\n*⏰ ${seconds} Second(s)*\n___________________________`;

      const buttons = [
        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "MENU", id: `${prefix}menu` }) },
        { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "PING", id: `${prefix}ping` }) }
      ];

      const msg = generateWAMessageFromContent(m.from, {
        viewOnceMessage: {
          message: