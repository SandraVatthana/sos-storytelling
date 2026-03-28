# Déploiement du Worker Inbox

## 1. Créer la table Supabase

Exécute ce SQL dans Supabase (SQL Editor) :

```sql
CREATE TABLE IF NOT EXISTS gmail_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Index pour les requêtes rapides
CREATE INDEX idx_gmail_connections_user_id ON gmail_connections(user_id);
CREATE INDEX idx_gmail_connections_active ON gmail_connections(user_id, is_active);

-- RLS (Row Level Security)
ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;

-- Policy: les users peuvent voir leurs propres connexions
CREATE POLICY "Users can view own gmail connections"
  ON gmail_connections FOR SELECT
  USING (auth.uid() = user_id);
```

## 2. Déployer le Worker

```bash
cd cloudflare-worker-inbox
npx wrangler deploy
```

## 3. Configurer les variables d'environnement

Dans le dashboard Cloudflare (Workers > sos-inbox-worker > Settings > Variables) :

| Variable | Valeur |
|----------|--------|
| GMAIL_CLIENT_ID | (ton Client ID Google OAuth) |
| GMAIL_CLIENT_SECRET | (ton Client Secret Google OAuth) |
| SUPABASE_URL | https://pyxidmnckpnrargygwnf.supabase.co |
| SUPABASE_SERVICE_KEY | (ta clé service_role de Supabase) |

**Important** : Utilise la clé `service_role` de Supabase (pas la clé `anon`) pour que le Worker puisse écrire dans la table.

## 4. Tester

1. Va sur https://sosstorytelling.fr/app.html
2. Ouvre l'Inbox Intelligente
3. Connecte ton Gmail
4. Vérifie que la connexion est enregistrée dans Supabase
