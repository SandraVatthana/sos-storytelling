# 📩 Bonnes Pratiques Aggregator

Système d'agrégation IA pour extraire les bonnes pratiques des newsletters et les injecter dans SOS Storytelling.

## 🎯 Architecture

```
┌─────────────────────┐
│  Extension Chrome   │
│  (Newsletter Scraper)│
└──────────┬──────────┘
           │ capture
           ▼
┌─────────────────────┐
│   newsletter_raw    │  ← Supabase
│   (contenu brut)    │
└──────────┬──────────┘
           │ extraction IA
           ▼
┌─────────────────────┐
│  Aggregator (Claude)│  ← Ce script
│  - Extraction       │
│  - Dédoublonnage    │
│  - Reformulation    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  bonnes_pratiques   │  ← Supabase
│  (règles propres)   │
└──────────┬──────────┘
           │ API
           ▼
┌─────────────────────┐
│   SOS Storytelling  │
│  "Bonnes pratiques  │
│   du moment"        │
└─────────────────────┘
```

## 🚀 Installation

### 1. Prérequis

- Node.js 18+
- Un projet Supabase
- Une clé API Anthropic (Claude)

### 2. Setup

```bash
# Cloner/télécharger ce dossier
cd bonnes-pratiques-aggregator

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec tes clés
```

### 3. Créer les tables Supabase

Dans le SQL Editor de Supabase, exécute le contenu de `supabase-schema.sql`.

### 4. Créer la fonction RPC (optionnel)

Pour le tracking d'usage dans SOS :

```sql
CREATE OR REPLACE FUNCTION increment_usage_count(rule_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE bonnes_pratiques 
  SET usage_count = usage_count + 1 
  WHERE id = rule_id;
END;
$$ LANGUAGE plpgsql;
```

## 📖 Utilisation

### Traiter les newsletters en attente

```bash
npm start
# ou
node index.js
```

Le script va :
1. Récupérer les newsletters avec `status = 'raw'`
2. Extraire les règles via Claude
3. Dédoublonner et fusionner
4. Stocker dans `bonnes_pratiques`
5. Marquer les newsletters comme `processed`

### Tester l'extraction

```bash
npm run test-extraction
```

Teste l'extraction sur une newsletter fictive pour vérifier que tout fonctionne.

### Voir les stats

```bash
node index.js --stats
```

### Lister les règles

```bash
# Toutes les règles
node index.js --list

# Filtrer par plateforme
node index.js --list --platform linkedin
```

## 🔧 Structure des fichiers

```
bonnes-pratiques-aggregator/
├── index.js              # Script principal
├── config.js             # Configuration
├── supabase-client.js    # Accès base de données
├── extractor.js          # Extraction IA (Claude)
├── deduplicator.js       # Dédoublonnage
├── api-sos.js            # API pour SOS Storytelling
├── test-extraction.js    # Script de test
├── supabase-schema.sql   # Schema SQL
├── package.json
├── .env.example
└── README.md
```

## 🤖 Le prompt d'extraction

Le prompt dans `extractor.js` est conçu pour :

- ✅ Extraire uniquement les conseils **actionnables**
- ✅ Ignorer les anecdotes et le blabla
- ✅ Catégoriser automatiquement
- ✅ Garder une trace du verbatim (pour citation légale)
- ✅ Reformuler en ses propres mots

## 📊 Catégories de règles

| Catégorie | Description | Exemple |
|-----------|-------------|---------|
| `algorithme` | Règles de l'algo | "Ne pas modifier un post dans les 2h" |
| `format` | Formats qui marchent | "Carrousels de 8-12 slides" |
| `timing` | Horaires, fréquence | "Poster entre 8h-9h" |
| `engagement` | Tactiques d'interaction | "Répondre aux commentaires dans l'heure" |
| `erreurs` | Ce qu'il ne faut pas faire | "Éviter les liens dans le post" |
| `copywriting` | Écriture, hooks | "Commencer par une question" |
| `strategie` | Vision long terme | "Poster 3-5x par semaine" |

## 🔌 Intégration dans SOS

### Exemple d'appel

```javascript
import { getTipsForSOS, getErrorsToAvoid } from './api-sos.js';

// Quand l'utilisatrice génère un post LinkedIn
const tips = await getTipsForSOS('linkedin', 'post', 3);
const errors = await getErrorsToAvoid('linkedin', 2);

// Afficher dans l'interface
// tips = [
//   { icon: '🤖', tip: 'Ne modifie pas ton post dans les 2h...', ... },
//   { icon: '⏰', tip: 'Reste dispo 1h après publication...', ... },
// ]
```

### Format de réponse

```javascript
{
  id: 'uuid',
  tip: 'La règle reformulée',
  category: 'algorithme',
  confidence: 'consensus', // ou 'tendance', 'a_tester'
  icon: '🤖',
  freshness: 'recent', // ou 'valide', 'a_reverifier'
}
```

## ⚠️ Légalité

Ce système est conçu pour respecter le droit d'auteur :

1. **Les newsletters sont stockées en privé** (usage personnel)
2. **L'IA reformule tout** (pas de copie verbatim)
3. **Les sources sont citées** (sans reproduire le texte)
4. **L'extension n'est pas commercialisée**

## 🔮 Évolutions possibles

- [ ] Edge Function Supabase pour traitement auto
- [ ] Webhook quand une newsletter est capturée
- [ ] Détection d'obsolescence automatique
- [ ] Interface admin pour valider/rejeter des règles
- [ ] Export des règles vers d'autres formats

---

*Made with 💜 pour My Inner Quest*
