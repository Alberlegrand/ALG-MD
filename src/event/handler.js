import config from '../../config.cjs';
import pkg, { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import Jimp from 'jimp';

const { generateWAMessageFromContent, proto } = pkg;

const alive = async (m, Matrix) => {
  try {
    // Calcul du temps d'exécution (uptime)
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);
    const timeString = `${String(days).padStart(2, '0')}-${String(hours).padStart(2, '0')}-${String(minutes).padStart(2, '0')}-${String(seconds).padStart(2, '0')}`;

    const prefix = config.PREFIX;
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

    // Vérification si la commande est valide
    if (['alive', 'uptime', 'runtime'].includes(cmd)) {
      // Création de l'image d'uptime avec Jimp
      const width = 800;
      const height = 500;
      const image = new Jimp(width, height, 'black');
      const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);

      // Calcul de la position pour centrer le texte
      const textMetrics = Jimp.measureText(font, timeString);
      const textHeight = Jimp.measureTextHeight(font, timeString, width);
      const x = (width / 2) - (textMetrics / 2);
      const y = (height / 2) - (textHeight / 2);

      image.print(font, x, y, timeString, width, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
      const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

      // Message d'état
      const uptimeMessage = `*🧿𝗔𝗟𝗚-𝗠𝗗🪀 Status Overview*\n___________________________\n\n` +
                            `*🌅 ${days} Day(s)*\n` +
                            `*📟 ${hours} Hour(s)*\n` +
                            `*🔭 ${minutes} Minute(s)*\n` +
                            `*⏰ ${seconds} Second(s)*\n___________________________`;

      // Boutons interactifs
      const buttons = [
        { buttonId: `${prefix}menu`, buttonText: { displayText: 'MENU' }, type: 1 },
        { buttonId: `${prefix}ping`, buttonText: { displayText: 'PING' }, type: 1 }
      ];

      // Préparation et envoi du message
      const sendMessageOptions = await prepareWAMessageMedia({ image: buffer }, { upload: Matrix.waUploadToServer });
      const msg = generateWAMessageFromContent(m.from, proto.Message.fromObject({
        templateMessage: {
          hydratedTemplate: {
            imageMessage: sendMessageOptions.imageMessage,
            hydratedContentText: uptimeMessage,
            hydratedFooterText: '© Powered by ALG-MD Bot',
            hydratedButtons: buttons.map(btn => ({
              quickReplyButton: {
                displayText: btn.buttonText.displayText,
                id: btn.buttonId
              }
            }))
          }
        }
      }), {});

      // Envoi du message
      await Matrix.relayMessage(m.from, msg.message, { messageId: msg.key.id });
    }
  } catch (error) {
    console.error("Erreur dans le plugin 'alive':", error);
  }
};

export default alive;