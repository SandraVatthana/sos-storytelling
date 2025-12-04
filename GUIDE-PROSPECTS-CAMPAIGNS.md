# Guide: Module Prospects & Campagnes Email

## Vue d'ensemble

Ce module ajoute a SOS Storytelling :
- **Import de prospects** depuis CSV (Pharow, Apollo, Excel...)
- **Generation d'emails** personnalises avec l'IA + "Ma Voix"
- **Envoi via Brevo API** avec tracking automatique
- **Interface bilingue FR/EN**

---

## Fichiers crees

### Frontend (Public pour Netlify/)
| Fichier | Description |
|---------|-------------|
| `i18n.js` | Systeme d'internationalisation FR/EN |
| `prospects-module.js` | Module gestion des prospects + import CSV |
| `campaigns-module.js` | Module campagnes email + generation IA |
| `prospects.html` | Page principale Prospects & Campagnes |

### Backend (Cloudflare Worker)
| Fichier | Description |
|---------|-------------|
| `cloudflare-worker-v8.js` | Worker avec nouveaux endpoints API |

### Base de donnees (Supabase)
| Fichier | Description |
|---------|-------------|
| `supabase-prospects-tables.sql` | Tables prospects, campaigns, emails, events |

---

## Installation

### 1. Base de donnees Supabase

Executer le SQL dans la console Supabase :

```sql
-- Voir supabase-prospects-tables.sql
```

Tables creees :
- `prospects` - Liste des prospects
- `email_campaigns` - Campagnes email
- `campaign_emails` - Emails generes par campagne
- `email_events` - Logs des evenements Brevo (ouvertures, clics...)

### 2. Cloudflare Worker

Deployer `cloudflare-worker-v8.js` :

```bash
cd "C:\Users\sandr\OneDrive\Bureau\SOS STORYTELLING&PERSONAL BRANDING"
npx wrangler deploy cloudflare-worker-v8.js --name sos-storytelling-api
```

**Important :** Fusionner les handlers existants de v7 dans v8 (newsletters, visuals, etc.)

### 3. Variables d'environnement Cloudflare

S'assurer que ces variables sont configurees :
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `BREVO_API_KEY`

### 4. Webhook Brevo

Configurer dans Brevo > Parametres > Webhooks :
- URL : `https://sos-storytelling-api.tithot.workers.dev/webhook/brevo`
- Evenements : delivered, opened, clicked, bounced, unsubscribed

### 5. Deploiement Netlify

Les fichiers du dossier `Public pour Netlify/` sont automatiquement deployes.

---

## Utilisation

### Page Prospects

Accessible via : `https://votre-site.netlify.app/prospects.html`

#### Import CSV

1. Cliquer "Importer"
2. Glisser-deposer un fichier CSV (Pharow, Apollo, Excel...)
3. Le systeme detecte automatiquement les colonnes
4. Ajuster le mapping si necessaire
5. Previsualiser et confirmer

**Colonnes reconnues automatiquement :**
- Prenom, Nom, Email, Entreprise, Poste
- LinkedIn, Telephone, Site web
- Secteur, Ville, Effectif

#### Gestion des prospects

- Recherche par nom, email, entreprise
- Filtres par statut (nouveau, contacte, ouvert, repondu...)
- Selection multiple pour actions groupees
- Export CSV

### Campagnes Email

#### Creation d'une campagne

1. Cliquer "Nouvelle Campagne"
2. Remplir les infos :
   - Nom de la campagne
   - Objectif (pour l'IA)
   - Email expediteur
   - Langue (FR/EN)
   - Options "Ma Voix"

3. Selectionner les prospects
4. Generer les emails avec l'IA ou ecrire manuellement
5. Previsualiser chaque email
6. Envoyer

#### Generation IA

L'IA genere des emails :
- Personnalises pour chaque prospect
- Dans le style "Ma Voix" de l'utilisateur
- Adaptes culturellement (FR ou EN)
- Sans cliches ni phrases generiques

#### Tracking

Suivi automatique via webhooks Brevo :
- Emails envoyes
- Ouvertures
- Clics
- Reponses
- Bounces
- Desabonnements

---

## API Endpoints

### Prospects

```
GET    /api/prospects              - Lister les prospects
POST   /api/prospects              - Creer un prospect
POST   /api/prospects/import       - Import batch
GET    /api/prospects/stats        - Statistiques
GET    /api/prospects/:id          - Detail
PUT    /api/prospects/:id          - Modifier
DELETE /api/prospects/:id          - Supprimer
DELETE /api/prospects              - Suppression batch (body: {ids: []})
```

### Campagnes

```
GET    /api/campaigns              - Lister les campagnes
POST   /api/campaigns              - Creer une campagne
GET    /api/campaigns/stats        - Statistiques globales
GET    /api/campaigns/:id          - Detail
PUT    /api/campaigns/:id          - Modifier
DELETE /api/campaigns/:id          - Supprimer
GET    /api/campaigns/:id/emails   - Emails de la campagne
POST   /api/campaigns/:id/send     - Envoyer la campagne
POST   /api/campaigns/generate-email - Generer un email IA
POST   /api/campaigns/send-email   - Envoyer un email unique
```

### Webhooks

```
POST   /webhook/brevo              - Tracking Brevo
```

---

## Internationalisation

### Changer la langue

```javascript
// Via le toggle dans l'interface
// ou programmatiquement :
await I18N.setLanguage('en'); // ou 'fr'
```

### Utiliser les traductions

```javascript
// Dans le code JS
const text = t('prospects.title'); // "Mes Prospects" ou "My Prospects"

// Avec variables
const text = t('prospects.import.success', { count: 150 });
// "150 prospects importes avec succes !"
```

### Ajouter des traductions

Editer `i18n.js` > `I18N.translations.fr` et `I18N.translations.en`

---

## Structure des donnees

### Prospect

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "company": "Acme Inc",
  "job_title": "CEO",
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "phone": "+33612345678",
  "website": "https://acme.com",
  "sector": "Tech",
  "city": "Paris",
  "company_size": "50-100",
  "status": "new|contacted|opened|clicked|replied|converted|unsubscribed|bounced",
  "emails_sent": 0,
  "source": "csv_import|manual|pharow|apollo"
}
```

### Campagne

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "name": "Prospection Q1 2025",
  "goal": "Proposer mes services aux agences",
  "sender_email": "sandra@example.com",
  "sender_name": "Sandra",
  "language": "fr|en",
  "use_my_voice": true,
  "generate_unique_per_prospect": true,
  "status": "draft|sending|sent|paused",
  "total_prospects": 100,
  "emails_sent": 95,
  "emails_opened": 45,
  "emails_clicked": 12,
  "emails_replied": 5
}
```

---

## Evolutions futures (V2/V3)

| Feature | Phase |
|---------|-------|
| Sequences automatisees (J+0, J+3, J+7) | V2 |
| Condition "si pas de reponse" | V2 |
| A/B testing objets | V2 |
| Integration directe API Pharow | V2 |
| Integration directe API Apollo | V2 |
| Warm-up domaine automatique | V3 |
| Multi-expediteurs | V3 |

---

## Support

En cas de probleme :
1. Verifier la console navigateur (F12)
2. Verifier les logs Cloudflare Workers
3. Verifier les webhooks Brevo

---

*Module cree pour SOS Storytelling - Decembre 2024*
