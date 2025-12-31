# 📩 Newsletter Scraper - SOS Storytelling

Extension Chrome personnelle pour capturer tes newsletters et alimenter ta base "Bonnes Pratiques".

## 🚀 Installation

### 1. Préparer l'extension

1. Télécharge ce dossier complet sur ton ordinateur
2. Ajoute des icônes dans le dossier `icons/` :
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)
   
   💡 Tu peux utiliser une icône simple violette avec une enveloppe, ou générer des icônes avec un outil comme https://favicon.io/

### 2. Installer dans Chrome

1. Ouvre Chrome et va sur `chrome://extensions/`
2. Active le **Mode développeur** (toggle en haut à droite)
3. Clique sur **"Charger l'extension non empaquetée"**
4. Sélectionne le dossier de l'extension
5. L'extension apparaît dans ta barre d'outils ! 📩

### 3. Créer la table Supabase

Dans ton projet Supabase, va dans **SQL Editor** et exécute :

```sql
-- Table pour stocker les newsletters brutes
CREATE TABLE newsletter_raw (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  subject TEXT,
  content TEXT NOT NULL,
  url TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'raw' CHECK (status IN ('raw', 'processing', 'processed', 'error')),
  extracted_rules JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour rechercher par source et status
CREATE INDEX idx_newsletter_source ON newsletter_raw(source);
CREATE INDEX idx_newsletter_status ON newsletter_raw(status);
CREATE INDEX idx_newsletter_captured ON newsletter_raw(captured_at DESC);

-- RLS (Row Level Security) - Optionnel pour usage perso
-- Si tu veux activer RLS, décommente ces lignes :
-- ALTER TABLE newsletter_raw ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for authenticated" ON newsletter_raw FOR ALL USING (true);

-- Commentaire sur la table
COMMENT ON TABLE newsletter_raw IS 'Newsletters capturées pour extraction de bonnes pratiques';
```

### 4. Configurer l'extension

1. Clique sur l'icône de l'extension
2. Va dans ⚙️ Configuration
3. Entre ton **URL Supabase** (ex: `https://abc123.supabase.co`)
4. Entre ta **clé API anon** (pas la service_role !)
5. Clique sur "Tester la connexion"
6. Si tout est vert ✅, c'est bon !

---

## 📖 Utilisation

### Capturer une newsletter

1. Ouvre ta newsletter dans Gmail ou sur Substack
2. Clique sur l'icône de l'extension 📩
3. Sélectionne la **source** (Nina Ramen, Caroline Mignaux, etc.)
4. Ajoute des **tags** si tu veux (LinkedIn, Algorithme, etc.)
5. Choisis le mode :
   - **Page entière** : capture tout le contenu
   - **Sélection** : capture uniquement le texte que tu as sélectionné
6. Clique sur **"Capturer cette newsletter"**
7. ✅ C'est envoyé dans ta base Supabase !

### Voir l'historique

Va dans ⚙️ Configuration pour voir tes 10 dernières captures.

---

## 🔧 Structure des fichiers

```
newsletter-scraper-extension/
├── manifest.json      # Config de l'extension
├── popup.html         # Interface du popup
├── popup.css          # Styles du popup
├── popup.js           # Logique du popup
├── content.js         # Script injecté dans les pages
├── content.css        # Styles injectés (optionnel)
├── background.js      # Service worker
├── options.html       # Page de configuration
├── icons/             # Icônes de l'extension
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # Ce fichier
```

---

## 🔮 Prochaines étapes

Une fois les newsletters capturées, l'IA pourra :

1. **Extraire les règles** (conseils actionnables)
2. **Dédupliquer** (fusionner les conseils similaires)
3. **Reformuler** (en tes propres mots)
4. **Alimenter SOS Storytelling** avec une section "Bonnes Pratiques du moment"

---

## ⚠️ Notes importantes

- Cette extension est pour **usage personnel uniquement**
- Ne commercialise pas l'extension elle-même
- Les newsletters sont stockées pour ta veille perso
- L'IA reformulera tout contenu avant utilisation publique

---

*Made with 💜 pour My Inner Quest*
