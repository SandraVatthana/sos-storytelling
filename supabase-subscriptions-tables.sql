-- ============================================
-- SOS Storytelling - Tables Subscriptions (Lemon Squeezy)
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- 1. Ajouter les colonnes de souscription à la table users existante
-- (Si la table users n'existe pas, on la crée)

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'free', -- free, solo, agency_starter, agency_scale, enterprise

  -- Données Lemon Squeezy
  lemon_customer_id VARCHAR(100),
  lemon_subscription_id VARCHAR(100),
  subscription_status VARCHAR(50) DEFAULT 'none', -- none, on_trial, active, paused, past_due, cancelled, expired

  -- Dates importantes
  trial_ends_at TIMESTAMPTZ,
  subscription_renews_at TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,

  -- Métadonnées
  last_login TIMESTAMPTZ,
  contents_generated INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la table existe déjà, ajouter les colonnes manquantes
DO $$
BEGIN
  -- Lemon Squeezy columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lemon_customer_id') THEN
    ALTER TABLE users ADD COLUMN lemon_customer_id VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lemon_subscription_id') THEN
    ALTER TABLE users ADD COLUMN lemon_subscription_id VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_status') THEN
    ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'none';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_renews_at') THEN
    ALTER TABLE users ADD COLUMN subscription_renews_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_ends_at') THEN
    ALTER TABLE users ADD COLUMN subscription_ends_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_payment_at') THEN
    ALTER TABLE users ADD COLUMN last_payment_at TIMESTAMPTZ;
  END IF;

  -- ANTI-ABUS : Colonne pour marquer si le trial a déjà été utilisé
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'trial_used') THEN
    ALTER TABLE users ADD COLUMN trial_used BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Table des événements de souscription (logs)
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- subscription_created, subscription_updated, payment_success, etc.
  email VARCHAR(255),
  lemon_subscription_id VARCHAR(100),
  plan_name VARCHAR(100),
  status VARCHAR(50),
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEX pour performances
-- ============================================

-- Recherche par email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Recherche par customer Lemon Squeezy
CREATE INDEX IF NOT EXISTS idx_users_lemon_customer ON users(lemon_customer_id);

-- Recherche par subscription Lemon Squeezy
CREATE INDEX IF NOT EXISTS idx_users_lemon_subscription ON users(lemon_subscription_id);

-- Recherche par statut de souscription
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Événements par date
CREATE INDEX IF NOT EXISTS idx_subscription_events_date ON subscription_events(created_at DESC);

-- Événements par email
CREATE INDEX IF NOT EXISTS idx_subscription_events_email ON subscription_events(email);

-- ============================================
-- VUES utiles
-- ============================================

-- Vue des utilisateurs avec abonnement actif
CREATE OR REPLACE VIEW active_subscribers AS
SELECT
  id,
  email,
  name,
  plan,
  subscription_status,
  trial_ends_at,
  subscription_renews_at,
  created_at
FROM users
WHERE subscription_status IN ('active', 'on_trial');

-- Vue des utilisateurs en trial
CREATE OR REPLACE VIEW users_on_trial AS
SELECT
  id,
  email,
  name,
  plan,
  trial_ends_at,
  trial_ends_at - NOW() as trial_remaining,
  created_at
FROM users
WHERE subscription_status = 'on_trial'
  AND trial_ends_at > NOW();

-- Vue des utilisateurs dont le trial expire bientôt (3 jours)
CREATE OR REPLACE VIEW trial_expiring_soon AS
SELECT
  id,
  email,
  name,
  plan,
  trial_ends_at,
  EXTRACT(DAY FROM trial_ends_at - NOW()) as days_remaining
FROM users
WHERE subscription_status = 'on_trial'
  AND trial_ends_at > NOW()
  AND trial_ends_at <= NOW() + INTERVAL '3 days';

-- Stats globales des souscriptions
CREATE OR REPLACE VIEW subscription_stats AS
SELECT
  plan,
  subscription_status,
  COUNT(*) as count
FROM users
WHERE plan != 'free' OR subscription_status != 'none'
GROUP BY plan, subscription_status
ORDER BY plan, subscription_status;

-- ============================================
-- FONCTIONS utiles
-- ============================================

-- Fonction pour vérifier si un utilisateur a un abonnement actif
CREATE OR REPLACE FUNCTION is_subscription_active(user_email VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE email = user_email
      AND subscription_status IN ('active', 'on_trial')
      AND (
        subscription_status = 'active'
        OR (subscription_status = 'on_trial' AND trial_ends_at > NOW())
      )
  );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir le plan d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_plan(user_email VARCHAR)
RETURNS TABLE (
  plan VARCHAR,
  status VARCHAR,
  is_active BOOLEAN,
  trial_ends_at TIMESTAMPTZ,
  renews_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.plan,
    u.subscription_status,
    (u.subscription_status IN ('active', 'on_trial') AND
     (u.subscription_status = 'active' OR u.trial_ends_at > NOW())) as is_active,
    u.trial_ends_at,
    u.subscription_renews_at
  FROM users u
  WHERE u.email = user_email;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour incrémenter le compteur de contenus générés
CREATE OR REPLACE FUNCTION increment_user_contents(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET contents_generated = contents_generated + 1,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (optionnel)
-- ============================================

-- Activer RLS sur la table subscription_events
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Supprimer les policies existantes si elles existent, puis les recréer
DROP POLICY IF EXISTS "Service can insert events" ON subscription_events;
DROP POLICY IF EXISTS "Admins can view all events" ON subscription_events;

-- Le worker peut tout insérer (service_role)
CREATE POLICY "Service can insert events" ON subscription_events
  FOR INSERT WITH CHECK (true);

-- Les admins peuvent tout voir
CREATE POLICY "Admins can view all events" ON subscription_events
  FOR SELECT USING (true);

-- ============================================
-- FIN DU SCRIPT
-- ============================================

-- Vérifie que tout est OK:
-- SELECT * FROM users LIMIT 5;
-- SELECT * FROM subscription_events LIMIT 5;
-- SELECT * FROM active_subscribers;
-- SELECT * FROM subscription_stats;
