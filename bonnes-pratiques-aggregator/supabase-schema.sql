-- ========================================
-- SCHEMA SUPABASE - Bonnes Pratiques
-- À exécuter dans le SQL Editor de Supabase
-- ========================================

-- ----------------------------------------
-- TABLE 1 : newsletter_raw
-- Stocke les newsletters brutes capturées
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS newsletter_raw (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  url TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'raw' CHECK (status IN ('raw', 'processing', 'processed', 'error')),
  extracted_rules JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la table newsletter_raw
CREATE INDEX IF NOT EXISTS idx_newsletter_source ON newsletter_raw(source);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_raw(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_captured ON newsletter_raw(captured_at DESC);

COMMENT ON TABLE newsletter_raw IS 'Newsletters capturées par l''extension Chrome';

-- ----------------------------------------
-- TABLE 2 : bonnes_pratiques
-- Stocke les règles extraites et agrégées
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS bonnes_pratiques (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- La règle elle-même
  rule TEXT NOT NULL,
  rule_hash TEXT UNIQUE, -- Pour détecter les doublons
  
  -- Catégorisation
  category TEXT NOT NULL CHECK (category IN (
    'algorithme',
    'format',
    'timing',
    'engagement',
    'erreurs',
    'copywriting',
    'strategie'
  )),
  
  -- Plateformes concernées
  platforms TEXT[] DEFAULT '{}' CHECK (
    platforms <@ ARRAY['linkedin', 'instagram', 'tiktok', 'twitter', 'facebook', 'youtube', 'general']
  ),
  
  -- Niveau de certitude
  confidence TEXT DEFAULT 'tendance' CHECK (confidence IN (
    'consensus',    -- Plusieurs sources concordantes
    'tendance',     -- Une ou deux sources fiables
    'a_tester'      -- Nouveau, pas encore validé
  )),
  
  -- Traçabilité des sources (IMPORTANT pour légalité)
  sources JSONB DEFAULT '[]',
  -- Format: [{"source": "Nina Ramen", "date": "2024-12-10", "excerpt": "verbatim court"}]
  
  -- Métadonnées
  last_verified TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0, -- Combien de fois affichée dans SOS
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la table bonnes_pratiques
CREATE INDEX IF NOT EXISTS idx_bp_category ON bonnes_pratiques(category);
CREATE INDEX IF NOT EXISTS idx_bp_platforms ON bonnes_pratiques USING GIN(platforms);
CREATE INDEX IF NOT EXISTS idx_bp_confidence ON bonnes_pratiques(confidence);
CREATE INDEX IF NOT EXISTS idx_bp_active ON bonnes_pratiques(is_active) WHERE is_active = true;

COMMENT ON TABLE bonnes_pratiques IS 'Règles extraites et agrégées des newsletters';

-- ----------------------------------------
-- FONCTION : Mise à jour automatique de updated_at
-- ----------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bonnes_pratiques_updated_at
  BEFORE UPDATE ON bonnes_pratiques
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------
-- FONCTION : Générer un hash de la règle (pour dédoublonnage)
-- ----------------------------------------
CREATE OR REPLACE FUNCTION generate_rule_hash(rule_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Normalise le texte : minuscules, sans accents basiques, sans ponctuation
  RETURN MD5(
    LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(rule_text, '[^a-zA-Z0-9àâäéèêëïîôùûüç\s]', '', 'g'),
        '\s+', ' ', 'g'
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------
-- VUE : Bonnes pratiques actives par catégorie
-- ----------------------------------------
CREATE OR REPLACE VIEW v_bonnes_pratiques_actives AS
SELECT 
  id,
  rule,
  category,
  platforms,
  confidence,
  sources,
  last_verified,
  CASE 
    WHEN last_verified > NOW() - INTERVAL '30 days' THEN 'recent'
    WHEN last_verified > NOW() - INTERVAL '90 days' THEN 'valide'
    ELSE 'a_reverifier'
  END AS freshness
FROM bonnes_pratiques
WHERE is_active = true
ORDER BY 
  CASE confidence 
    WHEN 'consensus' THEN 1 
    WHEN 'tendance' THEN 2 
    ELSE 3 
  END,
  last_verified DESC;

-- ----------------------------------------
-- EXEMPLES DE DONNÉES (optionnel, pour tester)
-- ----------------------------------------
/*
INSERT INTO bonnes_pratiques (rule, category, platforms, confidence, sources) VALUES
(
  'Ne pas modifier un post LinkedIn dans les 2 heures après publication, cela reset l''algorithme',
  'algorithme',
  ARRAY['linkedin'],
  'consensus',
  '[{"source": "Nina Ramen", "date": "2024-12-01", "excerpt": "modifier un post = reset algo"}]'
),
(
  'Répondre aux commentaires dans la première heure booste significativement la portée',
  'engagement',
  ARRAY['linkedin', 'instagram'],
  'consensus',
  '[{"source": "Caroline Mignaux", "date": "2024-12-05", "excerpt": "1ère heure cruciale"}]'
),
(
  'Les carrousels LinkedIn performent mieux avec 8-12 slides',
  'format',
  ARRAY['linkedin'],
  'tendance',
  '[{"source": "Laurine Bemer", "date": "2024-12-10", "excerpt": "8-12 slides optimal"}]'
);
*/
