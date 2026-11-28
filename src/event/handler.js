import { serialize, decodeJid } from '../../lib/Serializer.js';
import path from 'path';
import fs from 'fs/promises';
import config from '../../config.cjs';
import { smsg } from '../../lib/myfunc.cjs';
import { handleAntilink } from './antilink.js';
import { fileURLToPath } from 'url';
import { handleAssistantMessage } from '../assistant/aiAssistant.js';
import reminderManager from '../assistant/reminders.js';
import groupBuffer from '../assistant/groupBuffer.js';
import { sendMainMenu } from '../assistant/interactive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache mémoire des plugins pour éviter les lectures disques à chaque message
let cachedPlugins = null;

async function loadPlugins() {
    if (cachedPlugins) return cachedPlugins;
    const pluginDir = path.join(__dirname, '..', 'plugin');
    try {
        const pluginFiles = await fs.readdir(pluginDir);
        const loaded = [];

        for (const file of pluginFiles) {
            if (file.endsWith('.js')) {
                const pluginPath = path.join(pluginDir, file);
                try {
                    const pluginModule = await import(`file://${pluginPath}`);
                    if (typeof pluginModule.default === 'function') {
                        loaded.push({ file, execute: pluginModule.default });
                    }
                } catch (err) {
                    console.error(`Failed to preload plugin: ${file}`, err);
                }
            }
        }
        cachedPlugins = loaded;
        console.log(`🤖 [ALG-MD] ${cachedPlugins.length} plugins chargés en mémoire.`);
        return cachedPlugins;
    } catch (err) {
        console.error('Error reading plugin directory:', err);
        return [];
    }
}

// Préchargement immédiat
loadPlugins();

// Function to get group admins
export const getGroupAdmins = (participants) => {
    let admins = [];
    for (let i of participants) {
        if (i.admin === "superadmin" || i.admin === "admin") {
            admins.push(i.id);
        }
    }
    return admins || [];
};

const Handler = async (chatUpdate, sock, logger) => {
    try {
        if (!chatUpdate.messages || !chatUpdate.messages[0]) return;

        const m = serialize(JSON.parse(JSON.stringify(chatUpdate.messages[0])), sock, logger);
        if (!m.message) return;

        console.log(`📩 [Message reçu] de ${m.sender || m.from} : "${m.body}"`);

        // Liaison de la socket avec le gestionnaire de rappels
        reminderManager.setSocket(sock);

        const botNumber = await sock.decodeJid(sock.user.id);
        const ownerNumber = (config.OWNER_NUMBER || "").replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        const isCreator = m.sender === ownerNumber || m.sender === botNumber || m.isSelf || Boolean(m.key && m.key.fromMe);

        // Filtrage mode privé/public
        if (!sock.public && !isCreator) {
            return;
        }

        const cleanBody = (m.body || "").trim().toLowerCase();
        const prefix = config.PREFIX || '.';
        const menuCommands = new Set([
            'menu', 'help', 'list',
            `${prefix}menu`, `${prefix}help`, `${prefix}list`,
            '.menu', '.help', '!menu', '!help', '/menu', '/help', '#menu', '#help'
        ]);
        const command = cleanBody.split(/\s+/, 1)[0];
        if (menuCommands.has(command)) {
            console.log(`📋 [Menu demandé] par ${m.sender || m.from} (envoi vers ${m.from})`);
            await sendMainMenu(sock, m.from, m);
            return;
        }

        const participants = m.isGroup ? await sock.groupMetadata(m.from).then(metadata => metadata.participants).catch(() => []) : [];
        const groupAdmins = m.isGroup ? getGroupAdmins(participants) : [];
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const isBotAdmins = m.isGroup ? groupAdmins.includes(botId) : false;
        const isAdmins = m.isGroup ? groupAdmins.includes(m.sender) : false;

        const PREFIX = /^[\\/!#.]/;
        const isCOMMAND = (body) => PREFIX.test(body);
        const hasPrefix = m.body && isCOMMAND(m.body);

        // Gestion de l'anti-lien dans les groupes
        await handleAntilink(m, sock, logger, isBotAdmins, isAdmins, isCreator);

        // Mémorisation du message pour le résumé intelligent de groupe
        if (m.isGroup && m.body) {
            const senderName = m.pushName || m.sender.split('@')[0];
            groupBuffer.record(m.from, senderName, m.body);
        }

        // 2. Traitement des sélections de la liste interactive
        if (m.body && m.body.startsWith('action_')) {
            const actionMap = {
                'action_ask_ai': "Bonjour ! Présente-toi et dis-moi comment tu peux m'aider aujourd'hui.",
                'action_inspect_profile': "Que sais-tu sur moi ?",
                'action_summarize_group': "Fais un résumé des récents messages de ce groupe.",
                'action_get_notes': "Quelles sont les notes et mémos que tu as enregistrés pour moi ?",
                'action_currency': "Combien font 100 USD en gourdes haïtiennes HTG ?",
                'action_make_sticker': "Explique-moi comment je peux créer un sticker avec toi.",
                'action_create_reminder': "Comment puis-je te demander de me poser un rappel ?",
                'action_group_link': "Donne-moi le lien d'invitation de ce groupe WhatsApp.",
                'action_group_info': "Affiche les informations complètes de ce groupe WhatsApp.",
                'action_web_search': "Fais une recherche sur les dernières actualités importantes."
            };
            m.body = actionMap[m.body] || m.body;
            await handleAssistantMessage(m, sock, logger);
            return;
        }

        // 3. CAS D'UNE COMMANDE CLASSIQUE (Commence par un préfixe: ., !, #, /)
        if (hasPrefix) {
            const plugins = await loadPlugins();
            for (const { execute, file } of plugins) {
                try {
                    await execute(m, sock);
                } catch (err) {
                    console.error(`Error in plugin ${file}:`, err);
                }
            }
            return;
        }

        // 2. CAS D'UN MESSAGE SANS PRÉFIXE : ROUTAGE VERS L'ASSISTANT IA INTELLIGENT
        if (config.AI_ASSISTANT_ENABLED !== false && !m.key.fromMe) {
            let shouldTriggerAssistant = false;

            if (!m.isGroup) {
                // En discussion privée avec le bot : n'importe quel message déclenche l'assistant
                shouldTriggerAssistant = true;
            } else {
                // Dans un groupe : déclenché si le bot est mentionné ou si on répond à l'un de ses messages
                const botJidRaw = sock.user.id.split(':')[0];
                const mentions = m.message?.[m.type]?.contextInfo?.mentionedJid || [];
                const isMentioned = mentions.some(jid => jid.includes(botJidRaw)) || (m.body && m.body.includes(`@${botJidRaw}`));
                const isReplyingToBot = m.quoted && m.quoted.isSelf;

                if (isMentioned || isReplyingToBot) {
                    shouldTriggerAssistant = true;
                }
            }

            if (shouldTriggerAssistant) {
                await handleAssistantMessage(m, sock, logger);
            }
        }

    } catch (e) {
        console.error('Error in Handler:', e);
    }
};

export default Handler;
