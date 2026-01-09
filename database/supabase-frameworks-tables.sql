-- ============================================
-- TABLE FRAMEWORKS PERSONNALISABLES
-- SOS Storytelling - Supabase
-- ============================================

-- Table principale des frameworks
CREATE TABLE IF NOT EXISTS frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID DEFAULT NULL, -- Pour mode agence : framework spécifique à un client

    -- Informations de base
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'script_call', 'dm', 'email', 'post', 'carousel', 'newsletter', 'other'
    description TEXT,

    -- Structure du framework (JSON array)
    steps JSONB NOT NULL DEFAULT '[]',
    -- Format: [{"order": 1, "name": "Accroche", "description": "Créer le lien"}, ...]

    -- Consignes globales
    global_instructions TEXT,

    -- Métadonnées
    is_template BOOLEAN DEFAULT FALSE, -- Framework template (pré-rempli)
    is_public BOOLEAN DEFAULT FALSE, -- Pour futur partage communautaire
    is_default BOOLEAN DEFAULT FALSE, -- Frameworks par défaut du système
    color VARCHAR(7) DEFAULT '#667eea', -- Couleur du tag
    icon VARCHAR(10) DEFAULT '📝', -- Emoji icône

    -- Stats
    usage_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_frameworks_user_id ON frameworks(user_id);
CREATE INDEX IF NOT EXISTS idx_frameworks_client_id ON frameworks(client_id);
CREATE INDEX IF NOT EXISTS idx_frameworks_type ON frameworks(type);
CREATE INDEX IF NOT EXISTS idx_frameworks_is_default ON frameworks(is_default);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_frameworks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS trigger_frameworks_updated_at ON frameworks;
CREATE TRIGGER trigger_frameworks_updated_at
    BEFORE UPDATE ON frameworks
    FOR EACH ROW
    EXECUTE FUNCTION update_frameworks_updated_at();

-- RLS (Row Level Security)
ALTER TABLE frameworks ENABLE ROW LEVEL SECURITY;

-- Politique : Les utilisateurs voient leurs frameworks + les frameworks par défaut
CREATE POLICY "Users can view own frameworks and defaults"
    ON frameworks FOR SELECT
    USING (
        user_id = auth.uid()
        OR is_default = TRUE
        OR is_public = TRUE
    );

-- Politique : Les utilisateurs peuvent créer leurs frameworks
CREATE POLICY "Users can create own frameworks"
    ON frameworks FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Politique : Les utilisateurs peuvent modifier leurs frameworks
CREATE POLICY "Users can update own frameworks"
    ON frameworks FOR UPDATE
    USING (user_id = auth.uid());

-- Politique : Les utilisateurs peuvent supprimer leurs frameworks
CREATE POLICY "Users can delete own frameworks"
    ON frameworks FOR DELETE
    USING (user_id = auth.uid());

-- ============================================
-- FRAMEWORKS PAR DÉFAUT (TEMPLATES)
-- ============================================

-- Insérer les frameworks templates par défaut
INSERT INTO frameworks (id, user_id, name, type, description, steps, global_instructions, is_default, is_template, color, icon) VALUES

-- AIDA (classique)
(
    gen_random_uuid(),
    NULL,
    'AIDA',
    'post',
    'Attention, Intérêt, Désir, Action - Le classique du copywriting',
    '[
        {"order": 1, "name": "Attention", "description": "Capturer l''attention avec une accroche forte, une stat choc ou une question provocante"},
        {"order": 2, "name": "Intérêt", "description": "Développer l''intérêt en présentant le problème ou l''opportunité"},
        {"order": 3, "name": "Désir", "description": "Créer le désir en montrant la solution et ses bénéfices"},
        {"order": 4, "name": "Action", "description": "Appel à l''action clair et spécifique"}
    ]',
    'Ton direct et persuasif. Chaque étape doit naturellement mener à la suivante.',
    TRUE,
    TRUE,
    '#f093fb',
    '🎯'
),

-- PAS (Problem-Agitate-Solve)
(
    gen_random_uuid(),
    NULL,
    'PAS',
    'post',
    'Problem, Agitate, Solve - Idéal pour les posts de vente',
    '[
        {"order": 1, "name": "Problème", "description": "Identifier clairement le problème que ressent l''audience"},
        {"order": 2, "name": "Agitation", "description": "Amplifier la douleur, montrer les conséquences de ne pas agir"},
        {"order": 3, "name": "Solution", "description": "Présenter la solution comme le remède évident"}
    ]',
    'Empathique mais direct. Le lecteur doit se reconnaître dans le problème.',
    TRUE,
    TRUE,
    '#ff6b6b',
    '🔥'
),

-- Script Call Découverte
(
    gen_random_uuid(),
    NULL,
    'Script Call Découverte',
    'script_call',
    'Structure pour un appel de qualification prospect en 15-20 min',
    '[
        {"order": 1, "name": "Accroche", "description": "Créer le lien, référence commune, briser la glace"},
        {"order": 2, "name": "Contexte", "description": "Comprendre sa situation actuelle, son rôle, son entreprise"},
        {"order": 3, "name": "Douleur", "description": "Identifier le problème principal, les frustrations"},
        {"order": 4, "name": "Impact", "description": "Quantifier les conséquences : temps perdu, argent, stress"},
        {"order": 5, "name": "Solution", "description": "Présenter l''offre comme réponse aux douleurs identifiées"},
        {"order": 6, "name": "Next Step", "description": "Proposer l''action suivante claire : démo, devis, essai"}
    ]',
    'Ton conversationnel et chaleureux. Poser des questions ouvertes. Écouter plus que parler.',
    TRUE,
    TRUE,
    '#11998e',
    '📞'
),

-- DM Premier Contact
(
    gen_random_uuid(),
    NULL,
    'DM Premier Contact',
    'dm',
    'Message de prospection LinkedIn ou Instagram',
    '[
        {"order": 1, "name": "Personnalisation", "description": "Référence spécifique au profil : post récent, parcours, intérêt commun"},
        {"order": 2, "name": "Valeur", "description": "Apporter une info utile, un conseil, une ressource gratuite"},
        {"order": 3, "name": "Transition", "description": "Lien naturel vers votre expertise ou offre"},
        {"order": 4, "name": "Question ouverte", "description": "Terminer par une question qui invite à répondre"}
    ]',
    'Court et naturel. Pas de pitch. Le but est d''ouvrir une conversation, pas de vendre.',
    TRUE,
    TRUE,
    '#667eea',
    '💬'
),

-- Email de Relance
(
    gen_random_uuid(),
    NULL,
    'Email de Relance',
    'email',
    'Relancer un prospect sans être insistant',
    '[
        {"order": 1, "name": "Rappel contexte", "description": "Rappeler brièvement l''échange précédent"},
        {"order": 2, "name": "Nouvelle valeur", "description": "Apporter un élément nouveau : article, cas client, actualité"},
        {"order": 3, "name": "Réassurance", "description": "Montrer que vous comprenez qu''ils sont occupés"},
        {"order": 4, "name": "CTA simple", "description": "Une seule action demandée, facile à faire"}
    ]',
    'Bref et respectueux. Pas de culpabilisation. Apporter de la valeur même dans la relance.',
    TRUE,
    TRUE,
    '#f5576c',
    '📧'
),

-- Post LinkedIn Storytelling
(
    gen_random_uuid(),
    NULL,
    'Post LinkedIn Storytelling',
    'post',
    'Raconter une histoire engageante sur LinkedIn',
    '[
        {"order": 1, "name": "Hook", "description": "Première ligne choc qui stoppe le scroll"},
        {"order": 2, "name": "Situation", "description": "Planter le décor : qui, quand, où"},
        {"order": 3, "name": "Tension", "description": "Le problème, l''obstacle, le moment de doute"},
        {"order": 4, "name": "Résolution", "description": "Comment vous avez surmonté, ce qui a changé"},
        {"order": 5, "name": "Leçon", "description": "L''apprentissage à retenir, applicable par le lecteur"}
    ]',
    'Authentique et vulnérable. Utiliser le ''je''. Des phrases courtes. Sauts de ligne.',
    TRUE,
    TRUE,
    '#0077b5',
    '📖'
),

-- SOAP (pour newsletters/articles)
(
    gen_random_uuid(),
    NULL,
    'SOAP',
    'newsletter',
    'Story, Offer, Action, PS - Parfait pour les newsletters',
    '[
        {"order": 1, "name": "Story", "description": "Une histoire personnelle ou un cas concret qui illustre le sujet"},
        {"order": 2, "name": "Offer", "description": "Ce que vous proposez comme solution ou ressource"},
        {"order": 3, "name": "Action", "description": "Ce que le lecteur doit faire maintenant"},
        {"order": 4, "name": "PS", "description": "Un bonus, une urgence, ou un rappel important"}
    ]',
    'Conversationnel comme si on écrivait à un ami. Le PS est souvent la partie la plus lue.',
    TRUE,
    TRUE,
    '#9c27b0',
    '📰'
),

-- Séquence Nurturing (3 emails)
(
    gen_random_uuid(),
    NULL,
    'Séquence Nurturing 3 Emails',
    'email',
    'Séquence de 3 emails pour réchauffer un lead froid',
    '[
        {"order": 1, "name": "Email 1 - Valeur pure", "description": "Donner sans rien demander : guide, checklist, conseil actionnable"},
        {"order": 2, "name": "Email 2 - Cas client", "description": "Montrer un résultat concret obtenu par un client similaire"},
        {"order": 3, "name": "Email 3 - Invitation", "description": "Proposer un échange : call, démo, audit gratuit"}
    ]',
    'Espacer de 2-3 jours entre chaque email. Personnaliser avec le prénom. Pas de pression.',
    TRUE,
    TRUE,
    '#ff9800',
    '📬'
);

-- ============================================
-- VÉRIFICATION
-- ============================================
-- SELECT * FROM frameworks WHERE is_default = TRUE;
