-- =====================================================
-- TABLES MISSIONS MULTI-AGENTS
-- SOS Storytelling - Autopilot Multi-Agents
-- Inspiré de Manus AI
-- =====================================================

-- =====================================================
-- TABLE : missions
-- La mission principale donnée par l'utilisateur
-- =====================================================

CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

    -- La commande originale de l'utilisateur
    command TEXT NOT NULL,
    -- Ex: "Crée et programme 5 emails sur le GEO, mardi 9h, sur 5 semaines"

    -- Parsing de la commande par l'orchestrateur
    parsed_intent JSONB,
    -- {
    --   "type": "email_sequence",
    --   "count": 5,
    --   "topic": "GEO",
    --   "schedule": { "day": "tuesday", "time": "09:00" },
    --   "duration_weeks": 5
    -- }

    -- Type de mission détecté
    mission_type TEXT,
    -- email_sequence, prospection, monthly_content, followup, transformation, analysis

    -- Statut de la mission
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',           -- En attente de démarrage
        'processing',        -- En cours d'exécution
        'ready_for_review',  -- Prête pour validation
        'approved',          -- Validée par l'utilisateur
        'executing',         -- En cours d'exécution réelle (envoi emails, etc.)
        'completed',         -- Terminée avec succès
        'failed',            -- Échec
        'cancelled'          -- Annulée par l'utilisateur
    )),

    -- Progression
    current_step TEXT,
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    steps_log JSONB DEFAULT '[]',
    -- [
    --   { "agent": "scout", "action": "research", "status": "done", "duration_ms": 2340, "message": "Recherche terminée" },
    --   { "agent": "writer", "action": "draft_emails", "status": "in_progress", "message": "Rédaction en cours..." }
    -- ]

    -- Résultat final
    result JSONB,
    -- Contient les emails générés, le planning, les vérifications, etc.

    -- Résumé généré par l'agent Analyst
    summary JSONB,
    -- {
    --   "title": "Séquence de 5 emails prête",
    --   "overview": { "type": "email_sequence", "count": 5, ... },
    --   "verification_status": { "overall_score": 95, ... },
    --   "estimated_impact": { ... }
    -- }

    -- Validation
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    modifications_requested TEXT,

    -- Erreurs
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Index pour missions
CREATE INDEX IF NOT EXISTS idx_missions_user ON missions(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_org ON missions(organization_id);
CREATE INDEX IF NOT EXISTS idx_missions_created ON missions(created_at DESC);

-- =====================================================
-- TABLE : mission_tasks
-- Les sous-tâches exécutées par chaque agent
-- =====================================================

CREATE TABLE IF NOT EXISTS mission_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE NOT NULL,

    -- Agent assigné
    agent TEXT NOT NULL CHECK (agent IN (
        'orchestrator',  -- Maestro - coordonne tout
        'scout',         -- Recherche et collecte d'infos
        'writer',        -- Rédaction de contenu
        'scheduler',     -- Planification
        'guardian',      -- Vérification qualité/RGPD
        'analyst'        -- Génération de rapports
    )),

    -- Type de tâche
    task_type TEXT NOT NULL,
    -- parse_command, research_topic, scrape_linkedin, draft_sequence,
    -- personalize_messages, plan_sending, verify_all, filter_blacklist,
    -- generate_summary, etc.

    -- Entrée et sortie de la tâche
    task_input JSONB DEFAULT '{}',
    task_output JSONB,

    -- Statut de la tâche
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',    -- En attente
        'running',    -- En cours
        'completed',  -- Terminée
        'failed',     -- Échec
        'skipped'     -- Sautée (condition non remplie)
    )),

    -- Ordre d'exécution
    sequence_order INTEGER NOT NULL DEFAULT 0,
    depends_on UUID[], -- IDs des tâches qui doivent être complétées avant

    -- Métriques
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Erreurs et retry
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour mission_tasks
CREATE INDEX IF NOT EXISTS idx_tasks_mission ON mission_tasks(mission_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON mission_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON mission_tasks(agent);
CREATE INDEX IF NOT EXISTS idx_tasks_sequence ON mission_tasks(mission_id, sequence_order);

-- =====================================================
-- TABLE : mission_outputs
-- Les éléments produits par la mission (emails, posts, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS mission_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE NOT NULL,

    -- Type de sortie
    output_type TEXT NOT NULL CHECK (output_type IN (
        'email',          -- Email à envoyer
        'post',           -- Post LinkedIn/réseaux sociaux
        'dm',             -- Message direct LinkedIn
        'newsletter',     -- Newsletter
        'prospect_list',  -- Liste de prospects
        'schedule',       -- Planning
        'report'          -- Rapport d'analyse
    )),

    -- Contenu de la sortie
    content JSONB NOT NULL,
    -- Pour un email :
    -- {
    --   "subject": "...",
    --   "body": "...",
    --   "scheduled_at": "2025-01-07T09:00:00Z",
    --   "recipient_filter": "all_prospects",
    --   "cta": "..."
    -- }

    -- Position dans la séquence (si applicable)
    sequence_position INTEGER,

    -- Résultats de vérification
    verification_results JSONB,
    -- {
    --   "spam_score": 2.1,
    --   "rgpd_compliant": true,
    --   "links_valid": true,
    --   "warnings": ["Sujet un peu long"],
    --   "errors": []
    -- }

    -- Statut
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft',      -- Brouillon
        'approved',   -- Approuvé
        'scheduled',  -- Programmé
        'executing',  -- En cours d'exécution
        'sent',       -- Envoyé
        'failed'      -- Échec
    )),

    -- Lien vers l'exécution réelle
    executed_item_id UUID, -- ID dans email_queue, posts, etc.
    executed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour mission_outputs
CREATE INDEX IF NOT EXISTS idx_outputs_mission ON mission_outputs(mission_id);
CREATE INDEX IF NOT EXISTS idx_outputs_type ON mission_outputs(output_type);
CREATE INDEX IF NOT EXISTS idx_outputs_status ON mission_outputs(status);

-- =====================================================
-- TABLE : mission_templates
-- Templates de missions prédéfinis pour faciliter la création
-- =====================================================

CREATE TABLE IF NOT EXISTS mission_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Catégorie
    category TEXT NOT NULL,
    -- emails, prospection, content, followup, transformation, analysis

    -- Infos template
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '🚀',

    -- Commande suggérée (avec placeholders)
    suggested_command TEXT NOT NULL,
    -- Ex: "Crée une séquence de {count} emails sur {topic}, {day} {time}, sur {weeks} semaines"

    -- Paramètres requis
    required_params JSONB DEFAULT '[]',
    -- [
    --   { "name": "count", "type": "number", "label": "Nombre d'emails", "default": 5 },
    --   { "name": "topic", "type": "text", "label": "Sujet", "placeholder": "Ex: le GEO" }
    -- ]

    -- Configuration par défaut
    default_config JSONB DEFAULT '{}',

    -- Ordre d'affichage
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour mission_templates
CREATE INDEX IF NOT EXISTS idx_templates_category ON mission_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_active ON mission_templates(is_active);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mission_outputs ENABLE ROW LEVEL SECURITY;

-- Missions : les utilisateurs ne voient que leurs missions
CREATE POLICY "Users can view own missions" ON missions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions" ON missions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions" ON missions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own missions" ON missions
    FOR DELETE USING (auth.uid() = user_id);

-- Tasks : accès via mission ownership
CREATE POLICY "Users can view tasks via mission" ON mission_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM missions
            WHERE missions.id = mission_tasks.mission_id
            AND missions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage tasks via mission" ON mission_tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM missions
            WHERE missions.id = mission_tasks.mission_id
            AND missions.user_id = auth.uid()
        )
    );

-- Outputs : accès via mission ownership
CREATE POLICY "Users can view outputs via mission" ON mission_outputs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM missions
            WHERE missions.id = mission_outputs.mission_id
            AND missions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage outputs via mission" ON mission_outputs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM missions
            WHERE missions.id = mission_outputs.mission_id
            AND missions.user_id = auth.uid()
        )
    );

-- Templates : lecture publique
CREATE POLICY "Anyone can view active templates" ON mission_templates
    FOR SELECT USING (is_active = true);

-- =====================================================
-- FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour obtenir le prochain ordre de séquence
CREATE OR REPLACE FUNCTION get_next_task_order(p_mission_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT MAX(sequence_order) + 1 FROM mission_tasks WHERE mission_id = p_mission_id),
        0
    );
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer la progression d'une mission
CREATE OR REPLACE FUNCTION calculate_mission_progress(p_mission_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_total INTEGER;
    v_completed INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('completed', 'skipped'))
    INTO v_total, v_completed
    FROM mission_tasks
    WHERE mission_id = p_mission_id;

    IF v_total = 0 THEN
        RETURN 0;
    END IF;

    RETURN ROUND((v_completed::FLOAT / v_total::FLOAT) * 100);
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour la progression automatiquement
CREATE OR REPLACE FUNCTION update_mission_progress()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE missions
    SET progress_percent = calculate_mission_progress(NEW.mission_id)
    WHERE id = NEW.mission_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_mission_progress
    AFTER UPDATE OF status ON mission_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_mission_progress();

-- =====================================================
-- DONNÉES INITIALES : Templates de missions
-- =====================================================

INSERT INTO mission_templates (category, name, description, icon, suggested_command, required_params, display_order)
VALUES
    -- Séquences emails
    ('emails', 'Séquence emails', 'Crée une séquence d''emails sur un sujet', '📧',
     'Crée une séquence de {count} emails sur {topic}, {day} {time}, sur {weeks} semaines',
     '[{"name": "count", "type": "number", "label": "Nombre d''emails", "default": 5}, {"name": "topic", "type": "text", "label": "Sujet", "placeholder": "Ex: le GEO"}, {"name": "day", "type": "select", "label": "Jour", "options": ["lundi", "mardi", "mercredi", "jeudi", "vendredi"], "default": "mardi"}, {"name": "time", "type": "time", "label": "Heure", "default": "09:00"}, {"name": "weeks", "type": "number", "label": "Durée (semaines)", "default": 5}]',
     1),

    ('emails', 'Emails de bienvenue', 'Séquence d''onboarding pour nouveaux abonnés', '👋',
     'Prépare {count} emails de bienvenue pour mes nouveaux abonnés',
     '[{"name": "count", "type": "number", "label": "Nombre d''emails", "default": 3}]',
     2),

    -- Prospection
    ('prospection', 'Prospection LinkedIn', 'Trouve et contacte des prospects sur LinkedIn', '🎯',
     'Trouve {count} {target} sur LinkedIn et envoie-leur un message personnalisé',
     '[{"name": "count", "type": "number", "label": "Nombre de prospects", "default": 50}, {"name": "target", "type": "text", "label": "Cible", "placeholder": "Ex: coachs business femmes"}]',
     3),

    ('prospection', 'Engager les likers', 'Contacte les personnes qui ont liké tes posts', '💬',
     'Contacte les {count} dernières personnes qui ont liké mes posts',
     '[{"name": "count", "type": "number", "label": "Nombre", "default": 20}]',
     4),

    -- Contenu
    ('content', 'Contenu mensuel', 'Prépare ton calendrier de contenu pour le mois', '📅',
     'Prépare mon contenu LinkedIn pour {month}, {frequency} posts par semaine',
     '[{"name": "month", "type": "text", "label": "Mois", "placeholder": "Ex: janvier"}, {"name": "frequency", "type": "number", "label": "Posts par semaine", "default": 4}]',
     5),

    ('content', 'Batch de posts', 'Génère plusieurs posts sur un thème', '✨',
     'Génère {count} posts LinkedIn sur le thème de {topic}',
     '[{"name": "count", "type": "number", "label": "Nombre de posts", "default": 10}, {"name": "topic", "type": "text", "label": "Thème", "placeholder": "Ex: l''entrepreneuriat féminin"}]',
     6),

    -- Relances
    ('followup', 'Relancer les prospects froids', 'Relance les prospects sans réponse', '🔄',
     'Relance les prospects qui n''ont pas répondu depuis {days} jours',
     '[{"name": "days", "type": "number", "label": "Jours sans réponse", "default": 7}]',
     7),

    ('followup', 'Follow-up campagne', 'Suivi d''une campagne précédente', '📊',
     'Fais un follow-up sur ma campagne {campaign_name}',
     '[{"name": "campaign_name", "type": "text", "label": "Nom de la campagne", "placeholder": "Ex: de la semaine dernière"}]',
     8),

    -- Transformation
    ('transformation', 'PDF vers emails', 'Transforme un document en séquence', '📄',
     'Transforme ce PDF en séquence de {count} emails de nurturing',
     '[{"name": "count", "type": "number", "label": "Nombre d''emails", "default": 5}]',
     9),

    ('transformation', 'Recycler des posts', 'Transforme des posts en newsletter', '♻️',
     'Recycle mes {count} meilleurs posts en newsletter',
     '[{"name": "count", "type": "number", "label": "Nombre de posts", "default": 3}]',
     10),

    -- Analyse
    ('analysis', 'Analyser la concurrence', 'Analyse ce que font tes concurrents', '🔍',
     'Analyse ce que postent mes {count} concurrents et propose des angles différenciants',
     '[{"name": "count", "type": "number", "label": "Nombre de concurrents", "default": 5}]',
     11),

    ('analysis', 'Tendances du secteur', 'Trouve les sujets tendance', '📈',
     'Trouve les sujets tendance dans {sector} ce mois-ci',
     '[{"name": "sector", "type": "text", "label": "Secteur", "placeholder": "Ex: mon secteur"}]',
     12)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VÉRIFICATION
-- =====================================================
-- SELECT * FROM missions LIMIT 1;
-- SELECT * FROM mission_tasks LIMIT 1;
-- SELECT * FROM mission_outputs LIMIT 1;
-- SELECT * FROM mission_templates WHERE is_active = true ORDER BY display_order;
