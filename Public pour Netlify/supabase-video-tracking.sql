-- =====================================================
-- VIDEO TRACKING SYSTEM
-- Suivi des vues vidéo avec notifications
-- =====================================================
--
-- INSTRUCTIONS :
-- 1. Connecte-toi à https://supabase.com/dashboard
-- 2. Sélectionne ton projet SOS Storytelling
-- 3. Va dans SQL Editor
-- 4. Copie-colle ce script et exécute-le
-- =====================================================


-- ============================================
-- TABLE 1 : video_links (liens trackables)
-- Stocke les vidéos et leurs liens uniques
-- ============================================

CREATE TABLE IF NOT EXISTS video_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Infos vidéo
    title TEXT NOT NULL,
    video_url TEXT NOT NULL,  -- URL de la vidéo (YouTube, Vimeo, fichier direct, etc.)
    thumbnail_url TEXT,       -- Miniature optionnelle

    -- Paramètres
    notify_threshold INTEGER DEFAULT 50,  -- % à partir duquel notifier (défaut 50%)

    -- Stats agrégées
    total_views INTEGER DEFAULT 0,
    unique_views INTEGER DEFAULT 0,

    -- Métadonnées
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_links_user ON video_links(user_id);

-- RLS
ALTER TABLE video_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own video links" ON video_links;
CREATE POLICY "Users can manage own video links" ON video_links
    FOR ALL USING (auth.uid() = user_id);


-- ============================================
-- TABLE 2 : video_views (tracking des vues)
-- Enregistre chaque vue avec le % visionné
-- ============================================

CREATE TABLE IF NOT EXISTS video_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Liens
    video_id UUID REFERENCES video_links(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES hub_prospects(id) ON DELETE SET NULL,  -- Lien optionnel au prospect

    -- Identification du viewer
    lead_id TEXT NOT NULL,           -- Identifiant unique du lien (UTM)
    viewer_email TEXT,               -- Email si connu
    viewer_name TEXT,                -- Nom si connu

    -- Données de tracking
    percent_watched INTEGER DEFAULT 0,   -- % de la vidéo vue (0-100)
    watch_duration INTEGER DEFAULT 0,    -- Durée visionnée en secondes
    total_duration INTEGER,              -- Durée totale de la vidéo

    -- Contexte
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    country TEXT,
    city TEXT,

    -- Notifications
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,

    -- Timestamps
    first_view_at TIMESTAMPTZ DEFAULT NOW(),
    last_view_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_views_video ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_lead ON video_views(lead_id);
CREATE INDEX IF NOT EXISTS idx_video_views_prospect ON video_views(prospect_id);
CREATE INDEX IF NOT EXISTS idx_video_views_percent ON video_views(percent_watched DESC);

-- RLS - Les vues sont accessibles par le propriétaire de la vidéo
ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tracking for own videos" ON video_views;
CREATE POLICY "Users can view tracking for own videos" ON video_views
    FOR SELECT USING (
        video_id IN (SELECT id FROM video_links WHERE user_id = auth.uid())
    );

-- Permettre l'insertion publique (pour le tracking)
DROP POLICY IF EXISTS "Allow public insert for tracking" ON video_views;
CREATE POLICY "Allow public insert for tracking" ON video_views
    FOR INSERT WITH CHECK (true);

-- Permettre la mise à jour publique (pour le tracking)
DROP POLICY IF EXISTS "Allow public update for tracking" ON video_views;
CREATE POLICY "Allow public update for tracking" ON video_views
    FOR UPDATE USING (true);


-- ============================================
-- TABLE 3 : video_notifications (historique)
-- Log des notifications envoyées
-- ============================================

CREATE TABLE IF NOT EXISTS video_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    video_view_id UUID REFERENCES video_views(id) ON DELETE CASCADE,

    -- Contenu notification
    type TEXT DEFAULT 'view_threshold',  -- view_threshold, new_view, completed
    message TEXT,

    -- Statut
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_notifications_user ON video_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_video_notifications_unread ON video_notifications(user_id, read) WHERE read = FALSE;

-- RLS
ALTER TABLE video_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own notifications" ON video_notifications;
CREATE POLICY "Users can manage own notifications" ON video_notifications
    FOR ALL USING (auth.uid() = user_id);


-- ============================================
-- FONCTION : Mettre à jour les stats vidéo
-- ============================================

CREATE OR REPLACE FUNCTION update_video_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE video_links
    SET
        total_views = (SELECT COUNT(*) FROM video_views WHERE video_id = NEW.video_id),
        unique_views = (SELECT COUNT(DISTINCT lead_id) FROM video_views WHERE video_id = NEW.video_id),
        updated_at = NOW()
    WHERE id = NEW.video_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_video_stats ON video_views;
CREATE TRIGGER trigger_update_video_stats
    AFTER INSERT ON video_views
    FOR EACH ROW
    EXECUTE FUNCTION update_video_stats();


-- ============================================
-- FONCTION : Créer notification si seuil atteint
-- ============================================

CREATE OR REPLACE FUNCTION check_view_notification()
RETURNS TRIGGER AS $$
DECLARE
    video_owner UUID;
    threshold INTEGER;
    viewer_info TEXT;
BEGIN
    -- Récupérer le propriétaire et le seuil
    SELECT user_id, notify_threshold INTO video_owner, threshold
    FROM video_links WHERE id = NEW.video_id;

    -- Si le seuil est atteint et pas encore notifié
    IF NEW.percent_watched >= threshold AND NOT NEW.notification_sent THEN
        -- Construire l'info viewer
        viewer_info := COALESCE(NEW.viewer_name, NEW.viewer_email, NEW.lead_id);

        -- Créer la notification
        INSERT INTO video_notifications (user_id, video_view_id, type, message)
        VALUES (
            video_owner,
            NEW.id,
            'view_threshold',
            format('🎬 %s a regardé %s%% de ta vidéo !', viewer_info, NEW.percent_watched)
        );

        -- Marquer comme notifié
        UPDATE video_views
        SET notification_sent = TRUE, notification_sent_at = NOW()
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_view_notification ON video_views;
CREATE TRIGGER trigger_check_view_notification
    AFTER UPDATE OF percent_watched ON video_views
    FOR EACH ROW
    EXECUTE FUNCTION check_view_notification();


-- ============================================
-- VÉRIFICATION
-- ============================================

SELECT 'Tables créées avec succès!' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'video_links') as video_links_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'video_views') as video_views_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'video_notifications') as video_notifications_exists;
