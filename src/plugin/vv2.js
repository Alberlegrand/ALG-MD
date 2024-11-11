import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const botUser = '50944727644@s.whatsapp.net'; // Remplacez par le JID de l'utilisateur propriétaire du bot

const vv2 = async (m, Gifted) => {
  try {
    console.log('Quoted message:', m.quoted); // Vérification du message cité

    const prefixMatch = m.body.match(/^[\\/!#.]/);
    const prefix = prefixMatch ? prefixMatch[0] : '/';
    const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';

    const validCommands = ['rvo2', 'vv2', 'reveal2', 'antiviewonce2', 'viewonce2'];
    if (!validCommands.includes(cmd)) return;

    // Vérifier si le message cité est un message à vue unique
    if (!m.quoted || m.quoted.type !== 'view_once' || 
       (m.quoted.mtype !== 'imageMessage' && m.quoted.mtype !== 'videoMessage' && m.quoted.mtype !== 'audioMessage')) {
      return; // Ne renvoie aucune réponse dans le chat d'origine
    }

    // Extraire le message et son type
    const msg = m.quoted.message;
    const type = Object.keys(msg)[0];

    const originalCaption = msg[type].caption || '';
    const newCaption = `${originalCaption}\n\n> ALG-MD © 2025*`;

    // Télécharger le contenu du média
    const mediaStream = await downloadContentFromMessage(msg[type], 
                     type === 'imageMessage' ? 'image' : type === 'videoMessage' ? 'video' : 'audio');
    let buffer = Buffer.from([]);
    for await (const chunk of mediaStream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    // Envoyer le média au propriétaire du bot uniquement
    if (/video/.test(type)) {
      await Gifted.sendMessage(botUser, {
        video: buffer,
        caption: newCaption,
        contextInfo: {
          forwardingScore: 9999,
          isForwarded: false,
        }
      });
    } else if (/image/.test(type)) {
      await Gifted.sendMessage(botUser, {
        image: buffer,
        caption: newCaption,
        contextInfo: {
          forwardingScore: 9999,
          isForwarded: false,
        }
      });
    } else if (/audio/.test(type)) {
      await Gifted.sendMessage(botUser, {
        audio: buffer,
        mimetype: 'audio/mp4', // Type MIME pour un fichier audio
        ptt: true, // Définir comme note vocale
        contextInfo: {
          forwardingScore: 9999,
          isForwarded: false,
        }
      });
    }

    // Supprimer le message de commande de la conversation d'origine
    await Gifted.deleteMessage(m.from, { id: m.id, remoteJid: m.from, fromMe: true });

  } catch (e) {
    console.error('Erreur:', e);
  }
};

export default vv2;