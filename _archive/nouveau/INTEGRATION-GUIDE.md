# 📦 Guide d'intégration - Onboarding

## 🎯 Ce que fait ce module

Ce module ajoute un **système de profil utilisateur** au jeu Voyage Créatif :

1. **Formulaire d'onboarding** au premier lancement
2. **Profil sauvegardé** dans localStorage
3. **Bouton "Éditer mon profil"** pour modifier
4. **Données prêtes** pour personnaliser les prompts IA

---

## 📁 Fichiers créés

```
/nouveau/
├── user-profile.js    → Gestion du profil (localStorage)
├── onboarding.js      → Formulaire et logique
└── onboarding.css     → Styles du formulaire
```

---

## 🔧 Installation (3 étapes)

### Étape 1 : Copier les fichiers

Copie le dossier `/nouveau/` à la racine de ton projet :

```
voyage-creatif/
├── index.html
├── game-logic.js
├── game-data.js
├── style.css
└── nouveau/           ← AJOUTER ICI
    ├── user-profile.js
    ├── onboarding.js
    └── onboarding.css
```

### Étape 2 : Modifier index.html

Ajoute ces lignes **AVANT** la fermeture du `</body>` :

```html
    <!-- ... code existant ... -->

    <!-- ONBOARDING SYSTEM -->
    <link rel="stylesheet" href="nouveau/onboarding.css">
    <script src="nouveau/user-profile.js"></script>
    <script src="nouveau/onboarding.js"></script>
    <script>
        // Vérifier l'onboarding au chargement
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => Onboarding.check(), 1000);
        });
    </script>

    <script src="game-data.js"></script>
    <script src="game-logic.js"></script>
</body>
```

### Étape 3 : Ajouter le bouton "Éditer profil"

Dans `index.html`, ajoute ce bouton dans la section `.controls` :

```html
<div class="controls">
    <!-- Boutons existants -->
    <div class="dice-container">...</div>
    <button class="btn btn-primary" onclick="showInstructions()">📖 Instructions</button>
    
    <!-- NOUVEAU : Bouton profil -->
    <button id="profileBtn" class="btn btn-secondary" onclick="Onboarding.edit()">
        👤 Mon profil
    </button>
    
    <button class="btn btn-secondary" onclick="restartGame()">🔄 Recommencer</button>
    <!-- ... -->
</div>
```

---

## ✅ Test de l'installation

1. **Ouvre le jeu** dans ton navigateur
2. **Premier lancement** → Le formulaire d'onboarding doit s'afficher
3. **Remplis le formulaire** → Clique "Commencer le voyage"
4. **Vérifie le profil** → Clique sur le bouton "👤 Mon profil"
5. **Modifie** → Un message d'alerte apparaît avant modification

### Vérifier dans la console :

```javascript
// Ouvre la console (F12) et tape :
UserProfile.get()

// Tu dois voir ton profil :
{
  nom: "Sandra",
  domaine: "storytelling digital",
  piliers: ["gamification", "IA", "entrepreneuriat"],
  plateformes: ["linkedin", "instagram"],
  niveau: "avance",
  style: "authentique",
  objectif: "communaute",
  dateCreation: "2025-11-25T...",
  dateModification: "2025-11-25T..."
}
```

---

## 📱 Données du profil

| Champ | Type | Description |
|-------|------|-------------|
| `nom` | string | Prénom ou pseudo |
| `domaine` | string | Expertise principale |
| `piliers` | array | 3 piliers de contenu |
| `plateformes` | array | Réseaux sociaux utilisés |
| `niveau` | string | debutant / intermediaire / avance |
| `style` | string | inspirant / educatif / authentique / humour / provocateur / minimaliste |
| `objectif` | string | notoriete / communaute / ventes / autorite / reseau / expression |

---

## 🔗 Utilisation dans le code

### Récupérer le profil

```javascript
const profile = UserProfile.get();
console.log(profile.nom);        // "Sandra"
console.log(profile.domaine);    // "storytelling digital"
console.log(profile.piliers);    // ["gamification", "IA", "entrepreneuriat"]
```

### Vérifier si un profil existe

```javascript
if (UserProfile.hasValid()) {
    // Profil complet disponible
} else {
    // Pas de profil ou incomplet
}
```

### Ouvrir l'onboarding manuellement

```javascript
Onboarding.show(false);  // Mode création
Onboarding.show(true);   // Mode édition
Onboarding.edit();       // Mode édition avec confirmation
```

---

## 🎨 Personnalisation des styles

Les couleurs suivent le thème du jeu (violet/bleu).

Pour changer les couleurs, modifie dans `onboarding.css` :

```css
/* Couleur principale */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Remplace par tes couleurs */
background: linear-gradient(135deg, #TA_COULEUR1 0%, #TA_COULEUR2 100%);
```

---

## 🐛 Dépannage

### Le formulaire ne s'affiche pas

1. Vérifie que les 3 fichiers sont bien chargés (console → Network)
2. Vérifie l'ordre des scripts dans `index.html`
3. Vérifie qu'il n'y a pas d'erreur dans la console

### Le profil ne se sauvegarde pas

1. Vérifie que localStorage est disponible
2. Vérifie dans la console : `localStorage.getItem('voyageCreatifUserProfile')`

### Réinitialiser le profil (pour tester)

```javascript
UserProfile.delete();
location.reload();
```

---

## 📝 Prochaine étape

Une fois l'onboarding installé, on passera à :

1. **`game-data-v3.json`** : Templates de prompts pour les 64 cases
2. **`prompt-generator.js`** : Génération de prompts personnalisés
3. **Affichage** : Toggle dans le popup pour voir/copier le prompt

---

**Version** : 1.0  
**Date** : Novembre 2025
