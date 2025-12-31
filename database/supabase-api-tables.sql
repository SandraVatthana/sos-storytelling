-- ============================================
-- SOS Storytelling - Tables API Enterprise
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- 1. Table des clés API
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key_prefix VARCHAR(12) NOT NULL, -- "sk_live_" ou "sk_test_" + 4 chars visibles
  key_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA256 de la clé complète
  name VARCHAR(100) DEFAULT 'Ma clé API', -- "Production", "Test", etc.
  permissions JSONB DEFAULT '{"generate": true, "voices": true, "usage": true}',
  rate_limit_monthly INT DEFAULT 1000, -- requêtes/mois
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table d'usage API (logs de toutes les requêtes)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(50) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INT,
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  latency_ms INT,
  request_metadata JSONB DEFAULT '{}', -- structure, platform, etc.
  error_message TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Table des profils de voix (si pas déjà existante)
CREATE TABLE IF NOT EXISTS voice_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL DEFAULT 'Mon profil de voix',
  profile_data JSONB NOT NULL DEFAULT '{}',
  -- profile_data contient: ton, longueurPhrases, expressions, ponctuation, styleNarratif, vocabulaire, signature, conseils
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEX pour performances
-- ============================================

-- Recherche rapide par hash de clé
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Recherche par user_id
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- Stats d'usage par clé et date
CREATE INDEX IF NOT EXISTS idx_api_usage_key_date ON api_usage(api_key_id, created_at DESC);

-- Recherche par endpoint pour analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint, created_at DESC);

-- Profils de voix par user
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user ON voice_profiles(user_id);

-- ============================================
-- VUES pour analytics
-- ============================================

-- Vue de l'usage mensuel par clé
CREATE OR REPLACE VIEW api_usage_monthly AS
SELECT
  api_key_id,
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE status_code >= 200 AND status_code < 300) as successful_requests,
  COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
  SUM(tokens_input) as total_tokens_input,
  SUM(tokens_output) as total_tokens_output,
  SUM(tokens_input + tokens_output) as total_tokens,
  AVG(latency_ms)::INT as avg_latency_ms
FROM api_usage
GROUP BY api_key_id, DATE_TRUNC('month', created_at);

-- Vue de l'usage quotidien (pour graphiques)
CREATE OR REPLACE VIEW api_usage_daily AS
SELECT
  api_key_id,
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as requests,
  SUM(tokens_input + tokens_output) as tokens
FROM api_usage
GROUP BY api_key_id, DATE_TRUNC('day', created_at);

-- Vue des clés avec leur usage du mois en cours
CREATE OR REPLACE VIEW api_keys_with_usage AS
SELECT
  k.*,
  COALESCE(u.requests_this_month, 0) as requests_this_month,
  COALESCE(u.tokens_this_month, 0) as tokens_this_month
FROM api_keys k
LEFT JOIN (
  SELECT
    api_key_id,
    COUNT(*) as requests_this_month,
    SUM(tokens_input + tokens_output) as tokens_this_month
  FROM api_usage
  WHERE created_at >= DATE_TRUNC('month', NOW())
  GROUP BY api_key_id
) u ON k.id = u.api_key_id;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Activer RLS sur les tables
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;

-- Policies pour api_keys: un user ne voit que ses propres clés
CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys" ON api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Policies pour api_usage: un user ne voit que l'usage de ses clés
CREATE POLICY "Users can view own API usage" ON api_usage
  FOR SELECT USING (
    api_key_id IN (SELECT id FROM api_keys WHERE user_id = auth.uid())
  );

-- Note: l'INSERT dans api_usage se fait via le service_role (worker)
CREATE POLICY "Service role can insert usage" ON api_usage
  FOR INSERT WITH CHECK (true);

-- Policies pour voice_profiles
CREATE POLICY "Users can view own voice profiles" ON voice_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own voice profiles" ON voice_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own voice profiles" ON voice_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own voice profiles" ON voice_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- FONCTIONS utilitaires
-- ============================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_voice_profiles_updated_at
  BEFORE UPDATE ON voice_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour obtenir l'usage du mois courant d'une clé
CREATE OR REPLACE FUNCTION get_api_key_monthly_usage(key_id UUID)
RETURNS TABLE (
  requests BIGINT,
  tokens_input BIGINT,
  tokens_output BIGINT,
  total_tokens BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as requests,
    COALESCE(SUM(u.tokens_input), 0)::BIGINT as tokens_input,
    COALESCE(SUM(u.tokens_output), 0)::BIGINT as tokens_output,
    COALESCE(SUM(u.tokens_input + u.tokens_output), 0)::BIGINT as total_tokens
  FROM api_usage u
  WHERE u.api_key_id = key_id
    AND u.created_at >= DATE_TRUNC('month', NOW());
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DONNÉES DE TEST (optionnel, à commenter en prod)
-- ============================================

-- Pour tester, tu peux créer une clé manuellement:
-- INSERT INTO api_keys (user_id, key_prefix, key_hash, name, rate_limit_monthly)
-- VALUES (
--   'ton-user-id-uuid',
--   'sk_live_xxxx',
--   'hash-sha256-de-la-cle-complete',
--   'Test Production',
--   1000
-- );

-- ============================================
-- FIN DU SCRIPT
-- ============================================

-- Vérifie que tout est OK:
-- SELECT * FROM api_keys LIMIT 1;
-- SELECT * FROM api_usage LIMIT 1;
-- SELECT * FROM voice_profiles LIMIT 1;
