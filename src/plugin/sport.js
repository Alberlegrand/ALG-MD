import { promises as fs } from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import config from '../../config.cjs';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);
const chatHistoryFile = path.resolve(__dirname, '../live_score_history.json');

async function readChatHistoryFromFile() {
    try {
        const data = await fs.readFile(chatHistoryFile, "utf-8");
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

async function writeChatHistoryToFile(chatHistory) {
    try {
        await fs.writeFile(chatHistoryFile, JSON.stringify(chatHistory, null, 2));
    } catch (err) {
        console.error('Error writing chat history to file:', err);
    }
}

async function updateChatHistory(chatHistory, sender, message) {
    if (!chatHistory[sender]) {
        chatHistory[sender] = [];
    }
    chatHistory[sender].push(message);
    if (chatHistory[sender].length > 20) {
        chatHistory[sender].shift();
    }
    await writeChatHistoryToFile(chatHistory);
}

async function deleteChatHistory(chatHistory, userId) {
    delete chatHistory[userId];
    await writeChatHistoryToFile(chatHistory);
}

// Fonction de scraping des scores en direct depuis SofaScore
async function scrapeLiveScores() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://www.sofascore.com/', { waitUntil: 'domcontentloaded' });

    const liveScores = await page.evaluate(() => {
        const scores = [];
        document.querySelectorAll('.event-list-table__body .cell__section--main').forEach((match) => {
            const homeTeam = match.querySelector('.event-list-table__team--home .event-list-table__team-name')?.textContent.trim();
            const awayTeam = match.querySelector('.event-list-table__team--away .event-list-table__team-name')?.textContent.trim();
            const score = match.querySelector('.event-list-table__score')?.textContent.trim();
            if (homeTeam && awayTeam && score) {
                scores.push({ homeTeam, awayTeam, score });
            }
        });
        return scores;
    });

    await browser.close();
    return liveScores;
}

// Plugin principal pour le bot
const liveScorePlugin = async (m, Matrix) => {
    const chatHistory = await readChatHistoryFromFile();
    const text = m.body.toLowerCase();

    if (text === "/forget") {
        await deleteChatHistory(chatHistory, m.sender);
        await Matrix.sendMessage(m.from, { text: 'Historique des scores en direct effacé.' }, { quoted: m });
        return;
    }

    const prefix = config.PREFIX;
    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = m.body.match(commandRegex);

    const cmd = match ? match[1].toLowerCase() : '';

    if (cmd === 'livescore') {
        try {
            await m.React("🔄"); // Réaction pour signaler le traitement
            const scores = await scrapeLiveScores();

            if (scores.length > 0) {
                let scoreMessage = '🔴 Scores en direct :\n';
                scores.forEach(({ homeTeam, awayTeam, score }) => {
                    scoreMessage += `🏆 ${homeTeam} vs ${awayTeam} : ${score}\n`;
                });
                await Matrix.sendMessage(m.from, { text: scoreMessage }, { quoted: m });
                await updateChatHistory(chatHistory, m.sender, { role: "assistant", content: scoreMessage });
            } else {
                await Matrix.sendMessage(m.from, { text: 'Aucun score en direct trouvé.' }, { quoted: m });
            }

            await m.React("✅");
        } catch (err) {
            await Matrix.sendMessage(m.from, { text: 'Erreur lors de la récupération des scores.' }, { quoted: m });
            console.error('Error: ', err);
            await m.React("❌");
        }
    }
};

export default liveScorePlugin;