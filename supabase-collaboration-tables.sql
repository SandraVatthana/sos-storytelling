-- ============================================================
-- SOS STORYTELLING - COLLABORATION TABLES
-- Mode Agence : Workspaces, Team, Comments, Notifications
-- ============================================================

-- ============ 1. WORKSPACES ============
-- Espace de travail partagé pour une agence

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Branding
    logo_url TEXT,

    -- Limites (basées sur le plan du propriétaire)
    max_members INTEGER DEFAULT 1,
    max_clients INTEGER DEFAULT 10,

    -- Paramètres
    settings JSONB DEFAULT '{"language": "fr", "timezone": "Europe/Paris"}',

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_workspace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workspace_updated_at ON workspaces;
CREATE TRIGGER workspace_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_workspace_timestamp();


-- ============ 2. WORKSPACE_MEMBERS ============
-- Membres d'un workspace avec rôles

CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Rôle : admin (tout) ou member (limité)
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),

    -- Clients assignés (NULL = accès à tous les clients)
    assigned_clients UUID[] DEFAULT NULL,

    -- Statut
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'left')),

    -- Metadata
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by UUID REFERENCES auth.users(id),
    last_active_at TIMESTAMPTZ,

    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_status ON workspace_members(status) WHERE status = 'active';


-- ============ 3. WORKSPACE_INVITATIONS ============
-- Invitations par email avec magic link

CREATE TABLE IF NOT EXISTS workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Détails invitation
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    assigned_clients UUID[] DEFAULT NULL,

    -- Token pour magic link (hashé SHA256)
    token_hash VARCHAR(64) NOT NULL UNIQUE,

    -- Statut
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),

    -- Metadata
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON workspace_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON workspace_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_pending ON workspace_invitations(status) WHERE status = 'pending';


-- ============ 4. COMMENTS ============
-- Commentaires sur le contenu (validation workflow)

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Relation polymorphe vers le contenu
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN (
        'newsletter', 'newsletter_email', 'campaign', 'campaign_email',
        'prospect', 'voice_profile', 'framework'
    )),
    content_id UUID NOT NULL,

    -- Données du commentaire
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,

    -- Threading (réponses)
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    -- Statut validation
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'action_required')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_workspace ON comments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_comments_content ON comments(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_open ON comments(status) WHERE status = 'open';


-- ============ 5. NOTIFICATIONS ============
-- Notifications utilisateur

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

    -- Type de notification
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'invitation_received',
        'invitation_accepted',
        'member_joined',
        'member_left',
        'member_removed',
        'content_created',
        'content_updated',
        'comment_added',
        'comment_reply',
        'comment_resolved',
        'comment_mention',
        'client_assigned',
        'role_changed'
    )),

    -- Données notification
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',

    -- Lien d'action
    action_url TEXT,

    -- Statut
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_recent ON notifications(user_id, created_at DESC);


-- ============ 6. MODIFICATIONS TABLES EXISTANTES ============
-- Ajouter workspace_id aux tables de contenu (si elles existent)
-- NOTE: Ces ALTER TABLE sont conditionnels - ils ne s'exécutent que si la table existe

DO $$
BEGIN
    -- clients
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clients') THEN
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
        CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients(workspace_id);
    END IF;

    -- newsletters
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'newsletters') THEN
        ALTER TABLE newsletters ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
        CREATE INDEX IF NOT EXISTS idx_newsletters_workspace ON newsletters(workspace_id);
    END IF;

    -- newsletter_templates
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'newsletter_templates') THEN
        ALTER TABLE newsletter_templates ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
    END IF;

    -- prospects
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prospects') THEN
        ALTER TABLE prospects ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
        CREATE INDEX IF NOT EXISTS idx_prospects_workspace ON prospects(workspace_id);
    END IF;

    -- email_campaigns
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_campaigns') THEN
        ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
        CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON email_campaigns(workspace_id);
    END IF;

    -- voice_profiles
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'voice_profiles') THEN
        ALTER TABLE voice_profiles ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);
        CREATE INDEX IF NOT EXISTS idx_voice_profiles_workspace ON voice_profiles(workspace_id);
    END IF;
END $$;


-- ============ 7. FONCTIONS HELPER RLS ============

-- Vérifier l'accès au workspace
CREATE OR REPLACE FUNCTION user_has_workspace_access(ws_id UUID, required_role TEXT DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    IF ws_id IS NULL THEN RETURN false; END IF;

    RETURN EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = ws_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND (required_role IS NULL OR role = required_role OR role = 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vérifier l'accès à un client spécifique
CREATE OR REPLACE FUNCTION user_has_client_access(ws_id UUID, client_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    member_record workspace_members%ROWTYPE;
BEGIN
    IF ws_id IS NULL OR client_uuid IS NULL THEN RETURN false; END IF;

    SELECT * INTO member_record
    FROM workspace_members
    WHERE workspace_id = ws_id
    AND user_id = auth.uid()
    AND status = 'active';

    IF NOT FOUND THEN RETURN false; END IF;

    -- Admins ont accès à tous les clients
    IF member_record.role = 'admin' THEN RETURN true; END IF;

    -- Members avec NULL = accès à tous
    IF member_record.assigned_clients IS NULL THEN RETURN true; END IF;

    -- Vérifier si le client est dans la liste assignée
    RETURN client_uuid = ANY(member_record.assigned_clients);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obtenir le workspace par défaut d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_default_workspace(uid UUID)
RETURNS UUID AS $$
DECLARE
    ws_id UUID;
BEGIN
    -- D'abord chercher un workspace dont l'utilisateur est propriétaire
    SELECT id INTO ws_id FROM workspaces WHERE owner_id = uid LIMIT 1;

    -- Sinon, prendre le premier workspace dont il est membre actif
    IF ws_id IS NULL THEN
        SELECT workspace_id INTO ws_id
        FROM workspace_members
        WHERE user_id = uid AND status = 'active'
        ORDER BY joined_at
        LIMIT 1;
    END IF;

    RETURN ws_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============ 8. ROW LEVEL SECURITY POLICIES ============

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- WORKSPACES: membres peuvent voir, admins peuvent modifier
CREATE POLICY "Members can view workspace" ON workspaces
    FOR SELECT USING (user_has_workspace_access(id));

CREATE POLICY "Admins can update workspace" ON workspaces
    FOR UPDATE USING (user_has_workspace_access(id, 'admin'));

CREATE POLICY "Users can create workspace" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- WORKSPACE_MEMBERS: membres peuvent voir, admins peuvent gérer
CREATE POLICY "Members can view team" ON workspace_members
    FOR SELECT USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Admins can manage members" ON workspace_members
    FOR ALL USING (user_has_workspace_access(workspace_id, 'admin'));

-- INVITATIONS: admins peuvent créer/voir, invité peut accepter
CREATE POLICY "Admins can manage invitations" ON workspace_invitations
    FOR ALL USING (user_has_workspace_access(workspace_id, 'admin'));

CREATE POLICY "Anyone can view invitation by token" ON workspace_invitations
    FOR SELECT USING (true); -- Token vérifié au niveau API

-- COMMENTS: membres peuvent commenter sur contenu accessible
CREATE POLICY "Members can view comments" ON comments
    FOR SELECT USING (user_has_workspace_access(workspace_id));

CREATE POLICY "Members can add comments" ON comments
    FOR INSERT WITH CHECK (
        user_has_workspace_access(workspace_id)
        AND auth.uid() = user_id
    );

CREATE POLICY "Authors can update own comments" ON comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete comments" ON comments
    FOR DELETE USING (
        auth.uid() = user_id
        OR user_has_workspace_access(workspace_id, 'admin')
    );

-- NOTIFICATIONS: utilisateurs voient uniquement les leurs
CREATE POLICY "Users see own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON notifications
    FOR INSERT WITH CHECK (true); -- Créées par le backend


-- ============ 9. MIGRATION UTILISATEURS EXISTANTS ============
-- À exécuter APRÈS la création des tables
-- Crée un workspace pour chaque utilisateur ayant du contenu

-- NOTE: Exécuter ce bloc séparément après vérification

/*
DO $$
DECLARE
    user_record RECORD;
    new_workspace_id UUID;
    user_plan TEXT;
    member_limit INTEGER;
    client_limit INTEGER;
BEGIN
    FOR user_record IN
        SELECT DISTINCT u.id, u.email, u.name, u.plan
        FROM users u
        WHERE EXISTS (SELECT 1 FROM clients WHERE user_id = u.id)
           OR EXISTS (SELECT 1 FROM newsletters WHERE user_id = u.id)
           OR EXISTS (SELECT 1 FROM prospects WHERE user_id = u.id)
           OR EXISTS (SELECT 1 FROM email_campaigns WHERE user_id = u.id)
    LOOP
        -- Déterminer les limites selon le plan
        user_plan := COALESCE(user_record.plan, 'solo');

        CASE user_plan
            WHEN 'enterprise' THEN member_limit := 100; client_limit := 1000;
            WHEN 'agency_scale' THEN member_limit := 15; client_limit := 30;
            WHEN 'agency_starter' THEN member_limit := 5; client_limit := 10;
            ELSE member_limit := 1; client_limit := 5;
        END CASE;

        -- Créer le workspace
        INSERT INTO workspaces (name, slug, owner_id, max_members, max_clients)
        VALUES (
            COALESCE(user_record.name, 'Mon Espace'),
            'ws-' || SUBSTRING(user_record.id::TEXT, 1, 8) || '-' || FLOOR(RANDOM() * 1000)::TEXT,
            user_record.id,
            member_limit,
            client_limit
        )
        RETURNING id INTO new_workspace_id;

        -- Ajouter le propriétaire comme admin
        INSERT INTO workspace_members (workspace_id, user_id, role, status)
        VALUES (new_workspace_id, user_record.id, 'admin', 'active');

        -- Migrer le contenu vers ce workspace
        UPDATE clients SET workspace_id = new_workspace_id
        WHERE user_id = user_record.id AND workspace_id IS NULL;

        UPDATE newsletters SET workspace_id = new_workspace_id
        WHERE user_id = user_record.id AND workspace_id IS NULL;

        UPDATE prospects SET workspace_id = new_workspace_id
        WHERE user_id = user_record.id AND workspace_id IS NULL;

        UPDATE email_campaigns SET workspace_id = new_workspace_id
        WHERE user_id = user_record.id AND workspace_id IS NULL;

        UPDATE voice_profiles SET workspace_id = new_workspace_id
        WHERE user_id = user_record.id AND workspace_id IS NULL;

        RAISE NOTICE 'Migrated user % (%) to workspace %', user_record.email, user_plan, new_workspace_id;
    END LOOP;
END $$;
*/

-- ============ FIN ============
