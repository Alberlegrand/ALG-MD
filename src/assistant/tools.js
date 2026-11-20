import moment from 'moment-timezone';
import reminderManager from './reminders.js';
import memory from './memory.js';
import axios from 'axios';
import config from '../../config.cjs';
import { sendVoiceNote } from './tts.js';
import learner from './learner.js';
import groupBuffer from './groupBuffer.js';

// Définitions des outils (Function Declarations) compatibles avec le SDK Gemini
export const geminiToolDeclarations = [
    {
        name: "get_current_time",
        description: "Renvoie l'heure, la date et le fuseau horaire actuels.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "create_reminder",
        description: "Programme un rappel automatique pour l'utilisateur sur WhatsApp dans un certain nombre de minutes.",
        parameters: {
            type: "OBJECT",
            properties: {
                task: {
                    type: "STRING",
                    description: "La description de la tâche ou ce dont l'utilisateur veut se rappeler (ex: 'Boire de l'eau', 'Appeler maman', 'Réunion Zoom')."
                },
                delay_minutes: {
                    type: "NUMBER",
                    description: "Le délai en minutes avant de recevoir le rappel (ex: 5 pour 5 minutes, 60 pour 1 heure)."
                }
            },
            required: ["task", "delay_minutes"]
        }
    },
    {
        name: "save_note",
        description: "Enregistre une information, note, mot de passe, ou pensée dans la mémoire long terme de l'utilisateur quand il dit 'retiens que...', 'note que...', 'souviens-toi que...'.",
        parameters: {
            type: "OBJECT",
            properties: {
                note: {
                    type: "STRING",
                    description: "Le contenu exact de la note ou de l'information à enregistrer."
                }
            },
            required: ["note"]
        }
    },
    {
        name: "get_notes",
        description: "Récupère toutes les notes et informations précédemment enregistrées pour cet utilisateur.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "create_sticker",
        description: "Transforme l'image actuelle ou l'image citée en sticker (autocollant WhatsApp). Utilise cet outil quand l'utilisateur demande un sticker de l'image.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "reply_with_voice",
        description: "Envoie la réponse sous forme de note vocale WhatsApp (audio) en plus ou à la place du texte, si l'utilisateur a explicitement demandé un vocal ('réponds en vocal', 'dis-le en audio').",
        parameters: {
            type: "OBJECT",
            properties: {
                voice_text: {
                    type: "STRING",
                    description: "Le texte naturel à prononcer oralement dans la note vocale."
                }
            },
            required: ["voice_text"]
        }
    },
    {
        name: "search_web",
        description: "Recherche des informations récentes ou en direct sur le web (actualités, météo, faits, définitions).",
        parameters: {
            type: "OBJECT",
            properties: {
                query: {
                    type: "STRING",
                    description: "Les mots-clés de recherche."
                }
            },
            required: ["query"]
        }
    },
    {
        name: "get_group_info",
        description: "Récupère les informations détaillées du groupe WhatsApp actuel (nom, description, nombre de participants, admins).",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "get_group_invite_link",
        description: "Génère ou récupère le lien d'invitation officiel (https://chat.whatsapp.com/...) du groupe WhatsApp actuel.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "inspect_learned_profile",
        description: "Affiche tout ce que l'IA a appris et retenu au fur et à mesure des discussions sur l'utilisateur (ses faits, son travail, ses projets, ses préférences). Utilise cet outil quand l'utilisateur demande 'Que sais-tu sur moi ?' ou 'Montre ma mémoire'.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "reset_learned_profile",
        description: "Efface complètement les faits et le profil que l'IA a appris sur l'utilisateur quand il demande 'Oublie ce que tu sais sur moi' ou 'Réinitialise mon profil'.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "summarize_group_discussion",
        description: "Analyse et résume les récents messages échangés par les membres dans le groupe WhatsApp. À utiliser quand quelqu'un demande 'Fais un résumé du groupe', 'Que s'est-il passé dans ce groupe ?', 'Résume les discussions récentes'.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    },
    {
        name: "convert_currency",
        description: "Convertit un montant d'une devise à une autre (USD, HTG Gourdes haïtiennes, EUR, CAD, etc.).",
        parameters: {
            type: "OBJECT",
            properties: {
                amount: {
                    type: "NUMBER",
                    description: "Le montant numérique à convertir."
                },
                from: {
                    type: "STRING",
                    description: "Le code de la devise d'origine (ex: USD, HTG, EUR, CAD)."
                },
                to: {
                    type: "STRING",
                    description: "Le code de la devise de destination (ex: HTG, USD, EUR)."
                }
            },
            required: ["amount", "from", "to"]
        }
    },
    {
        name: "clear_conversation_memory",
        description: "Efface l'historique de la mémoire de conversation de l'utilisateur quand il demande d'oublier ou de réinitialiser.",
        parameters: {
            type: "OBJECT",
            properties: {},
            required: []
        }
    }
];

// Exécuteur des outils
export async function executeTool(name, args, context) {
    const { m, sock } = context;
    const tz = config.timezone || "America/Port-au-Prince";

    switch (name) {
        case "get_current_time": {
            const now = moment().tz(tz);
            return {
                timezone: tz,
                date: now.format("DD/MM/YYYY"),
                time: now.format("HH:mm:ss"),
                day: now.format("dddd"),
                full: now.format("LLLL")
            };
        }

        case "create_reminder": {
            const { task, delay_minutes } = args;
            if (!task || !delay_minutes || delay_minutes <= 0) {
                return { success: false, message: "Paramètres invalides pour le rappel." };
            }
            const rem = reminderManager.addReminder(m.from, task, Number(delay_minutes));
            const targetTimeFormatted = moment(rem.targetTime).tz(tz).format("HH:mm");
            return {
                success: true,
                task,
                delay_minutes,
                target_time: targetTimeFormatted,
                message: `Rappel programmé avec succès pour ${targetTimeFormatted} (dans ${delay_minutes} min).`
            };
        }

        case "save_note": {
            const { note } = args;
            if (!note) return { success: false, error: "Note vide." };
            memory.addNote(m.from, note);
            return {
                success: true,
                message: `Note enregistrée avec succès : "${note}"`
            };
        }

        case "get_notes": {
            const notes = memory.getNotes(m.from);
            if (!notes || notes.length === 0) {
                return { notes: [], message: "Aucune note enregistrée pour le moment." };
            }
            return {
                count: notes.length,
                notes: notes.map((n, i) => `${i + 1}. ${n.text}`)
            };
        }

        case "create_sticker": {
            try {
                let mediaBuffer = null;
                if (m.type === 'imageMessage') {
                    mediaBuffer = await m.download();
                } else if (m.quoted && m.quoted.mtype === 'imageMessage') {
                    mediaBuffer = await m.quoted.download();
                }

                if (!mediaBuffer) {
                    return { success: false, message: "Aucune image trouvée. Veuillez envoyer ou citer une image pour en faire un sticker." };
                }

                const packname = config.packname || "ALG Assistant";
                const author = config.author || config.OWNER_NAME || "ALG-MD";
                await sock.sendImageAsSticker(m.from, mediaBuffer, m, { packname, author });
                return { success: true, message: "Sticker créé et envoyé avec succès !" };
            } catch (err) {
                console.error("Erreur création sticker:", err);
                return { success: false, error: err.message };
            }
        }

        case "reply_with_voice": {
            const { voice_text } = args;
            if (!voice_text) return { success: false };
            try {
                const sent = await sendVoiceNote(sock, m.from, voice_text, 'fr', m);
                return { success: sent, message: sent ? "Note vocale envoyée." : "Échec de l'envoi vocal." };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }

        case "search_web": {
            const { query } = args;
            if (!query) return { error: "Requête vide." };

            try {
                const res = await axios.get(`https://api.duckduckgo.com/`, {
                    params: { q: query, format: 'json', no_html: 1, skip_disambig: 1 },
                    timeout: 8000
                });

                let results = [];
                if (res.data.AbstractText) {
                    results.push({ title: res.data.Heading, snippet: res.data.AbstractText, url: res.data.AbstractURL });
                }
                if (res.data.RelatedTopics && res.data.RelatedTopics.length > 0) {
                    for (const topic of res.data.RelatedTopics.slice(0, 3)) {
                        if (topic.Text) {
                            results.push({ snippet: topic.Text, url: topic.FirstURL });
                        }
                    }
                }

                if (results.length === 0) {
                    return { query, result: "Aucun résultat direct spécifique trouvé, utilise tes connaissances générales." };
                }

                return { query, results };
            } catch (err) {
                return { query, error: "Impossible de joindre le moteur de recherche pour le moment." };
            }
        }

        case "get_group_info": {
            if (!m.isGroup) return { success: false, message: "Cette commande ne fonctionne que dans un groupe WhatsApp." };
            try {
                const metadata = await sock.groupMetadata(m.from);
                const admins = metadata.participants.filter(p => p.admin).map(p => p.id.split('@')[0]);
                return {
                    success: true,
                    nom: metadata.subject,
                    description: metadata.desc || "Aucune description",
                    nombre_membres: metadata.participants.length,
                    nombre_admins: admins.length,
                    admins
                };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }

        case "get_group_invite_link": {
            if (!m.isGroup) return { success: false, message: "Cette commande ne fonctionne que dans un groupe WhatsApp." };
            try {
                const code = await sock.groupInviteCode(m.from);
                return {
                    success: true,
                    lien: `https://chat.whatsapp.com/${code}`,
                    message: `Voici le lien d'invitation du groupe : https://chat.whatsapp.com/${code}`
                };
            } catch (err) {
                return { success: false, error: "Impossible de récupérer le lien. Assurez-vous que le bot est administrateur du groupe." };
            }
        }

        case "inspect_learned_profile": {
            const profile = learner.getProfile(m.from);
            return {
                name: profile.name || "Non spécifié",
                facts: profile.facts || [],
                topics: profile.topics || [],
                summary: profile.summary || "Aucun résumé pour le moment.",
                message: `Voici ce que j'ai appris sur toi au fil de nos discussions.`
            };
        }

        case "reset_learned_profile": {
            learner.resetProfile(m.from);
            return { success: true, message: "J'ai effacé toutes les informations apprises sur toi." };
        }

        case "summarize_group_discussion": {
            if (!m.isGroup) return { success: false, message: "Cette commande ne fonctionne que dans un groupe WhatsApp." };
            const recentText = groupBuffer.getFormattedRecent(m.from, 50);
            if (!recentText) {
                return { success: false, message: "Il n'y a pas encore assez de messages enregistrés dans ce groupe pour générer un résumé." };
            }
            return {
                success: true,
                raw_messages: recentText,
                instruction: "Voici les derniers messages textuels du groupe. Rédige un résumé clair et structuré (Sujet principal, points clés débattus, décisions/conclusions)."
            };
        }

        case "convert_currency": {
            const { amount, from, to } = args;
            if (!amount || !from || !to) return { error: "Paramètres manquants pour la conversion." };

            const baseFrom = from.toUpperCase().trim();
            const baseTo = to.toUpperCase().trim();

            try {
                const res = await axios.get(`https://open.er-api.com/v6/latest/${baseFrom}`, { timeout: 6000 });
                const rate = res.data?.rates?.[baseTo];
                if (rate) {
                    const converted = (amount * rate).toFixed(2);
                    return {
                        success: true,
                        amount,
                        from: baseFrom,
                        to: baseTo,
                        rate,
                        result: `${amount} ${baseFrom} = ${converted} ${baseTo}`
                    };
                }
            } catch (_) {}

            // Fallback estimation (taux indicatifs standards)
            const fallbackRates = {
                "USD_HTG": 132.5,
                "HTG_USD": 0.0075,
                "EUR_HTG": 143.0,
                "HTG_EUR": 0.0070,
                "USD_EUR": 0.92,
                "EUR_USD": 1.09
            };
            const pair = `${baseFrom}_${baseTo}`;
            if (fallbackRates[pair]) {
                const converted = (amount * fallbackRates[pair]).toFixed(2);
                return {
                    success: true,
                    amount,
                    from: baseFrom,
                    to: baseTo,
                    estimated: true,
                    result: `${amount} ${baseFrom} ≈ ${converted} ${baseTo} (taux indicatif)`
                };
            }

            return { error: `Impossible de convertir de ${baseFrom} vers ${baseTo} pour le moment.` };
        }

        case "clear_conversation_memory": {
            memory.clearHistory(m.from);
            return { success: true, message: "Historique de conversation effacé." };
        }

        default:
            return { error: `Outil inconnu : ${name}` };
    }
}
