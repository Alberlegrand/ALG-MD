import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config.cjs';

const geminiResponse = async (m, Matrix) => {
  const prefix = config.PREFIX || '.';
  const cmd = m.body.startsWith(prefix) ? m.body.slice(prefix.length).split(' ')[0].toLowerCase() : '';
  const text = m.body.slice(prefix.length + cmd.length).trim();

  const apiKey = config.GEMINI_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
  const validCommands = ['gemini', 'ai', 'gpt', 'vision'];

  if (validCommands.includes(cmd)) {
    if (!apiKey) {
      return m.reply("❌ Clé API Gemini non configurée dans le fichier .env (GEMINI_KEY). Obtenez-en une sur https://aistudio.google.com/");
    }

    if (!text && (!m.quoted || m.quoted.mtype !== 'imageMessage') && m.type !== 'imageMessage') {
      return m.reply(`*Posez une question après la commande ou envoyez une image :*\nExemple : *${prefix + cmd} Qui a découvert la pénicilline ?*`);
    }

    await m.React("💭");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelName = config.AI_MODEL || "gemini-3.5-flash";
      const model = genAI.getGenerativeModel({ model: modelName });

      const parts = [];

      // Si une image est attachée ou citée
      if (m.type === 'imageMessage') {
        const media = await m.download();
        if (media) {
          parts.push({
            inlineData: {
              data: Buffer.from(media).toString("base64"),
              mimeType: "image/jpeg",
            },
          });
        }
      } else if (m.quoted && m.quoted.mtype === 'imageMessage') {
        const media = await m.quoted.download();
        if (media) {
          parts.push({
            inlineData: {
              data: Buffer.from(media).toString("base64"),
              mimeType: "image/jpeg",
            },
          });
        }
      }

      // Ajout du texte de la question
      const prompt = text || "Décris cette image en détail en français.";
      parts.push(prompt);

      const result = await model.generateContent(parts);
      const response = result.response;
      const textResponse = response.text();

      await m.reply(textResponse);
      await m.React("✅");
    } catch (error) {
      console.error('Error in Gemini command:', error);
      m.reply(`❌ Erreur Gemini : ${error.message}`);
      await m.React("❌");
    }
  }
};

export default geminiResponse;
