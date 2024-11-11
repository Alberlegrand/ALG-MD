import config from '../../config.cjs';
import pkg, { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import Jimp from 'jimp';

const { generateWAMessageFromContent, proto } = pkg;

const alive = async (m, Matrix) => {
  try {
    // 1. Calcul du temps d'exécution
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    const timeString = `${String(days).padStart(2, '0')}d:${String(hours).padStart(2, '0')}h:${String(minutes).padStart(2, '0')}m:${String(seconds).padStart(2, '0')}s`;

    // 2. Création de l'image avec le texte d'uptime
    const width = 800;
    const height = 500;
    const image = new Jimp(width, height, 'black');
    const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const textX = (width - Jimp.measureText(font, timeString)) / 2;
    const textY = (height - Jimp.measureTextHeight(font, timeString, width)) / 2;
    image.print(font, textX, textY, timeString);
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

    // 3. Message de statut d'uptime
    const uptimeMessage = `🧿 *ALG-MD Status*\n\n⏳ Uptime: ${timeString}`;

    // 4. Configuration des boutons interactifs
    const buttons = [
      { buttonId: `${config.PREFIX}menu`, buttonText: { displayText: 'MENU' }, type: 1 },
      { buttonId: `${config.PREFIX}ping`, buttonText: { displayText: 'PING' }, type: 1 }
    ];

    // 5. Préparation et envoi du message
    const messageContent = {
      image: buffer,
      caption: uptimeMessage,
      footer: '© Powered by ALG-MD Bot',
      buttons: buttons,
      headerType: 4
    };

    const sendMessageOptions = await prepareWAMessageMedia({ image: buffer }, { upload: Matrix.waUploadToServer });
    const msg = generateWAMessageFromContent(m.from, proto.Message.fromObject({
      templateMessage: {
        hydratedTemplate: {
          ...messageContent,
          hydratedButtons: buttons.map(btn => ({
            quickReplyButton: btn
          }))
        }
      }
    }), sendMessageOptions);

    await Matrix.relayMessage(m.from, msg.message, { messageId: msg.key.id });
  } catch (error) {
    console.error("Erreur dans le plugin 'alive':", error);
  }
};

export default alive;