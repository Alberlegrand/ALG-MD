import cron from 'node-cron';
import moment from 'moment-timezone';
import config from '../../config.cjs';
import reminderManager from './reminders.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

let isBriefingScheduled = false;

export function initDailyBriefing(sock) {
    if (isBriefingScheduled) return;

    const enabled = config.MORNING_BRIEFING !== undefined ? config.MORNING_BRIEFING === 'true' || config.MORNING_BRIEFING === true : false;
    if (!enabled) return;

    const tz = config.timezone || "America/Port-au-Prince";
    const cronTime = config.BRIEFING_TIME || "30 7 * * *"; // Tous les jours à 07h30 par défaut

    cron.schedule(cronTime, async () => {
        const ownerJid = (config.OWNER_NUMBER || "").replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        if (!sock || !ownerJid) return;

        try {
            console.log(`[ALG-MD] Génération du briefing matinal pour ${ownerJid}...`);
            const now = moment().tz(tz);
            const dateStr = now.format("dddd DD MMMM YYYY");

            const apiKey = config.GEMINI_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
            let briefingText = "";

            if (apiKey) {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: config.AI_MODEL || "gemini-1.5-flash" });
                const prompt = `Génère un message de 'Bonjour et briefing matinal' pour ton propriétaire sur WhatsApp pour la date du ${dateStr}.
Inclus :
1. Une salutation chaleureuse et énergique.
2. Une citation inspirante ou un conseil de productivité du jour.
3. Un rappel bienveillant d'hydratation et de focus.
Reste concis (maximum 12-15 lignes), utilise du formatage WhatsApp (*gras*, listes à puces) et des émojis élégants.`;

                const res = await model.generateContent(prompt);
                briefingText = res.response.text();
            } else {
                briefingText = `🌅 *BONJOUR & BONNE JOURNÉE !* 🌅\n\n📅 *Date :* ${dateStr}\n\n💡 _"Chaque matin est une nouvelle opportunité de créer l'excellence."_\n\n🎯 *Priorités du jour :* Restez concentré et hydratez-vous !\n\n🤖 _Votre assistant ALG-MD est à votre service._`;
            }

            await sock.sendMessage(ownerJid, { text: briefingText });
            console.log(`[ALG-MD] Briefing matinal envoyé avec succès.`);
        } catch (err) {
            console.error('[ALG-MD] Erreur lors de l’envoi du briefing matinal:', err);
        }
    }, {
        timezone: tz
    });

    isBriefingScheduled = true;
    console.log(`⏰ [ALG-MD] Briefing matinal activé pour ${cronTime} (${tz}).`);
}

export default initDailyBriefing;
