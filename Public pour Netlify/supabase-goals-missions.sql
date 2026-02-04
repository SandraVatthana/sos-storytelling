-- =====================================================
-- GOALS & MISSIONS SYSTEM - Objectifs et missions quotidiennes
-- SOS Storytelling 2026
-- =====================================================

-- Nouvelles colonnes pour user_tone_clone (profil utilisateur existant)
ALTER TABLE user_tone_clone ADD COLUMN IF NOT EXISTS sector VARCHAR(10); -- 'b2b', 'b2c', 'both'
ALTER TABLE user_tone_clone ADD COLUMN IF NOT EXISTS daily_time_minutes INTEGER DEFAULT 30;
ALTER TABLE user_tone_clone ADD COLUMN IF NOT EXISTS goal_type VARCHAR(20); -- 'followers', 'leads', 'clients', 'posts'
ALTER TABLE user_tone_clone ADD COLUMN IF NOT EXISTS goal_target INTEGER;
ALTER TABLE user_tone_clone ADD COLUMN IF NOT EXISTS goal_timeframe_days INTEGER DEFAULT 90;
ALTER TABLE user_tone_clone ADD COLUMN IF NOT EXISTS goal_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_tone_clone ADD COLUMN IF NOT EXISTS goal_current_progress INTEGER DEFAULT 0;

-- Table pour les missions complétées
CREATE TABLE IF NOT EXISTS daily_missions_completed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mission_id VARCHAR(50) NOT NULL,
    completed_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, mission_id, completed_date)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_missions_user_date ON daily_missions_completed(user_id, completed_date);

-- RLS Policies
ALTER TABLE daily_missions_completed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own missions"
    ON daily_missions_completed FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions"
    ON daily_missions_completed FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own missions"
    ON daily_missions_completed FOR DELETE
    USING (auth.uid() = user_id);

-- Permissions
GRANT SELECT, INSERT, DELETE ON daily_missions_completed TO authenticated;
