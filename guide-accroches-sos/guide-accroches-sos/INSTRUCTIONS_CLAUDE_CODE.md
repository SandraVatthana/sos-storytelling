# Instructions Claude Code — Système d'Accroches SOS Storytelling

## 🎯 Contexte

Le système actuel de génération d'accroches dans SOS produit des **structures/templates** plutôt que de vraies accroches qui claquent. 

Exemple du problème :
- ❌ Actuel : "Le mythe de [X]" → C'est un squelette, pas une accroche
- ✅ Attendu : "Le mythe du 'poste tous les jours' m'a fait perdre 6 mois et 3 clients." → C'est une accroche

## 📦 Fichiers fournis

1. **GUIDE_ACCROCHES_COMPLET.md** — Le guide complet avec :
   - Les 7 déclencheurs psychologiques
   - La checklist de validation
   - Les patterns par catégorie avec exemples
   - Les 10 erreurs fatales à éviter

2. **PROMPT_INJECTABLE.md** — Le prompt optimisé à injecter dans le système de génération

3. **BASE_EXEMPLES_ACCROCHES.md** — Une base de 40+ exemples d'accroches classées par catégorie (format JSON)

## 🔧 Modifications à apporter

### 1. Mettre à jour le prompt de génération d'accroches

Remplacer le prompt actuel par celui dans `PROMPT_INJECTABLE.md`. 

Le nouveau prompt :
- Définit clairement ce qu'est une accroche (vs un template)
- Liste les 7 déclencheurs à utiliser
- Donne des règles strictes (jamais de "Aujourd'hui je voulais...", etc.)
- Fournit des exemples concrets de bonnes ET mauvaises accroches

### 2. Intégrer le contexte du persona

Quand une utilisatrice génère des accroches, le prompt doit recevoir :

```javascript
const hookGenerationContext = {
  // Sujet/thème du post
  topic: postTopic,
  
  // Persona sélectionné (si disponible)
  audience: {
    name: persona.name,
    description: persona.description,
    painPoints: persona.pain_points,
    desires: persona.desires,
    vocabulary: persona.vocabulary,
    tonePreferences: persona.tone_preferences,
  },
  
  // Plateforme cible
  platform: selectedPlatform, // linkedin, instagram, tiktok
  
  // Profil de l'utilisatrice
  brandVoice: user.brand_voice,
  niche: user.niche,
};
```

### 3. Ajouter un sélecteur de "déclencheur" (optionnel mais recommandé)

Dans l'interface, proposer à l'utilisatrice de choisir le type d'accroche qu'elle veut :

```
Quel type d'accroche veux-tu ?

[ ] 🔮 Curiosité — Ouvrir une boucle
[ ] 🔄 Paradoxe — Contre-intuitif
[ ] 🔢 Chiffres — Data et résultats
[ ] 🎯 Identification — "C'est toi ça"
[ ] 💔 Confession — Vulnérabilité
[ ] ⏰ Urgence — FOMO
[ ] 🔥 Provocation — Opinion tranchée
[ ] 🎲 Surprise moi — Mix aléatoire
```

Si elle choisit un type spécifique, le prompt demande à Claude de se concentrer sur ce déclencheur.

### 4. Afficher les exemples pertinents

Quand l'utilisatrice sélectionne un déclencheur, afficher 2-3 exemples de la base pour l'inspirer :

```
💡 Exemples d'accroches "Paradoxe" :

"Plus tu veux vendre, moins tu vends."
"Moins j'ai de followers, plus je signe de clients."
"On t'a dit de poster tous les jours. C'est faux."
```

### 5. Valider les accroches générées

Avant d'afficher les accroches à l'utilisatrice, vérifier qu'elles passent la checklist :

```javascript
function validateHook(hook) {
  const checks = {
    isCompleteSentence: !hook.includes('[') && !hook.includes(']'),
    hasNoPoliteIntro: !hook.toLowerCase().startsWith('aujourd\'hui') && 
                      !hook.toLowerCase().startsWith('bonjour'),
    isShortEnough: hook.length <= 200,
    hasSpecificity: /\d/.test(hook) || hook.includes('€') || hook.includes('%'),
    hasTension: hook.includes('?') || hook.includes('!') || 
                hook.includes('mais') || hook.includes('pourtant'),
  };
  
  const score = Object.values(checks).filter(Boolean).length;
  return { valid: score >= 3, score, checks };
}
```

### 6. Permettre la régénération ciblée

Si une accroche ne plaît pas, permettre de régénérer avec un déclencheur différent :

```
Accroche 1 : "J'ai refusé un contrat à 15K€..."
[♻️ Régénérer] [🔄 Essayer un autre style ▼]
                 ├─ Plus de chiffres
                 ├─ Plus provocant  
                 ├─ Plus storytelling
                 └─ Plus identification
```

## 📋 Checklist d'implémentation

- [ ] Remplacer le prompt de génération d'accroches par le nouveau
- [ ] Injecter le contexte du persona dans le prompt
- [ ] Ajouter le sélecteur de déclencheur (optionnel)
- [ ] Intégrer la base d'exemples pour inspiration
- [ ] Ajouter la validation des accroches générées
- [ ] Permettre la régénération ciblée

## 🎨 UX suggérée

### Écran de génération d'accroches

```
┌─────────────────────────────────────────────────────────┐
│  ✨ Génère ton accroche                                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Sujet de ton post *                                    │
│  [Comment j'ai doublé mon CA en 6 mois            ]     │
│                                                         │
│  Style d'accroche                                       │
│  [🔮 Curiosité     ] [🔢 Chiffres    ] [💔 Confession]  │
│  [🔄 Paradoxe      ] [🎯 Identification] [🔥 Provoc   ]  │
│  [⏰ Urgence       ] [🎲 Surprise moi                 ]  │
│                                                         │
│  💡 Exemples de ce style :                              │
│  "J'ai refusé 15K€. Meilleure décision de ma vie."     │
│  "Mon lancement a fait 0 vente. Zéro."                 │
│                                                         │
│              [🚀 Générer 5 accroches]                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  RÉSULTATS                                              │
│                                                         │
│  1. "Ce post m'a pris 7 minutes. Il a fait 89K vues." │
│     [✓ Utiliser] [♻️ Régénérer] [📋 Copier]            │
│                                                         │
│  2. "On m'a dit que c'était impossible. 6 mois plus   │
│      tard, voilà les chiffres."                        │
│     [✓ Utiliser] [♻️ Régénérer] [📋 Copier]            │
│                                                         │
│  3. ...                                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## ⚠️ Points d'attention

1. **Ne jamais générer de templates vides** — L'IA doit produire des phrases complètes, pas des "[X]" à remplir

2. **Adapter au persona** — Si l'utilisatrice cible des "artistes", utiliser leur vocabulaire, pas du jargon business

3. **Adapter à la plateforme** — LinkedIn = plus pro, Instagram = plus émotionnel, TikTok = plus punchy

4. **Garder la cohérence de ton** — L'accroche doit correspondre au style de l'utilisatrice (défini dans son profil)

5. **Éviter le clickbait mensonger** — Les accroches doivent être percutantes mais honnêtes

## 🔗 Intégration avec les autres systèmes

- **Personas** : Utiliser le persona sélectionné pour adapter le vocabulaire et les pain points
- **Bonnes pratiques** : Vérifier que l'accroche respecte les règles de la plateforme (longueur, etc.)
- **Profil utilisateur** : Adapter le ton à la brand voice définie

---

Des questions ? Demande à Sandra pour clarifier les priorités.
