# Base d'exemples d'accroches — SOS Storytelling

## Structure de la base

Cette base peut être importée dans Supabase ou utilisée comme référence JSON pour l'IA.

---

## FORMAT JSON

```json
{
  "hooks_examples": [
    
    // ==========================================
    // CATÉGORIE 1 : CONFESSION & VULNÉRABILITÉ
    // ==========================================
    
    {
      "id": "conf-001",
      "category": "confession",
      "trigger": "confession",
      "hook_fr": "J'ai viré mon plus gros client. Mon chiffre d'affaires a doublé en 3 mois.",
      "hook_en": "I fired my biggest client. My revenue doubled in 3 months.",
      "pattern": "confession_resultat",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Paradoxe apparent (virer = perdre de l'argent) + résultat chiffré précis + curiosité (pourquoi ?)"
    },
    {
      "id": "conf-002",
      "category": "confession",
      "trigger": "confession",
      "hook_fr": "Mon lancement a fait 0 vente. Zéro. Voici les 3 erreurs que je ne referai plus.",
      "hook_en": "My launch made 0 sales. Zero. Here are the 3 mistakes I'll never make again.",
      "pattern": "echec_assume",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Vulnérabilité brute + chiffre choc (zéro) + promesse d'apprentissage"
    },
    {
      "id": "conf-003",
      "category": "confession",
      "trigger": "confession",
      "hook_fr": "Je n'ai pas posté pendant 2 mois. J'ai signé 4 nouveaux clients.",
      "hook_en": "I didn't post for 2 months. I signed 4 new clients.",
      "pattern": "confession_resultat",
      "platforms": ["linkedin"],
      "why_it_works": "Contre-intuitif total + chiffres précis des deux côtés"
    },
    {
      "id": "conf-004",
      "category": "confession",
      "trigger": "confession",
      "hook_fr": "Mon premier post LinkedIn a eu 12 vues. Dont 4 étaient moi qui rafraîchissais la page.",
      "hook_en": "My first LinkedIn post got 12 views. 4 of them were me refreshing the page.",
      "pattern": "echec_assume",
      "platforms": ["linkedin"],
      "why_it_works": "Humour autodérision + identification (tout le monde a vécu ça) + spécificité"
    },
    {
      "id": "conf-005",
      "category": "confession",
      "trigger": "confession",
      "hook_fr": "J'ai passé 6 mois à créer une formation que personne n'a achetée. La leçon m'a coûté 8 000€.",
      "hook_en": "I spent 6 months creating a course nobody bought. The lesson cost me €8,000.",
      "pattern": "echec_assume",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Temporalité + échec cuisant + coût précis = crédibilité et curiosité"
    },
    
    // ==========================================
    // CATÉGORIE 2 : PARADOXE & CONTRADICTION
    // ==========================================
    
    {
      "id": "para-001",
      "category": "paradoxe",
      "trigger": "paradoxe",
      "hook_fr": "Plus tu veux vendre, moins tu vends. Laisse-moi t'expliquer.",
      "hook_en": "The more you want to sell, the less you sell. Let me explain.",
      "pattern": "contre_intuitif",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Contradiction directe avec la logique commune + invitation à comprendre"
    },
    {
      "id": "para-002",
      "category": "paradoxe",
      "trigger": "paradoxe",
      "hook_fr": "Moins j'ai de followers, plus je signe de clients. Et c'est mathématique.",
      "hook_en": "The fewer followers I have, the more clients I sign. And it's mathematical.",
      "pattern": "contre_intuitif",
      "platforms": ["linkedin"],
      "why_it_works": "Paradoxe chiffrable + promesse d'explication rationnelle"
    },
    {
      "id": "para-003",
      "category": "paradoxe",
      "trigger": "paradoxe",
      "hook_fr": "On t'a dit qu'il fallait poster tous les jours. C'est faux. Et je vais te montrer pourquoi.",
      "hook_en": "You've been told to post every day. That's wrong. And I'll show you why.",
      "pattern": "mythe_deconstruit",
      "platforms": ["linkedin", "instagram", "tiktok"],
      "why_it_works": "Attaque une croyance répandue + promesse de preuve"
    },
    {
      "id": "para-004",
      "category": "paradoxe",
      "trigger": "paradoxe",
      "hook_fr": "Les hashtags ne servent à rien sur LinkedIn. J'ai testé pendant 6 mois, data à l'appui.",
      "hook_en": "Hashtags are useless on LinkedIn. I tested for 6 months, data included.",
      "pattern": "mythe_deconstruit",
      "platforms": ["linkedin"],
      "why_it_works": "Affirmation tranchée + preuve empirique + durée = crédibilité"
    },
    {
      "id": "para-005",
      "category": "paradoxe",
      "trigger": "paradoxe",
      "hook_fr": "'Apporte de la valeur' est le pire conseil qu'on m'ait donné. Voici pourquoi.",
      "hook_en": "'Provide value' is the worst advice I ever received. Here's why.",
      "pattern": "mythe_deconstruit",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Attaque un mantra universellement accepté = choc + curiosité"
    },
    
    // ==========================================
    // CATÉGORIE 3 : CHIFFRES & SPÉCIFICITÉ
    // ==========================================
    
    {
      "id": "chif-001",
      "category": "chiffres",
      "trigger": "specificite",
      "hook_fr": "Une seule phrase dans ma bio a généré 34 appels découverte en 30 jours.",
      "hook_en": "One sentence in my bio generated 34 discovery calls in 30 days.",
      "pattern": "resultat_precis",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Disproportion effort/résultat + chiffres ultra-précis"
    },
    {
      "id": "chif-002",
      "category": "chiffres",
      "trigger": "specificite",
      "hook_fr": "J'ai changé 3 mots dans mon accroche. +127% de taux de clic.",
      "hook_en": "I changed 3 words in my hook. +127% click-through rate.",
      "pattern": "resultat_precis",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Petit changement = gros résultat + pourcentage précis"
    },
    {
      "id": "chif-003",
      "category": "chiffres",
      "trigger": "specificite",
      "hook_fr": "Ce post m'a pris 7 minutes à écrire. Il a fait 89 000 impressions.",
      "hook_en": "This post took me 7 minutes to write. It got 89,000 impressions.",
      "pattern": "resultat_precis",
      "platforms": ["linkedin"],
      "why_it_works": "Contraste temps investi vs résultat + chiffres précis des deux côtés"
    },
    {
      "id": "chif-004",
      "category": "chiffres",
      "trigger": "specificite",
      "hook_fr": "J'ai testé 47 accroches sur le même sujet. 3 ont cartonné. Les autres ? Bide total.",
      "hook_en": "I tested 47 hooks on the same topic. 3 crushed it. The rest? Total flop.",
      "pattern": "test_experience",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Volume de test impressionnant + ratio échec/succès honnête"
    },
    {
      "id": "chif-005",
      "category": "chiffres",
      "trigger": "specificite",
      "hook_fr": "87% des posts LinkedIn ne dépassent pas 500 vues. Tu fais partie des 13% ?",
      "hook_en": "87% of LinkedIn posts don't get past 500 views. Are you in the 13%?",
      "pattern": "statistique_choc",
      "platforms": ["linkedin"],
      "why_it_works": "Statistique frappante + question qui challenge l'ego"
    },
    
    // ==========================================
    // CATÉGORIE 4 : IDENTIFICATION
    // ==========================================
    
    {
      "id": "iden-001",
      "category": "identification",
      "trigger": "identification",
      "hook_fr": "Tu relis ton post pour la 15ème fois. Tu changes un mot. Puis tu remets l'ancien. Et tu n'oses toujours pas publier.",
      "hook_en": "You reread your post for the 15th time. You change a word. Then change it back. And you still don't dare to publish.",
      "pattern": "cest_toi_ca",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Description hyper-précise d'un comportement que TOUT LE MONDE fait"
    },
    {
      "id": "iden-002",
      "category": "identification",
      "trigger": "identification",
      "hook_fr": "Il est 23h. Tu scrolles LinkedIn. Tu vois un post viral et tu te dis : 'Pourquoi pas moi ?'",
      "hook_en": "It's 11pm. You're scrolling LinkedIn. You see a viral post and think: 'Why not me?'",
      "pattern": "cest_toi_ca",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Moment précis + pensée intime que personne n'avoue = connexion immédiate"
    },
    {
      "id": "iden-003",
      "category": "identification",
      "trigger": "identification",
      "hook_fr": "Tu as 12 brouillons dans tes notes. Aucun n'a jamais vu la lumière du jour.",
      "hook_en": "You have 12 drafts in your notes. None of them have ever seen the light of day.",
      "pattern": "cest_toi_ca",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Chiffre spécifique + situation ultra-relatable + léger sentiment de culpabilité"
    },
    {
      "id": "iden-004",
      "category": "identification",
      "trigger": "identification",
      "hook_fr": "Tu passes 3 heures sur un post. Tu le publies. 4 likes. Dont ta mère.",
      "hook_en": "You spend 3 hours on a post. You publish it. 4 likes. Including your mom.",
      "pattern": "cest_toi_ca",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Effort vs résultat décevant + humour (la mère) = rire jaune d'identification"
    },
    {
      "id": "iden-005",
      "category": "identification",
      "trigger": "identification",
      "hook_fr": "Si tu commences tes posts par 'Aujourd'hui je voulais vous parler de...', ne t'étonne pas du silence.",
      "hook_en": "If you start your posts with 'Today I wanted to talk about...', don't be surprised by the silence.",
      "pattern": "si_tu_fais_ca",
      "platforms": ["linkedin"],
      "why_it_works": "Pointe une erreur commune + conséquence directe = prise de conscience"
    },
    
    // ==========================================
    // CATÉGORIE 5 : URGENCE & ACTUALITÉ
    // ==========================================
    
    {
      "id": "urge-001",
      "category": "urgence",
      "trigger": "urgence",
      "hook_fr": "Si tu fais encore ça en 2025, l'algorithme LinkedIn va t'enterrer.",
      "hook_en": "If you're still doing this in 2025, the LinkedIn algorithm will bury you.",
      "pattern": "avertissement",
      "platforms": ["linkedin"],
      "why_it_works": "Année précise + menace concrète + curiosité (ça quoi ?)"
    },
    {
      "id": "urge-002",
      "category": "urgence",
      "trigger": "urgence",
      "hook_fr": "Les pods LinkedIn sont morts en 2024. Voici ce qui marche maintenant.",
      "hook_en": "LinkedIn pods died in 2024. Here's what works now.",
      "pattern": "obsolescence",
      "platforms": ["linkedin"],
      "why_it_works": "Déclaration de mort + promesse d'alternative actuelle"
    },
    {
      "id": "urge-003",
      "category": "urgence",
      "trigger": "urgence",
      "hook_fr": "Pendant que tu peaufines ton 47ème brouillon, d'autres publient du 'pas parfait' et signent des clients.",
      "hook_en": "While you're perfecting your 47th draft, others are posting 'imperfect' content and signing clients.",
      "pattern": "pendant_que_tu",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Comparaison douloureuse + chiffre précis + résultat concret des autres"
    },
    {
      "id": "urge-004",
      "category": "urgence",
      "trigger": "urgence",
      "hook_fr": "Le contenu 'inspirationnel' ne fonctionne plus. En 2025, ton audience veut ça.",
      "hook_en": "Inspirational content doesn't work anymore. In 2025, your audience wants this.",
      "pattern": "obsolescence",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Annonce d'un changement + année + promesse de révélation"
    },
    {
      "id": "urge-005",
      "category": "urgence",
      "trigger": "urgence",
      "hook_fr": "Pendant que tu cherches le hashtag parfait, tes concurrents testent, échouent, et apprennent.",
      "hook_en": "While you're looking for the perfect hashtag, your competitors are testing, failing, and learning.",
      "pattern": "pendant_que_tu",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Action futile vs actions qui comptent + sentiment d'urgence"
    },
    
    // ==========================================
    // CATÉGORIE 6 : PROVOCATION & OPINION
    // ==========================================
    
    {
      "id": "prov-001",
      "category": "provocation",
      "trigger": "provocation",
      "hook_fr": "Le personal branding, c'est le nouveau MLM. Change my mind.",
      "hook_en": "Personal branding is the new MLM. Change my mind.",
      "pattern": "opinion_tranchee",
      "platforms": ["linkedin", "twitter"],
      "why_it_works": "Comparaison provocante + invitation au débat"
    },
    {
      "id": "prov-002",
      "category": "provocation",
      "trigger": "provocation",
      "hook_fr": "La plupart des formations en ligne sont des arnaques déguisées. Et je suis prête à en débattre.",
      "hook_en": "Most online courses are disguised scams. And I'm ready to debate it.",
      "pattern": "opinion_tranchee",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Attaque frontale d'une industrie + ouverture au débat"
    },
    {
      "id": "prov-003",
      "category": "provocation",
      "trigger": "provocation",
      "hook_fr": "Ce que personne n'ose dire sur les 'success stories' LinkedIn : 80% sont exagérées ou inventées.",
      "hook_en": "What nobody dares to say about LinkedIn success stories: 80% are exaggerated or made up.",
      "pattern": "ce_que_personne_nose_dire",
      "platforms": ["linkedin"],
      "why_it_works": "Révélation d'un secret de polichinelle + pourcentage = crédibilité"
    },
    {
      "id": "prov-004",
      "category": "provocation",
      "trigger": "provocation",
      "hook_fr": "Je refuse de poster tous les jours. Voici pourquoi ça me rapporte plus que les acharnés du quotidien.",
      "hook_en": "I refuse to post every day. Here's why it makes me more money than the daily grinders.",
      "pattern": "je_refuse_de",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Position contre-courant + promesse de résultats supérieurs"
    },
    {
      "id": "prov-005",
      "category": "provocation",
      "trigger": "provocation",
      "hook_fr": "Le syndrome de l'imposteur n'existe pas. C'est juste une excuse confortable.",
      "hook_en": "Impostor syndrome doesn't exist. It's just a comfortable excuse.",
      "pattern": "opinion_tranchee",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Négation d'un concept accepté + accusation directe = réaction garantie"
    },
    
    // ==========================================
    // CATÉGORIE 7 : STORYTELLING & MOMENTS
    // ==========================================
    
    {
      "id": "stor-001",
      "category": "storytelling",
      "trigger": "curiosite",
      "hook_fr": "Mardi dernier, 14h23. Un email qui a tout changé.",
      "hook_en": "Last Tuesday, 2:23pm. An email that changed everything.",
      "pattern": "moment_pivot",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Précision temporelle extrême + promesse de révélation"
    },
    {
      "id": "stor-002",
      "category": "storytelling",
      "trigger": "curiosite",
      "hook_fr": "'Tu ne peux pas vivre de ça.' — Mon père, 2019. Mon CA 2024 : 127K€.",
      "hook_en": "'You can't make a living from that.' — My dad, 2019. My 2024 revenue: €127K.",
      "pattern": "dialogue_retournement",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Citation directe + retournement temporel + preuve chiffrée"
    },
    {
      "id": "stor-003",
      "category": "storytelling",
      "trigger": "curiosite",
      "hook_fr": "C'était en mars 2022. Je venais de raccrocher avec mon comptable. Et j'ai pleuré.",
      "hook_en": "It was March 2022. I had just hung up with my accountant. And I cried.",
      "pattern": "moment_pivot",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Précision temporelle + émotion brute + curiosité (pourquoi ?)"
    },
    {
      "id": "stor-004",
      "category": "storytelling",
      "trigger": "curiosite",
      "hook_fr": "J'ai passé 6 mois à construire mon audience LinkedIn. Plot twist : mes clients viennent d'Instagram.",
      "hook_en": "I spent 6 months building my LinkedIn audience. Plot twist: my clients come from Instagram.",
      "pattern": "plot_twist",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Effort apparent + retournement inattendu = leçon implicite"
    },
    {
      "id": "stor-005",
      "category": "storytelling",
      "trigger": "curiosite",
      "hook_fr": "'C'est trop cher.' Depuis que j'ai augmenté mes prix, plus personne ne dit ça.",
      "hook_en": "'It's too expensive.' Since I raised my prices, nobody says that anymore.",
      "pattern": "dialogue_retournement",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Paradoxe prix + citation universelle + résolution contre-intuitive"
    },
    
    // ==========================================
    // CATÉGORIE 8 : INTERACTIF
    // ==========================================
    
    {
      "id": "inte-001",
      "category": "interactif",
      "trigger": "identification",
      "hook_fr": "Tu es plutôt 'je publie et je disparais' ou 'je réponds à chaque commentaire' ? Ta réponse explique tes résultats.",
      "hook_en": "Are you 'post and ghost' or 'reply to every comment'? Your answer explains your results.",
      "pattern": "sondage_implicite",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Choix binaire + promesse de diagnostic"
    },
    {
      "id": "inte-002",
      "category": "interactif",
      "trigger": "identification",
      "hook_fr": "Commente 'HOOK' si tu galères avec tes accroches. Je t'envoie mes 10 meilleures templates.",
      "hook_en": "Comment 'HOOK' if you struggle with your hooks. I'll send you my 10 best templates.",
      "pattern": "appel_action",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Identification du problème + récompense immédiate + action simple"
    },
    {
      "id": "inte-003",
      "category": "interactif",
      "trigger": "identification",
      "hook_fr": "Finis cette phrase : 'Je posterais plus souvent si...' (Sois honnête)",
      "hook_en": "Finish this sentence: 'I would post more often if...' (Be honest)",
      "pattern": "finis_phrase",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Invitation à l'introspection + permission d'être vulnérable"
    },
    {
      "id": "inte-004",
      "category": "interactif",
      "trigger": "identification",
      "hook_fr": "Tu préfères 1 000 abonnés engagés ou 50 000 fantômes ? Réfléchis bien avant de répondre.",
      "hook_en": "Would you rather have 1,000 engaged followers or 50,000 ghosts? Think carefully before you answer.",
      "pattern": "sondage_implicite",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Choix qui révèle les valeurs + incitation à la réflexion"
    },
    {
      "id": "inte-005",
      "category": "interactif",
      "trigger": "identification",
      "hook_fr": "Dis-moi en commentaire : c'est quoi TON plus gros blocage pour créer du contenu ?",
      "hook_en": "Tell me in the comments: what's YOUR biggest block when creating content?",
      "pattern": "appel_action",
      "platforms": ["linkedin", "instagram"],
      "why_it_works": "Question directe + majuscule sur TON = personnalisation + engagement"
    }
  ]
}
```

---

## UTILISATION DANS SOS

### Pour la génération
L'IA peut s'inspirer de ces exemples pour générer des accroches similaires adaptées au contexte de l'utilisatrice.

### Pour l'apprentissage
Afficher des exemples pertinents selon la catégorie/le déclencheur choisi.

### Pour la validation
Comparer l'accroche générée aux patterns qui fonctionnent.

---

## SQL SUPABASE (optionnel)

```sql
CREATE TABLE hooks_examples (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  trigger TEXT NOT NULL,
  hook_fr TEXT NOT NULL,
  hook_en TEXT,
  pattern TEXT NOT NULL,
  platforms TEXT[] DEFAULT '{}',
  why_it_works TEXT,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_hooks_category ON hooks_examples(category);
CREATE INDEX idx_hooks_trigger ON hooks_examples(trigger);
CREATE INDEX idx_hooks_platforms ON hooks_examples USING GIN(platforms);
```
