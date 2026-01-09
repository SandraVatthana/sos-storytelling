# Déploiement du Worker SOS Audit Agent

## Prérequis
- Compte Cloudflare avec Workers activé
- Wrangler CLI installé (`npm install -g wrangler`)
- Connecté à Cloudflare (`wrangler login`)

## Étapes de déploiement

### 1. Déployer le Worker
```bash
cd cloudflare-worker-audit
wrangler deploy
```

### 2. Configurer les secrets dans Cloudflare Dashboard

Aller sur https://dash.cloudflare.com > Workers > sos-audit-agent > Settings > Variables

Ajouter ces secrets:

| Nom | Description |
|-----|-------------|
| `supabase_url` | URL de votre projet Supabase (ex: https://xxx.supabase.co) |
| `supabase_key` | Clé SERVICE_ROLE de Supabase (~200 caractères, commence par eyJ...) |
| `anthropic_key` | Clé API Anthropic (sk-ant-...) |
| `apify_key` | (Optionnel) Clé API Apify pour le scraping réel |

### 3. Créer les tables Supabase

Exécuter ce SQL dans Supabase SQL Editor:

```sql
-- Table des audits
CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'linkedin')),
    profile_url TEXT NOT NULL,
    profile_username TEXT,
    scraped_data JSONB,
    business_context JSONB,
    audit_result JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scraping', 'analyzing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Table des posts générés
CREATE TABLE IF NOT EXISTS audit_generated_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID REFERENCES audits(id) ON DELETE CASCADE,
    week_number INTEGER,
    post_type TEXT,
    hook TEXT,
    content TEXT,
    hashtags TEXT[],
    visual_suggestion TEXT,
    best_posting_time TEXT,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audit_posts_audit_id ON audit_generated_posts(audit_id);

-- RLS policies
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_generated_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audits" ON audits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audits" ON audits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access audits" ON audits
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own audit posts" ON audit_generated_posts
    FOR SELECT USING (
        audit_id IN (SELECT id FROM audits WHERE user_id = auth.uid())
    );

CREATE POLICY "Service role full access posts" ON audit_generated_posts
    FOR ALL USING (auth.role() = 'service_role');
```

### 4. Tester le Worker

```bash
# Health check
curl https://sos-audit-agent.sandra-devonssay.workers.dev/health

# Debug (vérifier les secrets)
curl https://sos-audit-agent.sandra-devonssay.workers.dev/debug
```

## Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /health | Health check |
| GET | /debug | Vérifier la configuration |
| POST | /audits/create | Créer un nouvel audit |
| GET | /audits/:id | Récupérer un audit |
| POST | /audits/:id/generate-more | Générer plus de posts |

## Notes

- Sans clé Apify, le scraping utilise des données mock
- L'analyse prend environ 30-60 secondes
- Les posts sont générés automatiquement (8 posts pour 4 semaines)
