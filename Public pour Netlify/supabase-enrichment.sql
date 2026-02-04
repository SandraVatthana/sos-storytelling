-- =====================================================
-- ENRICHMENT SYSTEM - Tables & Modifications
-- SOS Storytelling - Enrichissement Intelligent des Prospects
-- =====================================================

-- ==========================================
-- 1. MODIFIER LA TABLE PROSPECTS
-- ==========================================

-- Ajouter les colonnes d'enrichissement
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS enrichment_data JSONB;
/*
Structure enrichment_data :
{
    "raw": {
        "person_info": [
            {"type": "linkedin_post", "date": "il y a X jours", "summary": "..."},
            {"type": "job_change", "date": "...", "summary": "..."}
        ],
        "company_info": [
            {"type": "funding", "date": "...", "summary": "..."},
            {"type": "hiring", "date": "...", "summary": "X postes ouverts en Y"},
            {"type": "news", "date": "...", "summary": "..."}
        ]
    },
    "analysis": {
        "relevant_info": [
            {
                "info": "L'info brute",
                "why_relevant": "Pourquoi c'est pertinent",
                "how_to_use": "Comment l'utiliser"
            }
        ],
        "ignored_info": [
            {
                "info": "L'info brute",
                "why_ignored": "Pourquoi on ne l'utilise pas"
            }
        ],
        "chosen_angle": "L'angle d'approche en 1 phrase",
        "angle_reasoning": "Pourquoi cet angle est le plus fort",
        "hook_suggestion": "Proposition d'accroche pour l'email",
        "personalization_level": "high|medium|low|none",
        "confidence_score": 85
    }
}
*/

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending';
-- Valeurs possibles : 'pending', 'enriching', 'enriched', 'no_data', 'error'

-- Index pour les requêtes d'enrichissement
CREATE INDEX IF NOT EXISTS idx_prospects_enrichment_status ON prospects(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_prospects_enriched_at ON prospects(enriched_at);

-- ==========================================
-- 2. MODIFIER LA TABLE CAMPAIGNS
-- ==========================================

-- Ajouter les infos produit/offre pour l'analyse de pertinence
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS product_description TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS value_proposition TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS target_persona TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS pain_points TEXT[];
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS email_tone TEXT DEFAULT 'Professionnel mais humain. Direct. Pas corporate.';

-- ==========================================
-- 3. TABLE ENRICHMENT_LOGS (optionnel - pour tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS enrichment_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,

    -- Infos enrichissement
    perplexity_tokens_used INTEGER DEFAULT 0,
    claude_tokens_used INTEGER DEFAULT 0,
    enrichment_source TEXT DEFAULT 'perplexity', -- 'perplexity', 'manual', 'linkedin_api'

    -- Résultat
    personalization_level TEXT, -- 'high', 'medium', 'low', 'none'
    data_found BOOLEAN DEFAULT false,
    error_message TEXT,

    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_user ON enrichment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_prospect ON enrichment_logs(prospect_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_logs_campaign ON enrichment_logs(campaign_id);

-- RLS Policies
ALTER TABLE enrichment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enrichment logs"
    ON enrichment_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrichment logs"
    ON enrichment_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 4. TABLE ENRICHMENT_TEMPLATES (angles prédéfinis)
-- ==========================================

CREATE TABLE IF NOT EXISTS enrichment_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Template info
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- 'funding', 'hiring', 'product_launch', 'news', 'linkedin_post', etc.
    angle_template TEXT NOT NULL,
    hook_template TEXT NOT NULL,

    -- Conditions
    min_confidence_score INTEGER DEFAULT 70,

    -- Status
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE enrichment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own enrichment templates"
    ON enrichment_templates FOR ALL
    USING (auth.uid() = user_id);

-- Templates par défaut (globaux)
INSERT INTO enrichment_templates (user_id, name, trigger_type, angle_template, hook_template)
VALUES
    (NULL, 'Levée de fonds', 'funding', 'Croissance post-levée = besoin de structurer/former rapidement', 'Après une levée de {amount}, le timing est serré pour scaler'),
    (NULL, 'Recrutement', 'hiring', 'Nouvelles recrues = besoin d''onboarding/formation rapide', '{count} postes ouverts = {count} personnes à former vite'),
    (NULL, 'Lancement produit', 'product_launch', 'Nouveau produit = besoin de former les équipes commerciales', 'Nouveau lancement = équipes à former sur le pitch'),
    (NULL, 'Croissance rapide', 'growth', 'Scaling = processus à automatiser/standardiser', 'Croissance rapide = besoin de structurer avant que ça explose')
ON CONFLICT DO NOTHING;

-- ==========================================
-- 5. STATS ENRICHISSEMENT (vue)
-- ==========================================

CREATE OR REPLACE VIEW enrichment_stats AS
SELECT
    user_id,
    campaign_id,
    COUNT(*) as total_enrichments,
    COUNT(*) FILTER (WHERE personalization_level = 'high') as high_personalization,
    COUNT(*) FILTER (WHERE personalization_level = 'medium') as medium_personalization,
    COUNT(*) FILTER (WHERE personalization_level = 'low') as low_personalization,
    COUNT(*) FILTER (WHERE personalization_level = 'none') as no_personalization,
    COUNT(*) FILTER (WHERE data_found = true) as data_found_count,
    COUNT(*) FILTER (WHERE error_message IS NOT NULL) as error_count,
    SUM(perplexity_tokens_used) as total_perplexity_tokens,
    SUM(claude_tokens_used) as total_claude_tokens,
    DATE(created_at) as date
FROM enrichment_logs
GROUP BY user_id, campaign_id, DATE(created_at);

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

GRANT SELECT, INSERT, UPDATE ON enrichment_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON enrichment_templates TO authenticated;
GRANT SELECT ON enrichment_stats TO authenticated;
