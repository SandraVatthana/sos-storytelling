-- ============================================
-- TABLE : audience_personas
-- SOS Storytelling - Personas d'audience
-- ============================================

-- Supprimer la table si elle existe (pour dev)
-- DROP TABLE IF EXISTS audience_personas;

-- Creer la table audience_personas
CREATE TABLE IF NOT EXISTS audience_personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identite du persona
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '🎯',

  -- Description detaillee
  description TEXT,

  -- Caracteristiques demographiques
  age_range TEXT DEFAULT '',
  location TEXT DEFAULT '',

  -- Douleurs et desirs (pour le copywriting)
  pain_points TEXT[] DEFAULT '{}',
  desires TEXT[] DEFAULT '{}',

  -- Langage et ton
  vocabulary TEXT[] DEFAULT '{}',
  tone_preferences TEXT DEFAULT '',

  -- Contexte digital
  primary_platform TEXT DEFAULT 'linkedin',
  content_preferences TEXT[] DEFAULT '{}',

  -- Metadonnees
  is_default BOOLEAN DEFAULT false,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEX pour performances
-- ============================================

CREATE INDEX IF NOT EXISTS idx_personas_user ON audience_personas(user_id);
CREATE INDEX IF NOT EXISTS idx_personas_default ON audience_personas(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_personas_updated ON audience_personas(updated_at DESC);

-- ============================================
-- TRIGGER pour updated_at automatique
-- ============================================

CREATE OR REPLACE FUNCTION update_personas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_personas_updated_at ON audience_personas;
CREATE TRIGGER trigger_personas_updated_at
  BEFORE UPDATE ON audience_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_personas_updated_at();

-- ============================================
-- FUNCTION pour garantir un seul is_default par user
-- ============================================

CREATE OR REPLACE FUNCTION ensure_single_default_persona()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE audience_personas
    SET is_default = false
    WHERE user_id = NEW.user_id
    AND id != NEW.id
    AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_default_persona ON audience_personas;
CREATE TRIGGER trigger_single_default_persona
  BEFORE INSERT OR UPDATE ON audience_personas
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_persona();

-- ============================================
-- RLS (Row Level Security) POLICIES
-- ============================================

-- Activer RLS sur la table
ALTER TABLE audience_personas ENABLE ROW LEVEL SECURITY;

-- Policy SELECT : users peuvent voir leurs propres personas
DROP POLICY IF EXISTS "Users can view own personas" ON audience_personas;
CREATE POLICY "Users can view own personas" ON audience_personas
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy INSERT : users peuvent creer leurs propres personas
DROP POLICY IF EXISTS "Users can create own personas" ON audience_personas;
CREATE POLICY "Users can create own personas" ON audience_personas
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy UPDATE : users peuvent modifier leurs propres personas
DROP POLICY IF EXISTS "Users can update own personas" ON audience_personas;
CREATE POLICY "Users can update own personas" ON audience_personas
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy DELETE : users peuvent supprimer leurs propres personas
DROP POLICY IF EXISTS "Users can delete own personas" ON audience_personas;
CREATE POLICY "Users can delete own personas" ON audience_personas
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- FUNCTION pour incrementer usage_count
-- ============================================

CREATE OR REPLACE FUNCTION increment_persona_usage(persona_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE audience_personas
  SET usage_count = usage_count + 1
  WHERE id = persona_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VUE pour personas avec infos utilisateur
-- ============================================

CREATE OR REPLACE VIEW v_user_personas AS
SELECT
  p.*,
  u.email as user_email
FROM audience_personas p
LEFT JOIN auth.users u ON p.user_id = u.id
ORDER BY p.is_default DESC, p.usage_count DESC, p.updated_at DESC;

-- ============================================
-- DONNEES DE TEST (optionnel - commenter si pas besoin)
-- ============================================

-- INSERT INTO audience_personas (user_id, name, emoji, description, age_range, location, pain_points, desires, vocabulary, tone_preferences, primary_platform, content_preferences, is_default)
-- VALUES
-- (
--   'VOTRE_USER_ID_ICI',
--   'Artistes independants',
--   '🎨',
--   'Artistes visuels (peintres, illustrateurs, photographes) qui veulent vivre de leur art',
--   '30-45 ans',
--   'France',
--   ARRAY['Pas assez de visibilite', 'Difficulte a fixer leurs prix', 'Se sentent illegitimes a se vendre'],
--   ARRAY['Vivre de leur art', 'Etre reconnus pour leur travail', 'Trouver des clients sans prospecter'],
--   ARRAY['creation', 'oeuvre', 'processus creatif', 'galerie', 'exposition'],
--   'Inspirant mais pas pompeux. Eviter le jargon marketing. Parler de partager plutot que vendre.',
--   'instagram',
--   ARRAY['behind the scenes', 'processus creatif', 'conseils pratiques'],
--   true
-- );

-- ============================================
-- VERIFICATION
-- ============================================

-- Verifier que la table existe
SELECT 'Table audience_personas creee avec succes!' as status;

-- Afficher la structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'audience_personas'
ORDER BY ordinal_position;
