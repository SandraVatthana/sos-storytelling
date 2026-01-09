-- ============================================================
-- SOS STORYTELLING - SYSTÈME DÉLIVRABILITÉ EMAIL PRO
-- Phase 1: Blacklist, Queue, Domaines
-- ============================================================

-- ============ 1. TABLE EMAIL_BLACKLIST ============
-- Stocke les emails à ne jamais recontacter

CREATE TABLE IF NOT EXISTS email_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Email blacklisté
    email VARCHAR(255) NOT NULL,

    -- Raison du blacklist
    reason VARCHAR(50) NOT NULL CHECK (reason IN (
        'hard_bounce',      -- Email n'existe pas
        'soft_bounce',      -- Boîte pleine, temporaire
        'complaint',        -- Signalé comme spam
        'unsubscribe',      -- Désabonnement
        'invalid',          -- Vérification échouée
        'manual'            -- Ajouté manuellement
    )),

    -- Source de l'info
    source VARCHAR(100), -- brevo_webhook, millionverifier, manual, import

    -- Détails additionnels
    details JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte unique par user
    UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_blacklist_user ON email_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_email ON email_blacklist(email);
CREATE INDEX IF NOT EXISTS idx_blacklist_reason ON email_blacklist(reason);


-- ============ 2. TABLE EMAIL_QUEUE ============
-- File d'attente centralisée pour orchestration des envois

-- Supprimer l'ancienne table si elle existe (schéma incompatible)
DROP TABLE IF EXISTS email_queue CASCADE;

CREATE TABLE email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Références
    campaign_id UUID,
    prospect_id UUID NOT NULL,
    sender_email_id UUID REFERENCES sender_emails(id),
    sequence_step INTEGER DEFAULT 1,

    -- Contenu email
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,

    -- Destinataire (dénormalisé pour perf)
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(255),

    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

    -- Options
    send_weekdays_only BOOLEAN DEFAULT false,
    send_hours_start INTEGER DEFAULT 9,
    send_hours_end INTEGER DEFAULT 18,

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending',      -- En attente
        'processing',   -- En cours de traitement
        'sent',         -- Envoyé avec succès
        'failed',       -- Échec d'envoi
        'cancelled',    -- Annulé
        'skipped'       -- Ignoré (blacklist, etc.)
    )),

    -- Tentatives et erreurs
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    last_attempt_at TIMESTAMPTZ,

    -- Résultat
    brevo_message_id VARCHAR(255),
    sent_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_pending ON email_queue(scheduled_at)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_queue_user ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_queue_campaign ON email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_sender ON email_queue(sender_email_id);


-- ============ 3. TABLE SENDER_DOMAINS ============
-- Gestion des domaines d'envoi avec vérification DNS

CREATE TABLE IF NOT EXISTS sender_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Domaine
    domain VARCHAR(255) NOT NULL,

    -- Statut DNS
    spf_valid BOOLEAN DEFAULT false,
    spf_record TEXT,
    dkim_valid BOOLEAN DEFAULT false,
    dkim_selector VARCHAR(100),
    dmarc_valid BOOLEAN DEFAULT false,
    dmarc_record TEXT,
    mx_valid BOOLEAN DEFAULT false,

    -- Score global (0-100)
    dns_score INTEGER DEFAULT 0,

    -- Réputation
    reputation_score INTEGER DEFAULT 100,
    total_emails_sent INTEGER DEFAULT 0,
    total_bounces INTEGER DEFAULT 0,
    total_complaints INTEGER DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0,
    complaint_rate DECIMAL(5,4) DEFAULT 0,

    -- Vérification
    last_dns_check TIMESTAMPTZ,
    dns_check_error TEXT,

    -- Status
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Contrainte unique
    UNIQUE(user_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_domains_user ON sender_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_domains_domain ON sender_domains(domain);


-- ============ 4. MODIFICATION TABLE PROSPECTS ============
-- Ajouter colonnes vérification

DO $$
BEGIN
    -- verification_status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prospects' AND column_name = 'verification_status') THEN
        ALTER TABLE prospects ADD COLUMN verification_status VARCHAR(20) DEFAULT 'unverified';
    END IF;

    -- verification_result (JSON détaillé)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prospects' AND column_name = 'verification_result') THEN
        ALTER TABLE prospects ADD COLUMN verification_result JSONB;
    END IF;

    -- verified_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prospects' AND column_name = 'verified_at') THEN
        ALTER TABLE prospects ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;

    -- is_disposable (email jetable)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prospects' AND column_name = 'is_disposable') THEN
        ALTER TABLE prospects ADD COLUMN is_disposable BOOLEAN DEFAULT false;
    END IF;

    -- is_catch_all
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prospects' AND column_name = 'is_catch_all') THEN
        ALTER TABLE prospects ADD COLUMN is_catch_all BOOLEAN DEFAULT false;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prospects_verification ON prospects(verification_status);


-- ============ 5. FONCTIONS UTILITAIRES ============

-- Fonction pour vérifier si un email est blacklisté
CREATE OR REPLACE FUNCTION is_email_blacklisted(p_user_id UUID, p_email VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM email_blacklist
        WHERE user_id = p_user_id AND email = LOWER(p_email)
    );
END;
$$ LANGUAGE plpgsql;


-- Fonction pour ajouter au blacklist
CREATE OR REPLACE FUNCTION add_to_blacklist(
    p_user_id UUID,
    p_email VARCHAR(255),
    p_reason VARCHAR(50),
    p_source VARCHAR(100) DEFAULT 'system',
    p_details JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO email_blacklist (user_id, email, reason, source, details)
    VALUES (p_user_id, LOWER(p_email), p_reason, p_source, p_details)
    ON CONFLICT (user_id, email) DO UPDATE
    SET reason = EXCLUDED.reason,
        source = EXCLUDED.source,
        details = EXCLUDED.details
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;


-- Fonction pour mettre à jour le health_score d'un sender après bounce
CREATE OR REPLACE FUNCTION update_sender_health_on_bounce(p_sender_id UUID, p_is_hard_bounce BOOLEAN)
RETURNS void AS $$
DECLARE
    v_penalty INTEGER;
BEGIN
    v_penalty := CASE WHEN p_is_hard_bounce THEN 10 ELSE 5 END;

    UPDATE sender_emails
    SET
        health_score = GREATEST(0, health_score - v_penalty),
        total_bounces = total_bounces + 1,
        -- Désactiver si health < 50
        is_active = CASE WHEN health_score - v_penalty < 50 THEN false ELSE is_active END
    WHERE id = p_sender_id;
END;
$$ LANGUAGE plpgsql;


-- Fonction pour mettre à jour les stats domaine après envoi
CREATE OR REPLACE FUNCTION update_domain_stats(p_domain_id UUID, p_event_type VARCHAR(50))
RETURNS void AS $$
BEGIN
    UPDATE sender_domains
    SET
        total_emails_sent = CASE WHEN p_event_type = 'sent' THEN total_emails_sent + 1 ELSE total_emails_sent END,
        total_bounces = CASE WHEN p_event_type IN ('hard_bounce', 'soft_bounce') THEN total_bounces + 1 ELSE total_bounces END,
        total_complaints = CASE WHEN p_event_type = 'complaint' THEN total_complaints + 1 ELSE total_complaints END,
        bounce_rate = CASE
            WHEN total_emails_sent > 0 THEN (total_bounces::DECIMAL / total_emails_sent * 100)
            ELSE 0
        END,
        complaint_rate = CASE
            WHEN total_emails_sent > 0 THEN (total_complaints::DECIMAL / total_emails_sent)
            ELSE 0
        END,
        updated_at = NOW()
    WHERE id = p_domain_id;
END;
$$ LANGUAGE plpgsql;


-- Fonction pour obtenir les prochains emails à envoyer
CREATE OR REPLACE FUNCTION get_pending_emails(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    queue_id UUID,
    user_id UUID,
    campaign_id UUID,
    prospect_id UUID,
    sender_email_id UUID,
    subject TEXT,
    body_html TEXT,
    body_text TEXT,
    recipient_email VARCHAR(255),
    recipient_name VARCHAR(255),
    scheduled_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        eq.id,
        eq.user_id,
        eq.campaign_id,
        eq.prospect_id,
        eq.sender_email_id,
        eq.subject,
        eq.body_html,
        eq.body_text,
        eq.recipient_email,
        eq.recipient_name,
        eq.scheduled_at
    FROM email_queue eq
    WHERE eq.status = 'pending'
      AND eq.scheduled_at <= NOW()
      AND eq.attempts < eq.max_attempts
      -- Vérifier que l'email n'est pas blacklisté
      AND NOT EXISTS (
          SELECT 1 FROM email_blacklist bl
          WHERE bl.user_id = eq.user_id AND bl.email = eq.recipient_email
      )
    ORDER BY eq.priority DESC, eq.scheduled_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- Fonction pour marquer un email comme envoyé
CREATE OR REPLACE FUNCTION mark_email_sent(p_queue_id UUID, p_brevo_message_id VARCHAR(255))
RETURNS void AS $$
BEGIN
    UPDATE email_queue
    SET
        status = 'sent',
        sent_at = NOW(),
        brevo_message_id = p_brevo_message_id,
        updated_at = NOW()
    WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql;


-- Fonction pour marquer un email comme échoué
CREATE OR REPLACE FUNCTION mark_email_failed(p_queue_id UUID, p_error TEXT)
RETURNS void AS $$
BEGIN
    UPDATE email_queue
    SET
        attempts = attempts + 1,
        last_error = p_error,
        last_attempt_at = NOW(),
        status = CASE
            WHEN attempts + 1 >= max_attempts THEN 'failed'
            ELSE 'pending'
        END,
        updated_at = NOW()
    WHERE id = p_queue_id;
END;
$$ LANGUAGE plpgsql;


-- ============ 6. TRIGGERS ============

-- Trigger updated_at pour email_queue
CREATE OR REPLACE FUNCTION update_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS queue_updated_at ON email_queue;
CREATE TRIGGER queue_updated_at
    BEFORE UPDATE ON email_queue
    FOR EACH ROW EXECUTE FUNCTION update_queue_timestamp();

-- Trigger updated_at pour sender_domains
DROP TRIGGER IF EXISTS domain_updated_at ON sender_domains;
CREATE TRIGGER domain_updated_at
    BEFORE UPDATE ON sender_domains
    FOR EACH ROW EXECUTE FUNCTION update_queue_timestamp();


-- ============ 7. ROW LEVEL SECURITY ============

ALTER TABLE email_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE sender_domains ENABLE ROW LEVEL SECURITY;

-- Policies email_blacklist
CREATE POLICY "Users can view own blacklist" ON email_blacklist
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own blacklist" ON email_blacklist
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own blacklist" ON email_blacklist
    FOR DELETE USING (auth.uid() = user_id);

-- Policies email_queue
CREATE POLICY "Users can view own queue" ON email_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queue" ON email_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue" ON email_queue
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue" ON email_queue
    FOR DELETE USING (auth.uid() = user_id);

-- Policies sender_domains
CREATE POLICY "Users can view own domains" ON sender_domains
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own domains" ON sender_domains
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own domains" ON sender_domains
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own domains" ON sender_domains
    FOR DELETE USING (auth.uid() = user_id);


-- ============ 8. VUES UTILES ============

-- Vue des stats de délivrabilité par sender
CREATE OR REPLACE VIEW sender_deliverability_stats AS
SELECT
    se.id,
    se.user_id,
    se.email,
    se.display_name,
    se.health_score,
    se.total_emails_sent,
    se.total_opens,
    se.total_clicks,
    se.total_replies,
    se.total_bounces,
    -- Calculs de taux
    CASE WHEN se.total_emails_sent > 0
         THEN ROUND((se.total_opens::DECIMAL / se.total_emails_sent * 100), 2)
         ELSE 0 END AS open_rate,
    CASE WHEN se.total_emails_sent > 0
         THEN ROUND((se.total_replies::DECIMAL / se.total_emails_sent * 100), 2)
         ELSE 0 END AS reply_rate,
    CASE WHEN se.total_emails_sent > 0
         THEN ROUND((se.total_bounces::DECIMAL / se.total_emails_sent * 100), 2)
         ELSE 0 END AS bounce_rate,
    -- Alertes
    CASE
        WHEN se.total_emails_sent > 10 AND (se.total_bounces::DECIMAL / se.total_emails_sent) > 0.05
            THEN 'bounce_alert'
        WHEN se.total_emails_sent > 50 AND (se.total_opens::DECIMAL / se.total_emails_sent) < 0.15
            THEN 'low_open_alert'
        WHEN se.health_score < 70
            THEN 'health_alert'
        ELSE 'ok'
    END AS alert_status,
    se.is_active,
    se.warmup_enabled,
    se.emails_sent_today,
    CASE WHEN se.warmup_enabled THEN se.warmup_current_limit ELSE se.daily_limit END AS effective_limit
FROM sender_emails se;


-- ============ FIN ============
-- NOTE: Exécuter ce script dans Supabase SQL Editor
