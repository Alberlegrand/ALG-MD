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
        if (chatUpdate.type !== 'notify') return;

        const m = serialize(JSON.parse(JSON.stringify(chatUpdate.messages[0])), sock, logger);
        if (!m.message) return;

        // Liaison de la socket avec le gestionnaire de rappels
        reminderManager.setSocket(sock);

        const participants = m.isGroup ? await sock.groupMetadata(m.from).then(metadata => metadata.participants).catch(() => []) : [];
        const groupAdmins = m.isGroup ? getGroupAdmins(participants) : [];
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const isBotAdmins = m.isGroup ? groupAdmins.includes(botId) : false;
        const isAdmins = m.isGroup ? groupAdmins.includes(m.sender) : false;

        const PREFIX = /^[\\/!#.]/;
        const isCOMMAND = (body) => PREFIX.test(body);
        const hasPrefix = m.body && isCOMMAND(m.body);

        const botNumber = await sock.decodeJid(sock.user.id);
        const ownerNumber = (config.OWNER_NUMBER || "").replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        const isCreator = m.sender === ownerNumber || m.sender === botNumber;

        // Filtrage mode privé/public
        if (!sock.public && !isCreator) {
            return;
        }

        // Gestion de l'anti-lien dans les groupes
        await handleAntilink(m, sock, logger, isBotAdmins, isAdmins, isCreator);

        // Mémorisation du message pour le résumé intelligent de groupe
        if (m.isGroup && m.body) {
            const senderName = m.pushName || m.sender.split('@')[0];
            groupBuffer.record(m.from, senderName, m.body);
        }

        // 1. CAS D'UNE COMMANDE CLASSIQUE (Commence par un préfixe: ., !, #, /)
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
