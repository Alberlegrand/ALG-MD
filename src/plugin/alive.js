import config from '../../config.cjs';
import pkg, { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import Jimp from 'jimp';

const { generateWAMessageFromContent, proto } = pkg;

const alive = async (m, Matrix) => {
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
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "MENU",
          id: `${prefix}menu`
        })
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "PING",
          id: `${prefix}ping`
        })
      }
    ];

    // Génération du message interactif
    const msg = generateWAMessageFromContent(m.from, {
      viewOnceMessage: {
        message: {
          interactiveMessage: proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({
              text: uptimeMessage
            }),
            footer: proto.Message.InteractiveMessage.Footer.create({
              text: "© Powered by ALG-MD Bot"
            }),
            header: proto.Message.InteractiveMessage.Header.create({
              ...(await prepareWAMessageMedia({ image: buffer }, { upload: Matrix.waUploadToServer })),
              title: '',
              gifPlayback: false
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons
            }),
            contextInfo: {
              quotedMessage: m.message
            }
          }),
        },
      },
    }, {});

    // Envoi du message
    await Matrix.relayMessage(msg.key.remoteJid, msg.message, { messageId: msg.key.id });
  }
};

export default alive;