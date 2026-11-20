import axios from 'axios';
import config from '../../config.cjs';

/**
 * Génère un buffer audio à partir de texte (Text-To-Speech)
 * Utilise ElevenLabs si configuré, sinon le service gratuit Google TTS en fallback.
 */
export async function textToSpeechBuffer(text, lang = 'fr') {
    if (!text || typeof text !== 'string') return null;

    // Nettoyer les balises Markdown et émojis trop longs pour le TTS
    const cleanText = text
        .replace(/\*[^*]+\*/g, m => m.replace(/\*/g, ''))
        .replace(/_[^_]+_/g, m => m.replace(/_/g, ''))
        .replace(/`[^`]+`/g, m => m.replace(/`/g, ''))
        .slice(0, 500); // Limite raisonnable pour une note vocale rapide

    // 1. ElevenLabs si clé API configurée
    const elevenKey = config.ELEVENLAB_API_KEY || process.env.ELEVENLAB_API_KEY;
    if (elevenKey) {
        try {
            const voiceId = config.aitts_Voice_Id || "21m00Tcm4TlvDq8ikWAM"; // Voix par défaut Rachel
            const response = await axios.post(
                `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
                {
                    text: cleanText,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                },
                {
                    headers: {
                        'xi-api-key': elevenKey,
                        'Content-Type': 'application/json',
                        'Accept': 'audio/mpeg'
                    },
                    responseType: 'arraybuffer',
                    timeout: 10000
                }
            );
            return { buffer: Buffer.from(response.data), mimetype: 'audio/mp4' };
        } catch (e) {
            console.error('ElevenLabs TTS failed, falling back to Google TTS:', e.message);
        }
    }

    // 2. Google TTS (Gratuit, illimité, sans clé)
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(cleanText)}&tl=${lang}&client=tw-ob`;
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            },
            timeout: 8000
        });
        return { buffer: Buffer.from(res.data), mimetype: 'audio/mp4' };
    } catch (err) {
        console.error('Google TTS error:', err.message);
        return null;
    }
}

/**
 * Envoie une note vocale PTT sur WhatsApp
 */
export async function sendVoiceNote(sock, jid, text, lang = 'fr', quoted = null) {
    const tts = await textToSpeechBuffer(text, lang);
    if (!tts || !tts.buffer) return false;

    try {
        await sock.sendMessage(
            jid,
            {
                audio: tts.buffer,
                mimetype: tts.mimetype,
                ptt: true // Envoie comme vraie note vocale WhatsApp
            },
            quoted ? { quoted } : {}
        );
        return true;
    } catch (error) {
        console.error('Error sending voice note:', error);
        return false;
    }
}
