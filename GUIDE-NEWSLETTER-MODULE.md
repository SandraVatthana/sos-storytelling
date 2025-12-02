# Guide d'intégration - Module "Newsletters qui Convertissent"

## Vue d'ensemble

Le module Newsletter permet aux utilisateurs de :
- Générer des newsletters avec l'IA (6 types différents)
- Choisir parmi 5 structures copywriting (AIDA, PAS, Hook+Story+Offer, BAB, OBI)
- Personnaliser la voix (8 tons + profils MA VOIX)
- Créer des séquences d'emails (2-7 emails avec arc narratif)
- Gérer plusieurs clients (Mode Agency)
- Sauvegarder des templates réutilisables

---

## Fichiers créés

| Fichier | Description |
|---------|-------------|
| `cloudflare-worker-v6.js` | Worker avec tous les endpoints API Newsletter |
| `supabase-newsletters-tables.sql` | Schéma de base de données |
| `Public pour Netlify/newsletter-module.js` | Module JavaScript frontend |
| `Public pour Netlify/newsletter-styles.css` | Styles CSS du module |

---

## 1. Configuration Supabase

### Exécuter le script SQL

Dans la console Supabase (SQL Editor), exécute le fichier `supabase-newsletters-tables.sql`.

Cela créera :
- Table `newsletters` - Newsletters sauvegardées
- Table `newsletter_emails` - Emails générés
- Table `newsletter_templates` - Templates réutilisables
- Table `clients` - Gestion multi-clients (Mode Agency)
- Fonctions et vues utilitaires
- Politiques RLS (Row Level Security)

---

## 2. Déployer le Worker Cloudflare

### Option A : Remplacer l'existant
```bash
# Renommer cloudflare-worker-v6.js en index.js (ou wrangler.toml)
wrangler publish
```

### Option B : Tester d'abord
```bash
wrangler dev cloudflare-worker-v6.js
```

### Variables d'environnement requises (déjà configurées)
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

---

## 3. Intégration dans app.html

### Étape 1 : Ajouter les fichiers CSS et JS

Dans le `<head>` de app.html, ajoute :
```html
<link rel="stylesheet" href="newsletter-styles.css">
```

Avant la fermeture du `</body>`, ajoute :
```html
<script src="newsletter-module.js"></script>
```

### Étape 2 : Ajouter l'onglet Newsletter dans la navigation

Cherche la navigation existante (probablement dans un header ou tabs) et ajoute :
```html
<button class="nav-tab" onclick="showTab('newsletter')">
  📧 Newsletters
</button>
```

### Étape 3 : Ajouter le container du module

Dans le corps de l'app, ajoute une section :
```html
<section id="newsletter-tab" class="tab-content" style="display: none;">
  <div id="newsletter-module"></div>
</section>
```

### Étape 4 : Fonction de switch d'onglet

Si tu n'as pas déjà une fonction `showTab()`, ajoute :
```javascript
function showTab(tabName) {
  // Masquer tous les onglets
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });

  // Afficher l'onglet sélectionné
  const selectedTab = document.getElementById(tabName + '-tab');
  if (selectedTab) {
    selectedTab.style.display = 'block';
  }

  // Mettre à jour les boutons de nav
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // Initialiser le module Newsletter si c'est le premier affichage
  if (tabName === 'newsletter' && !window.newsletterModule) {
    initNewsletterModule();
  }
}
```

---

## 4. Endpoints API disponibles

### Génération
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/newsletters/generate` | Générer une newsletter unique |
| POST | `/api/newsletters/generate-sequence` | Générer une séquence d'emails |
| POST | `/api/newsletters/regenerate` | Régénérer avec ajustements |

### CRUD Newsletters
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/newsletters` | Lister les newsletters |
| POST | `/api/newsletters` | Sauvegarder une newsletter |
| GET | `/api/newsletters/:id` | Détail d'une newsletter |
| PUT | `/api/newsletters/:id` | Mettre à jour |
| DELETE | `/api/newsletters/:id` | Supprimer |

### Templates
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/newsletters/templates` | Lister les templates |
| POST | `/api/newsletters/templates` | Créer un template |
| DELETE | `/api/newsletters/templates/:id` | Supprimer |

### Clients (Mode Agency)
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/newsletters/clients` | Lister les clients |
| POST | `/api/newsletters/clients` | Créer un client |
| PUT | `/api/newsletters/clients/:id` | Mettre à jour |
| DELETE | `/api/newsletters/clients/:id` | Archiver |

### Métadonnées
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/newsletters/types` | Types de newsletters |
| GET | `/api/newsletters/structures` | Structures copywriting |
| GET | `/api/newsletters/tones` | Tons disponibles |
| GET | `/api/newsletters/stats` | Statistiques utilisateur |

---

## 5. Types de newsletters

| ID | Nom | Description |
|----|-----|-------------|
| `launch` | Lancement produit/service | Annonce d'un nouveau produit |
| `nurturing` | Nurturing | Créer la relation, apporter de la valeur |
| `reengagement` | Réengagement | Réactiver les abonnés inactifs |
| `promo` | Promo/Vente flash | Offre limitée, promotion |
| `storytelling` | Storytelling personnel | Coulisses, parcours, histoire |
| `event` | Annonce événement | Webinar, atelier, conférence |

---

## 6. Structures copywriting

| ID | Nom | Description |
|----|-----|-------------|
| `aida` | AIDA | Attention → Intérêt → Désir → Action |
| `pas` | PAS | Problème → Agitation → Solution |
| `hook_story_offer` | Hook + Story + Offer | Accroche → Histoire → Offre |
| `bab` | Before/After/Bridge | Avant → Après → Pont |
| `obi` | One Big Idea | Une seule idée puissante |

---

## 7. Mode Séquence

Quand l'utilisateur active le mode séquence, l'IA génère plusieurs emails avec un arc narratif cohérent :

### Arc selon le type de newsletter

| Type | Arc narratif |
|------|--------------|
| Launch | Teasing → Valeur → Offre → Urgence → Dernier rappel |
| Promo | Teasing → Offre → Valeur → Urgence → Dernier rappel |
| Event | Annonce → Valeur → Détails → Urgence → Dernier rappel |
| Nurturing | Valeur → Valeur → Valeur → Offre douce → Valeur |
| Reengagement | "Tu nous manques" → Valeur → Offre spéciale → Urgence |
| Storytelling | Teaser → Histoire P1 → Suite → Révélation → Offre |

---

## 8. Mode Agency

Le mode Agency permet de :
- Créer des profils clients
- Associer une voix/ton spécifique à chaque client
- Sauvegarder des templates par client
- Switcher facilement entre clients

### Activer le mode Agency

1. L'utilisateur doit avoir au moins 1 client créé
2. Le toggle "Mode Agence" apparaît automatiquement
3. Sélectionner un client charge automatiquement sa voix/ton

---

## 9. Format des réponses API

### Génération simple
```json
{
  "success": true,
  "newsletter": {
    "subjectLines": ["Objet 1", "Objet 2", "Objet 3"],
    "previewText": "Texte de preview...",
    "body": "Corps de l'email...",
    "cta": "Texte du bouton"
  },
  "usage": {
    "input_tokens": 500,
    "output_tokens": 800
  }
}
```

### Génération séquence
```json
{
  "success": true,
  "sequence": [
    {
      "position": 1,
      "role": "teasing",
      "subjectLines": ["..."],
      "previewText": "...",
      "body": "...",
      "cta": "...",
      "sendDelay": "J+0"
    },
    // ... autres emails
  ],
  "sequenceCount": 5,
  "arc": {
    "name": "Lancement",
    "flow": "Teasing → Valeur → Offre → Urgence → Dernier rappel"
  }
}
```

---

## 10. Personnalisation

### Modifier les couleurs

Dans `newsletter-styles.css`, modifie les variables CSS :
```css
:root {
  --nl-primary: linear-gradient(135deg, #667eea, #764ba2);
  --nl-secondary: linear-gradient(135deg, #f093fb, #f5576c);
  /* ... */
}
```

### Ajouter un nouveau type de newsletter

1. Dans `cloudflare-worker-v6.js`, fonction `handleGetNewsletterTypes()`
2. Ajouter le prompt correspondant dans `buildNewsletterSystemPrompt()`
3. Mettre à jour le schéma SQL si nécessaire

### Ajouter une nouvelle structure

1. Dans `cloudflare-worker-v6.js`, fonction `handleGetNewsletterStructures()`
2. Ajouter le guide dans `buildNewsletterSystemPrompt()`

---

## 11. Checklist de déploiement

- [ ] Exécuter le SQL dans Supabase
- [ ] Déployer le worker v6 sur Cloudflare
- [ ] Ajouter newsletter-styles.css dans app.html
- [ ] Ajouter newsletter-module.js dans app.html
- [ ] Ajouter l'onglet Newsletter dans la navigation
- [ ] Ajouter le container `<div id="newsletter-module"></div>`
- [ ] Tester la génération simple
- [ ] Tester le mode séquence
- [ ] Tester la sauvegarde
- [ ] Tester le mode Agency (si clients)

---

## Support

En cas de problème :
1. Vérifier la console navigateur pour les erreurs JS
2. Vérifier les logs Cloudflare Workers
3. Vérifier que les tables Supabase sont bien créées
4. Vérifier l'authentification (token Supabase)

---

**Module créé pour SOS Storytelling & Personal Branding**
