-- ============================================================
-- SOS STORYTELLING - MULTI-SENDER EMAILS SYSTEM
-- Gestion multi-adresses avec limite 20 emails/jour/adresse
-- Best Practice Cold Email 2026
-- ============================================================

-- ============ 1. TABLE SENDER_EMAILS ============
-- Stocke les adresses email d'envoi avec leurs limites et stats

CREATE TABLE IF NOT EXISTS sender_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Informations de l'adresse
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    reply_to VARCHAR(255),

    -- Configuration SMTP/Brevo
    smtp_config JSONB DEFAULT '{}',  -- Pour config SMTP custom si besoin
    brevo_sender_id INTEGER,          -- ID du sender dans Brevo si applicable

    -- Limites et quotas
    daily_limit INTEGER DEFAULT 20,   -- 20 emails/jour par défaut (best practice 2026)
    warmup_enabled BOOLEAN DEFAULT true,
    warmup_current_limit INTEGER DEFAULT 5,  -- Commence à 5, augmente progressivement
    warmup_increment INTEGER DEFAULT 3,      -- +3 par jour
    warmup_started_at TIMESTAMPTZ,

    -- Stats du jour (reset à minuit)
    emails_sent_today INTEGER DEFAULT 0,
    last_sent_at TIMESTAMPTZ,
    last_reset_date DATE DEFAULT CURRENT_DATE,

    -- Stats globales
    total_emails_sent INTEGER DEFAULT 0,
    total_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_replies INTEGER DEFAULT 0,
    total_bounces INTEGER DEFAULT 0,

    -- Santé de l'adresse
    health_score INTEGER DEFAULT 100,  -- 0-100, diminue si bounces/spam
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(64),
    verified_at TIMESTAMPTZ,

    -- Dernière erreur
    last_error TEXT,
    last_error_at TIMESTAMPTZ,
    consecutive_errors INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contraintes
    UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_sender_emails_user ON sender_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_sender_emails_active ON sender_emails(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sender_emails_health ON sender_emails(health_score DESC);


-- ============ 2. TABLE EMAIL_SEND_LOG ============
-- Log de chaque email envoyé pour tracking précis

CREATE TABLE IF NOT EXISTS email_send_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_email_id UUID NOT NULL REFERENCES sender_emails(id) ON DELETE CASCADE,
    campaign_id UUID,  -- Référence à la campagne si applicable

    -- Destinataire
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),
    prospect_id UUID,  -- Référence au prospect si applicable

    -- Contenu
    subject TEXT,

    -- Séquence (pour limiter à 3 touchpoints)
    touchpoint_number INTEGER DEFAULT 1,  -- 1 = initial, 2 = relance 1, 3 = relance 2 (max)

    -- Statut
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'spam', 'failed')),

    -- Tracking
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,

    -- Metadata
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    brevo_message_id VARCHAR(255),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_sender ON email_send_log(sender_email_id);
CREATE INDEX IF NOT EXISTS idx_email_log_campaign ON email_send_log(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_log_prospect ON email_send_log(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_log_date ON email_send_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON email_send_log(recipient_email, touchpoint_number);


-- ============ 3. FONCTIONS UTILITAIRES ============

-- Fonction pour réinitialiser les compteurs quotidiens (à appeler via cron)
CREATE OR REPLACE FUNCTION reset_daily_email_counters()
RETURNS void AS $$
BEGIN
    UPDATE sender_emails
    SET
        emails_sent_today = 0,
        last_reset_date = CURRENT_DATE,
        -- Augmenter le warmup si actif
        warmup_current_limit = CASE
            WHEN warmup_enabled AND warmup_current_limit < daily_limit
            THEN LEAST(warmup_current_limit + warmup_increment, daily_limit)
            ELSE warmup_current_limit
        END
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;


-- Fonction pour obtenir la prochaine adresse disponible (rotation)
CREATE OR REPLACE FUNCTION get_next_available_sender(p_user_id UUID)
RETURNS TABLE (
    sender_id UUID,
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    remaining_today INTEGER
) AS $$
BEGIN
    -- Reset si nécessaire
    PERFORM reset_daily_email_counters();

    RETURN QUERY
    SELECT
        se.id,
        se.email,
        se.display_name,
        (CASE
            WHEN se.warmup_enabled THEN se.warmup_current_limit
            ELSE se.daily_limit
        END - se.emails_sent_today) AS remaining
    FROM sender_emails se
    WHERE se.user_id = p_user_id
      AND se.is_active = true
      AND se.health_score >= 50
      AND se.emails_sent_today < (
          CASE
              WHEN se.warmup_enabled THEN se.warmup_current_limit
              ELSE se.daily_limit
          END
      )
    ORDER BY
        se.emails_sent_today ASC,  -- Prioriser celles qui ont moins envoyé
        se.health_score DESC,       -- Puis celles en meilleure santé
        RANDOM()                    -- Un peu de randomisation
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- Fonction pour incrémenter le compteur après envoi
CREATE OR REPLACE FUNCTION increment_sender_counter(p_sender_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE sender_emails
    SET
        emails_sent_today = emails_sent_today + 1,
        total_emails_sent = total_emails_sent + 1,
        last_sent_at = NOW()
    WHERE id = p_sender_id;
END;
$$ LANGUAGE plpgsql;


-- Fonction pour vérifier si un prospect a déjà reçu 3 touchpoints
CREATE OR REPLACE FUNCTION can_send_to_prospect(p_user_id UUID, p_prospect_email VARCHAR(255), p_campaign_id UUID DEFAULT NULL)
RETURNS TABLE (
    can_send BOOLEAN,
    current_touchpoint INTEGER,
    last_sent TIMESTAMPTZ
) AS $$
DECLARE
    v_count INTEGER;
    v_last_sent TIMESTAMPTZ;
BEGIN
    SELECT COUNT(*), MAX(sent_at)
    INTO v_count, v_last_sent
    FROM email_send_log
    WHERE user_id = p_user_id
      AND recipient_email = p_prospect_email
      AND (p_campaign_id IS NULL OR campaign_id = p_campaign_id)
      AND status NOT IN ('bounced', 'failed');

    RETURN QUERY SELECT
        v_count < 3 AS can_send,
        COALESCE(v_count, 0) + 1 AS current_touchpoint,
        v_last_sent;
END;
$$ LANGUAGE plpgsql;


-- Fonction pour obtenir les stats d'envoi du jour
CREATE OR REPLACE FUNCTION get_daily_send_stats(p_user_id UUID)
RETURNS TABLE (
    total_available INTEGER,
    total_sent_today INTEGER,
    total_remaining INTEGER,
    active_senders INTEGER,
    senders_at_limit INTEGER
) AS $$
BEGIN
    -- Reset si nécessaire
    PERFORM reset_daily_email_counters();

    RETURN QUERY
    SELECT
        SUM(CASE WHEN warmup_enabled THEN warmup_current_limit ELSE daily_limit END)::INTEGER,
        SUM(emails_sent_today)::INTEGER,
        SUM(CASE WHEN warmup_enabled THEN warmup_current_limit ELSE daily_limit END - emails_sent_today)::INTEGER,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE emails_sent_today >= (CASE WHEN warmup_enabled THEN warmup_current_limit ELSE daily_limit END))::INTEGER
    FROM sender_emails
    WHERE user_id = p_user_id
      AND is_active = true;
END;
$$ LANGUAGE plpgsql;


-- ============ 4. TRIGGERS ============

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_sender_email_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sender_email_updated_at ON sender_emails;
CREATE TRIGGER sender_email_updated_at
    BEFORE UPDATE ON sender_emails
    FOR EACH ROW EXECUTE FUNCTION update_sender_email_timestamp();


-- ============ 5. ROW LEVEL SECURITY ============

ALTER TABLE sender_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_send_log ENABLE ROW LEVEL SECURITY;

-- Policies sender_emails
CREATE POLICY "Users can view own sender emails" ON sender_emails
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sender emails" ON sender_emails
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sender emails" ON sender_emails
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sender emails" ON sender_emails
    FOR DELETE USING (auth.uid() = user_id);

-- Policies email_send_log
CREATE POLICY "Users can view own send logs" ON email_send_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own send logs" ON email_send_log
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ============ 6. MODIFICATION TABLE CAMPAIGNS ============
-- Ajouter la limite de relances

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_campaigns') THEN
        -- Ajouter max_touchpoints si pas présent
        ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS max_touchpoints INTEGER DEFAULT 3;

        -- Ajouter délai entre relances
        ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS followup_delay_days INTEGER DEFAULT 3;
    END IF;
END $$;


-- ============ FIN ============
-- NOTE: Exécuter ce script dans Supabase SQL Editor
-- La fonction reset_daily_email_counters() devrait être appelée via un cron job à minuit
