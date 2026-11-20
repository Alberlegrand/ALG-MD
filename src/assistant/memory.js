import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import supabaseManager from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const MEMORY_FILE = path.join(DATA_DIR, 'ai_memory.json');

const MAX_HISTORY_TURNS = 16;

class MemoryStore {
    constructor() {
        this.cache = {};
        this.init();
    }

    init() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirpSync(DATA_DIR);
            }
            if (fs.existsSync(MEMORY_FILE)) {
                this.cache = fs.readJsonSync(MEMORY_FILE);
            } else {
                this.cache = {};
                fs.writeJsonSync(MEMORY_FILE, this.cache, { spaces: 2 });
            }
        } catch (error) {
            console.error('Error initializing MemoryStore:', error);
            this.cache = {};
        }
    }

    save() {
        try {
            fs.writeJsonSync(MEMORY_FILE, this.cache, { spaces: 2 });
        } catch (error) {
            console.error('Error saving MemoryStore:', error);
        }
    }

    getHistory(jid) {
        if (!this.cache[jid]) {
            this.cache[jid] = {
                messages: [],
                profile: {},
                lastInteraction: Date.now()
            };
        }
        return this.cache[jid].messages || [];
    }

    addTurn(jid, userParts, modelParts) {
        if (!this.cache[jid]) {
            this.cache[jid] = { messages: [], profile: {}, lastInteraction: Date.now() };
        }

        const messages = this.cache[jid].messages;

        // Normalisation des parts pour le stockage (ne pas garder les énormes base64 dans l'historique permanent)
        const sanitizedUserParts = Array.isArray(userParts) ? userParts.map(part => {
            if (typeof part === 'string') return { text: part };
            if (part.text) return { text: part.text };
            if (part.inlineData) return { text: "[Image ou Audio partagé]" };
            return part;
        }) : [{ text: String(userParts) }];

        const sanitizedModelParts = Array.isArray(modelParts) ? modelParts.map(part => {
            if (typeof part === 'string') return { text: part };
            if (part.text) return { text: part.text };
            return part;
        }) : [{ text: String(modelParts) }];

        messages.push({ role: 'user', parts: sanitizedUserParts });
        messages.push({ role: 'model', parts: sanitizedModelParts });

        // Garder les N derniers tours
        if (messages.length > MAX_HISTORY_TURNS * 2) {
            this.cache[jid].messages = messages.slice(-MAX_HISTORY_TURNS * 2);
        }

        this.cache[jid].lastInteraction = Date.now();
        this.save();

        // Synchronisation avec Supabase si configuré
        if (supabaseManager.isConfigured()) {
            const userText = sanitizedUserParts.map(p => p.text).filter(Boolean).join(' ');
            const modelText = sanitizedModelParts.map(p => p.text).filter(Boolean).join(' ');
            if (userText) supabaseManager.saveMessage(jid, 'user', userText);
            if (modelText) supabaseManager.saveMessage(jid, 'model', modelText);
        }
    }

    clearHistory(jid) {
        if (this.cache[jid]) {
            this.cache[jid].messages = [];
            this.save();
            if (supabaseManager.isConfigured()) {
                supabaseManager.clearHistory(jid);
            }
            return true;
        }
        return false;
    }

    setProfile(jid, key, value) {
        if (!this.cache[jid]) {
            this.cache[jid] = { messages: [], profile: {}, lastInteraction: Date.now() };
        }
        if (!this.cache[jid].profile) {
            this.cache[jid].profile = {};
        }
        this.cache[jid].profile[key] = value;
        this.save();
    }

    getProfile(jid) {
        return this.cache[jid]?.profile || {};
    }

    addNote(jid, note) {
        if (!this.cache[jid]) {
            this.cache[jid] = { messages: [], profile: {}, notes: [], lastInteraction: Date.now() };
        }
        if (!this.cache[jid].notes) {
            this.cache[jid].notes = [];
        }
        const noteId = Date.now();
        this.cache[jid].notes.push({
            id: noteId,
            text: note,
            createdAt: new Date().toISOString()
        });
        this.save();

        if (supabaseManager.isConfigured()) {
            supabaseManager.addNote(jid, note, noteId);
        }
        return this.cache[jid].notes;
    }

    getNotes(jid) {
        return this.cache[jid]?.notes || [];
    }

    deleteNote(jid, noteId) {
        if (!this.cache[jid] || !this.cache[jid].notes) return false;
        this.cache[jid].notes = this.cache[jid].notes.filter(n => n.id !== noteId && n.text !== noteId);
        this.save();
        return true;
    }
}

export const memory = new MemoryStore();
export default memory;
