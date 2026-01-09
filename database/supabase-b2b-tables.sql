-- ============================================
-- SOS STORYTELLING B2B / WHITE LABEL
-- Tables Supabase pour le pivot B2B
-- ============================================

-- ==========================================
-- 1. ORGANISATIONS (Nina, Aline, etc.)
-- ==========================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- "Nina Ramen"
  slug TEXT UNIQUE NOT NULL, -- "nina-ramen" pour les URLs

  -- White label
  app_name TEXT NOT NULL, -- "RamenTaFraise"
  logo_url TEXT,
  favicon_url TEXT,
  primary_color TEXT DEFAULT '#FF6B6B',
  secondary_color TEXT DEFAULT '#4ECDC4',
  accent_color TEXT DEFAULT '#FFE66D',

  -- Personnalisation UI
  loading_message TEXT DEFAULT 'L''IA reflechit...',
  loading_lottie_url TEXT,
  welcome_message TEXT,
  interface_tone TEXT, -- Description du ton pour tooltips/aide

  -- Contact
  support_email TEXT,
  website_url TEXT,

  -- Subscription B2B
  plan TEXT DEFAULT 'bootcamp', -- 'bootcamp', 'enterprise', 'trial'
  max_coaches INT DEFAULT 45,
  max_clients INT DEFAULT 150,
  price_per_month INT, -- en centimes

  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche par slug
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Organisation par defaut (SOS Storytelling solo)
INSERT INTO organizations (id, name, slug, app_name, primary_color, secondary_color, plan)
VALUES (
  'sos_default',
  'SOS Storytelling',
  'sos-storytelling',
  'SOS Storytelling',
  '#6366F1',
  '#8B5CF6',
  'individual'
) ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 2. COHORTES (Promotions de bootcamp)
-- ==========================================
CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL, -- "Cohorte Janvier 2025"
  description TEXT,
  emoji TEXT DEFAULT '🍓', -- Pour identifier visuellement

  start_date DATE NOT NULL,
  end_date DATE,
  duration_days INT DEFAULT 90,

  is_active BOOLEAN DEFAULT true,

  -- Stats cache
  total_clients INT DEFAULT 0,
  total_coaches INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cohorts_org ON cohorts(organization_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_active ON cohorts(is_active) WHERE is_active = true;

-- ==========================================
-- 3. UTILISATEURS ORGANISATION (avec roles)
-- ==========================================
CREATE TABLE IF NOT EXISTS org_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,

  -- Role
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach', 'client')),

  -- Pour clients: leur coach assignee
  coach_id UUID REFERENCES org_users(id) ON DELETE SET NULL,

  -- Infos utilisateur
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,

  -- Abonnement
  subscription_type TEXT DEFAULT 'bootcamp_included', -- 'bootcamp_included', 'individual', 'trial'
  subscription_ends_at TIMESTAMPTZ, -- NULL = recurrent
  referred_by UUID REFERENCES organizations(id), -- D'ou vient l'utilisatrice
  promo_code TEXT,
  transitioned_at TIMESTAMPTZ, -- Date passage bootcamp -> individual
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Progression (pour clients)
  current_day INT DEFAULT 1,
  current_step TEXT,
  posts_count INT DEFAULT 0,
  newsletters_count INT DEFAULT 0,
  emails_count INT DEFAULT 0,

  -- Activite
  last_activity_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,

  -- Mood tracking
  mood_today TEXT, -- emoji
  mood_note TEXT,
  mood_updated_at TIMESTAMPTZ,

  -- Notifications push
  push_token TEXT,
  push_enabled BOOLEAN DEFAULT true,

  -- Statut
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte unique
  UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_org_users_user ON org_users(user_id);
CREATE INDEX IF NOT EXISTS idx_org_users_org ON org_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_users_cohort ON org_users(cohort_id);
CREATE INDEX IF NOT EXISTS idx_org_users_coach ON org_users(coach_id);
CREATE INDEX IF NOT EXISTS idx_org_users_role ON org_users(role);

-- ==========================================
-- 4. FRAMEWORKS PERSONNALISES (par org)
-- ==========================================
CREATE TABLE IF NOT EXISTS org_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'post', 'newsletter', 'email', 'hook', 'dm'

  -- Contenu du framework
  content TEXT NOT NULL, -- Le template
  steps JSONB, -- Etapes structurees

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Framework par defaut pour cette categorie
  display_order INT DEFAULT 0,

  -- Stats
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_by UUID REFERENCES org_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_frameworks_org ON org_frameworks(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_frameworks_category ON org_frameworks(category);

-- ==========================================
-- 5. PROMPTS PERSONNALISES (par org)
-- ==========================================
CREATE TABLE IF NOT EXISTS org_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- Type de prompt
  prompt_type TEXT NOT NULL, -- 'hook_generator', 'post_writer', 'newsletter_writer', 'email_writer', 'dm_writer'

  -- Contenu
  prompt_content TEXT NOT NULL,

  -- Variables utilisees
  variables TEXT[] DEFAULT '{}', -- ['{topic}', '{audience}', '{tone}']

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  replaces_default BOOLEAN DEFAULT false, -- Remplace le prompt par defaut?

  -- Source template (si cree depuis un template)
  source_template TEXT,

  -- Stats
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_by UUID REFERENCES org_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_prompts_org ON org_prompts(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_prompts_type ON org_prompts(prompt_type);

-- ==========================================
-- 6. TEMPLATES DE PROMPTS (bibliotheque SOS)
-- ==========================================
CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY, -- 'hook_curiosity', 'post_storytelling'

  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'hooks', 'posts', 'newsletters', 'emails', 'dms'

  prompt_content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',

  display_order INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed templates de base
INSERT INTO prompt_templates (id, name, description, category, prompt_content, variables, display_order) VALUES
('hook_curiosity', 'Hook "Curiosite"', 'Ouvre une boucle que le lecteur doit fermer', 'hooks',
'Tu es un expert en hooks qui creent de la curiosite.

REGLE : Chaque hook doit ouvrir une "boucle" que le lecteur voudra fermer en lisant la suite.

Techniques a utiliser :
- Annoncer un resultat sans dire comment
- Promettre une revelation
- Creer un mystere

SUJET : {topic}
AUDIENCE : {audience}
TON : {tone}

Genere 5 hooks de max 2 lignes qui donnent ENVIE de lire la suite.',
ARRAY['{topic}', '{audience}', '{tone}'], 1),

('hook_confession', 'Hook "Confession"', 'Partage une vulnerabilite qui cree la connexion', 'hooks',
'Tu es un expert en hooks bases sur la vulnerabilite et l''authenticite.

REGLE : Chaque hook doit partager quelque chose de personnel/vulnerable qui cree une connexion immediate.

Techniques a utiliser :
- Avouer un echec
- Partager un doute
- Reveler une verite inconfortable

SUJET : {topic}
AUDIENCE : {audience}
TON : {tone}

Genere 5 hooks de max 2 lignes qui creent une connexion emotionnelle.',
ARRAY['{topic}', '{audience}', '{tone}'], 2),

('hook_paradox', 'Hook "Paradoxe"', 'Affirme quelque chose de contre-intuitif', 'hooks',
'Tu es un expert en hooks bases sur le paradoxe et la contradiction.

REGLE : Chaque hook doit affirmer quelque chose qui semble contre-intuitif ou contradictoire.

Techniques a utiliser :
- Contredire une croyance populaire
- Presenter un resultat inattendu
- Creer un effet de surprise

SUJET : {topic}
AUDIENCE : {audience}
TON : {tone}

Genere 5 hooks de max 2 lignes qui surprennent par leur paradoxe.',
ARRAY['{topic}', '{audience}', '{tone}'], 3),

('post_storytelling', 'Post "Storytelling personnel"', 'Structure narrative avec tension et resolution', 'posts',
'Tu es un copywriter expert LinkedIn specialise en storytelling.

STRUCTURE :
1. HOOK (2 lignes) - cree tension ou curiosite
2. SITUATION (3-4 lignes) - contexte et probleme
3. TOURNANT (2-3 lignes) - le declic
4. RESOLUTION (3-4 lignes) - ce qui a change
5. LECON (2 lignes) - enseignement universel
6. CTA (1 ligne) - question ou appel a l''action

REGLES :
- Phrases courtes et aerees
- "Tu" pas "vous"
- Maximum 3 emojis
- Hashtags a la fin uniquement

SUJET : {topic}
AUDIENCE : {audience}
TON : {tone}

Ecris le post complet.',
ARRAY['{topic}', '{audience}', '{tone}'], 1),

('newsletter_weekly', 'Newsletter Weekly', 'Resume de la semaine + conseil + CTA', 'newsletters',
'Tu es un expert en newsletters qui convertissent.

STRUCTURE :
1. OBJET (60 caracteres max) - donne envie d''ouvrir
2. ACCROCHE (2-3 lignes) - capte l''attention
3. CONTENU PRINCIPAL - 2-3 sections avec sous-titres
4. CTA - un seul, clair et direct
5. PS - bonus ou rappel

REGLES :
- Ton conversationnel, comme un email a une amie
- Phrases courtes, pas de jargon
- Un seul CTA principal

SUJET : {topic}
AUDIENCE : {audience}

Ecris la newsletter complete.',
ARRAY['{topic}', '{audience}'], 1)

ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 7. MESSAGES QUOTIDIENS PROGRAMMES
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,

  -- Programmation
  scheduled_date DATE NOT NULL,
  scheduled_time TIME DEFAULT '07:00',

  -- Contenu
  subject TEXT, -- Objet (pour notifications)
  template TEXT NOT NULL, -- Le template avec {VARIABLES}

  -- Options
  send_to_coaches BOOLEAN DEFAULT true,
  send_push BOOLEAN DEFAULT true,
  send_email BOOLEAN DEFAULT false,

  -- Statut
  status TEXT DEFAULT 'scheduled', -- 'draft', 'scheduled', 'sending', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  error_message TEXT,

  -- Stats
  recipients_count INT DEFAULT 0,
  read_count INT DEFAULT 0,

  created_by UUID REFERENCES org_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_messages_org ON daily_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_daily_messages_cohort ON daily_messages(cohort_id);
CREATE INDEX IF NOT EXISTS idx_daily_messages_date ON daily_messages(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_daily_messages_status ON daily_messages(status);

-- ==========================================
-- 8. MESSAGES ENVOYES (personnalises)
-- ==========================================
CREATE TABLE IF NOT EXISTS sent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_message_id UUID REFERENCES daily_messages(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES org_users(id) ON DELETE CASCADE,

  -- Contenu personnalise
  personalized_content TEXT NOT NULL,

  -- Statut
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  -- Push notification
  push_sent BOOLEAN DEFAULT false,
  push_delivered BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sent_messages_daily ON sent_messages(daily_message_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_recipient ON sent_messages(recipient_id);

-- ==========================================
-- 9. CHAT COACH-CLIENTE
-- ==========================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  sender_id UUID REFERENCES org_users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES org_users(id) ON DELETE CASCADE,

  content TEXT NOT NULL,

  -- Statut
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_org ON chat_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_recipient ON chat_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

-- ==========================================
-- 10. METRIQUES CLIENTES
-- ==========================================
CREATE TABLE IF NOT EXISTS client_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES org_users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Contenus crees
  posts_created INT DEFAULT 0,
  posts_published INT DEFAULT 0,
  newsletters_created INT DEFAULT 0,
  newsletters_sent INT DEFAULT 0,
  emails_created INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  hooks_generated INT DEFAULT 0,

  -- Prospection
  prospects_added INT DEFAULT 0,
  dms_sent INT DEFAULT 0,

  -- Metriques LinkedIn (si connecte)
  linkedin_views INT,
  linkedin_likes INT,
  linkedin_comments INT,
  linkedin_shares INT,

  -- Temps passe
  time_spent_minutes INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_client_metrics_user ON client_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_client_metrics_date ON client_metrics(date);

-- ==========================================
-- 11. ALERTES COACH
-- ==========================================
CREATE TABLE IF NOT EXISTS coach_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES org_users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES org_users(id) ON DELETE CASCADE,

  -- Type d'alerte
  alert_type TEXT NOT NULL, -- 'mood_low', 'inactive', 'behind_schedule', 'needs_feedback'
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high'

  -- Contenu
  title TEXT NOT NULL,
  description TEXT,

  -- Statut
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES org_users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_alerts_coach ON coach_alerts(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_alerts_client ON coach_alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_alerts_unread ON coach_alerts(is_read) WHERE is_read = false;

-- ==========================================
-- 12. CODES PROMO
-- ==========================================
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'NINA20', 'ALINE15'
  organization_id UUID REFERENCES organizations(id), -- Qui l'a cree

  -- Reduction
  discount_percent INT, -- 20 = 20%
  discount_amount INT, -- OU montant fixe en centimes

  -- Validite
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  max_uses INT,
  current_uses INT DEFAULT 0,

  -- Stripe
  stripe_coupon_id TEXT,

  -- Statut
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_org ON promo_codes(organization_id);

-- ==========================================
-- 13. RAPPELS DE TRANSITION
-- ==========================================
CREATE TABLE IF NOT EXISTS transition_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES org_users(id) ON DELETE CASCADE,

  reminder_type TEXT NOT NULL, -- 'j-7', 'j-3', 'j-1', 'j0'
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Email
  email_sent BOOLEAN DEFAULT false,
  email_opened_at TIMESTAMPTZ,

  -- Push
  push_sent BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transition_reminders_user ON transition_reminders(user_id);

-- ==========================================
-- 14. HISTORIQUE MOOD
-- ==========================================
CREATE TABLE IF NOT EXISTS mood_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES org_users(id) ON DELETE CASCADE,

  mood TEXT NOT NULL, -- emoji
  note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_history_user ON mood_history(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_history_created ON mood_history(created_at DESC);

-- ==========================================
-- 15. VICTOIRES / WINS
-- ==========================================
CREATE TABLE IF NOT EXISTS client_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES org_users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'milestone', 'client', 'revenue', 'visibility', 'personal'

  -- Celebre par la coach?
  celebrated_by UUID REFERENCES org_users(id),
  celebrated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_wins_user ON client_wins(user_id);
CREATE INDEX IF NOT EXISTS idx_client_wins_org ON client_wins(organization_id);

-- ==========================================
-- FONCTIONS UTILITAIRES
-- ==========================================

-- Fonction pour obtenir le contexte d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_context(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_context JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user', jsonb_build_object(
      'id', ou.id,
      'first_name', ou.first_name,
      'role', ou.role,
      'current_day', ou.current_day
    ),
    'organization', jsonb_build_object(
      'id', o.id,
      'name', o.name,
      'app_name', o.app_name,
      'primary_color', o.primary_color
    ),
    'cohort', CASE WHEN c.id IS NOT NULL THEN jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'start_date', c.start_date
    ) ELSE NULL END
  ) INTO v_context
  FROM org_users ou
  LEFT JOIN organizations o ON o.id = ou.organization_id
  LEFT JOIN cohorts c ON c.id = ou.cohort_id
  WHERE ou.user_id = p_user_id
  LIMIT 1;

  RETURN v_context;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre a jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer le trigger aux tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['organizations', 'cohorts', 'org_users', 'org_frameworks', 'org_prompts', 'daily_messages'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END;
$$;

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Activer RLS sur toutes les tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_alerts ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs voient leur organisation
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM org_users WHERE user_id = auth.uid())
  );

-- Politique: Les admins peuvent tout modifier dans leur org
CREATE POLICY "Admins can manage their organization" ON organizations
  FOR ALL USING (
    id IN (SELECT organization_id FROM org_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Politique: Les utilisateurs voient les cohortes de leur org
CREATE POLICY "Users can view cohorts in their org" ON cohorts
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM org_users WHERE user_id = auth.uid())
  );

-- Politique: Les admins peuvent gerer les cohortes
CREATE POLICY "Admins can manage cohorts" ON cohorts
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM org_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Politique: Les utilisateurs se voient eux-memes
CREATE POLICY "Users can view themselves" ON org_users
  FOR SELECT USING (user_id = auth.uid());

-- Politique: Les coachs voient leurs clientes
CREATE POLICY "Coaches can view their clients" ON org_users
  FOR SELECT USING (
    coach_id IN (SELECT id FROM org_users WHERE user_id = auth.uid() AND role = 'coach')
  );

-- Politique: Les admins voient tous les utilisateurs de leur org
CREATE POLICY "Admins can view all users in org" ON org_users
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM org_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Politique: Les frameworks sont visibles par tous dans l'org
CREATE POLICY "Users can view org frameworks" ON org_frameworks
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM org_users WHERE user_id = auth.uid())
  );

-- Politique: Seuls les admins modifient les frameworks
CREATE POLICY "Admins can manage frameworks" ON org_frameworks
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM org_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Politique similaire pour prompts
CREATE POLICY "Users can view org prompts" ON org_prompts
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM org_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage prompts" ON org_prompts
  FOR ALL USING (
    organization_id IN (SELECT organization_id FROM org_users WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Politique: Les messages envoyes sont visibles par le destinataire
CREATE POLICY "Recipients can view their messages" ON sent_messages
  FOR SELECT USING (
    recipient_id IN (SELECT id FROM org_users WHERE user_id = auth.uid())
  );

-- Politique: Chat entre coach et cliente
CREATE POLICY "Users can view their chat messages" ON chat_messages
  FOR SELECT USING (
    sender_id IN (SELECT id FROM org_users WHERE user_id = auth.uid())
    OR recipient_id IN (SELECT id FROM org_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can send chat messages" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id IN (SELECT id FROM org_users WHERE user_id = auth.uid())
  );

-- Politique: Metriques visibles par l'utilisateur et son coach
CREATE POLICY "Users can view their metrics" ON client_metrics
  FOR SELECT USING (
    user_id IN (SELECT id FROM org_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Coaches can view client metrics" ON client_metrics
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM org_users
      WHERE coach_id IN (SELECT id FROM org_users WHERE user_id = auth.uid() AND role = 'coach')
    )
  );

-- Politique: Alertes visibles par le coach
CREATE POLICY "Coaches can view their alerts" ON coach_alerts
  FOR SELECT USING (
    coach_id IN (SELECT id FROM org_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Coaches can manage their alerts" ON coach_alerts
  FOR UPDATE USING (
    coach_id IN (SELECT id FROM org_users WHERE user_id = auth.uid())
  );

-- ==========================================
-- DONNEES DE TEST (optionnel)
-- ==========================================

-- Creer une organisation de test "Nina Ramen"
-- INSERT INTO organizations (name, slug, app_name, primary_color, secondary_color, plan, max_coaches, max_clients)
-- VALUES ('Nina Ramen', 'nina-ramen', 'RamenTaFraise', '#FF6B6B', '#4ECDC4', 'bootcamp', 45, 150);

-- ==========================================
-- COLONNES SUPPLEMENTAIRES POUR LEMON SQUEEZY
-- ==========================================
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS subscription_starts_at TIMESTAMPTZ;
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id TEXT;
ALTER TABLE org_users ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id TEXT;

-- Ajouter notes aux transition_reminders
ALTER TABLE transition_reminders ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ajouter times_used aux promo_codes (alias pour current_uses)
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS times_used INT DEFAULT 0;

-- Ajouter lemonsqueezy_discount_code aux promo_codes
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS lemonsqueezy_discount_code TEXT;

-- ==========================================
-- FONCTION POUR INCREMENTER LES CODES PROMO
-- ==========================================
CREATE OR REPLACE FUNCTION increment_promo_usage(p_code TEXT)
RETURNS INT AS $$
DECLARE
  v_new_count INT;
BEGIN
  UPDATE promo_codes
  SET times_used = COALESCE(times_used, 0) + 1,
      current_uses = COALESCE(current_uses, 0) + 1
  WHERE code = p_code
  RETURNING times_used INTO v_new_count;

  RETURN COALESCE(v_new_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- CODES PROMO DE TEST POUR BOOTCAMPS
-- ==========================================
INSERT INTO promo_codes (code, discount_percent, is_active) VALUES
  ('NINA20', 20, true),
  ('ALINE15', 15, true),
  ('BOOTCAMP10', 10, true),
  ('ALUMNI35', 35, true)
ON CONFLICT (code) DO NOTHING;
