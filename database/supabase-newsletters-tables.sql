-- =====================================================
-- SUPABASE SCHEMA: MODULE NEWSLETTERS QUI CONVERTISSENT
-- SOS Storytelling & Personal Branding
-- =====================================================

-- =====================================================
-- TABLE: newsletters (newsletters sauvegardées)
-- =====================================================
CREATE TABLE IF NOT EXISTS newsletters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL, -- Mode Agency

    -- Infos de base
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Type de newsletter
    newsletter_type VARCHAR(50) NOT NULL CHECK (newsletter_type IN (
        'launch',           -- Lancement produit/service
        'nurturing',        -- Nurturing (valeur pure)
        'reengagement',     -- Réengagement inactifs
        'promo',            -- Promo/vente flash
        'storytelling',     -- Storytelling personnel
        'event'             -- Annonce événement
    )),

    -- Structure copywriting
    structure VARCHAR(50) NOT NULL CHECK (structure IN (
        'aida',             -- Attention, Intérêt, Désir, Action
        'pas',              -- Problème, Agitation, Solution
        'hook_story_offer', -- Hook + Story + Offer
        'bab',              -- Before/After/Bridge
        'obi'               -- One Big Idea
    )),

    -- Personnalisation voix
    voice_id UUID,  -- Référence vers profil MA VOIX
    custom_voice_description TEXT, -- Description custom si pas de voice_id
    tone VARCHAR(50) CHECK (tone IN (
        'warm',         -- Chaleureux
        'direct',       -- Direct
        'inspiring',    -- Inspirant
        'quirky',       -- Décalé
        'expert',       -- Expert
        'friendly',     -- Amical
        'professional', -- Professionnel
        'storyteller'   -- Conteur
    )),

    -- Mode séquence
    is_sequence BOOLEAN DEFAULT false,
    sequence_count INT DEFAULT 1 CHECK (sequence_count >= 1 AND sequence_count <= 10),

    -- Inputs utilisateur
    objective TEXT NOT NULL,
    product_service TEXT,
    target_audience TEXT NOT NULL,
    cta_type VARCHAR(50) CHECK (cta_type IN (
        'click_link',   -- Clic sur lien
        'reply',        -- Répondre à l'email
        'purchase',     -- Acheter
        'register',     -- S'inscrire
        'download',     -- Télécharger
        'book_call',    -- Réserver un appel
        'other'         -- Autre
    )),
    cta_text VARCHAR(255),
    cta_url TEXT,
    anecdote TEXT, -- Optionnel
    additional_context TEXT,

    -- Métadonnées
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'edited', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_newsletters_user_id ON newsletters(user_id);
CREATE INDEX idx_newsletters_client_id ON newsletters(client_id);
CREATE INDEX idx_newsletters_type ON newsletters(newsletter_type);
CREATE INDEX idx_newsletters_created_at ON newsletters(created_at DESC);

-- =====================================================
-- TABLE: newsletter_emails (emails générés)
-- =====================================================
CREATE TABLE IF NOT EXISTS newsletter_emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,

    -- Position dans la séquence (1 pour email unique)
    sequence_position INT NOT NULL DEFAULT 1,
    sequence_role VARCHAR(50) CHECK (sequence_role IN (
        'single',       -- Email unique
        'teasing',      -- Teasing (séquence)
        'value',        -- Valeur (séquence)
        'offer',        -- Offre (séquence)
        'urgency',      -- Urgence (séquence)
        'last_call'     -- Dernier rappel (séquence)
    )),

    -- Contenu généré
    subject_lines JSONB DEFAULT '[]'::jsonb, -- 3 propositions d'objet
    selected_subject VARCHAR(255),
    preview_text VARCHAR(255),
    body_content TEXT,
    cta_formatted TEXT,

    -- Versions
    version INT DEFAULT 1,
    previous_versions JSONB DEFAULT '[]'::jsonb, -- Historique des régénérations

    -- Ajustements
    tone_adjustments TEXT, -- Notes d'ajustement de ton
    is_edited BOOLEAN DEFAULT false,

    -- Métadonnées
    generated_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_newsletter_emails_newsletter_id ON newsletter_emails(newsletter_id);
CREATE INDEX idx_newsletter_emails_sequence ON newsletter_emails(newsletter_id, sequence_position);

-- =====================================================
-- TABLE: newsletter_templates (templates sauvegardés)
-- =====================================================
CREATE TABLE IF NOT EXISTS newsletter_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Configuration sauvegardée
    newsletter_type VARCHAR(50) NOT NULL,
    structure VARCHAR(50) NOT NULL,
    voice_id UUID,
    tone VARCHAR(50),
    target_audience TEXT,
    cta_type VARCHAR(50),

    -- Utilisation
    use_count INT DEFAULT 0,
    last_used_at TIMESTAMPTZ,

    -- Métadonnées
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_newsletter_templates_user_id ON newsletter_templates(user_id);
CREATE INDEX idx_newsletter_templates_client_id ON newsletter_templates(client_id);

-- =====================================================
-- TABLE: clients (Mode Agency - si pas existante)
-- =====================================================
-- Note: Cette table peut déjà exister. Vérifier avant d'exécuter.
CREATE TABLE IF NOT EXISTS clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    industry VARCHAR(100),

    -- Profil voix du client
    voice_description TEXT,
    tone VARCHAR(50),
    brand_keywords TEXT[], -- Mots-clés de marque

    -- Contact
    email VARCHAR(255),
    website VARCHAR(500),

    -- Contexte business
    target_audience TEXT,
    main_products TEXT,
    unique_value TEXT,

    -- Métadonnées
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_is_active ON clients(is_active);

-- =====================================================
-- FONCTIONS UTILITAIRES
-- =====================================================

-- Fonction pour incrémenter le compteur d'utilisation des templates
CREATE OR REPLACE FUNCTION increment_template_usage(template_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE newsletter_templates
    SET use_count = use_count + 1,
        last_used_at = NOW()
    WHERE id = template_id;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les stats newsletters d'un utilisateur
CREATE OR REPLACE FUNCTION get_user_newsletter_stats(p_user_id UUID)
RETURNS TABLE (
    total_newsletters BIGINT,
    newsletters_this_month BIGINT,
    total_sequences BIGINT,
    favorite_type VARCHAR,
    favorite_structure VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as total_newsletters,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::BIGINT as newsletters_this_month,
        COUNT(*) FILTER (WHERE is_sequence = true)::BIGINT as total_sequences,
        (SELECT newsletter_type FROM newsletters WHERE user_id = p_user_id
         GROUP BY newsletter_type ORDER BY COUNT(*) DESC LIMIT 1) as favorite_type,
        (SELECT structure FROM newsletters WHERE user_id = p_user_id
         GROUP BY structure ORDER BY COUNT(*) DESC LIMIT 1) as favorite_structure
    FROM newsletters
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue: Newsletters récentes avec infos client
CREATE OR REPLACE VIEW newsletters_with_client AS
SELECT
    n.*,
    c.name as client_name,
    c.company as client_company,
    (SELECT COUNT(*) FROM newsletter_emails WHERE newsletter_id = n.id) as email_count
FROM newsletters n
LEFT JOIN clients c ON n.client_id = c.id
ORDER BY n.created_at DESC;

-- Vue: Templates populaires
CREATE OR REPLACE VIEW popular_templates AS
SELECT
    t.*,
    c.name as client_name
FROM newsletter_templates t
LEFT JOIN clients c ON t.client_id = c.id
ORDER BY t.use_count DESC, t.last_used_at DESC;

-- =====================================================
-- POLITIQUES RLS (Row Level Security)
-- =====================================================

-- Activer RLS sur toutes les tables
ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Politique: Les utilisateurs ne voient que leurs propres newsletters
CREATE POLICY "Users can view own newsletters" ON newsletters
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own newsletters" ON newsletters
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own newsletters" ON newsletters
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own newsletters" ON newsletters
    FOR DELETE USING (auth.uid() = user_id);

-- Politique: Emails des newsletters de l'utilisateur
CREATE POLICY "Users can view own newsletter emails" ON newsletter_emails
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM newsletters WHERE id = newsletter_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can insert own newsletter emails" ON newsletter_emails
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM newsletters WHERE id = newsletter_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can update own newsletter emails" ON newsletter_emails
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM newsletters WHERE id = newsletter_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can delete own newsletter emails" ON newsletter_emails
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM newsletters WHERE id = newsletter_id AND user_id = auth.uid())
    );

-- Politique: Templates
CREATE POLICY "Users can view own templates" ON newsletter_templates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates" ON newsletter_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON newsletter_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON newsletter_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Politique: Clients
CREATE POLICY "Users can view own clients" ON clients
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own clients" ON clients
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients" ON clients
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" ON clients
    FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- DONNÉES DE DÉMO (optionnel, à commenter en prod)
-- =====================================================

/*
-- Exemple d'insertion pour test
INSERT INTO newsletters (user_id, name, newsletter_type, structure, tone, objective, target_audience, cta_type)
VALUES (
    'votre-user-id-ici',
    'Newsletter Test Lancement',
    'launch',
    'aida',
    'inspiring',
    'Annoncer le lancement de ma nouvelle formation en ligne',
    'Entrepreneurs et freelances qui veulent développer leur personal branding',
    'click_link'
);
*/
