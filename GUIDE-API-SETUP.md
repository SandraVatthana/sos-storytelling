# 🚀 Guide de Configuration API - Voyage Créatif

## 🎯 Problème résolu

Les cases du jeu ne fonctionnaient pas car l'API Claude nécessite une clé API pour fonctionner. Ce guide te montre 2 solutions.

---

## 📋 Solution 1 : Clé API directe (TEST RAPIDE)

### ⚠️ ATTENTION
Cette solution expose ta clé API dans le code JavaScript. **À utiliser UNIQUEMENT pour tester**, pas en production !

### Étapes

1. **Obtenir une clé API Anthropic**
   - Va sur https://console.anthropic.com/
   - Crée un compte si nécessaire
   - Génère une clé API dans "API Keys"
   - Copie la clé (format: `sk-ant-...`)

2. **Configurer le jeu**
   - Ouvre le fichier `game-logic.js`
   - Trouve les lignes 4-14 (configuration API)
   - Remplace `"VOTRE_CLE_API_ICI"` par ta vraie clé API
   - Assure-toi que `useWorker: false`

```javascript
const API_CONFIG = {
    apiKey: "sk-ant-api03-...", // TA CLÉ ICI
    workerUrl: null,
    useWorker: false // Doit être false
};
```

3. **Tester**
   - Ouvre `index.html` dans un navigateur
   - Lance le dé
   - Clique sur une case
   - Clique sur "Demander à Tithot"
   - La réponse devrait s'afficher !

### ✅ Avantages
- Rapide à mettre en place
- Parfait pour tester

### ❌ Inconvénients
- **Clé API visible** dans le code source
- Risque de vol de clé
- Pas adapté pour un site public

---

## 🛡️ Solution 2 : Cloudflare Worker (PRODUCTION)

### ✨ Pourquoi c'est mieux
- Clé API **sécurisée** côté serveur
- Gratuit jusqu'à 100 000 requêtes/jour
- Rapide (edge computing)
- Professionnel

### Prérequis
- Un compte Cloudflare (gratuit)
- Node.js installé (pour wrangler CLI)

### Étapes

#### 1. Installer Wrangler CLI

```bash
npm install -g wrangler
```

#### 2. Login Cloudflare

```bash
wrangler login
```

Ça va ouvrir un navigateur pour autoriser l'accès.

#### 3. Ajouter ta clé API en secret

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Quand demandé, colle ta clé API Anthropic et appuie sur Entrée.

#### 4. Déployer le Worker

```bash
wrangler deploy
```

Tu verras un message comme :
```
Published voyage-creatif-api (1.23 sec)
  https://voyage-creatif-api.VOTRE-USERNAME.workers.dev
```

**Copie cette URL !**

#### 5. Configurer le jeu

Ouvre `game-logic.js` et modifie :

```javascript
const API_CONFIG = {
    apiKey: "VOTRE_CLE_API_ICI", // Garde-le, mais ne sera pas utilisé
    workerUrl: "https://voyage-creatif-api.VOTRE-USERNAME.workers.dev", // TA URL ICI
    useWorker: true // IMPORTANT: mettre à true
};
```

#### 6. Tester

- Ouvre `index.html`
- Le jeu devrait maintenant utiliser ton Worker Cloudflare
- Ta clé API reste sécurisée !

### ✅ Avantages
- Clé API **100% sécurisée**
- Gratuit pour usage normal
- Rapide et fiable
- Prêt pour la production

### Configuration avancée (optionnel)

**Restreindre l'origine** (recommandé en production)

Modifie `cloudflare-worker.js` ligne 13 :

```javascript
'Access-Control-Allow-Origin': 'https://ton-domaine.com', // Au lieu de '*'
```

---

## 🎨 Héberger sur Cloudflare Pages

Une fois le Worker configuré, tu peux aussi héberger le jeu sur Cloudflare Pages :

1. **Créer un repository GitHub** avec tes fichiers
2. **Aller sur Cloudflare Dashboard** → Pages
3. **Connect to Git** → Sélectionner ton repo
4. **Build settings** :
   - Framework preset: None
   - Build command: (laisser vide)
   - Build output directory: `/`
5. **Deploy**

Cloudflare Pages est **gratuit** et inclut :
- HTTPS automatique
- CDN mondial
- Déploiements automatiques à chaque push Git

---

## 📊 Tableau comparatif

| Critère | Clé API directe | Cloudflare Worker |
|---------|----------------|-------------------|
| Sécurité | ❌ Faible | ✅ Excellente |
| Coût | Gratuit | Gratuit |
| Rapidité setup | ⚡ 2 min | 🔧 10 min |
| Usage | Test seulement | Production |
| Complexité | Simple | Moyenne |

---

## 🐛 Dépannage

### Erreur: "Clé API non configurée"
→ Tu as oublié de remplacer `"VOTRE_CLE_API_ICI"` dans `game-logic.js`

### Erreur: "Erreur API: 401"
→ Ta clé API n'est pas valide. Vérifie-la sur console.anthropic.com

### Erreur: "Erreur API: 429"
→ Tu as dépassé la limite de requêtes. Attends quelques minutes.

### Le Worker ne fonctionne pas
→ Vérifie que :
1. `ANTHROPIC_API_KEY` est bien configuré (`wrangler secret list`)
2. `workerUrl` dans `game-logic.js` est correct
3. `useWorker: true` dans `game-logic.js`

### CORS Error
→ C'est normal si tu ouvres `index.html` directement (file://).
Solutions :
- Utilise un serveur local : `python -m http.server 8000`
- Ou héberge sur Cloudflare Pages

---

## 💰 Coûts estimés

### API Claude
- $3 par million de tokens input
- $15 par million de tokens output
- Une réponse moyenne = ~$0.01

**Exemple :** 100 utilisateurs × 10 questions = 1000 appels ≈ **$10**

### Cloudflare
- Worker : **Gratuit** jusqu'à 100 000 req/jour
- Pages : **Gratuit** (illimité)

**Total pour 1000 utilisateurs/mois ≈ $100-200**

---

## 🎯 Recommandation finale

**Pour tester** → Solution 1 (clé API directe)  
**Pour lancer** → Solution 2 (Cloudflare Worker) + Cloudflare Pages

---

## 📞 Support

Si tu as des questions, consulte :
- [Documentation Anthropic](https://docs.anthropic.com/)
- [Documentation Cloudflare Workers](https://developers.cloudflare.com/workers/)

---

**Fait avec ❤️ par Claude**
Version : 2.1.1 - API Fix
Date : 23 Novembre 2025
