-- =====================================================
-- LIMITES D'ENVOI PAR PLAN & ALERTES ABUS
-- SOS Storytelling & Personal Branding
-- =====================================================

-- =====================================================
-- 1. LIMITES PAR PLAN
-- =====================================================

-- Plans disponibles et leurs limites
CREATE TABLE IF NOT EXISTS plan_limits (
    plan_name VARCHAR(50) PRIMARY KEY,
    daily_email_limit INTEGER NOT NULL DEFAULT 50,
    max_senders INTEGER NOT NULL DEFAULT 2,
    max_prospects INTEGER NOT NULL DEFAULT 500,
    max_campaigns_active INTEGER NOT NULL DEFAULT 3,
    description TEXT
);

-- Insérer les plans par défaut
INSERT INTO plan_limits (plan_name, daily_email_limit, max_senders, max_prospects, max_campaigns_active, description)
VALUES
    ('free', 10, 1, 100, 1, 'Essai gratuit - limité'),
    ('solo', 50, 2, 1000, 5, 'Plan Solo - freelances'),
    ('agence', 200, 5, 5000, 20, 'Plan Agence - multi-clients'),
    ('enterprise', 1000, 20, 50000, 100, 'Plan Enterprise - sur mesure')
ON CONFLICT (plan_name) DO UPDATE SET
    daily_email_limit = EXCLUDED.daily_email_limit,
    max_senders = EXCLUDED.max_senders,
    max_prospects = EXCLUDED.max_prospects,
    max_campaigns_active = EXCLUDED.max_campaigns_active;

-- Ajouter colonne plan à la table users si pas existante
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS emails_sent_today INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emails_sent_today_reset TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- 2. TABLE ALERTES ABUS
-- =====================================================

CREATE TABLE IF NOT EXISTS abuse_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    -- Types: high_bounce_rate, high_spam_rate, limit_exceeded, suspicious_activity
    severity VARCHAR(20) DEFAULT 'warning',
    -- warning, critical, suspended
    message TEXT NOT NULL,
    metric_value DECIMAL(10,4),
    threshold_value DECIMAL(10,4),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_abuse_alerts_user ON abuse_alerts(user_id, created_at DESC);

-- =====================================================
-- 3. FONCTION CHECK SENDING LIMITS (améliorée)
-- =====================================================

CREATE OR REPLACE FUNCTION check_sending_limits_v2(p_user_id UUID)
RETURNS TABLE (
    can_send BOOLEAN,
    daily_remaining INTEGER,
    hourly_remaining INTEGER,
    daily_limit INTEGER,
    plan_name TEXT,
    bounce_rate DECIMAL,
    spam_rate DECIMAL,
    has_abuse_alert BOOLEAN,
    alert_message TEXT
) AS $$
DECLARE
    v_plan VARCHAR(50);
    v_daily_limit INTEGER;
    v_emails_sent_today INTEGER;
    v_last_reset TIMESTAMPTZ;
    v_bounce_rate DECIMAL;
    v_spam_rate DECIMAL;
    v_has_alert BOOLEAN;
    v_alert_msg TEXT;
BEGIN
    -- Récupérer le plan de l'utilisateur
    SELECT COALESCE(u.plan, 'free'), COALESCE(u.emails_sent_today, 0), u.emails_sent_today_reset
    INTO v_plan, v_emails_sent_today, v_last_reset
    FROM users u WHERE u.id = p_user_id;

    -- Reset quotidien si nécessaire
    IF v_last_reset IS NULL OR v_last_reset::date < CURRENT_DATE THEN
        UPDATE users SET emails_sent_today = 0, emails_sent_today_reset = NOW() WHERE id = p_user_id;
        v_emails_sent_today := 0;
    END IF;

    -- Récupérer la limite du plan
    SELECT pl.daily_email_limit INTO v_daily_limit
    FROM plan_limits pl WHERE pl.plan_name = v_plan;

    IF v_daily_limit IS NULL THEN v_daily_limit := 50; END IF;

    -- Calculer le taux de bounce (derniers 30 jours)
    SELECT COALESCE(
        (SELECT COUNT(*)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE status != 'pending'), 0) * 100
         FROM sent_emails
         WHERE user_id = p_user_id
           AND created_at > NOW() - INTERVAL '30 days'
           AND status = 'bounced'), 0
    ) INTO v_bounce_rate;

    -- Calculer le taux de spam (plaintes)
    SELECT COALESCE(
        (SELECT COUNT(*)::DECIMAL / NULLIF(COUNT(*), 0) * 100
         FROM sent_emails
         WHERE user_id = p_user_id
           AND created_at > NOW() - INTERVAL '30 days'
           AND status = 'complaint'), 0
    ) INTO v_spam_rate;

    -- Vérifier alertes actives non résolues
    SELECT EXISTS(
        SELECT 1 FROM abuse_alerts
        WHERE user_id = p_user_id
          AND severity = 'suspended'
          AND resolved_at IS NULL
    ) INTO v_has_alert;

    IF v_has_alert THEN
        SELECT message INTO v_alert_msg FROM abuse_alerts
        WHERE user_id = p_user_id AND severity = 'suspended' AND resolved_at IS NULL
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    -- Créer alertes automatiques si nécessaire
    -- Bounce rate > 5%
    IF v_bounce_rate > 5 AND NOT EXISTS(
        SELECT 1 FROM abuse_alerts WHERE user_id = p_user_id AND alert_type = 'high_bounce_rate' AND created_at > NOW() - INTERVAL '1 day'
    ) THEN
        INSERT INTO abuse_alerts (user_id, alert_type, severity, message, metric_value, threshold_value)
        VALUES (p_user_id, 'high_bounce_rate', 'warning',
                'Votre taux de bounce est élevé (' || ROUND(v_bounce_rate, 2) || '%). Vérifiez la qualité de vos emails.',
                v_bounce_rate, 5);
    END IF;

    -- Spam rate > 0.1%
    IF v_spam_rate > 0.1 AND NOT EXISTS(
        SELECT 1 FROM abuse_alerts WHERE user_id = p_user_id AND alert_type = 'high_spam_rate' AND created_at > NOW() - INTERVAL '1 day'
    ) THEN
        INSERT INTO abuse_alerts (user_id, alert_type, severity,
                CASE WHEN v_spam_rate > 0.5 THEN 'critical' ELSE 'warning' END,
                message, metric_value, threshold_value)
        VALUES (p_user_id, 'high_spam_rate',
                CASE WHEN v_spam_rate > 0.5 THEN 'critical' ELSE 'warning' END,
                'Votre taux de plaintes spam est trop élevé (' || ROUND(v_spam_rate, 3) || '%). Risque de suspension.',
                v_spam_rate, 0.1);
    END IF;

    -- Suspension auto si bounce > 10% ou spam > 0.5%
    IF (v_bounce_rate > 10 OR v_spam_rate > 0.5) AND NOT v_has_alert THEN
        INSERT INTO abuse_alerts (user_id, alert_type, severity, message, metric_value, threshold_value)
        VALUES (p_user_id, 'auto_suspended', 'suspended',
                'Votre compte a été suspendu automatiquement en raison d''un taux de bounce/spam trop élevé. Contactez le support.',
                GREATEST(v_bounce_rate, v_spam_rate * 100), 10);
        v_has_alert := TRUE;
        v_alert_msg := 'Compte suspendu - taux bounce/spam critique';
    END IF;

    RETURN QUERY SELECT
        NOT v_has_alert AND v_emails_sent_today < v_daily_limit,
        GREATEST(0, v_daily_limit - v_emails_sent_today),
        50, -- Limite horaire fixe pour l'instant
        v_daily_limit,
        v_plan::TEXT,
        COALESCE(v_bounce_rate, 0),
        COALESCE(v_spam_rate, 0),
        v_has_alert,
        v_alert_msg;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. FONCTION INCREMENT USAGE
-- =====================================================

CREATE OR REPLACE FUNCTION increment_daily_usage(p_user_id UUID, p_count INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    v_can_send BOOLEAN;
BEGIN
    -- Vérifier d'abord les limites
    SELECT can_send INTO v_can_send FROM check_sending_limits_v2(p_user_id);

    IF NOT v_can_send THEN
        RETURN FALSE;
    END IF;

    -- Incrémenter le compteur
    UPDATE users
    SET emails_sent_today = COALESCE(emails_sent_today, 0) + p_count
    WHERE id = p_user_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. VUE ALERTES UTILISATEUR
-- =====================================================

CREATE OR REPLACE VIEW user_abuse_alerts AS
SELECT
    aa.*,
    u.email as user_email,
    u.plan
FROM abuse_alerts aa
JOIN users u ON u.id = aa.user_id
WHERE aa.resolved_at IS NULL
ORDER BY
    CASE aa.severity
        WHEN 'suspended' THEN 1
        WHEN 'critical' THEN 2
        ELSE 3
    END,
    aa.created_at DESC;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

ALTER TABLE abuse_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY abuse_alerts_user_read ON abuse_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY abuse_alerts_insert ON abuse_alerts
    FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

ALTER TABLE plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_limits_read ON plan_limits
    FOR SELECT TO authenticated USING (true);
