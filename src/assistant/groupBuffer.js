class GroupMessageBuffer {
    constructor(maxSize = 80) {
        this.maxSize = maxSize;
        this.buffers = new Map();
    }

    record(groupJid, senderName, text) {
        if (!groupJid || !text || typeof text !== 'string') return;
        // Ignorer les messages système ou commandes techniques
        if (text.startsWith('.') || text.startsWith('!') || text.startsWith('/')) return;

        if (!this.buffers.has(groupJid)) {
            this.buffers.set(groupJid, []);
        }

        const list = this.buffers.get(groupJid);
        const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        list.push({
            name: senderName || "Membre",
            text: text.slice(0, 300),
            time
        });

        if (list.length > this.maxSize) {
            list.shift();
        }
    }

    getFormattedRecent(groupJid, limit = 50) {
        if (!this.buffers.has(groupJid)) return null;
        const list = this.buffers.get(groupJid);
        if (list.length === 0) return null;

        const slice = list.slice(-limit);
        return slice.map(m => `[${m.time}] ${m.name}: ${m.text}`).join('\n');
    }

    clear(groupJid) {
        this.buffers.delete(groupJid);
    }
}

export const groupBuffer = new GroupMessageBuffer();
export default groupBuffer;
