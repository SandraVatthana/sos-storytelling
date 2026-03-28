-- ===========================================
-- APOLLO ENRICHMENT - Migration Schema
-- SOS Storytelling - Pipeline LinkedIn > Apollo > Campagnes
-- ===========================================
-- A executer dans Supabase SQL Editor
-- Les colonnes enrichment_data/enrichment_status/enriched_at (Perplexity) restent intactes

-- 1. Ajouter colonnes Apollo a la table prospects
ALTER TABLE prospects
ADD COLUMN IF NOT EXISTS apollo_email TEXT,
ADD COLUMN IF NOT EXISTS apollo_enrichment_status TEXT DEFAULT 'none'
    CHECK (apollo_enrichment_status IN ('none', 'pending', 'found', 'not_found', 'error')),
ADD COLUMN IF NOT EXISTS apollo_enriched_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS apollo_data JSONB;

CREATE INDEX IF NOT EXISTS idx_prospects_apollo_status ON prospects(apollo_enrichment_status);
CREATE INDEX IF NOT EXISTS idx_prospects_apollo_email ON prospects(apollo_email);

-- 2. Table de file d'attente enrichissement Apollo
CREATE TABLE IF NOT EXISTS apollo_enrichment_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Statut de traitement
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,

    -- Tentatives
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,

    -- Dates
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_apollo_queue_status ON apollo_enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_apollo_queue_user ON apollo_enrichment_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_apollo_queue_prospect ON apollo_enrichment_queue(prospect_id);

-- 3. RLS pour apollo_enrichment_queue
ALTER TABLE apollo_enrichment_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queue" ON apollo_enrichment_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue" ON apollo_enrichment_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue" ON apollo_enrichment_queue
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue" ON apollo_enrichment_queue
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Service role bypass (pour le worker Cloudflare qui utilise service_key)
-- Note: Le worker utilise SUPABASE_SERVICE_KEY qui bypass les RLS automatiquement
