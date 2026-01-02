-- =====================================================
-- INBOX INTELLIGENTE - Tables Supabase (Version OVH/IMAP)
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================

-- Modifier la table email_connections pour IMAP
ALTER TABLE email_connections
ADD COLUMN IF NOT EXISTS imap_host TEXT DEFAULT 'ssl0.ovh.net',
ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993,
ADD COLUMN IF NOT EXISTS imap_user TEXT,
ADD COLUMN IF NOT EXISTS imap_password TEXT, -- Chiffré côté serveur
ADD COLUMN IF NOT EXISTS smtp_host TEXT DEFAULT 'ssl0.ovh.net',
ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 465;

-- Mettre à jour le check constraint pour inclure 'ovh' et 'imap'
ALTER TABLE email_connections DROP CONSTRAINT IF EXISTS email_connections_provider_check;
ALTER TABLE email_connections ADD CONSTRAINT email_connections_provider_check
CHECK (provider IN ('gmail', 'outlook', 'ovh', 'imap'));

-- Vérification
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'email_connections' ORDER BY ordinal_position;
