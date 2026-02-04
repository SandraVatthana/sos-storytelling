-- =====================================================
-- EMAIL QUEUE SYSTEM
-- File d'attente pour l'envoi automatique des emails
-- =====================================================
--
-- INSTRUCTIONS :
-- 1. Connecte-toi à https://supabase.com/dashboard
-- 2. Sélectionne ton projet SOS Storytelling
-- 3. Va dans SQL Editor
-- 4. Copie-colle ce script et exécute-le
-- =====================================================


-- ============================================
-- TABLE : email_queue
-- File d'attente des emails à envoyer
-- ============================================

CREATE TABLE IF NOT EXISTS email_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Liens
    campaign_id UUID NOT NULL,
    prospect_id UUID,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Destinataire
    to_email VARCHAR(255) NOT NULL,
    to_name VARCHAR(255),

    -- Contenu
    subject TEXT NOT NULL,
    body TEXT NOT NULL,

    -- Séquence
    sequence_position INTEGER DEFAULT 1,
    send_condition VARCHAR(50) DEFAULT 'always', -- always, no_reply, no_open, no_click

    -- Programmation
    scheduled_for TIMESTAMPTZ NOT NULL,

    -- Statut
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, skipped, failed
    skip_reason VARCHAR(100),
    error_message TEXT,

    -- Expéditeur utilisé
    sender_email_id UUID,

    -- Tracking
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign ON email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled ON email_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_prospect ON email_queue(prospect_id, campaign_id);

-- RLS
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Politique : les utilisateurs voient leurs emails
DROP POLICY IF EXISTS "Users can view own email queue" ON email_queue;
CREATE POLICY "Users can view own email queue" ON email_queue
    FOR SELECT USING (auth.uid() = user_id);

-- Politique : le service peut tout faire (via service_role key)
DROP POLICY IF EXISTS "Service can manage all" ON email_queue;
CREATE POLICY "Service can manage all" ON email_queue
    FOR ALL USING (true) WITH CHECK (true);


-- ============================================
-- FONCTION : Ajouter des emails à la queue
-- Appelée quand une campagne est lancée
-- ============================================

CREATE OR REPLACE FUNCTION queue_campaign_emails(
    p_campaign_id UUID,
    p_prospect_ids UUID[],
    p_sequence_emails JSONB,
    p_start_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER AS $$
DECLARE
    v_prospect RECORD;
    v_email JSONB;
    v_position INTEGER;
    v_delay_days INTEGER;
    v_scheduled_for TIMESTAMPTZ;
    v_count INTEGER := 0;
    v_user_id UUID;
    v_subject TEXT;
    v_body TEXT;
BEGIN
    -- Récupérer le user_id de la campagne
    SELECT user_id INTO v_user_id FROM email_campaigns WHERE id = p_campaign_id;

    -- Pour chaque prospect
    FOR v_prospect IN
        SELECT id, email, first_name, last_name, company
        FROM hub_prospects
        WHERE id = ANY(p_prospect_ids)
    LOOP
        v_position := 0;

        -- Pour chaque email de la séquence
        FOR v_email IN SELECT * FROM jsonb_array_elements(p_sequence_emails)
        LOOP
            v_position := v_position + 1;
            v_delay_days := COALESCE((v_email->>'delay_days')::INTEGER, 0);
            v_scheduled_for := p_start_date + (v_delay_days || ' days')::INTERVAL;

            -- Personnaliser le sujet et le corps
            v_subject := v_email->>'subject_template';
            v_body := v_email->>'body_template';

            -- Remplacer les variables
            v_subject := REPLACE(v_subject, '{first_name}', COALESCE(v_prospect.first_name, 'there'));
            v_subject := REPLACE(v_subject, '{last_name}', COALESCE(v_prospect.last_name, ''));
            v_subject := REPLACE(v_subject, '{company}', COALESCE(v_prospect.company, 'votre entreprise'));

            v_body := REPLACE(v_body, '{first_name}', COALESCE(v_prospect.first_name, 'there'));
            v_body := REPLACE(v_body, '{last_name}', COALESCE(v_prospect.last_name, ''));
            v_body := REPLACE(v_body, '{company}', COALESCE(v_prospect.company, 'votre entreprise'));

            -- Insérer dans la queue
            INSERT INTO email_queue (
                campaign_id,
                prospect_id,
                user_id,
                to_email,
                to_name,
                subject,
                body,
                sequence_position,
                send_condition,
                scheduled_for
            ) VALUES (
                p_campaign_id,
                v_prospect.id,
                v_user_id,
                v_prospect.email,
                v_prospect.first_name,
                v_subject,
                v_body,
                v_position,
                COALESCE(v_email->>'send_condition', 'always'),
                v_scheduled_for
            );

            v_count := v_count + 1;
        END LOOP;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- FONCTION : Incrémenter le compteur d'envoi
-- ============================================

CREATE OR REPLACE FUNCTION increment_sender_email_count(sender_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE sender_emails
    SET
        emails_sent_today = COALESCE(emails_sent_today, 0) + 1,
        total_emails_sent = COALESCE(total_emails_sent, 0) + 1,
        last_email_sent_at = NOW()
    WHERE id = sender_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- FONCTION : Stats de la queue
-- ============================================

CREATE OR REPLACE FUNCTION get_queue_stats(p_user_id UUID)
RETURNS TABLE(
    pending_count BIGINT,
    sent_today BIGINT,
    sent_total BIGINT,
    failed_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'sent' AND sent_at > CURRENT_DATE) as sent_today,
        COUNT(*) FILTER (WHERE status = 'sent') as sent_total,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count
    FROM email_queue
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- TRIGGER : Mise à jour timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_email_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_queue_updated ON email_queue;
CREATE TRIGGER trigger_email_queue_updated
    BEFORE UPDATE ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_email_queue_timestamp();


-- ============================================
-- VUE : Résumé par campagne
-- ============================================

CREATE OR REPLACE VIEW campaign_email_stats AS
SELECT
    campaign_id,
    COUNT(*) as total_emails,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'sent') as sent,
    COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as opened,
    COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as clicked,
    COUNT(*) FILTER (WHERE replied_at IS NOT NULL) as replied,
    MIN(scheduled_for) FILTER (WHERE status = 'pending') as next_scheduled
FROM email_queue
GROUP BY campaign_id;


-- ============================================
-- VÉRIFICATION
-- ============================================

SELECT 'Table email_queue créée avec succès!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'email_queue') as table_exists;
