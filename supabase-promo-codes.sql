-- ============================================
-- SOS Storytelling - Ajout Codes Promo
-- ============================================

-- 1. Ajouter les colonnes manquantes si elles n'existent pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promo_codes' AND column_name = 'description') THEN
    ALTER TABLE promo_codes ADD COLUMN description TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promo_codes' AND column_name = 'created_by') THEN
    ALTER TABLE promo_codes ADD COLUMN created_by VARCHAR(255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promo_codes' AND column_name = 'current_uses') THEN
    ALTER TABLE promo_codes ADD COLUMN current_uses INT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promo_codes' AND column_name = 'valid_from') THEN
    ALTER TABLE promo_codes ADD COLUMN valid_from TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'promo_codes' AND column_name = 'valid_until') THEN
    ALTER TABLE promo_codes ADD COLUMN valid_until TIMESTAMPTZ;
  END IF;
END $$;

-- 2. Voir la structure actuelle de la table
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'promo_codes';

-- ============================================
-- INSÉRER LES CODES PROMO
-- ============================================

-- Code 1: 3 mois gratuits pour particuliers (plan Solo)
INSERT INTO promo_codes (code, plan_type, duration_days, max_uses, is_active)
VALUES ('SOLO3MOIS', 'solo', 90, 100, true)
ON CONFLICT (code) DO UPDATE SET
  plan_type = 'solo',
  duration_days = 90,
  max_uses = 100,
  is_active = true;

-- Mettre à jour la description si la colonne existe
UPDATE promo_codes SET description = '3 mois gratuits - Plan Solo' WHERE code = 'SOLO3MOIS';

-- Code 2: 6 mois gratuits pour l'agence 27degres
INSERT INTO promo_codes (code, plan_type, duration_days, max_uses, is_active)
VALUES ('27DEGRES6MOIS', 'agency_starter', 180, 10, true)
ON CONFLICT (code) DO UPDATE SET
  plan_type = 'agency_starter',
  duration_days = 180,
  max_uses = 10,
  is_active = true;

-- Mettre à jour la description
UPDATE promo_codes SET description = '6 mois gratuits - Agence 27degres' WHERE code = '27DEGRES6MOIS';

-- ============================================
-- VÉRIFICATION
-- ============================================

SELECT code, plan_type, duration_days, max_uses, is_active FROM promo_codes WHERE code IN ('SOLO3MOIS', '27DEGRES6MOIS');
