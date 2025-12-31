-- =====================================================
-- RGPD - Tables et colonnes pour la conformité
-- SOS Storytelling & Personal Branding
-- =====================================================

-- 1. Ajouter le champ unsubscribed_at à la table prospects
ALTER TABLE prospects
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP WITH TIME ZONE;

-- 2. Ajouter le champ company_name à agent_config (pour le footer RGPD)
ALTER TABLE agent_config
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

-- 2b. Ajouter les champs warm-up pour la délivrabilité
ALTER TABLE agent_config
ADD COLUMN IF NOT EXISTS warmup_mode BOOLEAN DEFAULT FALSE;

ALTER TABLE agent_config
ADD COLUMN IF NOT EXISTS warmup_started_at TIMESTAMP WITH TIME ZONE;

-- 3. Créer la table email_blocklist (emails qui ne doivent plus être contactés)
CREATE TABLE IF NOT EXISTS email_blocklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    reason VARCHAR(50) DEFAULT 'unsubscribed',
    -- Raisons possibles: unsubscribed, bounced, complained, manual
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source VARCHAR(100) -- D'où vient la désinscription
);

-- Index pour recherche rapide par email
CREATE INDEX IF NOT EXISTS idx_email_blocklist_email ON email_blocklist(email);

-- 4. Fonction pour vérifier si un email est bloqué
CREATE OR REPLACE FUNCTION is_email_blocked(check_email VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM email_blocklist WHERE email = check_email
    );
END;
$$ LANGUAGE plpgsql;

-- 5. Vue des prospects désinscrits (pour reporting RGPD)
CREATE OR REPLACE VIEW unsubscribed_prospects_view AS
SELECT
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.company,
    p.unsubscribed_at,
    u.email as owner_email
FROM prospects p
JOIN auth.users u ON p.user_id = u.id
WHERE p.agent_status = 'unsubscribed'
ORDER BY p.unsubscribed_at DESC;

-- =====================================================
-- NOTES IMPORTANTES RGPD pour le cold email B2B en France
-- =====================================================
--
-- 1. BASE LÉGALE (Art. L.34-5 du CPCE)
--    - En B2B, la prospection commerciale est autorisée si :
--      a) L'email est professionnel (pas personnel)
--      b) Le message est en rapport avec l'activité professionnelle du destinataire
--      c) Un lien de désinscription fonctionnel est présent
--
-- 2. OBLIGATIONS :
--    - Identification claire de l'expéditeur (nom, entreprise)
--    - Objet explicite (pas de tromperie)
--    - Lien de désinscription simple et gratuit
--    - Traitement immédiat des demandes de désinscription
--
-- 3. DONNÉES À CONSERVER :
--    - Preuve de la source des données (d'où vient l'email)
--    - Date et heure de chaque email envoyé
--    - Historique des désinscriptions
--
-- 4. DURÉE DE CONSERVATION :
--    - Les données de prospection peuvent être conservées 3 ans
--      après le dernier contact
--    - Les données de désinscription doivent être conservées indéfiniment
--      (pour ne jamais recontacter ces personnes)
-- =====================================================

-- VÉRIFICATION
-- SELECT * FROM email_blocklist LIMIT 5;
-- SELECT * FROM unsubscribed_prospects_view LIMIT 5;
