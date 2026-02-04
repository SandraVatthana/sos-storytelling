-- ============================================
-- HUB CRM - Schéma SQL Complet
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. TABLE hub_teams (équipes)
-- ============================================

CREATE TABLE IF NOT EXISTS hub_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Configuration canaux activés
  channels_enabled JSONB DEFAULT '{"email": true, "dm": true, "call": true}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_hub_teams_owner ON hub_teams(owner_id);

-- RLS
ALTER TABLE hub_teams ENABLE ROW LEVEL SECURITY;

-- Politique: Les membres voient leur équipe
DROP POLICY IF EXISTS "Team members see team" ON hub_teams;
CREATE POLICY "Team members see team" ON hub_teams
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT team_id FROM hub_team_members WHERE user_id = auth.uid())
  );

-- Politique: Le propriétaire gère l'équipe
DROP POLICY IF EXISTS "Owner manages team" ON hub_teams;
CREATE POLICY "Owner manages team" ON hub_teams
  FOR ALL USING (owner_id = auth.uid());

-- ============================================
-- 2. TABLE hub_team_members (membres équipe)
-- ============================================

CREATE TABLE IF NOT EXISTS hub_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES hub_teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  role VARCHAR(20) DEFAULT 'member', -- owner, admin, member
  invited_email VARCHAR(255),
  invitation_status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(team_id, user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_hub_team_members_team ON hub_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_hub_team_members_user ON hub_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_team_members_email ON hub_team_members(invited_email);

-- RLS
ALTER TABLE hub_team_members ENABLE ROW LEVEL SECURITY;

-- Politique: Les membres voient les autres membres de leur équipe
DROP POLICY IF EXISTS "Members see team members" ON hub_team_members;
CREATE POLICY "Members see team members" ON hub_team_members
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM hub_team_members WHERE user_id = auth.uid())
    OR team_id IN (SELECT id FROM hub_teams WHERE owner_id = auth.uid())
  );

-- Politique: Les admins/owners gèrent les membres
DROP POLICY IF EXISTS "Admins manage members" ON hub_team_members;
CREATE POLICY "Admins manage members" ON hub_team_members
  FOR ALL USING (
    team_id IN (
      SELECT team_id FROM hub_team_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR team_id IN (SELECT id FROM hub_teams WHERE owner_id = auth.uid())
  );

-- ============================================
-- 3. TABLE hub_prospects (prospects)
-- ============================================

CREATE TABLE IF NOT EXISTS hub_prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Propriétaire (user ou team)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES hub_teams(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id), -- membre assigné

  -- Infos de base
  email VARCHAR(255),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  company VARCHAR(200),
  job_title VARCHAR(200),
  linkedin_url TEXT,
  phone VARCHAR(50),
  website TEXT,
  sector VARCHAR(100),
  city VARCHAR(100),
  company_size VARCHAR(50),

  -- Notes libres
  notes TEXT,

  -- Source
  source VARCHAR(50) DEFAULT 'manual', -- manual, csv, linkedin, pharow, extension

  -- CANAL EMAIL
  email_contacted BOOLEAN DEFAULT FALSE,
  email_contacted_at TIMESTAMP WITH TIME ZONE,
  email_replied BOOLEAN DEFAULT FALSE,
  email_replied_at TIMESTAMP WITH TIME ZONE,
  email_notes TEXT,

  -- CANAL DM
  dm_contacted BOOLEAN DEFAULT FALSE,
  dm_contacted_at TIMESTAMP WITH TIME ZONE,
  dm_replied BOOLEAN DEFAULT FALSE,
  dm_replied_at TIMESTAMP WITH TIME ZONE,
  dm_notes TEXT,

  -- CANAL APPEL
  call_done BOOLEAN DEFAULT FALSE,
  call_done_at TIMESTAMP WITH TIME ZONE,
  call_result VARCHAR(50), -- rdv_booked, callback, not_interested, no_answer, wrong_number, other
  call_notes TEXT,

  -- Statut global
  status VARCHAR(50) DEFAULT 'new',
  -- new, contacted, in_discussion, rdv_booked, converted, lost, not_qualified

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Contrainte : soit user_id soit team_id
  CONSTRAINT owner_check CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_hub_prospects_user ON hub_prospects(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_prospects_team ON hub_prospects(team_id);
CREATE INDEX IF NOT EXISTS idx_hub_prospects_assigned ON hub_prospects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_hub_prospects_email ON hub_prospects(email);
CREATE INDEX IF NOT EXISTS idx_hub_prospects_status ON hub_prospects(status);
CREATE INDEX IF NOT EXISTS idx_hub_prospects_created ON hub_prospects(created_at DESC);

-- RLS
ALTER TABLE hub_prospects ENABLE ROW LEVEL SECURITY;

-- Politique: Utilisateurs voient leurs prospects ou ceux de leur équipe
DROP POLICY IF EXISTS "Users see own prospects" ON hub_prospects;
CREATE POLICY "Users see own prospects" ON hub_prospects
  FOR ALL USING (
    auth.uid() = user_id
    OR team_id IN (SELECT team_id FROM hub_team_members WHERE user_id = auth.uid())
    OR team_id IN (SELECT id FROM hub_teams WHERE owner_id = auth.uid())
  );

-- ============================================
-- 4. TABLE hub_activities (historique)
-- ============================================

CREATE TABLE IF NOT EXISTS hub_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES hub_prospects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  activity_type VARCHAR(50) NOT NULL,
  -- email_sent, email_reply, dm_sent, dm_reply, call_made, note_added, status_changed, prospect_created, prospect_assigned

  channel VARCHAR(20), -- email, dm, call
  description TEXT,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_hub_activities_prospect ON hub_activities(prospect_id);
CREATE INDEX IF NOT EXISTS idx_hub_activities_user ON hub_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_hub_activities_created ON hub_activities(created_at DESC);

-- RLS
ALTER TABLE hub_activities ENABLE ROW LEVEL SECURITY;

-- Politique: Accès via le prospect
DROP POLICY IF EXISTS "Access via prospect" ON hub_activities;
CREATE POLICY "Access via prospect" ON hub_activities
  FOR ALL USING (
    prospect_id IN (
      SELECT id FROM hub_prospects
      WHERE user_id = auth.uid()
        OR team_id IN (SELECT team_id FROM hub_team_members WHERE user_id = auth.uid())
        OR team_id IN (SELECT id FROM hub_teams WHERE owner_id = auth.uid())
    )
  );

-- ============================================
-- 5. TABLE hub_user_settings (préférences)
-- ============================================

CREATE TABLE IF NOT EXISTS hub_user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Mode de travail
  work_mode VARCHAR(20) DEFAULT 'solo', -- solo, team
  default_team_id UUID REFERENCES hub_teams(id),

  -- Préférences canaux
  channels_enabled JSONB DEFAULT '{"email": true, "dm": true, "call": true}',

  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INT DEFAULT 0,

  -- UI préférences
  default_view VARCHAR(20) DEFAULT 'list', -- list, kanban
  items_per_page INT DEFAULT 25,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_hub_user_settings_user ON hub_user_settings(user_id);

-- RLS
ALTER TABLE hub_user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own settings" ON hub_user_settings;
CREATE POLICY "Users manage own settings" ON hub_user_settings
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 6. FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION hub_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour updated_at
DROP TRIGGER IF EXISTS hub_prospects_updated_at ON hub_prospects;
CREATE TRIGGER hub_prospects_updated_at
  BEFORE UPDATE ON hub_prospects
  FOR EACH ROW
  EXECUTE FUNCTION hub_update_updated_at();

DROP TRIGGER IF EXISTS hub_teams_updated_at ON hub_teams;
CREATE TRIGGER hub_teams_updated_at
  BEFORE UPDATE ON hub_teams
  FOR EACH ROW
  EXECUTE FUNCTION hub_update_updated_at();

DROP TRIGGER IF EXISTS hub_user_settings_updated_at ON hub_user_settings;
CREATE TRIGGER hub_user_settings_updated_at
  BEFORE UPDATE ON hub_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION hub_update_updated_at();

-- ============================================
-- 7. VUES UTILITAIRES
-- ============================================

-- Vue pour les stats prospects par utilisateur
CREATE OR REPLACE VIEW hub_prospect_stats AS
SELECT
  COALESCE(user_id::text, team_id::text) as owner_id,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'new') as new_count,
  COUNT(*) FILTER (WHERE status = 'contacted') as contacted_count,
  COUNT(*) FILTER (WHERE status = 'in_discussion') as in_discussion_count,
  COUNT(*) FILTER (WHERE status = 'rdv_booked') as rdv_booked_count,
  COUNT(*) FILTER (WHERE status = 'converted') as converted_count,
  COUNT(*) FILTER (WHERE status = 'lost') as lost_count,
  COUNT(*) FILTER (WHERE email_contacted = true) as email_contacted_count,
  COUNT(*) FILTER (WHERE dm_contacted = true) as dm_contacted_count,
  COUNT(*) FILTER (WHERE call_done = true) as call_done_count
FROM hub_prospects
GROUP BY COALESCE(user_id::text, team_id::text);

-- ============================================
-- FIN DU SCHEMA
-- ============================================
