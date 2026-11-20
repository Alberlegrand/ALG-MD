import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import supabaseManager from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const REMINDERS_FILE = path.join(DATA_DIR, 'reminders.json');

class ReminderManager {
    constructor() {
        this.reminders = [];
        this.sock = null;
        this.timeouts = new Map();
        this.init();
    }

    init() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirpSync(DATA_DIR);
            }
            if (fs.existsSync(REMINDERS_FILE)) {
                this.reminders = fs.readJsonSync(REMINDERS_FILE);
            } else {
                this.reminders = [];
                fs.writeJsonSync(REMINDERS_FILE, this.reminders);
            }
        } catch (e) {
            console.error('Error loading reminders:', e);
            this.reminders = [];
        }
    }

    save() {
        try {
            fs.writeJsonSync(REMINDERS_FILE, this.reminders, { spaces: 2 });
        } catch (e) {
            console.error('Error saving reminders:', e);
        }
    }

    setSocket(sock) {
        this.sock = sock;
        this.scheduleExistingReminders();
    }

    scheduleExistingReminders() {
        const now = Date.now();
        for (const rem of [...this.reminders]) {
            if (rem.completed) continue;

            const remaining = rem.targetTime - now;
            if (remaining <= 0) {
                this.triggerReminder(rem);
            } else {
                this.setTimer(rem, remaining);
            }
        }
    }

    addReminder(jid, task, delayMinutes) {
        const id = 'rem_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const targetTime = Date.now() + Math.round(delayMinutes * 60 * 1000);

        const reminder = {
            id,
            jid,
            task,
            delayMinutes,
            createdAt: Date.now(),
            targetTime,
            completed: false
        };

        this.reminders.push(reminder);
        this.save();

        if (supabaseManager.isConfigured()) {
            supabaseManager.saveReminder(reminder);
        }

        if (this.sock) {
            this.setTimer(reminder, reminder.targetTime - Date.now());
        }

        return reminder;
    }

    setTimer(reminder, delayMs) {
        if (this.timeouts.has(reminder.id)) {
            clearTimeout(this.timeouts.get(reminder.id));
        }

        const timer = setTimeout(() => {
            this.triggerReminder(reminder);
        }, Math.max(0, delayMs));

        this.timeouts.set(reminder.id, timer);
    }

    async triggerReminder(reminder) {
        if (!this.sock) return;

        reminder.completed = true;
        this.save();
        this.timeouts.delete(reminder.id);

        if (supabaseManager.isConfigured()) {
            supabaseManager.markReminderCompleted(reminder.id);
        }

        try {
            await this.sock.sendMessage(reminder.jid, {
                text: `⏰ *RAPPEL DE VOTRE ASSISTANT* ⏰\n\n📌 *Tâche :* ${reminder.task}\n\n_Défini il y a ${reminder.delayMinutes} minute(s)._`
            });
            console.log(`Reminder sent to ${reminder.jid}: ${reminder.task}`);
        } catch (error) {
            console.error(`Failed to send reminder to ${reminder.jid}:`, error);
        }
    }
}

export const reminderManager = new ReminderManager();
export default reminderManager;
