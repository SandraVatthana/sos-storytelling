# Agent Autopilot - Guide de Déploiement

## Prérequis

1. Un compte Cloudflare (gratuit suffit)
2. Wrangler CLI installé : `npm install -g wrangler`
3. Les clés API : Supabase, Brevo, Anthropic

## Étapes de déploiement

### 1. Se connecter à Cloudflare
```bash
wrangler login
```

### 2. Déployer le worker
```bash
cd cloudflare-worker-agent
wrangler deploy
```

### 3. Configurer les variables d'environnement

Allez sur le dashboard Cloudflare :
1. Workers & Pages
2. Cliquez sur `sos-autopilot-agent`
3. Settings > Variables
4. Ajoutez ces variables (mode "Encrypt") :

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | URL de votre projet Supabase (ex: https://xxx.supabase.co) |
| `SUPABASE_SERVICE_KEY` | Clé service role de Supabase (pas la clé anon!) |
| `BREVO_API_KEY` | Clé API Brevo v3 |
| `ANTHROPIC_API_KEY` | Clé API Anthropic (optionnel, pour amélioration IA) |

### 4. Vérifier le Cron Trigger

Dans le dashboard Cloudflare :
1. Workers & Pages > `sos-autopilot-agent`
2. Triggers > Cron Triggers
3. Vérifiez que `*/5 * * * *` est configuré

## Configuration Supabase

Exécutez le script SQL `agent-tables.sql` dans votre projet Supabase pour créer les tables nécessaires.

## Configuration Brevo (Webhooks)

Pour recevoir les événements (ouvertures, clics) :

1. Allez sur Brevo > Settings > Webhooks
2. Créez un webhook avec l'URL : `https://YOUR_SUPABASE_URL/functions/v1/brevo-webhook`
3. Sélectionnez les événements : `opened`, `clicked`, `soft_bounce`, `hard_bounce`, `unsubscribed`

## Test manuel

Vous pouvez tester le worker manuellement :

```bash
curl -X POST https://sos-autopilot-agent.YOUR_SUBDOMAIN.workers.dev/run
```

## Logs

Les logs sont disponibles dans :
1. Cloudflare Dashboard > Workers > Logs
2. Table `agent_logs` dans Supabase

## Coûts

- Cloudflare Workers : 100,000 requêtes/jour gratuites
- Cron : Gratuit
- Avec 5 min d'intervalle = ~288 exécutions/jour = gratuit !
