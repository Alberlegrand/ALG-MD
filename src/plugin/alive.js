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
    const timeString = `${String(days).padStart(2, '0')} jour(s) ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

    const prefix = config.PREFIX;

    // Extraction de la commande
    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)\\s*(.*)`);
    const match = m.body.match(commandRegex);
    const cmd = match ? match[1].toLowerCase() : '';

    if (['alive', 'uptime', 'runtime'].includes(cmd)) {
      // Création de l'image d'uptime avec Jimp
      const width = 800;
      const height = 500;
      const image = new Jimp(width, height, 'black');
      const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
      image.print(
        font,
        0,
        0,
        {
          text: timeString,
          alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
          alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE,
        },
        width,
        height
      );
      const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

      // Message d'uptime à afficher
      const uptimeMessage = `*🧿ALG-MD🪀 Status Overview*\n___________________________\n*🌅 ${days} Jour(s)*\n*📟 ${hours} Heure(s)*\n*🔭 ${minutes} Minute(s)*\n*⏰ ${seconds} Seconde(s)*\n___________________________`;

      // Boutons interactifs
      const buttons = [
        {
          buttonId: `${prefix}menu`,
          buttonText: { displayText: 'MENU' },
          type: 1,
        },
        {
          buttonId: `${prefix}ping`,
          buttonText: { displayText: 'PING' },
          type: 1,
        },
      ];

      // Préparation du média avec l'image
      const media = await prepareWAMessageMedia({ image: buffer }, { upload: Matrix.waUploadToServer });
      
      // Génération du message avec les boutons
      const msg = generateWAMessageFromContent(
        m.from,
        proto.Message.fromObject({
          buttonsMessage: {
            contentText: uptimeMessage,
            footerText: '© 2025 ALG-MD',
            buttons: buttons,
            headerType: 4, // Type pour un message avec média
            imageMessage: media.imageMessage,
          },
        }),
        {}
      );

      // Envoi du message
      await Matrix.relayMessage(m.from, msg.message, { messageId: msg.key.id });
    }
  } catch (e) {
    console.error('Erreur dans la fonction alive:', e);
  }
};

export default alive;