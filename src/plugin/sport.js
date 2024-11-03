const fetch = require('node-fetch');

const sportsPlugin = async (m, Matrix) => {
    const text = m.body.toLowerCase();

    // Commande pour chercher le badge d'une équipe
    if (text.startsWith("/team ")) {
        const teamName = text.replace("/team ", "").trim();
        try {
            await m.React("🔍");
            const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`);
            const data = await response.json();

            if (!data.teams || data.teams.length === 0) {
                await Matrix.sendMessage(m.from, { text: `No team found with the name "${teamName}".` }, { quoted: m });
            } else {
                const team = data.teams[0];
                const badge = team.strBadge ? team.strBadge : "No badge available.";
                await Matrix.sendMessage(m.from, { 
                    text: `Team: ${team.strTeam}\nLeague: ${team.strLeague}\nBadge: ${badge}` 
                }, { quoted: m });
                await m.React("✅");
            }
        } catch (error) {
            console.error("Error fetching team data:", error);
            await Matrix.sendMessage(m.from, { text: "An error occurred while fetching team information." }, { quoted: m });
            await m.React("❌");
        }
    }

    // Commande pour obtenir les scores en direct
    else if (text === "/livescore") {
        try {
            await m.React("📺");
            const response = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsnow.php`);
            const data = await response.json();

            if (!data.events || data.events.length === 0) {
                await Matrix.sendMessage(m.from, { text: 'No live scores available right now.' }, { quoted: m });
            } else {
                let scoreMessage = 'Live Scores:\n\n';
                data.events.forEach(event => {
                    scoreMessage += `Match: ${event.strEvent}\nDate: ${event.dateEvent}\nScore: ${event.intHomeScore} - ${event.intAwayScore}\n\n`;
                });

                await Matrix.sendMessage(m.from, { text: scoreMessage }, { quoted: m });
                await m.React("✅");
            }
        } catch (error) {
            console.error("Error fetching live scores:", error);
            await Matrix.sendMessage(m.from, { text: "An error occurred while fetching live scores." }, { quoted: m });
            await m.React("❌");
        }
    }

    // Commande pour les événements passés d'une équipe
    else if (text.startsWith("/events ")) {
        const teamName = text.replace("/events ", "").trim();
        try {
            await m.React("📅");
            const searchResponse = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`);
            const searchData = await searchResponse.json();

            if (!searchData.teams || searchData.teams.length === 0) {
                await Matrix.sendMessage(m.from, { text: `No team found with the name "${teamName}".` }, { quoted: m });
                return;
            }

            const teamID = searchData.teams[0].idTeam;
            const eventsResponse = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventslast.php?id=${teamID}`);
            const eventsData = await eventsResponse.json();

            if (!eventsData.results || eventsData.results.length === 0) {
                await Matrix.sendMessage(m.from, { text: `No recent events found for team "${teamName}".` }, { quoted: m });
            } else {
                let eventsMessage = `Recent Events for ${teamName}:\n\n`;
                eventsData.results.forEach(event => {
                    eventsMessage += `Match: ${event.strEvent}\nDate: ${event.dateEvent}\nScore: ${event.intHomeScore} - ${event.intAwayScore}\n\n`;
                });

                await Matrix.sendMessage(m.from, { text: eventsMessage }, { quoted: m });
                await m.React("✅");
            }
        } catch (error) {
            console.error("Error fetching recent events:", error);
            await Matrix.sendMessage(m.from, { text: "An error occurred while fetching recent events." }, { quoted: m });
            await m.React("❌");
        }
    }

    // Message par défaut si la commande est inconnue
    else {
        await Matrix.sendMessage(m.from, { text: "Unknown command. Please use:\n/team <team name>\n/livescore\n/events <team name>" }, { quoted: m });
    }
};

export default sportsPlugin;