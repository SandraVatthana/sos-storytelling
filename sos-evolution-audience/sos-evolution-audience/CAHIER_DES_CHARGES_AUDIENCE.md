# Cahier des charges — Évolution du ciblage d'audience dans SOS Storytelling

## 📋 Contexte

Le système actuel de ciblage ("Ton audience" dans le panneau de configuration) est trop générique. Les options comme "Entrepreneurs", "Freelances", "Créateurs" ne permettent pas à l'IA de générer du contenu vraiment personnalisé.

**Problème identifié :** Sandra (et ses utilisatrices) s'adressent à des audiences variées et spécifiques selon les moments :
- Un jour : les artistes indépendants
- Un autre : les formateurs en ligne
- Un autre : les agences créatives

Le système doit permettre de définir des **personas détaillés** et de **switcher facilement** entre eux.

---

## 🎯 Objectifs

1. Permettre la création de **personas d'audience personnalisés** avec des détails riches
2. Remplacer le sélecteur générique par un **dropdown des personas sauvegardés**
3. Ajouter un **rappel contextuel discret** en bas de l'interface de création
4. Afficher un **pop-up récapitulatif** avec accès rapide aux modifications

---

## 🏗️ Architecture proposée

### 1. Nouvelle structure de données : Personas

**Table Supabase : `audience_personas`**

```sql
CREATE TABLE audience_personas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  
  -- Identité du persona
  name TEXT NOT NULL,                    -- "Artistes indépendants"
  emoji TEXT DEFAULT '🎯',               -- Icône pour le dropdown
  
  -- Description détaillée
  description TEXT,                      -- "Artistes visuels (peintres, illustrateurs, photographes) qui veulent vivre de leur art"
  
  -- Caractéristiques
  demographics JSONB DEFAULT '{}',       -- {"age": "30-45", "genre": "mixte", "localisation": "France"}
  psychographics JSONB DEFAULT '{}',     -- {"valeurs": ["authenticité", "liberté"], "frustrations": ["visibilité", "vendre sans se vendre"]}
  
  -- Langage et ton
  vocabulary TEXT[],                     -- ["création", "œuvre", "galerie", "exposition"]
  tone_preferences TEXT,                 -- "Inspirant mais pas pompeux, éviter le jargon marketing"
  
  -- Contexte digital
  primary_platform TEXT DEFAULT 'linkedin',  -- Plateforme principale
  content_preferences TEXT[],            -- ["behind the scenes", "processus créatif", "témoignages clients"]
  
  -- Douleurs et désirs (pour le copywriting)
  pain_points TEXT[],                    -- ["Pas assez de visibilité", "Difficulté à fixer ses prix"]
  desires TEXT[],                        -- ["Vivre de son art", "Être reconnu"]
  
  -- Métadonnées
  is_default BOOLEAN DEFAULT false,      -- Persona par défaut
  usage_count INT DEFAULT 0,             -- Combien de fois utilisé
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_personas_user ON audience_personas(user_id);
CREATE INDEX idx_personas_default ON audience_personas(user_id, is_default) WHERE is_default = true;
```

### 2. Modification de l'interface "Mon Profil"

**Nouvelle section : "Mes audiences"**

```
┌─────────────────────────────────────────────────────────┐
│  👥 Mes audiences                          [+ Nouveau]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🎨 Artistes indépendants            ⭐ Par défaut      │
│     Artistes visuels qui veulent vivre de leur art     │
│     [Modifier] [Dupliquer] [Supprimer]                 │
│                                                         │
│  📚 Formateurs en ligne                                │
│     Coachs et formateurs qui lancent leur activité     │
│     [Modifier] [Dupliquer] [Supprimer]                 │
│                                                         │
│  🏢 Agences créatives                                  │
│     Petites agences de com/marketing                   │
│     [Modifier] [Dupliquer] [Supprimer]                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Formulaire de création/édition de persona :**

```
┌─────────────────────────────────────────────────────────┐
│  Créer une audience                              [X]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Nom *                                                  │
│  [Artistes indépendants                           ]     │
│                                                         │
│  Emoji                                                  │
│  [🎨] (sélecteur)                                       │
│                                                         │
│  Description *                                          │
│  [Artistes visuels (peintres, illustrateurs,      ]     │
│  [photographes) qui veulent vivre de leur art     ]     │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  CARACTÉRISTIQUES                                       │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Tranche d'âge        Localisation                      │
│  [30-45 ans     ▼]    [France            ]              │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  DOULEURS & DÉSIRS                                      │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Leurs problèmes (un par ligne)                         │
│  [Pas assez de visibilité                         ]     │
│  [Difficulté à fixer leurs prix                   ]     │
│  [Se sentent illégitimes à "se vendre"            ]     │
│                                                         │
│  Ce qu'ils veulent (un par ligne)                       │
│  [Vivre de leur art                               ]     │
│  [Être reconnus pour leur travail                 ]     │
│  [Trouver des clients sans prospecter             ]     │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  TON & LANGAGE                                          │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Mots-clés à utiliser (séparés par des virgules)        │
│  [création, œuvre, galerie, exposition, processus ]     │
│                                                         │
│  Notes sur le ton                                       │
│  [Inspirant mais pas pompeux. Éviter le jargon    ]     │
│  [marketing. Parler de "partager" pas "vendre"    ]     │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  PRÉFÉRENCES DE CONTENU                                 │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Plateforme principale                                  │
│  [Instagram    ▼]                                       │
│                                                         │
│  Types de contenu qui les intéressent                   │
│  [x] Behind the scenes                                  │
│  [x] Processus créatif                                  │
│  [ ] Témoignages clients                                │
│  [x] Conseils pratiques                                 │
│  [ ] Actualités du secteur                              │
│                                                         │
│  ☐ Définir comme audience par défaut                    │
│                                                         │
│           [Annuler]              [💾 Sauvegarder]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3. Modification du panneau "Ton audience" (création de contenu)

**Avant (actuel) :**
```
Public cible
[Entrepreneurs] [Freelances] [Salariés] ...
```

**Après (nouveau) :**
```
┌─────────────────────────────────────────────────────────┐
│  🎯 Ton audience                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [🎨 Artistes indépendants              ▼]              │
│   ├─ 🎨 Artistes indépendants  ⭐                       │
│   ├─ 📚 Formateurs en ligne                             │
│   ├─ 🏢 Agences créatives                               │
│   ├─ ───────────────────────                            │
│   ├─ 🚀 Entrepreneurs (générique)                       │
│   ├─ 💼 Freelances (générique)                          │
│   └─ ➕ Créer une nouvelle audience...                  │
│                                                         │
│  Aperçu :                                               │
│  "Artistes visuels qui veulent vivre de leur art"      │
│  Douleurs : visibilité, se vendre                       │
│  Ton : inspirant, authentique                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Comportement :**
- Le dropdown liste d'abord les personas personnalisés (avec ⭐ pour le défaut)
- Puis un séparateur
- Puis les options génériques (fallback)
- Puis "Créer une nouvelle audience..." qui ouvre le formulaire

### 4. Rappel contextuel en bas de l'interface

**Position :** Tout en bas de la zone de création, discret, texte souligné/surligné

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [Zone de création de contenu]                          │
│                                                         │
│  ...                                                    │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  📋 Tu parles à : Artistes indépendants • Ton style     │
└─────────────────────────────────────────────────────────┘
         ↑
    Texte cliquable, couleur discrète (gris ou violet clair)
```

**Au clic → Pop-up récapitulatif :**

```
┌─────────────────────────────────────────────────────────┐
│  📋 Ton contexte actuel                          [X]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  TOI                                                    │
│  ─────────────────────────────────────────────────────  │
│  Sandra • My Inner Quest                                │
│  "L'amie qui te secoue avec bienveillance"             │
│  Style : direct, piquant, authentique                   │
│                                                         │
│  TON AUDIENCE ACTUELLE                                  │
│  ─────────────────────────────────────────────────────  │
│  🎨 Artistes indépendants                               │
│  Artistes visuels qui veulent vivre de leur art        │
│                                                         │
│  Leurs douleurs :                                       │
│  • Pas assez de visibilité                              │
│  • Difficulté à fixer leurs prix                        │
│                                                         │
│  Ce qu'ils veulent :                                    │
│  • Vivre de leur art                                    │
│  • Être reconnus                                        │
│                                                         │
│  Ton à adopter :                                        │
│  Inspirant mais pas pompeux. Éviter le jargon.         │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│     [Changer d'audience ▼]     [✏️ Modifier mon profil] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Boutons du pop-up :**
- "Changer d'audience" → Dropdown rapide pour switcher
- "Modifier mon profil" → Redirige vers la page Mon Profil, section Audiences

---

## 🤖 Intégration avec l'IA

### Modification du prompt de génération

Quand l'utilisatrice génère du contenu, le prompt envoyé à Claude doit inclure le persona complet :

```javascript
const audienceContext = `
AUDIENCE CIBLE : ${persona.name}
Description : ${persona.description}

CARACTÉRISTIQUES :
- Tranche d'âge : ${persona.demographics.age}
- Localisation : ${persona.demographics.localisation}

LEURS PROBLÈMES (à adresser dans le contenu) :
${persona.pain_points.map(p => `- ${p}`).join('\n')}

CE QU'ILS VEULENT (promesse implicite) :
${persona.desires.map(d => `- ${d}`).join('\n')}

TON À ADOPTER :
${persona.tone_preferences}

VOCABULAIRE À PRIVILÉGIER :
${persona.vocabulary.join(', ')}

TYPES DE CONTENU QUI LES INTÉRESSENT :
${persona.content_preferences.join(', ')}
`;
```

### Exemple concret

**Avant (générique) :**
```
Génère un post LinkedIn pour des entrepreneurs.
```

**Après (avec persona) :**
```
Génère un post LinkedIn.

AUDIENCE CIBLE : Artistes indépendants
Description : Artistes visuels (peintres, illustrateurs, photographes) qui veulent vivre de leur art

LEURS PROBLÈMES :
- Pas assez de visibilité sur les réseaux
- Difficulté à fixer leurs prix
- Se sentent illégitimes à "se vendre"

CE QU'ILS VEULENT :
- Vivre de leur art sans compromis
- Être reconnus pour leur travail
- Trouver des clients sans avoir à prospecter

TON À ADOPTER :
Inspirant mais pas pompeux. Éviter le jargon marketing. Parler de "partager son travail" plutôt que "vendre". Être authentique et bienveillant.

VOCABULAIRE À PRIVILÉGIER :
création, œuvre, processus créatif, galerie, exposition, collectionneur
```

---

## 📱 Comportements UX détaillés

### Sélection d'audience

1. **Premier accès** : Si aucun persona créé, afficher les options génériques + CTA "Crée ton audience idéale pour des contenus plus percutants"

2. **Avec personas** : Le persona par défaut est pré-sélectionné. L'aperçu s'affiche sous le dropdown.

3. **Changement** : Quand on change d'audience, l'aperçu se met à jour. Si un contenu est déjà généré, proposer "Régénérer avec cette audience ?"

### Création de persona

1. **Depuis le dropdown** : "Créer une nouvelle audience" ouvre une modale
2. **Depuis Mon Profil** : Section dédiée avec liste + bouton "Nouveau"
3. **Duplication** : Permet de créer une variante d'un persona existant

### Rappel contextuel

1. **Toujours visible** mais discret (pas de couleur vive)
2. **Texte adaptatif** : 
   - Si persona perso : "Tu parles à : [Nom persona]"
   - Si générique : "Tu parles à : Entrepreneurs (générique)"
3. **Hover** : Légère surbrillance pour indiquer que c'est cliquable

### Pop-up récapitulatif

1. **Fermeture** : Clic sur X, clic en dehors, ou touche Escape
2. **Responsive** : Sur mobile, s'affiche en plein écran
3. **Mémorisation** : Si on change d'audience dans le pop-up, ça met à jour le dropdown principal

---

## 🔄 Migration des données existantes

Pour les utilisatrices existantes qui ont déjà sélectionné des options génériques :

1. Garder les options génériques fonctionnelles (rétrocompatibilité)
2. Afficher un bandeau d'incitation : "Crée des personas personnalisés pour des contenus plus ciblés !"
3. Proposer un assistant de création basé sur leurs choix actuels

---

## 📊 Tracking et analytics

Métriques à suivre :
- Nombre de personas créés par utilisatrice
- Persona le plus utilisé
- Taux de switch entre personas
- Corrélation persona détaillé / qualité perçue du contenu

---

## 🚀 Priorisation

### Phase 1 (MVP)
- [ ] Table `audience_personas` en base
- [ ] CRUD personas dans "Mon Profil"
- [ ] Dropdown de sélection dans la création
- [ ] Injection du persona dans le prompt IA

### Phase 2
- [ ] Rappel contextuel en bas + pop-up
- [ ] Aperçu sous le dropdown
- [ ] Duplication de personas

### Phase 3
- [ ] Assistant de création de persona (guidé par questions)
- [ ] Suggestions de personas basées sur le secteur
- [ ] Import/export de personas

---

## 📎 Fichiers liés

- `supabase-schema.sql` : Ajouter la table `audience_personas`
- `ProfilePage.jsx` : Ajouter la section "Mes audiences"
- `AudienceSelector.jsx` : Nouveau composant dropdown
- `ContextReminder.jsx` : Nouveau composant rappel + pop-up
- `contentGenerator.js` : Modifier pour inclure le persona dans le prompt
