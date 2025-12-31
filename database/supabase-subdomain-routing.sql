-- ============================================
-- SOS STORYTELLING - SOUS-DOMAINES WHITE LABEL
-- Migration pour le routage par sous-domaine
-- ============================================

-- ==========================================
-- 1. AJOUTER COLONNES SUBDOMAIN/CUSTOM_DOMAIN
-- ==========================================

-- Sous-domaine (ex: "ramentafraise" pour ramentafraise.sos-storytelling.app)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;

-- Domaine personnalise (ex: "app.ninaramen.com")
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS custom_domain TEXT UNIQUE;

-- Index pour recherche rapide par sous-domaine
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain ON organizations(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_custom_domain ON organizations(custom_domain) WHERE custom_domain IS NOT NULL;

-- ==========================================
-- 2. METTRE A JOUR L'ORG PAR DEFAUT
-- ==========================================

-- L'organisation SOS Storytelling (B2C) utilise le sous-domaine "app"
UPDATE organizations
SET subdomain = 'app'
WHERE slug = 'sos-storytelling' AND subdomain IS NULL;

-- ==========================================
-- 3. FONCTION POUR TROUVER ORG PAR DOMAINE
-- ==========================================

CREATE OR REPLACE FUNCTION get_organization_by_domain(p_domain TEXT)
RETURNS JSONB AS $$
DECLARE
  v_org JSONB;
  v_subdomain TEXT;
BEGIN
  -- Essayer d'abord avec le domaine personnalise complet
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'subdomain', subdomain,
    'app_name', app_name,
    'logo_url', logo_url,
    'favicon_url', favicon_url,
    'primary_color', primary_color,
    'secondary_color', secondary_color,
    'accent_color', accent_color,
    'loading_message', loading_message,
    'loading_lottie_url', loading_lottie_url,
    'welcome_message', welcome_message,
    'support_email', support_email
  ) INTO v_org
  FROM organizations
  WHERE custom_domain = p_domain;

  IF v_org IS NOT NULL THEN
    RETURN v_org;
  END IF;

  -- Sinon, extraire le sous-domaine (premiere partie avant le premier point)
  v_subdomain := split_part(p_domain, '.', 1);

  -- Chercher par sous-domaine
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'slug', slug,
    'subdomain', subdomain,
    'app_name', app_name,
    'logo_url', logo_url,
    'favicon_url', favicon_url,
    'primary_color', primary_color,
    'secondary_color', secondary_color,
    'accent_color', accent_color,
    'loading_message', loading_message,
    'loading_lottie_url', loading_lottie_url,
    'welcome_message', welcome_message,
    'support_email', support_email
  ) INTO v_org
  FROM organizations
  WHERE subdomain = v_subdomain;

  RETURN v_org;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 4. EXEMPLES D'ORGANISATIONS WHITE LABEL
-- ==========================================

-- Nina Ramen - RamenTaFraise
INSERT INTO organizations (
  name,
  slug,
  subdomain,
  app_name,
  primary_color,
  secondary_color,
  accent_color,
  loading_message,
  plan,
  max_coaches,
  max_clients
) VALUES (
  'Nina Ramen',
  'nina-ramen',
  'ramentafraise',
  'RamenTaFraise',
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  'Nina reflechit...',
  'bootcamp',
  45,
  150
) ON CONFLICT (slug) DO UPDATE SET
  subdomain = EXCLUDED.subdomain,
  loading_message = EXCLUDED.loading_message;

-- Aline Bartoli - B.Academie
INSERT INTO organizations (
  name,
  slug,
  subdomain,
  app_name,
  primary_color,
  secondary_color,
  accent_color,
  loading_message,
  plan,
  max_coaches,
  max_clients
) VALUES (
  'Aline Bartoli',
  'aline-bartoli',
  'bacademie',
  'B.Academie',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  'L''IA B.Academie reflechit...',
  'bootcamp',
  45,
  150
) ON CONFLICT (slug) DO UPDATE SET
  subdomain = EXCLUDED.subdomain,
  loading_message = EXCLUDED.loading_message;

-- ==========================================
-- 5. RLS POLICY POUR ISOLATION PAR ORG
-- ==========================================

-- Les utilisateurs ne voient QUE les donnees de leur organisation
-- (Les policies existantes filtrent deja par organization_id via org_users)

-- Ajouter une policy pour permettre la lecture publique des infos d'org (pour le loader)
DROP POLICY IF EXISTS "Public can view basic org info" ON organizations;
CREATE POLICY "Public can view basic org info" ON organizations
  FOR SELECT USING (true);

-- ==========================================
-- 6. VERIFICATION DES SOUS-DOMAINES
-- ==========================================

-- Fonction pour valider un sous-domaine
CREATE OR REPLACE FUNCTION is_valid_subdomain(p_subdomain TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Doit etre entre 3 et 63 caracteres
  IF LENGTH(p_subdomain) < 3 OR LENGTH(p_subdomain) > 63 THEN
    RETURN FALSE;
  END IF;

  -- Doit contenir uniquement des lettres minuscules, chiffres et tirets
  IF p_subdomain !~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' THEN
    RETURN FALSE;
  END IF;

  -- Ne doit pas contenir de double tiret
  IF p_subdomain LIKE '%--%' THEN
    RETURN FALSE;
  END IF;

  -- Sous-domaines reserves
  IF p_subdomain IN ('www', 'api', 'admin', 'mail', 'smtp', 'ftp', 'ns1', 'ns2', 'app') THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Contrainte CHECK sur subdomain
-- Note: Executer separement car peut echouer si subdomain existants invalides
-- ALTER TABLE organizations ADD CONSTRAINT check_valid_subdomain
--   CHECK (subdomain IS NULL OR is_valid_subdomain(subdomain));
