import config from '../../config.cjs';

class SupabaseManager {
    constructor() {
        this.supabase = null;
        this.init();
    }

    async init() {
        const url = this.getUrl();
        const key = this.getKey();

        if (url && key) {
            try {
                const { createClient } = await import('@supabase/supabase-js');
                this.supabase = createClient(url, key);
                console.log('⚡ [Supabase] SDK client initialisé avec succès.');
            } catch (_) {
                // Utilise le fallback natif fetch sans dépendance
            }
        }
    }

    getUrl() {
        return (config.SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
    }

    getKey() {
        return (
            config.SUPABASE_KEY ||
            process.env.SUPABASE_SECRET_KEY ||
            process.env.SUPABASE_KEY ||
            process.env.SUPABASE_PUBLISHABLE_KEY ||
            process.env.SUPABASE_ANON_KEY ||
            ""
        ).trim();
    }

    isConfigured() {
        return Boolean(this.getUrl() && this.getKey());
    }

    // Helper utilisant le fetch natif de Node.js (fonctionne sans aucun npm install)
    async restRequest(endpoint, method = 'GET', data = null, headers = {}) {
        const url = `${this.getUrl()}/rest/v1/${endpoint}`;
        const key = this.getKey();

        const options = {
            method,
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                ...headers
            }
        };

        if (data && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
            options.body = typeof data === 'string' ? data : JSON.stringify(data);
        }

        const res = await fetch(url, options);
        let responseData = null;
        try {
            const text = await res.text();
            responseData = text ? JSON.parse(text) : null;
        } catch (_) {}

        if (!res.ok) {
            const error = new Error(`Supabase HTTP ${res.status}: ${JSON.stringify(responseData)}`);
            error.status = res.status;
            error.data = responseData;
            throw error;
        }

        return { status: res.status, data: responseData };
    }

    // ==========================================
    // 1. Profil Utilisateur & Mémoire Cognitive
    // ==========================================
    async getProfile(jid) {
        if (!this.isConfigured()) return null;
        try {
            if (this.supabase) {
                const { data, error } = await this.supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('jid', jid)
                    .single();
                if (error && error.code !== 'PGRST116') console.error('Supabase getProfile error:', error);
                return data || null;
            } else {
                const res = await this.restRequest(`user_profiles?jid=eq.${encodeURIComponent(jid)}&select=*`);
                return res.data?.[0] || null;
            }
        } catch (e) {
            console.error('Erreur getProfile Supabase:', e.message);
            return null;
        }
    }

    async upsertProfile(jid, profileData) {
        if (!this.isConfigured()) return false;
        const payload = {
            jid,
            name: profileData.name || null,
            language: profileData.language || 'Français',
            facts: profileData.facts || [],
            topics: profileData.topics || [],
            summary: profileData.summary || "",
            turn_count: profileData.turnCount || 0,
            updated_at: new Date().toISOString()
        };

        try {
            if (this.supabase) {
                const { error } = await this.supabase
                    .from('user_profiles')
                    .upsert(payload, { onConflict: 'jid' });
                if (error) console.error('Supabase upsertProfile error:', error);
                return !error;
            } else {
                await this.restRequest('user_profiles', 'POST', payload, {
                    'Prefer': 'resolution=merge-duplicates'
                });
                return true;
            }
        } catch (e) {
            console.error('Erreur upsertProfile Supabase:', e.message);
            return false;
        }
    }

    // ==========================================
    // 2. Historique des Messages (chat_history)
    // ==========================================
    async saveMessage(jid, role, content) {
        if (!this.isConfigured() || !content) return false;
        const payload = {
            jid,
            role,
            content: typeof content === 'string' ? content : JSON.stringify(content),
            created_at: new Date().toISOString()
        };

        try {
            if (this.supabase) {
                await this.supabase.from('chat_history').insert(payload);
            } else {
                await this.restRequest('chat_history', 'POST', payload);
            }
            return true;
        } catch (e) {
            console.error('Erreur saveMessage Supabase:', e.message);
            return false;
        }
    }

    async getHistory(jid, limit = 16) {
        if (!this.isConfigured()) return null;
        try {
            let rows = [];
            if (this.supabase) {
                const { data } = await this.supabase
                    .from('chat_history')
                    .select('role, content')
                    .eq('jid', jid)
                    .order('created_at', { ascending: false })
                    .limit(limit);
                rows = data || [];
            } else {
                const res = await this.restRequest(`chat_history?jid=eq.${encodeURIComponent(jid)}&select=role,content&order=created_at.desc&limit=${limit}`);
                rows = res.data || [];
            }

            return rows.reverse().map(r => ({
                role: r.role,
                parts: [{ text: r.content }]
            }));
        } catch (e) {
            console.error('Erreur getHistory Supabase:', e.message);
            return null;
        }
    }

    async clearHistory(jid) {
        if (!this.isConfigured()) return false;
        try {
            if (this.supabase) {
                await this.supabase.from('chat_history').delete().eq('jid', jid);
            } else {
                await this.restRequest(`chat_history?jid=eq.${encodeURIComponent(jid)}`, 'DELETE');
            }
            return true;
        } catch (e) {
            console.error('Erreur clearHistory Supabase:', e.message);
            return false;
        }
    }

    // ==========================================
    // 3. Notes Personnelles (user_notes)
    // ==========================================
    async addNote(jid, noteText, noteId = Date.now()) {
        if (!this.isConfigured()) return false;
        const payload = { id: noteId, jid, note: noteText, created_at: new Date().toISOString() };
        try {
            if (this.supabase) {
                await this.supabase.from('user_notes').insert(payload);
            } else {
                await this.restRequest('user_notes', 'POST', payload);
            }
            return true;
        } catch (e) {
            console.error('Erreur addNote Supabase:', e.message);
            return false;
        }
    }

    async getNotes(jid) {
        if (!this.isConfigured()) return null;
        try {
            if (this.supabase) {
                const { data } = await this.supabase.from('user_notes').select('*').eq('jid', jid).order('created_at', { ascending: true });
                return data || [];
            } else {
                const res = await this.restRequest(`user_notes?jid=eq.${encodeURIComponent(jid)}&select=*&order=created_at.asc`);
                return res.data || [];
            }
        } catch (e) {
            console.error('Erreur getNotes Supabase:', e.message);
            return null;
        }
    }

    // ==========================================
    // 4. Rappels (reminders)
    // ==========================================
    async saveReminder(rem) {
        if (!this.isConfigured()) return false;
        const payload = {
            id: rem.id,
            jid: rem.jid,
            task: rem.task,
            delay_minutes: rem.delayMinutes,
            target_time: rem.targetTime,
            completed: rem.completed || false,
            created_at: new Date().toISOString()
        };
        try {
            if (this.supabase) {
                await this.supabase.from('reminders').upsert(payload, { onConflict: 'id' });
            } else {
                await this.restRequest('reminders', 'POST', payload, { 'Prefer': 'resolution=merge-duplicates' });
            }
            return true;
        } catch (e) {
            console.error('Erreur saveReminder Supabase:', e.message);
            return false;
        }
    }

    async getActiveReminders() {
        if (!this.isConfigured()) return null;
        try {
            if (this.supabase) {
                const { data } = await this.supabase.from('reminders').select('*').eq('completed', false);
                return data || [];
            } else {
                const res = await this.restRequest(`reminders?completed=eq.false&select=*`);
                return res.data || [];
            }
        } catch (e) {
            console.error('Erreur getActiveReminders Supabase:', e.message);
            return null;
        }
    }

    async markReminderCompleted(id) {
        if (!this.isConfigured()) return false;
        try {
            if (this.supabase) {
                await this.supabase.from('reminders').update({ completed: true }).eq('id', id);
            } else {
                await this.restRequest(`reminders?id=eq.${encodeURIComponent(id)}`, 'PATCH', { completed: true });
            }
            return true;
        } catch (e) {
            console.error('Erreur markReminderCompleted Supabase:', e.message);
            return false;
        }
    }
}

export const supabaseManager = new SupabaseManager();
export default supabaseManager;
