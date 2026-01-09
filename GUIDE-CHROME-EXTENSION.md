# Guide : Publication Extension Chrome SOS Storytelling

## 1. Preparation

### Fichiers requis

```
sos-storytelling-extension/
├── manifest.json           ✅ Cree
├── popup/
│   ├── popup.html          ✅ Cree
│   ├── popup.js            ✅ Cree
│   └── popup.css           ✅ Cree
├── content/
│   └── content.js          ✅ Cree
├── background/
│   └── background.js       ✅ Cree
├── assets/
│   ├── icon-16.png         ⚠️ A generer
│   ├── icon-48.png         ⚠️ A generer
│   └── icon-128.png        ⚠️ A generer
├── styles/
│   └── injected.css        ✅ Cree
└── README.md               ✅ Cree
```

### Generer les icones

1. Ouvrir `assets/generate-icons.html` dans Chrome
2. Telecharger chaque icone (16, 48, 128)
3. Placer dans le dossier `assets/`

OU utiliser votre propre logo SOS Storytelling redimensionne.

## 2. Deployer l'API

### Mettre a jour le Cloudflare Worker

1. Aller sur [dash.cloudflare.com](https://dash.cloudflare.com)
2. Workers & Pages > sos-storytelling-api
3. Remplacer le code par `cloudflare-worker-v10-extension.js`
4. OU fusionner les fonctions `handleExtensionAPI` dans votre v9 existant

### Executer les migrations SQL

Dans Supabase SQL Editor, executer :
```sql
-- Contenu de supabase-extension-tables.sql
```

## 3. Tester en local

### Charger l'extension

1. Chrome > `chrome://extensions/`
2. Activer "Mode developpeur"
3. "Charger l'extension non empaquetee"
4. Selectionner le dossier `sos-storytelling-extension`

### Tests a effectuer

- [ ] Connexion avec identifiants SOS Storytelling
- [ ] Liste des campagnes chargee
- [ ] Detection page Sales Navigator
- [ ] Affichage bouton flottant
- [ ] Selection de leads (individuel)
- [ ] Selection de leads (en masse)
- [ ] Export vers campagne
- [ ] Gestion des doublons
- [ ] Deconnexion

## 4. Publication Chrome Web Store

### Creer un compte developpeur

1. Aller sur [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Payer les frais d'inscription ($5 une fois)
3. Verifier votre identite

### Preparer le package

1. Creer un fichier ZIP du dossier `sos-storytelling-extension`
   ```bash
   cd "C:\Users\sandr\OneDrive\Bureau\SOS STORYTELLING&PERSONAL BRANDING"
   powershell Compress-Archive -Path sos-storytelling-extension\* -DestinationPath sos-storytelling-extension.zip
   ```

2. Assets requis pour le Store :
   - Screenshot 1280x800 (au moins 1)
   - Icone 128x128
   - Description courte (132 chars max)
   - Description complete

### Textes pour le Store

**Nom** : SOS Storytelling - LinkedIn Leads Exporter

**Description courte** (132 chars) :
```
Exportez vos leads LinkedIn Sales Navigator vers SOS Storytelling en un clic. Gratuit avec votre abonnement.
```

**Description complete** :
```
SOS Storytelling - LinkedIn Leads Exporter

Exportez facilement vos leads depuis LinkedIn Sales Navigator vers vos campagnes de prospection SOS Storytelling.

FONCTIONNALITES :
• Detection automatique de Sales Navigator
• Selection individuelle ou en masse des leads
• Export en un clic vers vos campagnes
• Gestion intelligente des doublons
• 100% gratuit avec votre abonnement SOS Storytelling

DONNEES EXTRAITES :
• Prenom et nom
• Poste / Titre professionnel
• Entreprise
• URL du profil LinkedIn
• Localisation

COMMENT CA MARCHE :
1. Connectez-vous avec vos identifiants SOS Storytelling
2. Allez sur Sales Navigator et faites votre recherche
3. Selectionnez les leads qui vous interessent
4. Cliquez sur "Exporter" et choisissez votre campagne

LIMITE : 100 leads par export pour respecter les CGU LinkedIn.

IMPORTANT : Cette extension necessite un compte SOS Storytelling actif.
Creez votre compte sur https://sos-storytelling.com

Support : support@sos-storytelling.com
```

**Categorie** : Productivity

**Langue** : Francais

### Soumettre pour review

1. Dashboard > Ajouter un nouvel element
2. Upload le ZIP
3. Remplir les informations
4. Soumettre pour examen

Delai : 1-3 jours ouvrables

## 5. Mises a jour

### Processus de mise a jour

1. Modifier le code
2. Incrementer `version` dans manifest.json
3. Creer nouveau ZIP
4. Dashboard > Element > Mettre a jour
5. Soumettre pour examen

### Versioning

- `1.0.x` : Correctifs bugs
- `1.x.0` : Nouvelles fonctionnalites mineures
- `x.0.0` : Changements majeurs

## 6. Monitoring

### Metriques a suivre

- Nombre d'installations
- Notes et avis
- Rapports de bugs
- Taux de retention

### Logs cote serveur

Dans Cloudflare Workers :
```javascript
console.log('[Extension] Import:', {
  user: user.id,
  leads: leads.length,
  campaign: campaign_id
});
```

## 7. Conformite

### CGU LinkedIn

- Export manuel uniquement (pas d'automatisation)
- Limite de 100 leads par action
- Pas de scraping en arriere-plan

### RGPD

- Donnees stockees uniquement sur demande utilisateur
- Possibilite de suppression via l'app
- Pas de partage avec des tiers

### Chrome Web Store Policies

- Permissions minimales requises
- Description claire de l'usage des donnees
- Pas de code obfusque

---

## Checklist finale

- [ ] Icones generees (16, 48, 128)
- [ ] API deployee avec endpoints extension
- [ ] Tables SQL creees
- [ ] Extension testee en local
- [ ] ZIP prepare
- [ ] Screenshots prets
- [ ] Compte developpeur Chrome cree
- [ ] Extension soumise

---

Questions ? support@sos-storytelling.com
