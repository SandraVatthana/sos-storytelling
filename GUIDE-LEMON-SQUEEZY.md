# 🍋 Guide de Configuration Lemon Squeezy pour SOS Storytelling

## Étape 1 : Créer ton compte Lemon Squeezy (5 min)

1. Va sur [lemonsqueezy.com](https://www.lemonsqueezy.com)
2. Clique **Start for free**
3. Crée ton compte avec ton email
4. Complète les infos de ton entreprise :
   - Nom : **My Inner Quest**
   - Type : Individual / Sole Proprietor
   - Pays : France
   - Adresse : ton adresse à Hossegor

---

## Étape 2 : Configurer le paiement (10 min)

1. Va dans **Settings** → **Payments**
2. Connecte ton compte Stripe ou utilise Lemon Squeezy Payments
3. Ajoute tes infos bancaires pour recevoir les paiements
4. Configure la TVA :
   - Active **Collect VAT**
   - Sélectionne **France** comme pays principal

---

## Étape 3 : Créer tes produits (15 min)

### Produit 1 : Solo

1. **Products** → **New Product**
2. Remplis :
   - **Name** : SOS Storytelling Solo
   - **Description** : Création de contenu IA illimitée pour créateurs individuels
   - **Price** : 39€/mois (sélectionne "Subscription")
   - **Billing interval** : Monthly
   - **Free trial** : 7 days ✅
3. Dans **Variants**, laisse par défaut
4. **Save**

### Produit 2 : Agence Starter

1. **New Product**
2. Remplis :
   - **Name** : SOS Storytelling Agence Starter
   - **Description** : Jusqu'à 10 clients, voix par client, dashboard analytics
   - **Price** : 99€/mois
   - **Billing interval** : Monthly
   - **Free trial** : 7 days ✅
3. **Save**

### Produit 3 : Agence Scale

1. **New Product**
2. Remplis :
   - **Name** : SOS Storytelling Agence Scale
   - **Description** : Jusqu'à 30 clients, analytics avancées, exports bulk
   - **Price** : 199€/mois
   - **Billing interval** : Monthly
   - **Free trial** : 7 days ✅
3. **Save**

### Produit 4 : Enterprise (optionnel)

Pour Enterprise, tu peux :
- Soit créer un produit à 300€/mois comme base
- Soit garder le contact par email pour personnaliser

---

## Étape 4 : Récupérer les liens de paiement

Pour chaque produit créé :

1. Va dans **Products** → clique sur le produit
2. Copie le **Checkout URL** (format : `https://myinnerquest.lemonsqueezy.com/checkout/buy/xxx`)

Tu obtiendras 3-4 liens comme :
```
Solo :           https://myinnerquest.lemonsqueezy.com/checkout/buy/abc123
Agence Starter : https://myinnerquest.lemonsqueezy.com/checkout/buy/def456
Agence Scale :   https://myinnerquest.lemonsqueezy.com/checkout/buy/ghi789
```

---

## Étape 5 : Remplacer les liens dans la landing page

Dans `landing-sos-storytelling-v2.html`, remplace les liens suivants :

### Boutons "Essayer 7 jours"

Cherche : `href="sos-storytelling.html"` 
Remplace par tes liens Lemon Squeezy selon le plan.

### Exemple de modification :

**Avant :**
```html
<a href="sos-storytelling.html" class="pricing-btn secondary">Essayer 7 jours</a>
```

**Après :**
```html
<a href="https://myinnerquest.lemonsqueezy.com/checkout/buy/SOLO_ID" class="pricing-btn secondary">Essayer 7 jours</a>
```

### Liste des remplacements à faire :

| Emplacement | Lien actuel | Nouveau lien |
|-------------|-------------|--------------|
| Hero "Essayer gratuitement" | `sos-storytelling.html` | Lien Solo ou page choix |
| Bandeau essai gratuit | `sos-storytelling.html` | Lien Solo ou page choix |
| Plan Solo | `sos-storytelling.html` | Lien Solo |
| Plan Agence Starter | `sos-storytelling.html` | Lien Agence Starter |
| Plan Agence Scale | `sos-storytelling.html` | Lien Agence Scale |

---

## Étape 6 : Configurer les webhooks (optionnel mais recommandé)

Pour activer automatiquement les comptes après paiement :

1. **Settings** → **Webhooks**
2. **Add Webhook**
3. URL : `https://ton-worker.workers.dev/webhook/lemonsqueezy`
4. Sélectionne les événements :
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_payment_success`
   - `subscription_payment_failed`
5. **Save**

Je peux te créer le code du webhook Cloudflare Worker si tu veux automatiser l'activation des comptes.

---

## Étape 7 : Personnaliser l'expérience checkout

1. **Settings** → **Store**
2. Configure :
   - **Store name** : My Inner Quest
   - **Logo** : Upload ton logo
   - **Brand color** : `#667eea` (violet SOS Storytelling)
   - **Support email** : contact@myinnerquest.fr

3. **Settings** → **Emails**
   - Personnalise les emails de bienvenue
   - Ajoute le lien vers l'app : `https://sosstorytelling.myinnerquest.fr/app.html`

---

## Étape 8 : Tester le flow

1. Crée un **Test Mode** checkout (ou utilise un coupon 100% off)
2. Simule un achat
3. Vérifie :
   - [ ] Email de confirmation reçu
   - [ ] Accès à l'app fonctionnel
   - [ ] Données correctes dans Lemon Squeezy

---

## 📊 Après le lancement

### Dashboard Lemon Squeezy

Tu pourras suivre :
- Nombre d'abonnés par plan
- MRR (Monthly Recurring Revenue)
- Churn rate
- Revenus par période

### Codes promo

Pour créer des offres spéciales :
1. **Discounts** → **New Discount**
2. Configure le % de réduction et la durée
3. Partage le code ou le lien direct

---

## 🚨 Points importants

- **TVA** : Lemon Squeezy gère automatiquement la TVA mondiale
- **Factures** : Générées et envoyées automatiquement
- **Remboursements** : Gérables depuis le dashboard
- **Portail client** : Les clients peuvent gérer leur abo eux-mêmes

---

## 🔗 Liens utiles

- [Documentation Lemon Squeezy](https://docs.lemonsqueezy.com)
- [API Reference](https://docs.lemonsqueezy.com/api)
- [Help Center](https://help.lemonsqueezy.com)

---

## ✅ Checklist finale

- [ ] Compte Lemon Squeezy créé
- [ ] Paiements configurés (Stripe ou LS Payments)
- [ ] 3-4 produits créés avec essai 7j
- [ ] Liens récupérés
- [ ] Landing page mise à jour
- [ ] Test d'achat effectué
- [ ] Emails personnalisés

---

Une fois que tu as tes liens Lemon Squeezy, envoie-les moi et je mets à jour la landing page automatiquement ! 🚀
