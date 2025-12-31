# Deploiement du Worker Missions Multi-Agents

## 1. Configuration des Variables d'Environnement

Dans le Dashboard Cloudflare Workers, configure ces secrets :

```
SUPABASE_URL = https://xxx.supabase.co
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ANTHROPIC_API_KEY = sk-ant-...
PERPLEXITY_API_KEY = pplx-... (optionnel, fallback vers Claude si absent)
BREVO_API_KEY = xkeysib-... (pour l'envoi d'emails)
```

## 2. Deploiement

```bash
cd cloudflare-worker-missions
npx wrangler deploy
```

## 3. Configuration Supabase

Exécute le fichier SQL `supabase-missions-tables.sql` dans l'éditeur SQL de Supabase pour créer :
- Table `missions` - Les missions principales
- Table `mission_tasks` - Les sous-tâches par agent
- Table `mission_outputs` - Les éléments générés (emails, posts, etc.)
- Table `mission_templates` - Templates de missions prédéfinis

## 4. Endpoints disponibles

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/missions/create` | POST | Créer une nouvelle mission |
| `/missions/execute` | POST | Lancer l'exécution d'une mission |
| `/missions/{id}/status` | GET | Obtenir le statut d'une mission |
| `/missions/approve` | POST | Approuver et lancer une mission |
| `/missions/cancel` | POST | Annuler une mission |
| `/missions/outputs/update` | POST | Modifier un output |
| `/missions/templates` | GET | Liste des templates disponibles |

## 5. Architecture Multi-Agents

```
🎯 ORCHESTRATEUR (Maestro)
├── 🔍 SCOUT (Recherche)
│   └── Perplexity API, recherche prospects
├── ✍️ WRITER (Rédaction)
│   └── Claude API, style cloné utilisateur
├── 📅 SCHEDULER (Planification)
│   └── Calcul dates, quotas, warm-up
├── 🛡️ GUARDIAN (Vérification)
│   └── Spam score, RGPD, blacklist
└── 📊 ANALYST (Reporting)
    └── Génération récapitulatifs
```

## 6. Types de missions supportées

- `email_sequence` - Séquence d'emails sur un sujet
- `prospection` - Campagne de prospection
- `monthly_content` - Calendrier de contenu mensuel
- `followup` - Relance de prospects froids
- `transformation` - Transformation de contenu (PDF → emails)
- `analysis` - Analyse de concurrence/tendances

## 7. URL du Worker

Après déploiement : `https://sos-missions-agent.xxx.workers.dev`

Mettre à jour `WORKER_URL` dans `missions-module.js` si nécessaire.
