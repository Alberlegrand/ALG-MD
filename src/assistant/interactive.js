import { generateWAMessageFromContent, proto, prepareWAMessageMedia } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import config from '../../config.cjs';

/**
 * Envoie un message avec boutons interactifs cliquables et/ou liste déroulante (NativeFlow)
 */
export async function sendInteractiveButtons(sock, jid, { text, footer, title, buttons = [], quoted = null, image = null }) {
    const cleanJid = jid.includes(':') ? jid.split(':')[0] + '@s.whatsapp.net' : jid;

    // Normalisation des boutons pour le format Baileys NativeFlow
    const formattedButtons = buttons.map(btn => {
        // Bouton déjà préparé avec name et buttonParamsJson
        if (btn.name && btn.buttonParamsJson) {
            return btn;
        }

        // Bouton URL (lien web)
        if (btn.url) {
            return {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text || "Visiter le lien",
                    url: btn.url,
                    merchant_url: btn.url
                })
            };
        }

        // Bouton Copier (code promo ou texte)
        if (btn.copy) {
            return {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text || "Copier",
                    id: btn.copy,
                    copy_code: btn.copy
                })
            };
        }

        // Bouton Réponse Rapide standard
        return {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: btn.text || btn.display_text || "Option",
                id: btn.id || btn.text || "action"
            })
        };
    });

    // Préparation de l'en-tête (avec image si disponible pour un rendu style carte professionnelle)
    let header = null;
    const defaultImg = path.join(process.cwd(), 'src', 'hitdev.jpg');
    const imgPath = image || (fs.existsSync(defaultImg) ? defaultImg : null);

    if (imgPath && fs.existsSync(imgPath) && typeof sock.waUploadToServer === 'function') {
        try {
            const media = await prepareWAMessageMedia({ image: fs.readFileSync(imgPath) }, { upload: sock.waUploadToServer });
            header = proto.Message.InteractiveMessage.Header.create({
                ...media,
                title: title || "",
                hasMediaAttachment: true
            });
        } catch (_) {}
    }

    if (!header) {
        header = proto.Message.InteractiveMessage.Header.create({
            title: title || "",
            hasMediaAttachment: false
        });
    }

    const interactiveMessage = proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({
            text: text || ""
        }),
        footer: proto.Message.InteractiveMessage.Footer.create({
            text: footer || `© ${config.botname || "ALG-MD"} Assistant`
        }),
        header,
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: formattedButtons
        }),
        contextInfo: {
            mentionedJid: [cleanJid],
            forwardingScore: 999,
            isForwarded: true
        }
    });

    const msg = generateWAMessageFromContent(cleanJid, {
        interactiveMessage
    }, { userJid: sock.user?.id });

    // Enregistrement dans le cache de messages pour répondre aux requêtes de retry E2EE de WhatsApp
    if (typeof sock.cacheMessage === 'function' && msg.key?.id) {
        sock.cacheMessage(msg.key.id, msg.message);
    }

    await sock.relayMessage(cleanJid, msg.message, { messageId: msg.key.id });
    console.log(`🔘 [Boutons envoyés] vers ${cleanJid} (${formattedButtons.length} boutons actifs)`);
    return msg;
}

/**
 * Envoie un menu déroulant / liste de choix interactive
 */
export async function sendInteractiveList(sock, jid, { text, footer, title, buttonText = "Sélectionner une option", sections = [], quoted = null }) {
    const cleanJid = jid.includes(':') ? jid.split(':')[0] + '@s.whatsapp.net' : jid;

    const listButton = {
        name: "single_select",
        buttonParamsJson: JSON.stringify({
            title: buttonText,
            sections: sections.map(sec => ({
                title: sec.title,
                rows: sec.rows.map(row => ({
                    header: row.header || "",
                    title: row.title,
                    description: row.description || "",
                    id: row.id
                }))
            }))
        })
    };

    return await sendInteractiveButtons(sock, cleanJid, {
        title,
        text,
        footer,
        buttons: [listButton],
        quoted
    });
}

/**
 * Tableau de Bord Principal Interactif avec Boutons & Menu Déroulant
 */
export async function sendMainMenu(sock, jid, quoted = null) {
    const cleanJid = jid.includes(':') ? jid.split(':')[0] + '@s.whatsapp.net' : jid;
    const prefix = config.PREFIX || '.';
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const geminiKey = config.GEMINI_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;
    const geminiStatus = config.AI_ASSISTANT_ENABLED === false
        ? "Désactivé"
        : geminiKey
            ? `Activé (${config.AI_MODEL || "gemini-3.5-flash"})`
            : "Non configuré — clé GEMINI_KEY manquante";

    const menuText = `╭─────────────━┈⊷
│ 🤖 *${config.botname || "ALG-MD"} Assistant*
│ 👑 *Propriétaire :* ${config.OWNER_NAME || "Berny"}
│ ⏱️ *Uptime :* ${hours}h ${minutes}m
│ ⚡ *Préfixe :* [ ${prefix} ]
│ 🧠 *Gemini :* ${geminiStatus}
│ 💾 *Base :* Supabase Cloud
╰─────────────━┈⊷

📌 *Commandes rapides*
├ ${prefix}play <titre> — musique
├ ${prefix}tiktok <lien> — vidéo TikTok
├ ${prefix}sticker — créer un sticker
├ ${prefix}tagall — mentionner le groupe
├ ${prefix}ping — tester le bot
└ Posez une question sans préfixe pour parler à Gemini.

Cliquez sur le menu déroulant pour parcourir les catégories.`;

    // Sections du menu déroulant complet
    const sections = [
        {
            title: "🧠 ASSISTANT & IA",
            rows: [
                { title: "🤖 Poser une question à l'IA", id: "action_ask_ai", description: "Discuter en langage naturel" },
                { title: "⏰ Programmer un rappel", id: "action_create_reminder", description: "Créer un rappel automatique" },
                { title: "🧠 Profil mémorisé", id: "action_inspect_profile", description: "Que sais-tu sur moi ?" },
                { title: "📝 Notes & Mémos", id: "action_get_notes", description: "Consulter vos notes" },
                { title: "📊 Résumer le groupe", id: "action_summarize_group", description: "Synthèse des discussions" }
            ]
        },
        {
            title: "📥 TÉLÉCHARGEMENT & MÉDIAS",
            rows: [
                { title: "🎵 Télécharger MP3 (.play)", id: `${prefix}play`, description: "Musique YouTube en audio" },
                { title: "🎬 Télécharger Vidéo (.video)", id: `${prefix}video`, description: "Vidéo YouTube MP4" },
                { title: "📱 Vidéo TikTok (.tiktok)", id: `${prefix}tiktok`, description: "Sans filigrane" },
                { title: "📸 Image Pinterest (.pinterest)", id: `${prefix}pinterest`, description: "Recherche d'images" },
                { title: "🎨 Créer un Sticker (.s)", id: `${prefix}s`, description: "Image en sticker" }
            ]
        },
        {
            title: "👥 GESTION DE GROUPE",
            rows: [
                { title: "📢 Taguer Tout le Monde (.tagall)", id: `${prefix}tagall`, description: "Mentionner tous les membres" },
                { title: "🔗 Lien du Groupe (.link)", id: `${prefix}link`, description: "Lien d'invitation" },
                { title: "🛡️ Anti-Lien (.antilink)", id: `${prefix}antilink on`, description: "Activer la protection" },
                { title: "ℹ️ Infos Groupe (.groupinfo)", id: `${prefix}groupinfo`, description: "Détails et membres" }
            ]
        },
        {
            title: "🛠️ SYSTÈME & OUTILS",
            rows: [
                { title: "⚡ Latence & Ping (.ping)", id: `${prefix}ping`, description: "Tester la réactivité" },
                { title: "🟢 État du Bot (.alive)", id: `${prefix}alive`, description: "Vérifier le statut" },
                { title: "💱 Convertisseur Devises", id: "action_currency", description: "USD / HTG / EUR" }
            ]
        }
    ];

    // Boutons cliquables : Menu déroulant + Boutons de raccourcis
    const buttons = [
        {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
                title: "📂 TOUTES LES COMMANDES",
                sections
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "⚡ Ping",
                id: `${prefix}ping`
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "🤖 Parler à l'IA",
                id: "Bonjour ! Comment peux-tu m'aider aujourd'hui ?"
            })
        }
    ];

    // 1. Envoi du texte complet garanti (immédiat, 100% lisible, 0 attente E2EE)
    try {
        await sock.sendMessage(cleanJid, { text: menuText });
    } catch (_) {}

    // 2. Envoi des boutons interactifs en complément
    try {
        await sendInteractiveButtons(sock, cleanJid, {
            title: "🌟 ALG-MD • OPTIONS INTERACTIVES 🌟",
            text: "Cliquez sur une option rapide ci-dessous :",
            footer: `© ${config.botname || "ALG-MD"} • Assistant Intelligent`,
            buttons
        });
        console.log(`📋 [Menu avec Boutons Envoyé] vers ${cleanJid}`);
    } catch (err) {
        console.error("❌ Erreur envoi boutons interactifs:", err.message || err);
    }
}

/**
 * Message de Bienvenue Interactif avec Boutons de Lancement
 */
export async function sendWelcomeMessage(sock, jid) {
    const cleanJid = jid.includes(':') ? jid.split(':')[0] + '@s.whatsapp.net' : jid;
    const prefix = config.PREFIX || '.';

    const text = `🌟 *BIENVENUE SUR ${config.AI_ASSISTANT_NAME || "ALG-MD ASSISTANT"}* 🌟

Votre assistant intelligent est désormais connecté et prêt à l'emploi !

✨ *Capacités actives :*
🧠 *Intelligence Artificielle :* Gemini 3.5 Flash
💾 *Mémoire Cognitive :* Supabase Cloud active
⚡ *Outils Disponibles :* 90+ commandes intégrées
📱 *Mode :* ${config.MODE || "public"}

Appuyez sur un bouton ci-dessous pour démarrer immédiatement :`;

    const buttons = [
        {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
                title: "📂 Ouvrir le Menu",
                sections: [
                    {
                        title: "🚀 Démarrage Rapide",
                        rows: [
                            { title: "📋 Menu Complet", id: `${prefix}menu`, description: "Toutes les commandes du bot" },
                            { title: "🤖 Poser une question à l'IA", id: "action_ask_ai", description: "Discuter avec Gemini" },
                            { title: "⚡ Test Ping", id: `${prefix}ping`, description: "Vérifier la latence" },
                            { title: "⏰ Poser un rappel", id: "action_create_reminder", description: "Rappels programmés" }
                        ]
                    }
                ]
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "📂 Menu Principal",
                id: `${prefix}menu`
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "⚡ Ping",
                id: `${prefix}ping`
            })
        },
        {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
                display_text: "📢 Canal Officiel",
                url: "https://whatsapp.com/channel/0029VaDAkV9FHWqAMMHvb40b",
                merchant_url: "https://whatsapp.com/channel/0029VaDAkV9FHWqAMMHvb40b"
            })
        }
    ];

    try {
        await sendInteractiveButtons(sock, cleanJid, {
            title: "🚀 ASSISTANT PRÊT & CONNECTÉ",
            text,
            footer: `© ${config.botname || "ALG-MD"}`,
            buttons
        });
        console.log(`🎉 [Welcome Message avec Boutons Envoyé] vers ${cleanJid}`);
    } catch (err) {
        console.error("❌ Erreur envoi welcome message avec boutons:", err.message || err);
        try {
            const fallback = await sock.sendMessage(cleanJid, { text });
            console.log(`✉️ [Welcome texte envoyé] vers ${cleanJid}`);
            return fallback;
        } catch (fallbackError) {
            console.error("❌ Échec de l'envoi du message de bienvenue en texte:", fallbackError.message || fallbackError);
            throw fallbackError;
        }
    }
}
