# Instructions Claude Code — Système Humour SOS Storytelling

## 🎯 Contexte

L'humour actuel de SOS sonne "marketing" — des formules, des emojis, du fake. On veut un humour authentique, comme un texto avec ta pote.

## 📦 Fichier fourni

**GUIDE_HUMOUR_COMPLET.md** contient :
- Les 3 styles d'humour (Copines, Cash, Caricature)
- Les 6 ressorts humoristiques (dont le nouveau "Parallèle qui dégonfle")
- Les règles DO/DON'T
- Le prompt injectable
- Des exemples par situation

## 🔧 Modifications à apporter

### 1. Ajouter un sélecteur de style d'humour

Quand l'utilisatrice choisit un ton humoristique, proposer :

```
Quel style d'humour ?

🍷 Copines — Entre potes autour d'un verre
🔪 Cash — Honnêteté brutale, auto-dérision
🎭 Caricature — Quotidien poussé jusqu'à l'absurde
```

### 2. Remplacer le prompt humour actuel

Utiliser le `HUMOR_SYSTEM_PROMPT` du guide (Partie 6).

Points clés :
- Définit les 3 styles clairement
- Liste les 6 ressorts humoristiques
- Interdit les emojis qui surjouent
- Interdit le vocabulaire usé ("niveau X", "mood", "en PLS"...)

### 3. Ajouter le ressort "Parallèle qui dégonfle"

C'est un nouveau ressort particulièrement efficace pour :
- Rassurer sur la peur de l'échec
- Dédramatiser les lancements ratés
- Combattre le syndrome de l'imposteur
- Relativiser la comparaison aux autres

**Structure :**
```
[Célébrité] quand [situation] :
→ [Conséquence dramatique 1]
→ [Conséquence dramatique 2]

Toi quand [même situation] :
→ [Conséquence gérable 1]
→ [Conséquence gérable 2]
```

### 4. Optionnel : Sélecteur de ressort

En plus du style, permettre de choisir le ressort :

```
Type de blague ?

↔️ Contraste — "À l'écran X, hors champ Y"
📈 Exagération — Pousser jusqu'à l'absurde  
🎭 Rupture de posture — Image vs réalité
😅 Auto-dérision — Rire de soi
⚖️ Parallèle — Relativiser avec les "grands"
🎲 Surprise moi
```

## 📋 Checklist d'implémentation

- [ ] Ajouter le sélecteur de style (Copines/Cash/Caricature)
- [ ] Remplacer le prompt humour par le nouveau
- [ ] Intégrer les exemples du guide comme inspiration
- [ ] Ajouter le ressort "Parallèle qui dégonfle"
- [ ] Valider que les emojis sont limités (max 1)
- [ ] Interdire le vocabulaire usé dans la génération

## ⚠️ Points d'attention

1. **Ne jamais mélanger les styles** — Un contenu = un style
2. **Pas d'emojis qui surjouent** — Max 1, et seulement si vraiment nécessaire
3. **Court et sec** — L'humour ne s'explique pas
4. **Bienveillant** — On rit de soi, pas des autres

## 🎨 UX suggérée

```
┌─────────────────────────────────────────────────────────┐
│  😄 Génère du contenu humoristique                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Sujet                                                  │
│  [Mon lancement a fait un flop                    ]     │
│                                                         │
│  Style d'humour                                         │
│  [🍷 Copines  ] [🔪 Cash     ] [🎭 Caricature   ]       │
│                                                         │
│  💡 Exemple de ce style :                               │
│  "J'ai passé 4h sur un post. 12 likes.                 │
│   Ma photo de burrito : 200 vues. Je suis le problème."|
│                                                         │
│              [🚀 Générer]                               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  RÉSULTATS                                              │
│                                                         │
│  1. "Bilan du lancement : 0 vente, 3 likes (merci     │
│      maman), et un DM pour me vendre une formation."   │
│     [✓ Utiliser] [♻️ Autre style]                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

Des questions ? Demande à Sandra.
