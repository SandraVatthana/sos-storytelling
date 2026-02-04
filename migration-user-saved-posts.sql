-- =====================================================
-- MIGRATION : Ajout de la table user_saved_posts
-- =====================================================
-- Cette migration ajoute la synchronisation des posts
-- sauvegardés ("Mes Posts") entre tous les appareils.
--
-- INSTRUCTIONS :
-- 1. Connecte-toi à ton dashboard Supabase
-- 2. Va dans SQL Editor
-- 3. Copie-colle ce script et exécute-le
-- 4. Vérifie que la table est créée dans Table Editor
-- =====================================================

-- Table pour les posts sauvegardés (Mes Posts)
CREATE TABLE IF NOT EXISTS user_saved_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Contenu du post
    platform TEXT DEFAULT 'instagram', -- instagram, linkedin, twitter, facebook, tiktok
    caption TEXT,
    hashtags TEXT,
    visual_texts TEXT, -- Textes pour les visuels (carousel)

    -- État
    done BOOLEAN DEFAULT false, -- true = post publié

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_user_saved_posts_user_id ON user_saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_posts_created_at ON user_saved_posts(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE user_saved_posts ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité : chaque utilisateur ne voit que ses propres posts
DO $$
BEGIN
    -- View policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own saved posts' AND tablename = 'user_saved_posts') THEN
        CREATE POLICY "Users can view own saved posts"
            ON user_saved_posts FOR SELECT
            USING (auth.uid() = user_id);
    END IF;

    -- Insert policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own saved posts' AND tablename = 'user_saved_posts') THEN
        CREATE POLICY "Users can insert own saved posts"
            ON user_saved_posts FOR INSERT
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Update policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own saved posts' AND tablename = 'user_saved_posts') THEN
        CREATE POLICY "Users can update own saved posts"
            ON user_saved_posts FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;

    -- Delete policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own saved posts' AND tablename = 'user_saved_posts') THEN
        CREATE POLICY "Users can delete own saved posts"
            ON user_saved_posts FOR DELETE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- =====================================================
-- Vérification
-- =====================================================
-- Après exécution, tu devrais voir la table user_saved_posts
-- dans le Table Editor de Supabase avec les colonnes :
-- - id (UUID)
-- - user_id (UUID)
-- - platform (TEXT)
-- - caption (TEXT)
-- - hashtags (TEXT)
-- - visual_texts (TEXT)
-- - done (BOOLEAN)
-- - created_at (TIMESTAMPTZ)
-- - updated_at (TIMESTAMPTZ)
-- =====================================================
