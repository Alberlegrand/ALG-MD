import puppeteer from 'puppeteer';
import config from '../../config.cjs';

const scrapeLiveScores = async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    // Accéder à la page live scores de SofaScore
    await page.goto('https://www.sofascore.com/');
    
    // Sélectionner les scores en cours
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
};

// Fonction principale du plugin
const liveScorePlugin = async (m, Matrix) => {
    const prefix = config.PREFIX; // Préfixe à utiliser pour les commandes
    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = m.body.match(commandRegex);
    const cmd = match ? match[1].toLowerCase() : '';

    if (cmd === 'livescore') {
        try {
            await m.React("🔄"); // Réaction en cours
            const scores = await scrapeLiveScores();
            
            if (scores.length > 0) {
                let scoreMessage = '🔴 Scores en direct :\n';
                scores.forEach(({ homeTeam, awayTeam, score }) => {
                    scoreMessage += `🏆 ${homeTeam} vs ${awayTeam} : ${score}\n`;
                });
                await Matrix.sendMessage(m.from, { text: scoreMessage }, { quoted: m });
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