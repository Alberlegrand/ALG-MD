import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../../config.cjs';
import memory from './memory.js';
import { geminiToolDeclarations, executeTool } from './tools.js';
import reminderManager from './reminders.js';
import learner from './learner.js';
import { sendInteractiveButtons } from './interactive.js';

const SYSTEM_INSTRUCTION = `
Tu es ALG Assistant, un assistant personnel et professionnel IA hautement compétent, conçu pour WhatsApp.
Ton rôle est d'aider ton interlocuteur de manière amicale, intelligente, concise et percutante.

Règles de comportement :
1. Style de communication : Adapte-toi au format WhatsApp. Sois concis, clair, utilise des listes à puces et du gras (*mot*) pour mettre en valeur les informations clés. Utilise des émojis pertinents avec modération.
2. Langues : Tu réponds dans la langue employée par l'utilisateur (Français, Créole haïtien, Anglais, Espagnol, etc.).
3. Outils disponibles :
   - Si l'utilisateur demande de se rappeler de quelque chose ou de lui poser un rappel, utilise systématiquement l'outil 'create_reminder'.
   - Si l'utilisateur demande l'heure ou la date, utilise 'get_current_time'.
   - Si l'utilisateur pose une question sur un fait d'actualité récente, utilise 'search_web'.
   - Si l'utilisateur demande d'effacer ou d'oublier la discussion, utilise 'clear_conversation_memory'.
4. Images et Audios : Si l'utilisateur partage une image ou une note vocale, analyse-la avec précision et réponds directement à sa demande.
`;

export async function handleAssistantMessage(m, sock, logger) {
    const apiKey = config.GEMINI_KEY || process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
        if (!m.isGroup) {
            await m.reply(
                `👋 *Bonjour ! Je suis ${config.AI_ASSISTANT_NAME || "ALG Assistant"}.*\n\n` +
                `Pour activer mon intelligence artificielle conversationnelle, veuillez configurer votre clé d'API Gemini gratuite dans votre fichier *.env* :\n` +
                `\`GEMINI_KEY=votre_cle_api\`\n\n` +
                `🔗 Obtenez votre clé gratuite en 30 secondes sur : https://aistudio.google.com/`
            );
        }
        return;
    }

    try {
        // Enregistrer la socket pour les rappels automatiques
        reminderManager.setSocket(sock);

        // Réaction pour indiquer la prise en charge
        await m.React("💭");

        const genAI = new GoogleGenerativeAI(apiKey);
        const modelName = config.AI_MODEL || "gemini-1.5-flash";
        const dynamicSystemInstruction = learner.buildSystemInstruction(m.from, SYSTEM_INSTRUCTION);
        const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: dynamicSystemInstruction,
            tools: [{ functionDeclarations: geminiToolDeclarations }]
        });

        // 1. Préparation du contenu du message utilisateur
        const userParts = [];
        let promptText = m.body || "";

        // Nettoyer d'éventuelles mentions de bot dans les groupes
        const botId = sock.user.id.split(':')[0];
        promptText = promptText.replace(new RegExp(`@${botId}`, 'g'), '').trim();

        // 2. Gestion des médias entrants (Image)
        if (m.type === 'imageMessage') {
            try {
                const mediaBuffer = await m.download();
                if (mediaBuffer) {
                    userParts.push({
                        inlineData: {
                            data: Buffer.from(mediaBuffer).toString('base64'),
                            mimeType: 'image/jpeg'
                        }
                    });
                }
            } catch (err) {
                console.error("Erreur téléchargement image directe:", err);
            }
        } else if (m.quoted && m.quoted.mtype === 'imageMessage') {
            try {
                const mediaBuffer = await m.quoted.download();
                if (mediaBuffer) {
                    userParts.push({
                        inlineData: {
                            data: Buffer.from(mediaBuffer).toString('base64'),
                            mimeType: 'image/jpeg'
                        }
                    });
                }
            } catch (err) {
                console.error("Erreur téléchargement image citée:", err);
            }
        }

        // 3. Gestion des médias entrants (Audio / Notes vocales)
        if (m.type === 'audioMessage') {
            try {
                const audioBuffer = await m.download();
                if (audioBuffer) {
                    userParts.push({
                        inlineData: {
                            data: Buffer.from(audioBuffer).toString('base64'),
                            mimeType: 'audio/ogg'
                        }
                    });
                    if (!promptText) {
                        promptText = "Voici un message vocal de l'utilisateur. Écoute-le attentivement, comprends sa demande et réponds-y.";
                    }
                }
            } catch (err) {
                console.error("Erreur téléchargement audio direct:", err);
            }
        } else if (m.quoted && m.quoted.mtype === 'audioMessage') {
            try {
                const audioBuffer = await m.quoted.download();
                if (audioBuffer) {
                    userParts.push({
                        inlineData: {
                            data: Buffer.from(audioBuffer).toString('base64'),
                            mimeType: 'audio/ogg'
                        }
                    });
                }
            } catch (err) {
                console.error("Erreur téléchargement audio cité:", err);
            }
        }

        // 4. Gestion des documents (PDF et fichiers texte)
        const isDoc = m.type === 'documentMessage' || (m.quoted && m.quoted.mtype === 'documentMessage');
        if (isDoc) {
            try {
                const docTarget = m.type === 'documentMessage' ? m : m.quoted;
                const docBuffer = await docTarget.download();
                const mime = docTarget.message?.documentMessage?.mimetype || "application/pdf";
                const filename = docTarget.message?.documentMessage?.fileName || "document";

                if (docBuffer) {
                    if (mime.includes('pdf')) {
                        userParts.push({
                            inlineData: {
                                data: Buffer.from(docBuffer).toString('base64'),
                                mimeType: 'application/pdf'
                            }
                        });
                        promptText = `[Document PDF attaché : "${filename}"]\n${promptText || "Analyse ce document PDF et résume-le ou réponds aux questions s'y rapportant."}`;
                    } else if (mime.includes('text') || filename.endsWith('.txt') || filename.endsWith('.json') || filename.endsWith('.js') || filename.endsWith('.md')) {
                        const fileContent = docBuffer.toString('utf-8').slice(0, 50000); // 50k caractères max
                        promptText = `[Fichier texte "${filename}"] :\n\`\`\`\n${fileContent}\n\`\`\`\n\nDemande : ${promptText || "Analyse ce fichier."}`;
                    }
                }
            } catch (err) {
                console.error("Erreur téléchargement document:", err);
            }
        }

        // Si l'utilisateur cite un message texte, l'inclure comme contexte
        if (m.quoted && m.quoted.text && !userParts.some(p => p.inlineData)) {
            promptText = `[Message cité: "${m.quoted.text}"]\n${promptText}`;
        }

        if (promptText) {
            userParts.push({ text: promptText });
        }

        if (userParts.length === 0) {
            await m.React("❓");
            return;
        }

        // 4. Récupérer l'historique de conversation
        const conversationHistory = memory.getHistory(m.from);

        // Construire les contents complets pour Gemini
        let contents = [
            ...conversationHistory,
            { role: 'user', parts: userParts }
        ];

        // 5. Appel à Gemini avec boucle d'exécution des fonctions (Tool Calling)
        let response = await model.generateContent({ contents });
        let responseText = "";
        let turns = 0;

        while (turns < 3) {
            turns++;
            const candidate = response.response.candidates?.[0];
            const functionCalls = candidate?.content?.parts?.filter(part => part.functionCall);

            if (functionCalls && functionCalls.length > 0) {
                // Ajouter la réponse avec appel de fonction au fil de discussion
                contents.push(candidate.content);

                const toolResponses = [];
                for (const call of functionCalls) {
                    const { name, args } = call.functionCall;
                    const toolResult = await executeTool(name, args, { m, sock, logger });
                    toolResponses.push({
                        functionResponse: {
                            name,
                            response: { result: toolResult }
                        }
                    });
                }

                // Réinjecter le résultat dans Gemini
                contents.push({ role: 'function', parts: toolResponses });
                response = await model.generateContent({ contents });
            } else {
                responseText = response.response.text();
                break;
            }
        }

        if (!responseText && response.response.text) {
            responseText = response.response.text();
        }

        // 6. Sauvegarder dans la mémoire
        if (responseText) {
            memory.addTurn(m.from, userParts, [{ text: responseText }]);

            // Envoi interactif avec boutons en discussion privée ou texte classique en groupe
            try {
                if (!m.isGroup) {
                    await sendInteractiveButtons(sock, m.from, {
                        text: responseText,
                        buttons: [
                            { text: "📋 Menu Options", id: ".menu" },
                            { text: "🎙️ Écouter en Vocal", id: "Répète ta réponse précédente sous forme de note vocale audio" }
                        ],
                        quoted: m
                    });
                } else {
                    await m.reply(responseText);
                }
            } catch (_) {
                await m.reply(responseText);
            }

            await m.React("✅");

            // 7. Apprentissage continu en tâche de fond (sans bloquer la réponse)
            learner.learnFromTurn(m.from, promptText, responseText, apiKey).catch(e => {
                console.error("Erreur apprentissage continu:", e.message);
            });
        } else {
            await m.React("⚠️");
        }

    } catch (error) {
        console.error("Erreur dans handleAssistantMessage:", error);
        await m.React("❌");
        await m.reply(`⚠️ *Oups, une erreur est survenue dans l'assistant :* ${error.message || error}`);
    }
}

export default handleAssistantMessage;
