import pkg from '@whiskeysockets/baileys';
const { generateWAMessageFromContent, proto } = pkg;
import config from '../../config.cjs';

/**
 * Envoie un message avec boutons interactifs cliquables (NativeFlow)
 */
export async function sendInteractiveButtons(sock, jid, { text, footer, title, buttons = [], quoted = null }) {
    const formattedButtons = buttons.map(btn => {
        if (btn.url) {
            return {
                name: "cta_url",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    url: btn.url,
                    merchant_url: btn.url
                })
            };
        } else if (btn.copy) {
            return {
                name: "cta_copy",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    id: btn.copy,
                    copy_code: btn.copy
                })
            };
        } else {
            return {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                    display_text: btn.text,
                    id: btn.id || btn.text
                })
            };
        }
    });

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({
                        text: text || ""
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.create({
                        text: footer || config.caption || `© ${config.botname || "ALG-MD"} Assistant`
                    }),
                    header: proto.Message.InteractiveMessage.Header.create({
                        title: title || "",
                        hasMediaAttachment: false
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: formattedButtons
                    }),
                    contextInfo: quoted ? { quotedMessage: quoted.message || quoted } : {}
                })
            }
        }
    }, {});

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
}

/**
 * Envoie un menu déroulant / liste de choix interactive
 */
export async function sendInteractiveList(sock, jid, { text, footer, title, buttonText = "Sélectionner une option", sections = [], quoted = null }) {
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

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({
                        text: text || ""
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.create({
                        text: footer || config.caption || `© ${config.botname || "ALG-MD"} Assistant`
                    }),
                    header: proto.Message.InteractiveMessage.Header.create({
                        title: title || "",
                        hasMediaAttachment: false
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: [listButton]
                    }),
                    contextInfo: quoted ? { quotedMessage: quoted.message || quoted } : {}
                })
            }
        }
    }, {});

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
}

/**
 * Tableau de Bord Principal Interactif (Boutons + Liste)
 */
export async function sendMainMenu(sock, jid, quoted = null) {
    const text = `👋 *Bonjour ! Je suis ${config.AI_ASSISTANT_NAME || "ALG Assistant"}.*

Je suis votre assistant intelligent WhatsApp tout-en-un.
Choisissez une catégorie ou une action ci-dessous :`;

    const sections = [
        {
            title: "🧠 Intelligence Artificielle & Productivité",
            rows: [
                {
                    title: "🤖 Poser une question à l'IA",
                    description: "Discutez en langage naturel avec Gemini",
                    id: "action_ask_ai"
                },
                {
                    title: "⏰ Programmer un rappel",
                    description: "Recevez une alerte WhatsApp automatique",
                    id: "action_create_reminder"
                },
                {
                    title: "🧠 Que sais-tu sur moi ?",
                    description: "Affichez votre profil cognitif mémorisé",
                    id: "action_inspect_profile"
                },
                {
                    title: "🎨 Créer un sticker",
                    description: "Transformez une photo en autocollant",
                    id: "action_make_sticker"
                },
                {
                    title: "📝 Mes notes enregistrées",
                    description: "Consultez votre deuxième cerveau",
                    id: "action_get_notes"
                }
            ]
        },
        {
            title: "📥 Téléchargements de Médias",
            rows: [
                {
                    title: "🎵 Musique YouTube (MP3)",
                    description: "Téléchargez des titres en audio haute qualité",
                    id: ".play"
                },
                {
                    title: "🎬 Vidéo TikTok",
                    description: "Téléchargez sans filigrane",
                    id: ".tiktok"
                },
                {
                    title: "📸 Instagram Reel / Post",
                    description: "Téléchargez des médias Instagram",
                    id: ".insta"
                },
                {
                    title: "📱 APK Android",
                    description: "Téléchargez des applications Aptoide",
                    id: ".apk"
                }
            ]
        },
        {
            title: "👥 Outils de Groupe",
            rows: [
                {
                    title: "📊 Résumer ce groupe",
                    description: "Synthèse IA des derniers messages échangés",
                    id: "action_summarize_group"
                },
                {
                    title: "🔗 Lien d'invitation du groupe",
                    description: "Obtenez le lien officiel du groupe",
                    id: "action_group_link"
                },
                {
                    title: "ℹ️ Informations du groupe",
                    description: "Membres, admins et détails",
                    id: "action_group_info"
                }
            ]
        },
        {
            title: "🛠️ Outils & Utilitaires",
            rows: [
                {
                    title: "💱 Convertisseur de devises",
                    description: "USD, HTG Gourdes, EUR, CAD en direct",
                    id: "action_currency"
                },
                {
                    title: "🌐 Recherche Web",
                    description: "Recherchez des faits et actualités",
                    id: "action_web_search"
                },
                {
                    title: "⚡ Vitesse & Statut du bot",
                    description: "Uptime, mémoire et état du serveur",
                    id: ".ping"
                }
            ]
        }
    ];

    const buttons = [
        {
            name: "single_select",
            buttonParamsJson: JSON.stringify({
                title: "📂 Ouvrir le Menu des Options",
                sections
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "⚡ Ping / Uptime",
                id: ".ping"
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "🤖 Parler à l'Assistant",
                id: "Bonjour ! Comment peux-tu m'aider aujourd'hui ?"
            })
        }
    ];

    const msg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({
                        text
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.create({
                        text: `🤖 ${config.AI_ASSISTANT_NAME || "ALG Assistant"} • Mode Interactif`
                    }),
                    header: proto.Message.InteractiveMessage.Header.create({
                        title: "🌟 TABLEAU DE BORD INTERACTIF 🌟",
                        hasMediaAttachment: false
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons
                    }),
                    contextInfo: quoted ? { quotedMessage: quoted.message || quoted } : {}
                })
            }
        }
    }, {});

    await sock.relayMessage(jid, msg.message, { messageId: msg.key.id });
    return msg;
}
