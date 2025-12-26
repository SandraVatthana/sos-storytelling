-- ============================================
-- SOS STORYTELLING - PROGRAMME AFFILIATION
-- Tables pour le systeme de parrainage Alumni
-- ============================================

-- ==========================================
-- 1. TABLE DES AFFILIEES
-- ==========================================

CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Code unique de parrainage
  referral_code TEXT UNIQUE NOT NULL, -- "MARIE2025", "SOPHIE-SOS"

  -- Stats
  total_referrals INT DEFAULT 0,
  active_referrals INT DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  pending_earnings DECIMAL(10,2) DEFAULT 0,
  paid_earnings DECIMAL(10,2) DEFAULT 0,

  -- Paiement
  paypal_email TEXT,
  iban TEXT,
  bic TEXT,

  -- Seuil minimum de paiement
  payout_threshold DECIMAL(10,2) DEFAULT 50.00,

  -- Statut
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'banned')),

  -- Dates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_affiliates_user ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);

-- ==========================================
-- 2. TABLE DES PARRAINAGES EN ATTENTE
-- ==========================================

-- Stocke temporairement le lien entre une nouvelle inscrite et son code parrain
-- Jusqu'a ce qu'elle souscrive a un abonnement

CREATE TABLE IF NOT EXISTS pending_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE NOT NULL,
  referral_code TEXT NOT NULL,

  -- Tracking
  source TEXT, -- 'link', 'manual', 'email'
  landing_page TEXT, -- URL d'arrivee

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Une seule pending referral par user
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_referrals_user ON pending_referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_referrals_affiliate ON pending_referrals(affiliate_id);

-- ==========================================
-- 3. TABLE DES PARRAINAGES CONFIRMES
-- ==========================================

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE NOT NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Info filleule
  referred_email TEXT,
  referred_name TEXT,

  -- Type de conversion
  conversion_type TEXT NOT NULL CHECK (conversion_type IN ('b2c', 'b2b')),

  -- Montants
  subscription_amount DECIMAL(10,2) NOT NULL, -- 19 ou 2925
  commission_percent INT NOT NULL, -- 20 ou 10
  commission_amount DECIMAL(10,2) NOT NULL, -- 3.80 ou 292.50 par mois

  -- Periode de commission (12 mois)
  commission_start_date DATE NOT NULL,
  commission_end_date DATE NOT NULL,
  commission_months INT DEFAULT 12,

  -- Suivi des paiements
  months_paid INT DEFAULT 0,
  total_paid DECIMAL(10,2) DEFAULT 0,
  next_payment_date DATE,

  -- Statut
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'churned', 'completed', 'cancelled')),
  churned_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Une filleule ne peut etre parrainee qu'une fois
  UNIQUE(referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate ON referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_end_date ON referrals(commission_end_date);

-- ==========================================
-- 4. TABLE DES PAIEMENTS D'AFFILIATION
-- ==========================================

CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE NOT NULL,

  -- Montant
  amount DECIMAL(10,2) NOT NULL,

  -- Periode couverte
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Detail
  referrals_count INT DEFAULT 0,
  breakdown JSONB, -- Detail par referral

  -- Paiement
  payment_method TEXT CHECK (payment_method IN ('paypal', 'bank_transfer')),
  payment_reference TEXT,
  paid_at TIMESTAMPTZ,

  -- Statut
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  failure_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_period ON affiliate_payouts(period_start, period_end);

-- ==========================================
-- 5. TABLE HISTORIQUE DES COMMISSIONS
-- ==========================================

-- Chaque mois, on enregistre les commissions dues

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE CASCADE NOT NULL,
  referral_id UUID REFERENCES referrals(id) ON DELETE CASCADE NOT NULL,
  payout_id UUID REFERENCES affiliate_payouts(id) ON DELETE SET NULL,

  -- Periode
  month DATE NOT NULL, -- Premier jour du mois (2025-01-01)

  -- Montant
  amount DECIMAL(10,2) NOT NULL,

  -- Statut
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'included_in_payout', 'paid', 'cancelled')),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Une commission par referral par mois
  UNIQUE(referral_id, month)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_month ON affiliate_commissions(month);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_status ON affiliate_commissions(status);

-- ==========================================
-- 6. FONCTIONS UTILITAIRES
-- ==========================================

-- Generer un code de parrainage unique
CREATE OR REPLACE FUNCTION generate_referral_code(p_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  -- Nettoyer le nom et ajouter l'annee
  v_code := UPPER(
    REGEXP_REPLACE(
      UNACCENT(SPLIT_PART(p_name, ' ', 1)),
      '[^A-Z0-9]',
      '',
      'g'
    )
  ) || TO_CHAR(NOW(), 'YY');

  -- Verifier si existe deja
  SELECT EXISTS(SELECT 1 FROM affiliates WHERE referral_code = v_code) INTO v_exists;

  -- Si existe, ajouter un suffixe aleatoire
  WHILE v_exists LOOP
    v_code := v_code || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 4));
    SELECT EXISTS(SELECT 1 FROM affiliates WHERE referral_code = v_code) INTO v_exists;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- Incrementer les stats d'une affiliee
CREATE OR REPLACE FUNCTION increment_affiliate_stats(
  p_affiliate_id UUID,
  p_earnings DECIMAL(10,2)
)
RETURNS VOID AS $$
BEGIN
  UPDATE affiliates
  SET
    total_referrals = total_referrals + 1,
    active_referrals = active_referrals + 1,
    pending_earnings = pending_earnings + p_earnings,
    total_earnings = total_earnings + p_earnings,
    updated_at = NOW()
  WHERE id = p_affiliate_id;
END;
$$ LANGUAGE plpgsql;

-- Calculer les commissions mensuelles dues
CREATE OR REPLACE FUNCTION calculate_monthly_commissions(p_month DATE)
RETURNS TABLE(
  affiliate_id UUID,
  total_amount DECIMAL(10,2),
  referrals_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.affiliate_id,
    SUM(r.commission_amount)::DECIMAL(10,2) as total_amount,
    COUNT(*)::INT as referrals_count
  FROM referrals r
  WHERE r.status = 'active'
    AND p_month >= r.commission_start_date
    AND p_month <= r.commission_end_date
  GROUP BY r.affiliate_id;
END;
$$ LANGUAGE plpgsql;

-- Marquer un referral comme churned
CREATE OR REPLACE FUNCTION mark_referral_churned(p_referred_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE referrals
  SET
    status = 'churned',
    churned_at = NOW(),
    updated_at = NOW()
  WHERE referred_user_id = p_referred_user_id
    AND status = 'active';

  -- Mettre a jour les stats de l'affiliee
  UPDATE affiliates a
  SET
    active_referrals = active_referrals - 1,
    updated_at = NOW()
  FROM referrals r
  WHERE r.referred_user_id = p_referred_user_id
    AND r.affiliate_id = a.id;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 7. RLS POLICIES
-- ==========================================

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- Affiliees: voir uniquement son propre compte
CREATE POLICY "Users can view own affiliate" ON affiliates
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own affiliate" ON affiliates
  FOR UPDATE USING (user_id = auth.uid());

-- Referrals: les affiliees voient leurs filleules
CREATE POLICY "Affiliates can view their referrals" ON referrals
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

-- Payouts: les affiliees voient leurs paiements
CREATE POLICY "Affiliates can view their payouts" ON affiliate_payouts
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

-- Commissions: les affiliees voient leurs commissions
CREATE POLICY "Affiliates can view their commissions" ON affiliate_commissions
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

-- Pending referrals: lecture publique pour verification du code
CREATE POLICY "Public can check pending referrals" ON pending_referrals
  FOR SELECT USING (true);

CREATE POLICY "System can insert pending referrals" ON pending_referrals
  FOR INSERT WITH CHECK (true);

-- ==========================================
-- 8. TRIGGER UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION update_affiliate_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_affiliates_updated_at ON affiliates;
CREATE TRIGGER trigger_affiliates_updated_at
  BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();

DROP TRIGGER IF EXISTS trigger_referrals_updated_at ON referrals;
CREATE TRIGGER trigger_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_affiliate_updated_at();
