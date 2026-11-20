import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config.cjs';
import supabaseManager from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'user_knowledge.json');

class ConversationLearner {
    constructor() {
        this.knowledge = {};
        this.init();
    }

    init() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirpSync(DATA_DIR);
            }
            if (fs.existsSync(KNOWLEDGE_FILE)) {
                this.knowledge = fs.readJsonSync(KNOWLEDGE_FILE);
            } else {
                this.knowledge = {};
                fs.writeJsonSync(KNOWLEDGE_FILE, this.knowledge, { spaces: 2 });
            }
        } catch (err) {
            console.error('Erreur chargement user_knowledge:', err);
            this.knowledge = {};
        }
    }

    save() {
        try {
            fs.writeJsonSync(KNOWLEDGE_FILE, this.knowledge, { spaces: 2 });
        } catch (err) {
            console.error('Erreur sauvegarde user_knowledge:', err);
        }
    }

    getProfile(jid) {
        if (!this.knowledge[jid]) {
            this.knowledge[jid] = {
                name: null,
                language: "Français",
                facts: [],
                topics: [],
                summary: "",
                turnCount: 0,
                lastUpdated: Date.now()
            };
        }
        return this.knowledge[jid];
    }

    /**
     * Génère la directive système enrichie des connaissances sur l'utilisateur
     */
    buildSystemInstruction(jid, baseInstruction) {
        const profile = this.getProfile(jid);
        const hasFacts = profile.facts && profile.facts.length > 0;
        const hasSummary = Boolean(profile.summary);

        if (!hasFacts && !hasSummary && !profile.name) {
            return baseInstruction;
        }

        let contextBlock = `\n\n══════════════════════════════════════════════════\n`;
        contextBlock += `🧠 MÉMOIRE ET CONTEXTE PROFOND SUR CET UTILISATEUR :\n`;
        if (profile.name) contextBlock += `- Prénom / Identité : ${profile.name}\n`;
        if (profile.language) contextBlock += `- Langue de prédilection : ${profile.language}\n`;

        if (hasFacts) {
            contextBlock += `- Ce que tu sais sur lui / elle (Faits et habitudes) :\n`;
            for (const fact of profile.facts.slice(-15)) {
                contextBlock += `  • ${fact}\n`;
            }
        }

        if (profile.topics && profile.topics.length > 0) {
            contextBlock += `- Sujets récurrents : ${profile.topics.join(', ')}\n`;
        }

        if (hasSummary) {
            contextBlock += `- Contexte des échanges passés : ${profile.summary}\n`;
        }

        contextBlock += `\nCONSIGNE D'ADAPTATION : Utilise naturellement ce contexte pour comprendre immédiatement à quoi il fait référence, personnaliser tes conseils, adapter ton ton et créer une relation de confiance continue sans répéter inutilement ces faits.\n`;
        contextBlock += `══════════════════════════════════════════════════\n`;

        return `${baseInstruction}\n${contextBlock}`;
    }

    /**
     * Apprend en tâche de fond (asynchrone) sans bloquer la conversation
     */
    async learnFromTurn(jid, userText, botReply, apiKey) {
        if (!userText || userText.length < 5 || !apiKey) return;

        // Éviter de lancer l'analyse sur des commandes simples
        if (userText.startsWith('.') || userText.startsWith('!') || userText.startsWith('/')) return;

        const profile = this.getProfile(jid);
        profile.turnCount = (profile.turnCount || 0) + 1;

        // Analyse cognitive déclenchée tous les 1 ou 2 messages significatifs
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            });

            const prompt = `Tu es un extracteur de mémoire et de connaissances sur un utilisateur pour un assistant IA.
Analyse cet échange récent :
Utilisateur : "${userText}"
Assistant : "${botReply.slice(0, 300)}"

Faits déjà connus sur cet utilisateur :
${JSON.stringify(profile.facts || [])}

Extrais UNIQUEMENT les NOUVELLES informations réelles, personnelles ou factuelles sur l'utilisateur s'il y en a (par exemple: son prénom, son travail, ses projets, ce qu'il aime ou déteste, ses proches, ses objectifs, ses contraintes).
Réponds STRICTEMENT sous ce format JSON :
{
  "detectedName": "string ou null",
  "newFacts": ["fait 1", "fait 2"],
  "mainTopic": "string ou null",
  "updatedContextSummary": "Court résumé mis à jour de ce dont parle l'utilisateur (max 2 phrases)"
}`;

            const res = await model.generateContent(prompt);
            const data = JSON.parse(res.response.text());

            let updated = false;

            if (data.detectedName && !profile.name) {
                profile.name = data.detectedName;
                updated = true;
            }

            if (Array.isArray(data.newFacts) && data.newFacts.length > 0) {
                for (const fact of data.newFacts) {
                    if (!profile.facts.includes(fact)) {
                        profile.facts.push(fact);
                        updated = true;
                    }
                }
                // Limiter à 25 faits majeurs les plus récents
                if (profile.facts.length > 25) {
                    profile.facts = profile.facts.slice(-25);
                }
            }

            if (data.mainTopic && !profile.topics.includes(data.mainTopic)) {
                profile.topics.push(data.mainTopic);
                if (profile.topics.length > 10) profile.topics.shift();
                updated = true;
            }

            if (data.updatedContextSummary) {
                profile.summary = data.updatedContextSummary;
                updated = true;
            }

            if (updated) {
                profile.lastUpdated = Date.now();
                this.save();
                if (supabaseManager.isConfigured()) {
                    supabaseManager.upsertProfile(jid, profile);
                }
                console.log(`🧠 [Apprentissage IA] Mémoire enrichie pour ${jid}:`, data.newFacts || data.detectedName);
            }
        } catch (err) {
            console.error("Erreur durant l'apprentissage de discussion:", err.message);
        }
    }

    /**
     * Oublie ou réinitialise la mémoire d'un utilisateur
     */
    resetProfile(jid) {
        if (this.knowledge[jid]) {
            this.knowledge[jid] = {
                name: null,
                language: "Français",
                facts: [],
                topics: [],
                summary: "",
                turnCount: 0,
                lastUpdated: Date.now()
            };
            this.save();
            return true;
        }
        return false;
    }
}

export const learner = new ConversationLearner();
export default learner;
