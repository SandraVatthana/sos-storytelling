-- =====================================================
-- AGENT AUTOPILOT - Tables Supabase
-- SOS Storytelling
-- =====================================================

-- Ajouter des colonnes à la table prospects existante
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agent_priority INTEGER DEFAULT 0;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agent_status TEXT DEFAULT 'pending' CHECK (agent_status IN ('pending', 'in_sequence', 'hot', 'converted', 'dead'));
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS agent_notes TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMP;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMP;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMP;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;

-- Table des actions de l'agent
CREATE TABLE IF NOT EXISTS agent_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,

    action_type TEXT NOT NULL, -- 'email_sent', 'email_opened', 'reply_received', 'meeting_booked', 'stopped'
    action_data JSONB, -- Détails (contenu email, messageId, etc.)

    decided_by TEXT DEFAULT 'agent', -- 'agent' ou 'human'
    decision_reasoning TEXT, -- Pourquoi l'agent a décidé ça

    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_agent_actions_user ON agent_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_prospect ON agent_actions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_type ON agent_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_agent_actions_date ON agent_actions(created_at DESC);

-- Table de configuration de l'agent
CREATE TABLE IF NOT EXISTS agent_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) UNIQUE,

    -- Objectif
    goal TEXT, -- "10 RDV avec des agences marketing"
    goal_count INTEGER DEFAULT 10,
    goal_deadline DATE,
    goal_current INTEGER DEFAULT 0,

    -- Contraintes
    max_emails_per_day INTEGER DEFAULT 50,
    min_delay_between_emails INTEGER DEFAULT 30, -- secondes
    working_hours_start INTEGER DEFAULT 9,
    working_hours_end INTEGER DEFAULT 18,
    working_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri'],

    -- Email expéditeur
    sender_email TEXT,
    sender_name TEXT,

    -- Personnalité
    tone TEXT DEFAULT 'friendly', -- friendly, professional, casual
    language TEXT DEFAULT 'fr',

    -- Actif ?
    is_active BOOLEAN DEFAULT false,

    -- Stats
    total_emails_sent INTEGER DEFAULT 0,
    total_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_replies INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des logs de l'agent (pour debug)
CREATE TABLE IF NOT EXISTS agent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),

    run_id UUID, -- ID de l'exécution
    log_type TEXT, -- 'info', 'decision', 'action', 'error'
    message TEXT,
    data JSONB,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les logs
CREATE INDEX IF NOT EXISTS idx_agent_logs_user ON agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_run ON agent_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_date ON agent_logs(created_at DESC);

-- Table des notifications
CREATE TABLE IF NOT EXISTS agent_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),

    type TEXT, -- 'hot_prospect', 'reply', 'meeting', 'error'
    title TEXT,
    message TEXT,
    prospect_id UUID REFERENCES prospects(id),

    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour les notifications
CREATE INDEX IF NOT EXISTS idx_agent_notif_user ON agent_notifications(user_id, read);

-- Templates d'emails de l'agent
CREATE TABLE IF NOT EXISTS agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),

    name TEXT NOT NULL, -- 'premier_contact', 'relance_j3', 'relance_j7', 'prospect_chaud'
    subject TEXT NOT NULL,
    body TEXT NOT NULL,

    position INTEGER DEFAULT 1, -- Ordre dans la séquence
    delay_days INTEGER DEFAULT 0, -- Jours après le précédent
    send_condition TEXT DEFAULT 'always', -- 'always', 'no_reply', 'opened_no_reply', 'clicked'

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own agent_actions" ON agent_actions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own agent_config" ON agent_config
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own agent_logs" ON agent_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own agent_notifications" ON agent_notifications
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own agent_templates" ON agent_templates
    FOR ALL USING (auth.uid() = user_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_agent_config_updated_at BEFORE UPDATE ON agent_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_templates_updated_at BEFORE UPDATE ON agent_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
