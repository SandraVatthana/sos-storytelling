-- =====================================================
-- INBOX INTELLIGENTE - Tables Supabase
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================

-- Table des connexions email (Gmail/Outlook)
CREATE TABLE IF NOT EXISTS email_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  email TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Index pour la recherche
CREATE INDEX IF NOT EXISTS idx_email_connections_user ON email_connections(user_id);

-- RLS (Row Level Security)
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own connections" ON email_connections;
CREATE POLICY "Users can manage their own connections"
ON email_connections FOR ALL
USING (auth.uid() = user_id);

-- =====================================================

-- Table des réponses emails analysées
CREATE TABLE IF NOT EXISTS email_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,

  -- Infos email brutes
  gmail_message_id TEXT UNIQUE,
  thread_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_text TEXT,
  body_snippet TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Classification IA
  category TEXT CHECK (category IN (
    'MEETING',        -- Demande de RDV
    'INTERESTED',     -- Intéressé, veut en savoir plus
    'OBJECTION',      -- Objection mais pas refus
    'NOT_INTERESTED', -- Refus clair
    'UNSUBSCRIBE',    -- Demande désinscription
    'OUT_OF_OFFICE',  -- Réponse automatique absence
    'OTHER'           -- Autre
  )),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  summary TEXT,
  suggested_action TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),

  -- Statut de traitement
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'archived')),
  notes TEXT,
  replied_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_email_responses_user ON email_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_email_responses_category ON email_responses(category);
CREATE INDEX IF NOT EXISTS idx_email_responses_status ON email_responses(status);
CREATE INDEX IF NOT EXISTS idx_email_responses_priority ON email_responses(priority);
CREATE INDEX IF NOT EXISTS idx_email_responses_received ON email_responses(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_responses_from ON email_responses(from_email);

-- RLS
ALTER TABLE email_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own responses" ON email_responses;
CREATE POLICY "Users can manage their own responses"
ON email_responses FOR ALL
USING (auth.uid() = user_id);

-- =====================================================

-- Table blacklist prospects (pour ne plus les contacter)
CREATE TABLE IF NOT EXISTS prospect_blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT,
  source TEXT DEFAULT 'manual', -- manual, unsubscribe, bounce
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_blacklist_user ON prospect_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_email ON prospect_blacklist(email);

ALTER TABLE prospect_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own blacklist" ON prospect_blacklist;
CREATE POLICY "Users can manage their own blacklist"
ON prospect_blacklist FOR ALL
USING (auth.uid() = user_id);

-- =====================================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
DROP TRIGGER IF EXISTS update_email_connections_updated_at ON email_connections;
CREATE TRIGGER update_email_connections_updated_at
  BEFORE UPDATE ON email_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_responses_updated_at ON email_responses;
CREATE TRIGGER update_email_responses_updated_at
  BEFORE UPDATE ON email_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VÉRIFICATION
-- =====================================================

-- Vérifier que les tables existent
SELECT 'email_connections' as table_name, count(*) as rows FROM email_connections
UNION ALL
SELECT 'email_responses', count(*) FROM email_responses
UNION ALL
SELECT 'prospect_blacklist', count(*) FROM prospect_blacklist;
