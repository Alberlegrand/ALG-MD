const { smd, prefix, Config, sleep } = require('../lib'); // Importation des modules nécessaires

// Enregistrement du plugin via 'smd'
smd({
    cmdname: "hack",
    type: "fun",
    info: "Simule un piratage pour plaisanter.",
    filename: __filename,
}, async (citel) => {
    try {
        // Début de la simulation de piratage
        await citel.send("Injecting Malware...");
        await sleep(2000);

        // Progression de la barre de piratage
        const progressSteps = [
            { text: " █ 10%", delay: 1000 },
            { text: " █ █ 20%", delay: 1000 },
            { text: " █ █ █ 30%", delay: 1000 },
            { text: " █ █ █ █ 40%", delay: 1000 },
            { text: " █ █ █ █ █ 50%", delay: 1000 },
            { text: " █ █ █ █ █ █ 60%", delay: 1000 },
            { text: " █ █ █ █ █ █ █ 70%", delay: 1000 },
            { text: " █ █ █ █ █ █ █ █ 80%", delay: 1000 },
            { text: " █ █ █ █ █ █ █ █ █ 90%", delay: 1000 },
            { text: " █ █ █ █ █ █ █ █ █ █ 100%", delay: 1000 }
        ];

        for (const step of progressSteps) {
            await citel.send(step.text);
            await sleep(step.delay);
        }

        // Finalisation de la simulation
        await citel.send("System hijacking in progress... \nConnecting to server: error 404 not found.");
        await sleep(1000);
        await citel.send("Device successfully connected... \nReceiving data...");
        await sleep(1000);
        await citel.send("Data hijacked from device: 100% completed.\nErasing all evidence and cleaning up malware...");
        await sleep(1000);
        await citel.send("HACKING COMPLETED");
        await sleep(2000);
        await citel.send("SENDING LOG DOCUMENTS...");
        await sleep(1000);
        await citel.send("SUCCESSFULLY SENT DATA AND DISCONNECTED.");
        await sleep(1000);

        return await citel.send('BACKLOGS CLEARED');
    } catch (error) {
        console.error("Erreur dans le plugin hack.js:", error);
        await citel.send("Erreur: Impossible de compléter la simulation de piratage.");
    }
});