-- =====================================================
-- GESTION DES DÉSINSCRIPTIONS EMAIL
-- Conformité RGPD et anti-spam
-- =====================================================
--
-- INSTRUCTIONS :
-- 1. Connecte-toi à https://supabase.com/dashboard
-- 2. Sélectionne ton projet SOS Storytelling
-- 3. Va dans SQL Editor
-- 4. Copie-colle ce script et exécute-le
-- =====================================================


-- ============================================
-- TABLE : email_unsubscribes
-- Liste des personnes qui se sont désinscrites
-- ============================================

CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Qui a envoyé l'email (propriétaire de la campagne)
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Email désinscrit
    email VARCHAR(255) NOT NULL,

    -- Contexte (optionnel - les références peuvent ne pas exister)
    campaign_id UUID,
    prospect_id UUID,

    -- Raison (optionnel)
    reason TEXT,

    -- Timestamps
    unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte unique : un email ne peut être désinscrit qu'une fois par user
    UNIQUE(user_id, email)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_unsubscribes_user_email ON email_unsubscribes(user_id, email);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON email_unsubscribes(email);

-- RLS
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs désinscriptions
DROP POLICY IF EXISTS "Users can view own unsubscribes" ON email_unsubscribes;
CREATE POLICY "Users can view own unsubscribes" ON email_unsubscribes
    FOR SELECT USING (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer (si quelqu'un veut se réinscrire)
DROP POLICY IF EXISTS "Users can delete own unsubscribes" ON email_unsubscribes;
CREATE POLICY "Users can delete own unsubscribes" ON email_unsubscribes
    FOR DELETE USING (auth.uid() = user_id);

-- Insertion publique (pour la page de désinscription)
DROP POLICY IF EXISTS "Allow public insert for unsubscribe" ON email_unsubscribes;
CREATE POLICY "Allow public insert for unsubscribe" ON email_unsubscribes
    FOR INSERT WITH CHECK (true);


-- ============================================
-- FONCTION : Vérifier si un email est désinscrit
-- ============================================

CREATE OR REPLACE FUNCTION is_email_unsubscribed(p_user_id UUID, p_email VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM email_unsubscribes
        WHERE user_id = p_user_id
        AND LOWER(email) = LOWER(p_email)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- FONCTION : Obtenir les emails à exclure
-- ============================================

CREATE OR REPLACE FUNCTION get_unsubscribed_emails(p_user_id UUID)
RETURNS TABLE(email VARCHAR(255), unsubscribed_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT eu.email, eu.unsubscribed_at
    FROM email_unsubscribes eu
    WHERE eu.user_id = p_user_id
    ORDER BY eu.unsubscribed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- FONCTION : Compter les désinscriptions
-- ============================================

CREATE OR REPLACE FUNCTION count_unsubscribes(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    count_result INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_result
    FROM email_unsubscribes
    WHERE user_id = p_user_id
    AND unsubscribed_at > NOW() - (p_days || ' days')::INTERVAL;

    RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- TRIGGER : Mettre à jour le statut du prospect
-- Quand quelqu'un se désinscrit, marquer le prospect
-- ============================================

CREATE OR REPLACE FUNCTION update_prospect_on_unsubscribe()
RETURNS TRIGGER AS $$
BEGIN
    -- Mettre à jour le statut du prospect si trouvé
    UPDATE hub_prospects
    SET
        status = 'unsubscribed',
        notes = COALESCE(notes, '') || E'\n[' || NOW()::DATE || '] Désinscrit: ' || COALESCE(NEW.reason, 'Aucune raison fournie')
    WHERE user_id = NEW.user_id
    AND LOWER(email) = LOWER(NEW.email);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_prospect_unsubscribe ON email_unsubscribes;
CREATE TRIGGER trigger_update_prospect_unsubscribe
    AFTER INSERT ON email_unsubscribes
    FOR EACH ROW
    EXECUTE FUNCTION update_prospect_on_unsubscribe();


-- ============================================
-- VUE : Statistiques de désinscription
-- ============================================

CREATE OR REPLACE VIEW unsubscribe_stats AS
SELECT
    user_id,
    COUNT(*) as total_unsubscribes,
    COUNT(*) FILTER (WHERE unsubscribed_at > NOW() - INTERVAL '7 days') as last_7_days,
    COUNT(*) FILTER (WHERE unsubscribed_at > NOW() - INTERVAL '30 days') as last_30_days,
    COUNT(*) FILTER (WHERE reason IS NOT NULL) as with_reason
FROM email_unsubscribes
GROUP BY user_id;


-- ============================================
-- VÉRIFICATION
-- ============================================

SELECT 'Table email_unsubscribes créée avec succès!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'email_unsubscribes') as table_exists;
