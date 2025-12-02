-- ============================================================
-- Visual History Table - Pour stocker l'historique des visuels générés
-- ============================================================

-- Table pour l'historique des visuels générés via Orshot
CREATE TABLE IF NOT EXISTS visual_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Informations sur le visuel
    content_type VARCHAR(50) NOT NULL, -- post_instagram, story_instagram, etc.
    template_id VARCHAR(100) NOT NULL,
    template_name VARCHAR(100),

    -- Contenu utilisé pour générer le visuel
    content_data JSONB NOT NULL DEFAULT '{}',

    -- Résultat
    image_url TEXT,
    width INTEGER,
    height INTEGER,
    format VARCHAR(10) DEFAULT 'png', -- png, webp, jpg

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Index pour les requêtes fréquentes
    CONSTRAINT visual_history_content_type_check CHECK (
        content_type IN ('post_instagram', 'story_instagram', 'carrousel_instagram', 'post_linkedin', 'quote')
    )
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_visual_history_user_id ON visual_history(user_id);
CREATE INDEX IF NOT EXISTS idx_visual_history_created_at ON visual_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visual_history_content_type ON visual_history(content_type);
CREATE INDEX IF NOT EXISTS idx_visual_history_user_content ON visual_history(user_id, content_type);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

-- Activer RLS
ALTER TABLE visual_history ENABLE ROW LEVEL SECURITY;

-- Policy: Les utilisateurs peuvent voir leurs propres visuels
CREATE POLICY "Users can view own visuals" ON visual_history
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent créer leurs propres visuels
CREATE POLICY "Users can create own visuals" ON visual_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Les utilisateurs peuvent supprimer leurs propres visuels
CREATE POLICY "Users can delete own visuals" ON visual_history
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================
-- Fonction pour nettoyer les anciens visuels (optionnel)
-- Garde uniquement les 100 derniers visuels par utilisateur
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_old_visuals()
RETURNS TRIGGER AS $$
BEGIN
    -- Supprimer les visuels au-delà des 100 plus récents
    DELETE FROM visual_history
    WHERE user_id = NEW.user_id
    AND id NOT IN (
        SELECT id FROM visual_history
        WHERE user_id = NEW.user_id
        ORDER BY created_at DESC
        LIMIT 100
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour le nettoyage automatique
DROP TRIGGER IF EXISTS trigger_cleanup_old_visuals ON visual_history;
CREATE TRIGGER trigger_cleanup_old_visuals
    AFTER INSERT ON visual_history
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_old_visuals();

-- ============================================================
-- Grant permissions pour le service role
-- ============================================================

GRANT ALL ON visual_history TO service_role;
GRANT ALL ON visual_history TO authenticated;

-- ============================================================
-- Commentaires sur la table
-- ============================================================

COMMENT ON TABLE visual_history IS 'Historique des visuels générés via Orshot pour SOS Storytelling';
COMMENT ON COLUMN visual_history.content_type IS 'Type de format: post_instagram, story_instagram, carrousel_instagram, post_linkedin, quote';
COMMENT ON COLUMN visual_history.content_data IS 'Données JSON utilisées pour générer le visuel (titre, accroche, points, etc.)';
COMMENT ON COLUMN visual_history.image_url IS 'URL de l''image générée (stockée temporairement chez Orshot)';
