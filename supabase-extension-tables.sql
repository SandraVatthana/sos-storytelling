-- ===========================================
-- TABLES POUR EXTENSION CHROME LINKEDIN
-- SOS Storytelling - Import LinkedIn Sales Navigator
-- ===========================================

-- 1. Table pour tracker les imports depuis l'extension
CREATE TABLE IF NOT EXISTS import_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Source et stats
    source TEXT NOT NULL DEFAULT 'linkedin_extension',
    total_leads INTEGER DEFAULT 0,
    imported_leads INTEGER DEFAULT 0,
    duplicate_leads INTEGER DEFAULT 0,

    -- Campagne associee (optionnel)
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,

    -- Metadonnees
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_events_user ON import_events(user_id);
CREATE INDEX IF NOT EXISTS idx_import_events_source ON import_events(source);
CREATE INDEX IF NOT EXISTS idx_import_events_created ON import_events(created_at);

-- 2. Ajouter index sur linkedin_url pour recherche rapide des doublons
CREATE INDEX IF NOT EXISTS idx_prospects_linkedin_url ON prospects(linkedin_url)
WHERE linkedin_url IS NOT NULL;

-- 3. Ajouter colonne source si pas existante et index
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prospects' AND column_name = 'source') THEN
        ALTER TABLE prospects ADD COLUMN source TEXT DEFAULT 'manual';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prospects_source ON prospects(source);

-- 4. RLS pour import_events
ALTER TABLE import_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import_events" ON import_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import_events" ON import_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. Fonction pour statistiques d'import
CREATE OR REPLACE FUNCTION get_import_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_imports BIGINT,
    total_leads_imported BIGINT,
    total_duplicates BIGINT,
    sources JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_imports,
        COALESCE(SUM(imported_leads), 0)::BIGINT as total_leads_imported,
        COALESCE(SUM(duplicate_leads), 0)::BIGINT as total_duplicates,
        jsonb_object_agg(
            source,
            jsonb_build_object('count', src_count, 'leads', src_leads)
        ) as sources
    FROM (
        SELECT
            source,
            COUNT(*) as src_count,
            SUM(imported_leads) as src_leads
        FROM import_events
        WHERE user_id = p_user_id
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
        GROUP BY source
    ) subq;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Vue pour prospects LinkedIn (facilite le filtrage)
CREATE OR REPLACE VIEW linkedin_prospects AS
SELECT
    p.*,
    CASE
        WHEN p.email LIKE '%@linkedin.enrichment.pending' THEN true
        ELSE false
    END as needs_email_enrichment
FROM prospects p
WHERE p.source IN ('linkedin_extension', 'linkedin_sales_navigator');

-- 7. Grant permissions
GRANT SELECT ON linkedin_prospects TO authenticated;
GRANT EXECUTE ON FUNCTION get_import_stats TO authenticated;
