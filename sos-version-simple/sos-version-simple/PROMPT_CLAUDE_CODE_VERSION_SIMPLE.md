# Prompt Claude Code — Création de SOS Storytelling Version "Simple"

## 🎯 Contexte

SOS Storytelling existe en version "full" avec beaucoup de fonctionnalités. Le problème : les bêta-testeuses partent dès le jour 1 car l'outil est trop complexe, trop de choix, pas de "wow moment" immédiat.

On veut créer une version "Simple" qui :
- Donne un résultat en 3 clics
- Apprend le ton de l'utilisatrice une seule fois
- Cache toutes les options avancées

**Promesse centrale :**
> "L'anti-ChatGPT générique pour femmes entrepreneures débordées : ton ton, tes clientes, zéro blabla technique."

---

## ⚠️ RÈGLE ABSOLUE : NE PAS ÉCRASER LA VERSION ACTUELLE

Avant de commencer :

1. **Duplique le projet actuel** dans un nouveau dossier `sos-simple/` OU crée une nouvelle branche Git `simple-version`
2. **Garde la version "full" intacte** — on pourra y revenir ou proposer les deux versions
3. **Travaille uniquement sur la copie**

Confirme-moi que tu as fait la duplication avant de continuer.

---

## 📋 CE QU'ON GARDE (visible)

### 1. Onboarding "Clonage de ton" (NOUVEAU)

Remplacer l'onboarding actuel par 3 écrans maximum :

**ÉCRAN 1 : Objectif**
```
Bienvenue dans SOS Storytelling 👋

Tu veux que je t'aide avec quoi en priorité ?

[ ] Posts réseaux sociaux (LinkedIn, Instagram)
[ ] Newsletters
[ ] Mails de lancement / vente

[Continuer →]
```

**ÉCRAN 2 : Clonage du ton**
```
Apprends-moi à écrire comme toi ✍️

Colle ici 3 à 5 textes que tu as écrits 
(posts, mails, pages de vente... ce qui te ressemble)

[Zone de texte grande]

💡 Plus tu me donnes d'exemples, plus je parlerai comme toi.

[Continuer →]
```

**ÉCRAN 3 : Audience**
```
Tu t'adresses principalement à... 🎯

[ ] Entrepreneures / solopreneures
[ ] Coachs / formatrices
[ ] Créatrices de contenu
[ ] Prestataires de services (graphistes, VA, etc.)
[ ] Autre : [_______________]

[Zone optionnelle] En une phrase, c'est quoi leur plus gros problème ?
[_______________]

[C'est parti ! →]
```

**Comportement :**
- Barre de progression visible (1/3, 2/3, 3/3)
- Wording oral, chaleureux, rassurant
- Pas de jargon technique
- On peut skipper l'écran 3 (pré-rempli avec "Entrepreneures" par défaut)

---

### 2. Dashboard épuré (NOUVEAU)

Après l'onboarding, l'utilisatrice arrive sur un dashboard ULTRA SIMPLE :

```
┌─────────────────────────────────────────────────────────────┐
│  SOS Storytelling                            [Mon profil]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Bonjour [Prénom] 👋                                        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  💡 INSPIRATION DU JOUR                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "Les 3 erreurs qui tuent ton engagement LinkedIn"   │   │
│  │                                                     │   │
│  │ [Écrire un post sur ce sujet]                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [🔄 Autre idée]                                            │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  QUE VEUX-TU CRÉER ?                                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │             │  │             │  │             │         │
│  │  📱 POST    │  │  📧 NEWS-   │  │  🚀 MAIL    │         │
│  │  RÉSEAUX   │  │   LETTER    │  │  LANCEMENT  │         │
│  │             │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  📚 Mes contenus récents                                    │
│  • Post LinkedIn — "Comment j'ai..." — il y a 2h           │
│  • Newsletter — "3 astuces pour..." — hier                 │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [⚙️ Options avancées]  ← Discret, en bas, petit           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Les 3 boutons principaux :**

1. **POST RÉSEAUX** → Génération de post (LinkedIn OU Instagram, choix simple)
2. **NEWSLETTER** → Génération de newsletter
3. **MAIL LANCEMENT** → Génération de mail de vente/lancement

---

### 3. Écran de génération simplifié

Quand elle clique sur "POST RÉSEAUX" :

```
┌─────────────────────────────────────────────────────────────┐
│  ← Retour                              📱 Post réseaux      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  De quoi tu veux parler ? *                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Ex: Comment j'ai surmonté mon syndrome de           │   │
│  │ l'imposteur pour enfin lancer mon offre             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Plateforme                                                 │
│  [LinkedIn ▼]  [Instagram]                                  │
│                                                             │
│                                                             │
│            [✨ Générer mon post]                            │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  RÉSULTAT                                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  [Post généré avec le ton de l'utilisatrice]       │   │
│  │                                                     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [📋 Copier]  [🔄 Régénérer]  [💾 Sauvegarder]             │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [⚙️ Plus d'options] ← pour accéder aux options avancées   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**C'est TOUT.** Pas de :
- Sélecteur de framework
- Choix d'émotion
- Choix de format
- Déclencheurs d'accroche
- Modes d'humour
- Personas multiples

Tout ça est caché derrière "Plus d'options".

---

## 📋 CE QU'ON CACHE (dans "Options avancées")

Tout ce qui suit doit être :
- **Retiré de la vue principale**
- **Accessible via un lien discret** "Options avancées" ou "⚙️"
- **Pas supprimé du code** — juste masqué

### À cacher :

| Fonctionnalité | Où la mettre |
|----------------|--------------|
| Frameworks (AIDA, PAS, Golden Circle...) | Options avancées > Frameworks |
| 7 déclencheurs d'accroches | Options avancées > Accroches |
| 3 modes d'humour (Copines/Cash/Caricature) | Options avancées > Ton |
| Personas détaillés | Options avancées > Audiences |
| Intégrations visuelles (Midjourney, DALL-E, Canva) | Options avancées > Visuels |
| Mode Agence | Options avancées > Mode Agence |
| Cascade / Planning | Options avancées > Planning |
| Toutes les plateformes sauf LinkedIn/Instagram | Options avancées > Plateformes |
| Piliers de contenu multiples | Options avancées > Stratégie |
| Formats avancés (carrousel détaillé, etc.) | Options avancées > Formats |

---

## 🤖 MODIFICATION DU PROMPT IA

Le prompt de génération doit :

1. **Utiliser le ton cloné** à l'onboarding (stocké en base)
2. **Utiliser l'audience par défaut** (définie à l'onboarding)
3. **Générer directement** sans demander 14 options

**Structure du prompt simplifié :**

```javascript
const SIMPLE_GENERATION_PROMPT = `
Tu es un copywriter expert qui écrit EXACTEMENT comme cette personne.

SON TON (appris de ses textes) :
${user.cloned_tone}

SON AUDIENCE :
${user.default_audience}

TA MISSION :
Génère un ${contentType} pour ${platform} sur le sujet suivant :
"${userTopic}"

RÈGLES :
- Utilise SON ton, ses expressions, son style
- Parle directement à son audience
- Sois concret et actionnable : inclus toujours 1-2 pistes d'action concrètes (mini-checklist, exemple à copier, phrase prête à l'emploi)
- Accroche qui stoppe le scroll
- Pas de jargon marketing générique
- Pas d'emojis excessifs (max 2-3)

FORMAT :
- ${platform === 'linkedin' ? 'Post LinkedIn optimisé (accroche + corps + CTA)' : 'Post Instagram (caption engageante)'}
`;
```

---

## 🗄️ MODIFICATIONS SUPABASE

### Nouvelle table : `user_tone_clone`

```sql
CREATE TABLE user_tone_clone (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  
  -- Textes sources fournis par l'utilisatrice
  source_texts TEXT[], -- Les 3-5 textes collés
  
  -- Ton analysé par l'IA
  tone_analysis JSONB, -- {style, expressions, à_éviter, signature}
  
  -- Audience par défaut
  default_audience TEXT,
  audience_pain_point TEXT,
  
  -- Préférence de contenu
  primary_content_type TEXT DEFAULT 'posts', -- posts, newsletter, mails
  
  -- Métadonnées
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Fonction d'analyse du ton (à appeler après l'onboarding)

```javascript
async function analyzeUserTone(sourceTexts) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `
Analyse ces textes et extrais le "ton" de la personne.

TEXTES :
${sourceTexts.join('\n\n---\n\n')}

Réponds en JSON :
{
  "style": "description du style général (ex: direct et chaleureux, piquant mais bienveillant...)",
  "expressions_typiques": ["liste", "d'expressions", "récurrentes"],
  "structure_preferee": "comment elle structure ses contenus",
  "a_eviter": ["ce qu'elle", "n'utilise jamais"],
  "signature": "ce qui la rend reconnaissable"
}
`
    }]
  });
  
  return JSON.parse(response.content[0].text);
}
```

---

## 📋 CHECKLIST D'IMPLÉMENTATION

### Phase 1 : Duplication
- [ ] Dupliquer le projet dans `sos-simple/` ou branche `simple-version`
- [ ] Vérifier que la version "full" est intacte

### Phase 2 : Onboarding
- [ ] Créer les 3 écrans d'onboarding
- [ ] Implémenter le clonage de ton (analyse IA)
- [ ] Créer la table `user_tone_clone` dans Supabase
- [ ] Stocker le ton analysé + audience par défaut

### Phase 3 : Dashboard
- [ ] Remplacer le dashboard actuel par la version épurée
- [ ] 3 boutons principaux (Post / Newsletter / Mail)
- [ ] Section "Inspiration du jour" (Trends simplifié)
- [ ] Lien discret "Options avancées" en bas

### Phase 4 : Génération simplifiée
- [ ] Écran de génération avec juste : sujet + plateforme + bouton
- [ ] Prompt IA qui utilise le ton cloné automatiquement
- [ ] Pas d'options visibles (cachées derrière "Plus d'options")

### Phase 5 : Cacher les features avancées
- [ ] Créer une page/section "Options avancées"
- [ ] Y déplacer : frameworks, déclencheurs, humour, personas, visuels, etc.
- [ ] S'assurer que tout fonctionne encore si on y accède

---

## 🎯 CRITÈRES DE SUCCÈS

La version "Simple" est réussie si :

1. **Onboarding < 3 minutes** — 3 écrans, pas plus
2. **Premier contenu généré < 1 minute** après l'onboarding
3. **3 clics max** pour générer : Dashboard → Type → Générer
4. **"Wow moment"** — Le contenu généré ressemble VRAIMENT au ton de l'utilisatrice
5. **Zéro friction** — Pas de choix paralysants, pas de jargon

---

## ⚠️ POINTS D'ATTENTION

1. **Le clonage de ton est CRITIQUE** — C'est LE différenciateur. Si le contenu sonne générique, on a perdu.

2. **Trends doit être simple** — Juste une idée + bouton "Écrire sur ce sujet". Pas de configuration.

3. **Les options avancées restent accessibles** — Pour les power users qui veulent aller plus loin, mais JAMAIS en premier.

4. **Mobile-first** — Les entrepreneures débordées sont souvent sur leur téléphone.

5. **Wording chaleureux** — Pas de "Configurez vos paramètres". Plutôt "De quoi tu veux parler ?".

---

## 🚀 POUR COMMENCER

1. Confirme que tu as dupliqué le projet
2. Montre-moi la structure actuelle des fichiers
3. Propose un plan d'action pour les 5 phases
4. Commence par l'onboarding (Phase 2)

Des questions avant de démarrer ?
