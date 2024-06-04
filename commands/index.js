const fs = require('fs');
const path = require('path');

module.exports = async (sock, message, command) => {
    try {
        const args = command.split(' ');
        const commandName = args.shift().toLowerCase();

        const commandFilePath = path.join(__dirname, `${commandName}.js`);
        if (fs.existsSync(commandFilePath)) {
            const commandFile = require(commandFilePath);
            if (commandFile.execute) {
                await commandFile.execute(sock, message, args);
            } else {
                throw new Error(`Command file '${commandName}.js' is missing 'execute' function.`);
            }
        } else {
            throw new Error(`Command file '${commandName}.js' not found.`);
        }
    } catch (error) {
        console.error('Error handling command:', error);
        await sock.sendMessage(message.key.remoteJid, { text: `An error occurred while processing the command: ${command}` });
    }
};
