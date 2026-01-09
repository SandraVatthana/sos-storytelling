# Instructions pour Claude Code — SOS Storytelling

## 🎯 Contexte

Tu travailles sur SOS Storytelling, une application de création de contenu pour les réseaux sociaux. L'app est déployée sur Netlify : `sos-storytelling.netlify.app`

Sandra (la fondatrice) te confie deux évolutions majeures :

---

## 📦 TÂCHE 1 : Intégrer le système "Bonnes Pratiques"

### Fichiers fournis
Le ZIP `bonnes-pratiques-aggregator.zip` contient un système complet pour :
1. Capturer des newsletters (extension Chrome séparée)
2. Extraire les règles/conseils via Claude API
3. Stocker dans Supabase
4. Exposer une API pour SOS

### Ce que tu dois faire

**1.1 Créer les tables Supabase**
- Exécute le contenu de `supabase-schema.sql` dans le SQL Editor de Supabase
- Vérifie que les tables `newsletter_raw` et `bonnes_pratiques` sont créées
- Vérifie que la vue `v_bonnes_pratiques_actives` fonctionne

**1.2 Intégrer l'API dans SOS**
- Copie le fichier `api-sos.js` dans le projet SOS (adapte les imports si nécessaire)
- Les fonctions clés à utiliser :
  - `getTipsForSOS(platform, contentType, limit)` → retourne les tips pertinents
  - `getErrorsToAvoid(platform, limit)` → retourne les erreurs à éviter

**1.3 Créer le composant "Bonnes Pratiques du moment"**

Position : Dans la colonne de gauche (ou sous le formulaire de configuration), là où il y avait "Les tendances en ce moment" (renommer en "Bonnes pratiques du moment")

```jsx
// Exemple de structure
<BonnesPratiquesWidget 
  platform={selectedPlatform}  // linkedin, instagram, etc.
  contentType={selectedFormat}  // post, carrousel, story, etc.
  maxTips={3}
/>
```

**Affichage :**
```
┌─────────────────────────────────────────┐
│ 💡 Bonnes pratiques du moment           │
├─────────────────────────────────────────┤
│ 🤖 Ne modifie pas ton post dans les 2h  │
│    après publication                    │
│                                         │
│ ⏰ Reste dispo 1h après pour répondre   │
│    aux commentaires                     │
│                                         │
│ ⚠️ Évite les liens dans le corps du    │
│    post (mets-les en commentaire)       │
│                                         │
│         [Voir toutes les règles →]      │
└─────────────────────────────────────────┘
```

**Comportement :**
- Charge les tips au montage du composant
- Se met à jour quand la plateforme ou le format change
- Affiche un loader pendant le chargement
- Si aucune règle, afficher "Pas encore de bonnes pratiques pour cette plateforme"

**1.4 Optionnel : Injecter les tips dans le prompt IA**

Quand l'utilisatrice génère du contenu, tu peux ajouter les règles pertinentes au prompt :

```javascript
const relevantTips = await getTipsForSOS(platform, contentType, 5);
const tipsContext = relevantTips.length > 0 
  ? `\n\nBONNES PRATIQUES À RESPECTER :\n${relevantTips.map(t => `- ${t.tip}`).join('\n')}`
  : '';

// Ajouter tipsContext au prompt de génération
```

---

## 📦 TÂCHE 2 : Évolution du ciblage d'audience

### Fichier fourni
`CAHIER_DES_CHARGES_AUDIENCE.md` contient toutes les spécifications détaillées.

### Résumé des modifications

**2.1 Nouvelle table Supabase : `audience_personas`**
- Voir le schéma SQL dans le cahier des charges
- Permet de créer des personas détaillés (nom, description, douleurs, désirs, ton, vocabulaire...)

**2.2 Section "Mes audiences" dans Mon Profil**
- Liste des personas créés
- CRUD complet (créer, modifier, dupliquer, supprimer)
- Possibilité de définir un persona par défaut

**2.3 Nouveau sélecteur d'audience (remplace l'actuel)**
- Dropdown avec :
  - Les personas personnalisés en premier (⭐ pour le défaut)
  - Séparateur
  - Options génériques (Entrepreneurs, Freelances...) en fallback
  - "Créer une nouvelle audience..."
- Aperçu du persona sélectionné sous le dropdown

**2.4 Rappel contextuel en bas de l'interface**
- Texte discret cliquable : "📋 Tu parles à : [Nom du persona]"
- Au clic → Pop-up récapitulatif avec :
  - Infos sur l'utilisatrice (positionnement, style)
  - Infos sur l'audience (description, douleurs, désirs, ton)
  - Bouton "Changer d'audience"
  - Bouton "Modifier mon profil" (redirige vers la page profil)

**2.5 Injection dans le prompt IA**
- Quand un persona est sélectionné, inclure TOUTES ses infos dans le prompt
- Voir l'exemple de contexte dans le cahier des charges

---

## 🔧 Stack technique (pour info)

- **Frontend** : HTML/CSS/JS (ou React selon ce qui est en place)
- **Backend** : Supabase (PostgreSQL + Auth + API REST)
- **IA** : Claude API (Anthropic)
- **Déploiement** : Netlify

---

## 📋 Ordre de priorité suggéré

1. **D'abord** : Tâche 2.1 et 2.2 (table personas + CRUD dans profil) — c'est la base
2. **Ensuite** : Tâche 2.3 (nouveau sélecteur) — visible immédiatement
3. **Puis** : Tâche 1 (bonnes pratiques) — valeur ajoutée
4. **Enfin** : Tâche 2.4 (rappel contextuel) — polish UX
5. **Optionnel** : Tâche 1.4 et 2.5 (injection dans les prompts)

---

## ⚠️ Points d'attention

1. **Rétrocompatibilité** : Les options génériques actuelles (Entrepreneurs, Freelances...) doivent continuer à fonctionner pour les utilisatrices qui n'ont pas créé de personas

2. **Responsive** : Tous les nouveaux composants doivent être responsive (mobile-first)

3. **UX** : Le rappel contextuel doit être discret, pas intrusif. Couleur grise ou violet très clair.

4. **Performance** : Les appels Supabase pour les bonnes pratiques doivent être mis en cache côté client pour éviter les appels répétés

5. **Sécurité** : Les personas sont liés au `user_id` — vérifier que les RLS Supabase sont en place

---

## 🚀 Pour commencer

1. Lis le cahier des charges complet (`CAHIER_DES_CHARGES_AUDIENCE.md`)
2. Explore le code actuel de SOS pour comprendre la structure
3. Commence par créer la table `audience_personas` dans Supabase
4. Puis développe le CRUD dans la page Profil
5. Avance étape par étape en testant chaque fonctionnalité

Des questions ? Demande à Sandra pour clarifier les priorités ou les détails UX.
