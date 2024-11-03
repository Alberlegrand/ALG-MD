import fetch from 'node-fetch';
import config from '../../config.cjs';

// Définir le préfixe du plugin
const prefix = config.PREFIX;

// Fonction principale du plugin sportif
const sportsPlugin = async (m, Matrix) => {
    const text = m.body.toLowerCase();

    // Vérifier le préfixe et extraire la commande
    const commandRegex = new RegExp(`^${prefix}\\s*(\\S+)`, 'i');
    const match = text.match(commandRegex);
    const cmd = match ? match[1].toLowerCase() : '';
    const prompt = match ? text.slice(match[0].length).trim() : '';

    // Vérifier si la commande correspond au plugin sportif
    const validCommands = ['team', 'livescore', 'events'];
    if (!validCommands.includes(cmd)) return;

    // Commande pour afficher le badge d'une équipe
    if (cmd === 'team') {
        const teamName = prompt.trim();
        if (!teamName) {
            await Matrix.sendMessage(m.from, { text: 'Veuillez fournir le nom de l’équipe.' }, { quoted: m });
            return;
        }
        
        try {
            await m.React("🔍");
            const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`);
            const data = await response.json();
            
            if (!data.teams || data.teams.length === 0) {
                await Matrix.sendMessage(m.from, { text: `Aucune équipe trouvée pour "${teamName}".` }, { quoted: m });
            } else {
                const team = data.teams[0];
                const badge = team.strBadge ? team.strBadge : "Pas de badge disponible.";
                await Matrix.sendMessage(m.from, { 
                    text: `Équipe: ${team.strTeam}\nLigue: ${team.strLeague}\nBadge: ${badge}` 
                }, { quoted: m });
            }
            await m.React("✅");
        } catch (error) {
            console.error("Erreur lors de la récupération des données de l'équipe:", error);
            await Matrix.sendMessage(m.from, { text: "Une erreur s'est produite lors de la récupération des informations de l'équipe." }, { quoted: m });
            await m.React("❌");
        }
    }

    // Commande pour les scores en direct
    else if (cmd === 'livescore') {
        try {
            await m.React("📺");
            const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsnow.php`);
            const data = await response.json();
            
            if (!data.events || data.events.length === 0) {
                await Matrix.sendMessage(m.from, { text: 'Aucun score en direct disponible actuellement.' }, { quoted: m });
            } else {
                let scoreMessage = 'Scores en direct :\n\n';
                data.events.forEach(event => {
                    scoreMessage += `Match: ${event.strEvent}\nDate: ${event.dateEvent}\nScore: ${event.intHomeScore} - ${event.intAwayScore}\n\n`;
                });
                await Matrix.sendMessage(m.from, { text: scoreMessage }, { quoted: m });
            }
            await m.React("✅");
        } catch (error) {
            console.error("Erreur lors de la récupération des scores en direct:", error);
            await Matrix.sendMessage(m.from, { text: "Une erreur s'est produite lors de la récupération des scores en direct." }, { quoted: m });
            await m.React("❌");
        }
    }

    // Commande pour les événements récents d'une équipe
    else if (cmd === 'events') {
        const teamName = prompt.trim();
        if (!teamName) {
            await Matrix.sendMessage(m.from, { text: 'Veuillez fournir le nom de l’équipe.' }, { quoted: m });
            return;
        }

        try {
            await m.React("📅");
            const searchResponse = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`);
            const searchData = await searchResponse.json();

            if (!searchData.teams || searchData.teams.length === 0) {
                await Matrix.sendMessage(m.from, { text: `Aucune équipe trouvée pour "${teamName}".` }, { quoted: m });
                return;
            }

            const teamID = searchData.teams[0].idTeam;
            const eventsResponse = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${teamID}`);
            const eventsData = await eventsResponse.json();

            if (!eventsData.results || eventsData.results.length === 0) {
                await Matrix.sendMessage(m.from, { text: `Aucun événement récent trouvé pour l'équipe "${teamName}".` }, { quoted: m });
            } else {
                let eventsMessage = `Événements récents pour ${teamName} :\n\n`;
                eventsData.results.forEach(event => {
                    eventsMessage += `Match: ${event.strEvent}\nDate: ${event.dateEvent}\nScore: ${event.intHomeScore} - ${event.intAwayScore}\n\n`;
                });
                await Matrix.sendMessage(m.from, { text: eventsMessage }, { quoted: m });
            }
            await m.React("✅");
        } catch (error) {
            console.error("Erreur lors de la récupération des événements récents:", error);
            await Matrix.sendMessage(m.from, { text: "Une erreur s'est produite lors de la récupération des événements récents." }, { quoted: m });
            await m.React("❌");
        }
    }
};

export default sportsPlugin;