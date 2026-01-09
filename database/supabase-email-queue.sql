-- =====================================================
-- TABLE EMAIL_QUEUE - File d'attente des emails Autopilot
-- SOS Storytelling & Personal Branding
-- =====================================================

-- IMPORTANT: Supprimer la vue d'abord (elle sera recréée à la fin)
DROP VIEW IF EXISTS pending_emails_view;

-- Créer la table email_queue
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Infos prospect
    prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
    prospect_email VARCHAR(255) NOT NULL,
    prospect_name VARCHAR(255),

    -- Contenu de l'email
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),

    -- Metadata template
    template_id UUID,
    template_position INTEGER DEFAULT 1,

    -- Statut de l'email
    status VARCHAR(50) DEFAULT 'pending_approval',
    -- Valeurs possibles: pending_approval, approved, sent, rejected, error

    -- Anti-spam
    spam_score INTEGER DEFAULT 0,
    spam_warnings TEXT, -- JSON array des avertissements

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,

    -- En cas d'erreur
    error_message TEXT,
    message_id VARCHAR(255), -- ID Brevo après envoi

    -- Tracking
    run_id VARCHAR(255) -- ID du cycle agent qui a créé cet email
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_user_status ON email_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_email_queue_created_at ON email_queue(created_at DESC);

-- Activer RLS (Row Level Security)
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Supprimer les anciennes politiques si elles existent (pour éviter l'erreur 42710)
DROP POLICY IF EXISTS "Users can view own email queue" ON email_queue;
DROP POLICY IF EXISTS "Users can update own email queue" ON email_queue;

-- Politique: Les utilisateurs ne peuvent voir que leurs propres emails
CREATE POLICY "Users can view own email queue"
    ON email_queue FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own email queue"
    ON email_queue FOR UPDATE
    USING (auth.uid() = user_id);

-- Note: INSERT et DELETE gérés par le service role (worker)

-- Si la table existe déjà, ajouter les colonnes anti-spam
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS spam_warnings TEXT;

-- =====================================================
-- AJOUTER LE CHAMP require_approval À agent_config
-- =====================================================

-- Si la table agent_config existe déjà, ajouter le champ
ALTER TABLE agent_config
ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT TRUE;

-- Par défaut, tous les utilisateurs existants nécessitent une validation
UPDATE agent_config SET require_approval = TRUE WHERE require_approval IS NULL;

-- =====================================================
-- VUE POUR LES EMAILS EN ATTENTE (optionnel)
-- =====================================================

CREATE OR REPLACE VIEW pending_emails_view AS
SELECT
    eq.*,
    p.company as prospect_company,
    p.job_title as prospect_job_title
FROM email_queue eq
LEFT JOIN prospects p ON eq.prospect_id = p.id
WHERE eq.status = 'pending_approval'
ORDER BY eq.created_at DESC;

-- =====================================================
-- VÉRIFICATION
-- =====================================================
-- SELECT * FROM email_queue LIMIT 1;
-- SELECT * FROM agent_config LIMIT 1;
