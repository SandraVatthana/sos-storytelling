-- =====================================================
-- TABLES SUPABASE POUR SOS STORYTELLING VERSION SIMPLE
-- =====================================================
-- Exécuter ces requêtes dans Supabase SQL Editor

-- 1. Table pour stocker le profil simplifié et le ton cloné
CREATE TABLE IF NOT EXISTS user_tone_clone (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Nom de l'utilisatrice
    user_name TEXT,

    -- Textes sources fournis pour le clonage de ton
    source_texts TEXT[], -- Les 3-5 textes collés

    -- Ton analysé par l'IA (résultat de l'analyse)
    tone_analysis JSONB, -- {style, expressions_typiques, structure_preferee, a_eviter, signature}

    -- Audience par défaut
    default_audience TEXT DEFAULT 'entrepreneures', -- entrepreneures, coachs, creatrices, prestataires
    audience_pain_point TEXT,

    -- Préférence de contenu principal
    primary_content_type TEXT DEFAULT 'posts', -- posts, newsletter, mails

    -- État de l'onboarding
    onboarding_completed BOOLEAN DEFAULT false,

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_user_tone_clone_user_id ON user_tone_clone(user_id);

-- RLS (Row Level Security)
ALTER TABLE user_tone_clone ENABLE ROW LEVEL SECURITY;

-- Politique : les utilisateurs ne voient que leur propre profil
CREATE POLICY "Users can view own tone profile"
    ON user_tone_clone FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tone profile"
    ON user_tone_clone FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tone profile"
    ON user_tone_clone FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tone profile"
    ON user_tone_clone FOR DELETE
    USING (auth.uid() = user_id);


-- 2. Table pour l'historique des contenus générés
CREATE TABLE IF NOT EXISTS generated_contents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Type de contenu
    content_type TEXT NOT NULL, -- post, newsletter, mail
    platform TEXT, -- linkedin, instagram (pour les posts)

    -- Sujet et contenu
    topic TEXT,
    content TEXT,

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_generated_contents_user_id ON generated_contents(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_contents_created_at ON generated_contents(created_at DESC);

-- RLS
ALTER TABLE generated_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generated contents"
    ON generated_contents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generated contents"
    ON generated_contents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own generated contents"
    ON generated_contents FOR DELETE
    USING (auth.uid() = user_id);


-- 3. Table pour les posts sauvegardés (Mes Posts)
-- IMPORTANT : Cette table permet la synchronisation entre appareils
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

-- RLS
ALTER TABLE user_saved_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved posts"
    ON user_saved_posts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved posts"
    ON user_saved_posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved posts"
    ON user_saved_posts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved posts"
    ON user_saved_posts FOR DELETE
    USING (auth.uid() = user_id);


-- =====================================================
-- NOTES D'INSTALLATION
-- =====================================================
--
-- 1. Connecte-toi à ton dashboard Supabase
-- 2. Va dans SQL Editor
-- 3. Copie-colle ce script et exécute-le
-- 4. Vérifie que les tables sont créées dans Table Editor
--
-- La table user_tone_clone stocke :
-- - Le prénom de l'utilisatrice
-- - Ses textes exemples pour le clonage de ton
-- - L'analyse du ton faite par l'IA
-- - Son audience par défaut
-- - Son type de contenu préféré
--
-- La table generated_contents stocke :
-- - Tous les contenus générés
-- - Permet d'afficher l'historique récent
--
-- La table user_saved_posts stocke :
-- - Les posts sauvegardés par l'utilisateur ("Mes Posts")
-- - Synchronisés entre tous les appareils
-- - État de publication (done)
-- =====================================================
