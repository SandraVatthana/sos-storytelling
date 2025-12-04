-- ===========================================
-- TABLES PROSPECTS & EMAIL CAMPAIGNS
-- SOS Storytelling - Module Prospection
-- ===========================================

-- 1. Ajouter colonne langue à la table users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr'
CHECK (language IN ('fr', 'en'));

-- 2. Table des prospects
CREATE TABLE IF NOT EXISTS prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Infos prospect
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT,
    company TEXT,
    job_title TEXT,
    linkedin_url TEXT,
    phone TEXT,
    website TEXT,

    -- Infos supplementaires
    sector TEXT,
    city TEXT,
    company_size TEXT,
    notes TEXT,

    -- Statut & tracking
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'opened', 'clicked', 'replied', 'converted', 'unsubscribed', 'bounced')),
    emails_sent INTEGER DEFAULT 0,
    last_contacted_at TIMESTAMP,
    last_opened_at TIMESTAMP,
    last_clicked_at TIMESTAMP,
    replied_at TIMESTAMP,

    -- Source
    source TEXT DEFAULT 'manual', -- 'manual', 'csv_import', 'pharow', 'apollo'
    tags TEXT[],

    -- Metadonnees
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Contrainte unicite par user
    UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_prospects_user ON prospects(user_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_email ON prospects(email);

-- 3. Table des campagnes email
CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Infos campagne
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')),

    -- Configuration
    sender_email TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    reply_to TEXT,

    -- Template email
    subject_template TEXT,
    body_template TEXT,

    -- Options
    use_my_voice BOOLEAN DEFAULT true,
    generate_unique_per_prospect BOOLEAN DEFAULT true,
    language TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'en')),
    goal TEXT, -- Objectif de la campagne pour l'IA

    -- Filtres prospects
    prospect_filter JSONB, -- {"status": "new", "tags": ["agences"]}

    -- Stats
    total_prospects INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,

    -- Dates
    scheduled_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status);

-- 4. Table des emails envoyes (lien campagne <-> prospect)
CREATE TABLE IF NOT EXISTS campaign_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Contenu genere
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    preview_text TEXT,

    -- Statut
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')),

    -- Brevo tracking
    brevo_message_id TEXT,

    -- Dates
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    replied_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(campaign_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_emails_campaign ON campaign_emails(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_prospect ON campaign_emails(prospect_id);
CREATE INDEX IF NOT EXISTS idx_campaign_emails_status ON campaign_emails(status);

-- 5. Table des evenements email (webhooks Brevo)
CREATE TABLE IF NOT EXISTS email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    message_id TEXT,
    event_type TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_email ON email_events(email);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_events_message_id ON email_events(message_id);

-- 6. Fonction pour incrementer emails_sent
CREATE OR REPLACE FUNCTION increment_emails_sent(prospect_email TEXT, user_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE prospects
    SET emails_sent = emails_sent + 1,
        last_contacted_at = NOW(),
        updated_at = NOW()
    WHERE email = prospect_email AND user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS Policies
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_emails ENABLE ROW LEVEL SECURITY;

-- Prospects: users can only see their own
CREATE POLICY "Users can view own prospects" ON prospects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prospects" ON prospects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prospects" ON prospects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own prospects" ON prospects
    FOR DELETE USING (auth.uid() = user_id);

-- Campaigns: users can only see their own
CREATE POLICY "Users can view own campaigns" ON email_campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaigns" ON email_campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" ON email_campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns" ON email_campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- Campaign emails: users can only see their own
CREATE POLICY "Users can view own campaign_emails" ON campaign_emails
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaign_emails" ON campaign_emails
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaign_emails" ON campaign_emails
    FOR UPDATE USING (auth.uid() = user_id);
