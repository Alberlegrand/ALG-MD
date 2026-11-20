-- ====================================================================
-- SCHEMA SUPABASE POUR ALG-MD ASSISTANT WHATSAPP
-- Exécutez ce script dans l'éditeur SQL de votre tableau de bord Supabase
-- ====================================================================

-- 1. Table des profils utilisateurs et mémoire cognitive
CREATE TABLE IF NOT EXISTS user_profiles (
    jid TEXT PRIMARY KEY,
    name TEXT,
    language TEXT DEFAULT 'Français',
    facts JSONB DEFAULT '[]'::jsonb,
    topics JSONB DEFAULT '[]'::jsonb,
    summary TEXT,
    turn_count INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table de l'historique des conversations
CREATE TABLE IF NOT EXISTS chat_history (
    id BIGSERIAL PRIMARY KEY,
    jid TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_history_jid_time ON chat_history (jid, created_at DESC);

-- 3. Table des notes personnelles (Deuxième Cerveau)
CREATE TABLE IF NOT EXISTS user_notes (
    id BIGINT PRIMARY KEY,
    jid TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notes_jid ON user_notes (jid);

-- 4. Table des rappels programmés
CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    jid TEXT NOT NULL,
    task TEXT NOT NULL,
    delay_minutes INT NOT NULL,
    target_time BIGINT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_target ON reminders (target_time, completed);
