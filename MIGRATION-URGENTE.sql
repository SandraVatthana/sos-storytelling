-- =====================================================
-- MIGRATION URGENTE - Synchronisation des donnees utilisateur
-- =====================================================
-- Ce script cree les tables necessaires pour que les donnees
-- (profil, style, posts sauvegardes) soient synchronisees
-- entre tous les appareils de vos utilisateurs.
--
-- INSTRUCTIONS :
-- 1. Connectez-vous a https://supabase.com/dashboard
-- 2. Selectionnez votre projet SOS Storytelling
-- 3. Allez dans SQL Editor (menu de gauche)
-- 4. Copiez-collez TOUT ce script et executez-le
-- =====================================================


-- ============================================
-- TABLE 1 : user_profiles (profil + style)
-- Stocke toutes les donnees d'onboarding et Mon Style
-- ============================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  profile_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

-- Trigger pour mettre a jour updated_at automatiquement
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
-- TABLE 2 : user_saved_posts (Mes Posts)
-- Stocke les posts sauvegardes par l'utilisateur
-- ============================================

CREATE TABLE IF NOT EXISTS user_saved_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT DEFAULT 'instagram',
    caption TEXT,
    hashtags TEXT,
    visual_texts TEXT,
    done BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_posts_user_id ON user_saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_posts_created_at ON user_saved_posts(created_at DESC);

ALTER TABLE user_saved_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved posts" ON user_saved_posts;
CREATE POLICY "Users can view own saved posts" ON user_saved_posts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved posts" ON user_saved_posts;
CREATE POLICY "Users can insert own saved posts" ON user_saved_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own saved posts" ON user_saved_posts;
CREATE POLICY "Users can update own saved posts" ON user_saved_posts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved posts" ON user_saved_posts;
CREATE POLICY "Users can delete own saved posts" ON user_saved_posts
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'Tables creees avec succes!' as status,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_profiles') as user_profiles_exists,
       (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_saved_posts') as user_saved_posts_exists;
