-- ============================================
-- SOS Storytelling - Tables Profils & Personas
-- A executer dans Supabase SQL Editor
-- ============================================

-- ============================================
-- TABLE 1 : user_profiles (profil onboarding)
-- ============================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  profile_data JSONB NOT NULL DEFAULT '{}',
  -- profile_data contient: prenom, activite, cible, objectifs, piliers, reseaux, frequence, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par user
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own profile" ON user_profiles;
CREATE POLICY "Users can delete own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TABLE 2 : audience_personas
-- ============================================

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

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_personas_user ON audience_personas(user_id);
CREATE INDEX IF NOT EXISTS idx_personas_default ON audience_personas(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_personas_updated ON audience_personas(updated_at DESC);

-- Trigger pour updated_at automatique
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

-- Function pour garantir un seul is_default par user
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

-- RLS (Row Level Security)
ALTER TABLE audience_personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own personas" ON audience_personas;
CREATE POLICY "Users can view own personas" ON audience_personas
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own personas" ON audience_personas;
CREATE POLICY "Users can create own personas" ON audience_personas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own personas" ON audience_personas;
CREATE POLICY "Users can update own personas" ON audience_personas
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own personas" ON audience_personas;
CREATE POLICY "Users can delete own personas" ON audience_personas
  FOR DELETE USING (auth.uid() = user_id);

-- Function pour incrementer usage_count
CREATE OR REPLACE FUNCTION increment_persona_usage(persona_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE audience_personas
  SET usage_count = usage_count + 1
  WHERE id = persona_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Tables user_profiles et audience_personas creees avec succes!' as status;
