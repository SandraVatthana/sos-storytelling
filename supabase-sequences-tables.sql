-- ===========================================
-- TABLES SEQUENCES EMAIL
-- SOS Storytelling - Sequences J+0, J+3, J+7
-- ===========================================

-- 1. Ajouter colonnes de programmation a email_campaigns
ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS send_weekdays_only BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS send_hours_start INTEGER DEFAULT 9,
ADD COLUMN IF NOT EXISTS send_hours_end INTEGER DEFAULT 18,
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Paris';

-- 2. Table des emails de sequence (templates)
CREATE TABLE IF NOT EXISTS campaign_sequence_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,

    -- Position dans la sequence
    position INTEGER NOT NULL DEFAULT 1, -- 1, 2, 3...
    delay_days INTEGER NOT NULL DEFAULT 0, -- J+0, J+3, J+7...

    -- Condition d'envoi
    send_condition TEXT DEFAULT 'no_reply' CHECK (send_condition IN ('always', 'no_reply', 'no_open')),

    -- Contenu template
    subject_template TEXT NOT NULL,
    body_template TEXT NOT NULL,

    -- Options
    use_ai_generation BOOLEAN DEFAULT false, -- Generer avec IA pour chaque prospect

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(campaign_id, position)
);

CREATE INDEX IF NOT EXISTS idx_sequence_emails_campaign ON campaign_sequence_emails(campaign_id);

-- 3. Table de suivi prospect dans la sequence
CREATE TABLE IF NOT EXISTS campaign_prospect_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Progression dans la sequence
    current_step INTEGER DEFAULT 0, -- 0 = pas encore envoye, 1 = email 1 envoye, etc.

    -- Statut global
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- En attente du premier envoi
        'in_sequence',  -- Dans la sequence, en attente du prochain email
        'replied',      -- A repondu, sequence stoppee
        'completed',    -- Sequence terminee (tous emails envoyes)
        'stopped',      -- Arrete manuellement
        'bounced',      -- Email invalide
        'unsubscribed'  -- Desabonne
    )),

    -- Prochain envoi prevu
    next_email_at TIMESTAMP,

    -- Historique des envois (JSON array)
    emails_history JSONB DEFAULT '[]',
    -- Format: [{"step": 1, "sent_at": "...", "opened_at": "...", "clicked_at": "...", "message_id": "..."}]

    -- Tracking agrege
    total_sent INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    has_replied BOOLEAN DEFAULT false,

    -- Dates
    first_sent_at TIMESTAMP,
    last_sent_at TIMESTAMP,
    replied_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(campaign_id, prospect_id)
);

CREATE INDEX IF NOT EXISTS idx_prospect_status_campaign ON campaign_prospect_status(campaign_id);
CREATE INDEX IF NOT EXISTS idx_prospect_status_prospect ON campaign_prospect_status(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_status_status ON campaign_prospect_status(status);
CREATE INDEX IF NOT EXISTS idx_prospect_status_next_email ON campaign_prospect_status(next_email_at);

-- 4. Table des emails individuels envoyes (tracking detaille)
-- Modifie la table existante campaign_emails pour supporter les sequences
ALTER TABLE campaign_emails
ADD COLUMN IF NOT EXISTS sequence_step INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS sequence_email_id UUID REFERENCES campaign_sequence_emails(id),
ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- 5. Table des limites d'envoi par utilisateur
CREATE TABLE IF NOT EXISTS user_sending_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Limites quotidiennes
    daily_limit INTEGER DEFAULT 200,
    daily_sent INTEGER DEFAULT 0,
    daily_reset_at DATE DEFAULT CURRENT_DATE,

    -- Limites horaires
    hourly_limit INTEGER DEFAULT 50,
    hourly_sent INTEGER DEFAULT 0,
    hourly_reset_at TIMESTAMP DEFAULT NOW(),

    -- Delai minimum entre envois (secondes)
    min_delay_seconds INTEGER DEFAULT 30,
    last_sent_at TIMESTAMP,

    -- Stats globales
    total_sent INTEGER DEFAULT 0,
    total_bounced INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sending_limits_user ON user_sending_limits(user_id);

-- 6. Table des desabonnements (blacklist)
CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    reason TEXT, -- 'manual', 'link_clicked', 'spam_complaint'
    unsubscribed_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_unsubscribes_user ON email_unsubscribes(user_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribes_email ON email_unsubscribes(email);

-- 7. RLS Policies pour les nouvelles tables

ALTER TABLE campaign_sequence_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_prospect_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sending_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;

-- Sequence emails: via campaign ownership
CREATE POLICY "Users can manage sequence emails via campaign" ON campaign_sequence_emails
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM email_campaigns
            WHERE email_campaigns.id = campaign_sequence_emails.campaign_id
            AND email_campaigns.user_id = auth.uid()
        )
    );

-- Prospect status
CREATE POLICY "Users can view own prospect status" ON campaign_prospect_status
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prospect status" ON campaign_prospect_status
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prospect status" ON campaign_prospect_status
    FOR UPDATE USING (auth.uid() = user_id);

-- Sending limits
CREATE POLICY "Users can view own sending limits" ON user_sending_limits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own sending limits" ON user_sending_limits
    FOR ALL USING (auth.uid() = user_id);

-- Unsubscribes
CREATE POLICY "Users can view own unsubscribes" ON email_unsubscribes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own unsubscribes" ON email_unsubscribes
    FOR ALL USING (auth.uid() = user_id);

-- 8. Fonctions utilitaires

-- Fonction pour verifier les limites d'envoi
CREATE OR REPLACE FUNCTION check_sending_limits(p_user_id UUID)
RETURNS TABLE(can_send BOOLEAN, reason TEXT, daily_remaining INTEGER, hourly_remaining INTEGER) AS $$
DECLARE
    v_limits user_sending_limits%ROWTYPE;
BEGIN
    -- Recuperer ou creer les limites
    SELECT * INTO v_limits FROM user_sending_limits WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        INSERT INTO user_sending_limits (user_id) VALUES (p_user_id)
        RETURNING * INTO v_limits;
    END IF;

    -- Reset quotidien si necessaire
    IF v_limits.daily_reset_at < CURRENT_DATE THEN
        UPDATE user_sending_limits
        SET daily_sent = 0, daily_reset_at = CURRENT_DATE
        WHERE user_id = p_user_id;
        v_limits.daily_sent := 0;
    END IF;

    -- Reset horaire si necessaire
    IF v_limits.hourly_reset_at < NOW() - INTERVAL '1 hour' THEN
        UPDATE user_sending_limits
        SET hourly_sent = 0, hourly_reset_at = NOW()
        WHERE user_id = p_user_id;
        v_limits.hourly_sent := 0;
    END IF;

    -- Verifier les limites
    IF v_limits.daily_sent >= v_limits.daily_limit THEN
        RETURN QUERY SELECT false, 'daily_limit_reached'::TEXT, 0, (v_limits.hourly_limit - v_limits.hourly_sent);
        RETURN;
    END IF;

    IF v_limits.hourly_sent >= v_limits.hourly_limit THEN
        RETURN QUERY SELECT false, 'hourly_limit_reached'::TEXT, (v_limits.daily_limit - v_limits.daily_sent), 0;
        RETURN;
    END IF;

    -- Verifier delai minimum
    IF v_limits.last_sent_at IS NOT NULL AND
       v_limits.last_sent_at > NOW() - (v_limits.min_delay_seconds || ' seconds')::INTERVAL THEN
        RETURN QUERY SELECT false, 'too_fast'::TEXT, (v_limits.daily_limit - v_limits.daily_sent), (v_limits.hourly_limit - v_limits.hourly_sent);
        RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::TEXT, (v_limits.daily_limit - v_limits.daily_sent), (v_limits.hourly_limit - v_limits.hourly_sent);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour incrementer les compteurs apres envoi
CREATE OR REPLACE FUNCTION increment_send_counters(p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE user_sending_limits
    SET
        daily_sent = daily_sent + 1,
        hourly_sent = hourly_sent + 1,
        total_sent = total_sent + 1,
        last_sent_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Creer si n'existe pas
    IF NOT FOUND THEN
        INSERT INTO user_sending_limits (user_id, daily_sent, hourly_sent, total_sent, last_sent_at)
        VALUES (p_user_id, 1, 1, 1, NOW());
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les prospects a contacter (prochain email de sequence)
CREATE OR REPLACE FUNCTION get_pending_sequence_emails(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
    prospect_status_id UUID,
    campaign_id UUID,
    prospect_id UUID,
    user_id UUID,
    current_step INTEGER,
    next_step INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cps.id as prospect_status_id,
        cps.campaign_id,
        cps.prospect_id,
        cps.user_id,
        cps.current_step,
        cps.current_step + 1 as next_step
    FROM campaign_prospect_status cps
    JOIN email_campaigns ec ON ec.id = cps.campaign_id
    WHERE
        cps.status IN ('pending', 'in_sequence')
        AND cps.next_email_at <= NOW()
        AND ec.status = 'sending'
        -- Verifier contraintes horaires
        AND (
            ec.send_weekdays_only = false
            OR EXTRACT(DOW FROM NOW() AT TIME ZONE COALESCE(ec.timezone, 'Europe/Paris')) BETWEEN 1 AND 5
        )
        AND (
            EXTRACT(HOUR FROM NOW() AT TIME ZONE COALESCE(ec.timezone, 'Europe/Paris'))
            BETWEEN ec.send_hours_start AND ec.send_hours_end - 1
        )
    ORDER BY cps.next_email_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour verifier si un email est blackliste
CREATE OR REPLACE FUNCTION is_email_blacklisted(p_user_id UUID, p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM email_unsubscribes
        WHERE user_id = p_user_id AND LOWER(email) = LOWER(p_email)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger pour mettre a jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sequence_emails_updated_at
    BEFORE UPDATE ON campaign_sequence_emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_prospect_status_updated_at
    BEFORE UPDATE ON campaign_prospect_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sending_limits_updated_at
    BEFORE UPDATE ON user_sending_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
