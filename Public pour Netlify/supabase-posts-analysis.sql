-- =====================================================
-- POSTS ANALYSIS SYSTEM - Tables pour l'analyse de performance
-- SOS Storytelling - Coach de contenu intelligent
-- =====================================================

-- ==========================================
-- 1. TABLE POSTS_ANALYZED
-- ==========================================

CREATE TABLE IF NOT EXISTS posts_analyzed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Contenu du post
    content TEXT NOT NULL,
    platform TEXT DEFAULT 'linkedin', -- 'linkedin', 'instagram', 'twitter', 'facebook', 'threads'
    post_url TEXT,
    published_at TIMESTAMP WITH TIME ZONE,

    -- Stats brutes (saisies par l'user)
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,

    -- Score calculé
    engagement_rate DECIMAL(5,2), -- (likes + comments + reposts) / views * 100
    performance_score INTEGER, -- 0-100, calculé par l'IA
    performance_tier TEXT, -- 'top', 'good', 'average', 'flop'

    -- Analyse IA (JSONB)
    analysis JSONB,
    /*
    Structure analysis:
    {
        "verdict": "Phrase résumant la performance",
        "why_it_worked": ["raison 1", "raison 2"],
        "why_it_flopped": ["raison 1"],
        "scores": {
            "hook": 85,
            "hook_comment": "Accroche qui intrigue",
            "structure": 70,
            "structure_comment": "Bien aéré",
            "emotion": 90,
            "emotion_comment": "Vulnérabilité qui touche",
            "cta": 60,
            "cta_comment": "Pas de question finale",
            "uniqueness": 75,
            "uniqueness_comment": "Point de vue original"
        },
        "detected_elements": {
            "format": "story",
            "emotion": "vulnerable",
            "has_personal_story": true,
            "has_question": false,
            "has_list": false,
            "has_hook": true,
            "hook_type": "curiosity"
        },
        "reusable_patterns": ["pattern 1", "pattern 2"],
        "improvement_suggestions": ["suggestion 1"],
        "rewrite_hook": "Proposition d'accroche alternative",
        "similar_content_idea": "Idée de post similaire"
    }
    */

    -- Catégorisation (extraits de l'analyse pour requêtes rapides)
    format TEXT, -- 'story', 'tips', 'question', 'carousel', 'poll', 'announcement', 'thread'
    emotion TEXT, -- 'vulnerable', 'inspiring', 'funny', 'educational', 'controversial', 'neutral'
    has_personal_story BOOLEAN DEFAULT false,
    has_question BOOLEAN DEFAULT false,
    has_list BOOLEAN DEFAULT false,
    has_image BOOLEAN DEFAULT false,
    has_video BOOLEAN DEFAULT false,
    word_count INTEGER,

    -- Méta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_posts_analyzed_user ON posts_analyzed(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_analyzed_performance ON posts_analyzed(user_id, performance_tier);
CREATE INDEX IF NOT EXISTS idx_posts_analyzed_date ON posts_analyzed(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_analyzed_platform ON posts_analyzed(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_posts_analyzed_engagement ON posts_analyzed(user_id, engagement_rate DESC);

-- RLS Policies
ALTER TABLE posts_analyzed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own posts"
    ON posts_analyzed FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
    ON posts_analyzed FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
    ON posts_analyzed FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
    ON posts_analyzed FOR DELETE
    USING (auth.uid() = user_id);

-- ==========================================
-- 2. TABLE USER_PATTERNS
-- ==========================================

CREATE TABLE IF NOT EXISTS user_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    -- Patterns détectés (mis à jour après chaque analyse)
    patterns JSONB,
    /*
    Structure patterns:
    {
        "best_format": "story",
        "best_emotion": "vulnerable",
        "best_day": "tuesday",
        "best_hour": 8,
        "avg_engagement_rate": 3.2,
        "top_performing_elements": [
            {"element": "Histoire personnelle", "impact": "+340%"},
            {"element": "Question finale", "impact": "+89%"},
            {"element": "Vulnérabilité", "impact": "+210%"}
        ],
        "underperforming_elements": [
            {"element": "Conseils génériques", "impact": "-60%"},
            {"element": "Pas d'accroche", "impact": "-75%"}
        ],
        "recommendations": [
            "Privilégie les posts avec une histoire personnelle",
            "Termine toujours par une question",
            "Évite les listes de conseils génériques"
        ],
        "format_stats": {
            "story": {"count": 12, "avg_engagement": 4.2},
            "tips": {"count": 8, "avg_engagement": 1.8}
        },
        "emotion_stats": {
            "vulnerable": {"count": 10, "avg_engagement": 5.1},
            "educational": {"count": 15, "avg_engagement": 2.3}
        }
    }
    */

    total_posts_analyzed INTEGER DEFAULT 0,
    last_analysis_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE user_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own patterns"
    ON user_patterns FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns"
    ON user_patterns FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns"
    ON user_patterns FOR UPDATE
    USING (auth.uid() = user_id);

-- ==========================================
-- 3. VUE STATS AGGREGEES
-- ==========================================

CREATE OR REPLACE VIEW posts_stats_summary AS
SELECT
    user_id,
    platform,
    COUNT(*) as total_posts,
    AVG(engagement_rate) as avg_engagement_rate,
    AVG(performance_score) as avg_performance_score,
    COUNT(*) FILTER (WHERE performance_tier = 'top') as top_posts,
    COUNT(*) FILTER (WHERE performance_tier = 'good') as good_posts,
    COUNT(*) FILTER (WHERE performance_tier = 'average') as average_posts,
    COUNT(*) FILTER (WHERE performance_tier = 'flop') as flop_posts,
    MAX(engagement_rate) as best_engagement_rate,
    MIN(engagement_rate) as worst_engagement_rate
FROM posts_analyzed
GROUP BY user_id, platform;

-- ==========================================
-- 4. FONCTION POUR CALCULER L'ENGAGEMENT RATE
-- ==========================================

CREATE OR REPLACE FUNCTION calculate_engagement_rate(
    p_views INTEGER,
    p_likes INTEGER,
    p_comments INTEGER,
    p_reposts INTEGER
) RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF p_views IS NULL OR p_views = 0 THEN
        RETURN 0;
    END IF;
    RETURN ROUND(((COALESCE(p_likes, 0) + COALESCE(p_comments, 0) + COALESCE(p_reposts, 0))::DECIMAL / p_views) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 5. TRIGGER POUR AUTO-UPDATE engagement_rate
-- ==========================================

CREATE OR REPLACE FUNCTION update_engagement_rate()
RETURNS TRIGGER AS $$
BEGIN
    NEW.engagement_rate := calculate_engagement_rate(NEW.views, NEW.likes, NEW.comments, NEW.reposts);
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_engagement_rate
    BEFORE INSERT OR UPDATE OF views, likes, comments, reposts
    ON posts_analyzed
    FOR EACH ROW
    EXECUTE FUNCTION update_engagement_rate();

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

GRANT SELECT, INSERT, UPDATE, DELETE ON posts_analyzed TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_patterns TO authenticated;
GRANT SELECT ON posts_stats_summary TO authenticated;
