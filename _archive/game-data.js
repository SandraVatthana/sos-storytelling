// DONNÉES DU JEU - 64 CASES
// Thèmes : storytelling, visual, video, engagement, tools, growth, emotions, special
const cases = [
    // Case 0 - Départ
    {
        title: "🚀 DÉPART",
        description: "Bienvenue dans ton voyage créatif ! Tu vas découvrir comment créer du contenu captivant pour les réseaux sociaux, maîtriser le storytelling, et développer ta créativité. Lance le dé pour commencer ton aventure !",
        cometMission: "Donne-moi 3 conseils ultra-pratiques pour démarrer ma stratégie de contenu sur les réseaux sociaux quand on part de zéro.",
        type: "start",
        theme: "special"
    },
    // Cases 1-10 : Bases du storytelling
    {
        title: "Qu'est-ce que le storytelling ?",
        description: "Le storytelling est l'art de raconter des histoires pour créer une connexion émotionnelle avec ton audience. C'est bien plus qu'un simple message : c'est une expérience.",
        cometMission: "Explique-moi ce qu'est le storytelling sur les réseaux sociaux et donne-moi 2 exemples concrets de marques qui le font bien.",
        type: "normal",
        theme: "storytelling"
    },
    {
        title: "Identifier son audience",
        description: "Pour créer du contenu qui résonne, tu dois d'abord comprendre qui tu veux toucher : leurs besoins, leurs peurs, leurs rêves.",
        cometMission: "Aide-moi à créer le portrait-robot de mon audience idéale (persona) pour mes réseaux sociaux. Pose-moi des questions pour m'aider.",
        type: "normal",
        theme: "storytelling"
    },
    {
        title: "Trouver son ton",
        description: "Ton ton de communication est ta signature. Es-tu plutôt humoristique, sérieux, inspirant, décalé ? Il doit être authentique et cohérent.",
        cometMission: "Je veux définir mon ton de communication. Donne-moi des questions à me poser pour trouver ce qui me correspond vraiment.",
        type: "normal",
        theme: "storytelling"
    },
    {
        title: "Le pouvoir des émotions",
        description: "Les histoires qui marquent sont celles qui touchent le cœur : joie, surprise, nostalgie, espoir... Les émotions créent l'engagement.",
        cometMission: "Explique-moi comment intégrer les émotions dans mes posts sur les réseaux sociaux. Donne-moi des techniques concrètes.",
        type: "normal",
        theme: "emotions"
    },
    {
        title: "5 éléments d'une histoire impactante",
        description: "Toute bonne histoire contient : un personnage, un problème, une transformation, une émotion, et un message. C'est ta formule magique !",
        cometMission: "Détaille-moi les 5 éléments essentiels d'une histoire captivante et donne-moi un exemple appliqué à un post Instagram.",
        type: "normal",
        theme: "storytelling"
    },
    {
        title: "Construire un pitch en 3 phrases",
        description: "Tu as 3 secondes pour capter l'attention. Ton pitch doit être clair, percutant et donner envie d'en savoir plus.",
        cometMission: "Aide-moi à créer un pitch en 3 phrases pour présenter mon activité/projet sur les réseaux sociaux.",
        type: "normal",
        theme: "storytelling"
    },
    {
        title: "🎯 DÉFI : Anecdote marquante",
        description: "Écris une anecdote personnelle (100-150 mots) qui révèle quelque chose sur toi et qui pourrait créer une connexion avec ton audience. Partage-la sur Instagram, TikTok ou LinkedIn !",
        cometMission: "J'ai écrit une anecdote personnelle pour mes réseaux sociaux. Peux-tu l'analyser et me donner des conseils pour la rendre encore plus impactante ? Voici mon texte : [colle ton texte]",
        type: "challenge",
        theme: "special"
    },
    {
        title: "Capter l'attention en 3 secondes",
        description: "Sur les réseaux sociaux, tu as 3 secondes pour faire arrêter le scroll. Les premières secondes sont CRUCIALES.",
        cometMission: "Donne-moi 5 techniques ultra-efficaces pour capter l'attention dans les 3 premières secondes d'une vidéo ou d'un post.",
        type: "normal",
        theme: "storytelling"
    },
    {
        title: "L'importance de l'ouverture visuelle",
        description: "Ton visuel d'ouverture doit être irrésistible : couleurs, contraste, composition... Tout compte pour faire stopper le scroll !",
        cometMission: "Explique-moi comment créer une ouverture visuelle qui fait stopper le scroll. Quels sont les éléments clés ?",
        type: "normal",
        theme: "visual"
    },
    {
        title: "💥 BUZZ INATTENDU !",
        description: "Un de tes posts génère un buzz incroyable ! Ton contenu est partagé massivement. Saute 5 cases en avant !",
        cometMission: "Donne-moi 3 idées de stories Instagram créatives que je peux publier dès maintenant pour générer de l'engagement.",
        type: "mega-forward",
        theme: "special"
    },
    // Cases 11-20 : Création visuelle et formats
    {
        title: "Découverte de Canva",
        description: "Canva est ton meilleur ami pour créer des visuels professionnels sans être designer. Templates, outils intuitifs, magic !",
        cometMission: "Guide-moi pour créer mon premier visuel professionnel sur Canva. Quels sont les templates et fonctions essentiels à connaître ?",
        type: "normal",
        theme: "visual"
    },
    {
        title: "Jouer avec les couleurs",
        description: "Les couleurs créent des émotions et renforcent ton identité. Comprendre les contrastes et l'harmonie est essentiel.",
        cometMission: "Explique-moi la psychologie des couleurs sur les réseaux sociaux et aide-moi à choisir ma palette de 3-4 couleurs principales.",
        type: "normal",
        theme: "visual"
    },
    {
        title: "Typographie : choisir la bonne police",
        description: "La police de caractères n'est pas qu'esthétique : elle transmet ta personnalité et facilite (ou pas !) la lecture.",
        cometMission: "Comment choisir les bonnes polices de caractères pour mes visuels ? Donne-moi des règles simples et des combinaisons qui fonctionnent.",
        type: "normal",
        theme: "visual"
    },
    {
        title: "Mise en page mobile-friendly",
        description: "90% de ton audience te regarde sur mobile. Tes visuels doivent être lisibles en petit format avec du texte bien placé.",
        cometMission: "Donne-moi les règles d'or pour créer des visuels parfaitement adaptés au format mobile. Tailles, zones de sécurité, etc.",
        type: "normal",
        theme: "visual"
    },
    {
        title: "Vidéo courte : Reels efficaces",
        description: "Les Reels et vidéos courtes sont le format roi en 2025. Format vertical, rythme rapide, hooks puissants : tu dois maîtriser ça !",
        cometMission: "Explique-moi la structure parfaite d'un Reel/TikTok efficace : durée, hooks, transitions, call-to-action.",
        type: "normal",
        theme: "video"
    },
    {
        title: "🎯 DÉFI : Mini vidéo 15s",
        description: "Réalise une mini vidéo de 15 secondes maximum où tu partages un tip, une astuce ou une présentation de toi. Poste-la sur Instagram Reels, TikTok ou LinkedIn !",
        cometMission: "J'ai filmé une vidéo de 15 secondes pour Instagram/TikTok/LinkedIn. Donne-moi des conseils pour l'améliorer : cadrage, montage, texte, musique, accroche.",
        type: "challenge",
        theme: "special"
    },
    {
        title: "Photo qui raconte une histoire",
        description: "Une seule photo peut raconter mille histoires. Composition, lumière, émotion : l'art de la photo narrative.",
        cometMission: "Comment transformer une simple photo en storytelling visuel captivant ? Donne-moi des techniques et exemples.",
        type: "normal",
        theme: "visual"
    },
    {
        title: "Panorama des formats",
        description: "Stories, posts, Reels, carrousels, lives... Chaque format a ses spécificités et ses usages stratégiques.",
        cometMission: "Fais-moi un panorama complet des formats de contenu sur Instagram, TikTok et LinkedIn. Quand utiliser chaque format ?",
        type: "normal",
        theme: "video"
    },
    {
        title: "Optimiser pour chaque plateforme",
        description: "Instagram ≠ TikTok ≠ LinkedIn. Dimensions, durées, codes : adapte ton contenu pour maximiser l'impact sur chaque réseau.",
        cometMission: "Donne-moi un tableau récapitulatif des formats optimaux (dimensions, durées, fréquence) pour Instagram, TikTok et LinkedIn.",
        type: "normal",
        theme: "tools"
    },
    {
        title: "😰 BAD BUZZ !",
        description: "Oups ! Un post mal compris génère des réactions négatives. Recule de 3 cases et apprends à mieux anticiper les réactions de ton audience.",
        cometMission: "Donne-moi 5 techniques concrètes pour anticiper et éviter un bad buzz sur Instagram, TikTok ou LinkedIn.",
        type: "bad-buzz",
        theme: "special"
    },
    // Cases 21-30 : Engagement et algorithmes
    {
        title: "L'algorithme Instagram 2025",
        description: "Comprendre l'algorithme c'est comprendre ce qu'Instagram veut : engagement, temps passé, interactions authentiques.",
        cometMission: "Explique-moi comment fonctionne l'algorithme Instagram en 2025 et donne-moi 5 actions concrètes pour booster ma visibilité.",
        type: "normal",
        theme: "engagement"
    },
    {
        title: "Hashtags stratégiques",
        description: "Les hashtags sont toujours puissants s'ils sont bien utilisés : mix de taille, pertinence, communauté ciblée.",
        cometMission: "Comment choisir mes hashtags stratégiquement ? Donne-moi une méthode pour trouver les meilleurs hashtags pour mon niche.",
        type: "normal",
        theme: "engagement"
    },
    {
        title: "Calendrier éditorial simple",
        description: "La régularité bat la perfection. Un calendrier éditorial simple t'aide à rester constant sans t'épuiser.",
        cometMission: "Aide-moi à créer un calendrier éditorial simple pour mes réseaux sociaux. Quelle fréquence ? Quels types de contenus alterner ?",
        type: "normal",
        theme: "tools"
    },
    {
        title: "Répondre aux commentaires",
        description: "Les commentaires ne sont pas du bruit : c'est de l'OR ! Répondre rapidement booste ton engagement et crée de la communauté.",
        cometMission: "Donne-moi des techniques pour gérer et répondre aux commentaires de façon authentique et engageante.",
        type: "normal",
        theme: "engagement"
    },
    {
        title: "Stories pour multiplier les interactions",
        description: "Les stories offrent plein d'outils d'interaction : sondages, questions, quiz, sliders... Utilise-les pour créer du lien !",
        cometMission: "Donne-moi 10 idées créatives de stories interactives qui vont générer de l'engagement avec mon audience.",
        type: "normal",
        theme: "engagement"
    },
    {
        title: "Animation des lives",
        description: "Les lives créent une connexion authentique et instantanée. Prépare ton format, ton flow, et lance-toi !",
        cometMission: "Comment préparer et animer mon premier live sur Instagram ou TikTok ? Structure, durée, sujets, interaction.",
        type: "normal",
        theme: "video"
    },
    {
        title: "🎯 DÉFI : 3 hashtags à appliquer",
        description: "Trouve 3 hashtags pertinents pour ton niche et utilise-les sur ton prochain post Instagram, TikTok ou LinkedIn. Analyse ensuite les résultats !",
        cometMission: "Je travaille dans [ton domaine]. Aide-moi à trouver 3 hashtags stratégiques (1 petit, 1 moyen, 1 gros) pour Instagram/TikTok/LinkedIn et explique-moi pourquoi.",
        type: "challenge",
        theme: "special"
    },
    {
        title: "🔥 TENDANCES 2025",
        description: "Découvre les tendances qui dominent les réseaux sociaux en 2025 : IA générative, authenticité radicale, vidéos verticales ultra-courtes, micro-communities, et social commerce intégré.",
        cometMission: "Explique-moi les 5 tendances majeures des réseaux sociaux en 2025 et donne-moi 3 actions concrètes pour les exploiter sur Instagram, TikTok et LinkedIn.",
        type: "trends",
        theme: "special"
    },
    {
        title: "🔥 POST VIRAL !",
        description: "Ton live est un succès EXPLOSIF ! Partages, likes, nouveaux abonnés... Tu as créé quelque chose de mémorable. Rejoue ton tour immédiatement !",
        cometMission: "Donne-moi 3 sujets de lives qui cartonnent actuellement sur Instagram, TikTok et YouTube et explique pourquoi ils fonctionnent.",
        type: "viral-post",
        theme: "special"
    },
    // Cases 31-40 : Outils avancés et gestion
    {
        title: "Outils de montage vidéo gratuits",
        description: "CapCut, InShot, Canva Video : des outils gratuits et puissants pour créer des vidéos pro sans budget.",
        cometMission: "Compare-moi les meilleurs outils gratuits de montage vidéo pour réseaux sociaux. Lequel me conseilles-tu selon mes besoins ?",
        type: "normal",
        theme: "tools"
    },
    {
        title: "Automatiser ses publications",
        description: "Later, Buffer, Meta Business Suite : programme tes posts à l'avance pour rester constant sans être esclave de ton phone.",
        cometMission: "Explique-moi comment automatiser mes publications sur les réseaux sociaux. Quels outils utiliser ? Quelle stratégie ?",
        type: "normal",
        theme: "tools"
    },
    {
        title: "Linktree et landing pages",
        description: "Un seul lien dans ta bio ? Maximise-le avec Linktree, Beacons ou un mini site pour diriger ton trafic stratégiquement.",
        cometMission: "Aide-moi à structurer mon Linktree ou landing page. Quels liens mettre en priorité ? Comment optimiser les clics ?",
        type: "normal",
        theme: "tools"
    },
    {
        title: "SEO social",
        description: "Oui, le SEO existe sur les réseaux ! Mots-clés dans ta bio, tes posts, tes légendes : optimise pour être trouvé·e.",
        cometMission: "Explique-moi comment optimiser mon profil et mes contenus pour le SEO sur Instagram et TikTok. Mots-clés, hashtags, description.",
        type: "normal",
        theme: "tools"
    },
    {
        title: "Storytelling visuel sans mots",
        description: "Parfois, les images parlent mieux que les mots. Crée des récits puissants uniquement avec des visuels.",
        cometMission: "Donne-moi des techniques pour créer un storytelling visuel puissant sans utiliser de texte. Séquences, transitions, émotions.",
        type: "normal",
        theme: "visual"
    },
    {
        title: "🎯 DÉFI : Storyboard d'une story",
        description: "Crée le storyboard (plan détaillé) d'une story en 5-7 slides qui raconte une transformation ou un avant/après.",
        cometMission: "Je veux créer une story en plusieurs slides sur [ton sujet]. Aide-moi à construire un storyboard captivant avec un arc narratif.",
        type: "challenge",
        theme: "special"
    },
    {
        title: "Recyclage de contenu",
        description: "Un bon contenu peut vivre plusieurs fois ! Réutilise, adapte, transforme : maximise l'impact de chaque création.",
        cometMission: "Explique-moi comment recycler intelligemment mes contenus sur différents formats et plateformes. Donne-moi des exemples concrets.",
        type: "normal",
        theme: "tools"
    },
    {
        title: "Analytics pour ajuster",
        description: "Les données sont tes meilleures amies : taux d'engagement, reach, clics... Analyse et ajuste ta stratégie en continu.",
        cometMission: "Quels sont les indicateurs (KPIs) essentiels à suivre sur Instagram et TikTok ? Comment les interpréter pour m'améliorer ?",
        type: "normal",
        theme: "tools"
    },
    {
        title: "Gérer les collaborations",
        description: "Partenariats, sponsorisations, échanges : apprends à négocier, cadrer et valoriser les collaborations intelligemment.",
        cometMission: "Comment gérer mes premières collaborations avec des marques ou d'autres créateurs ? Tarifs, contrats, livrables.",
        type: "normal",
        theme: "growth"
    },
    {
        title: "📉 ALGORITHM DROP !",
        description: "L'algorithme a baissé ta visibilité... Tes posts ne sont plus mis en avant. Passe ton prochain tour et analyse ce qui n'a pas marché.",
        cometMission: "J'ai l'impression que l'algorithme me pénalise sur Instagram/TikTok. Aide-moi à identifier les erreurs courantes et comment retrouver ma visibilité.",
        type: "algorithm-drop",
        theme: "special"
    },
    // Cases 41-50 : Créativité émotionnelle
    {
        title: "Émotions positives et négatives",
        description: "Les émotions positives attirent, les négatives engagent. Apprends à doser et utiliser le spectre émotionnel complet.",
        cometMission: "Explique-moi comment utiliser stratégiquement les émotions positives ET négatives dans mes contenus pour créer de l'impact.",
        type: "normal",
        theme: "emotions"
    },
    {
        title: "Histoires inspirantes vraies",
        description: "Les vraies histoires touchent toujours plus. Tes échecs, tes victoires, tes transformations : c'est ça qui connecte.",
        cometMission: "Aide-moi à structurer une histoire personnelle inspirante pour mes réseaux sociaux. Comment la rendre captivante sans me surexposer ?",
        type: "normal",
        theme: "emotions"
    },
    {
        title: "Identité visuelle cohérente",
        description: "Couleurs, filtres, style : ton identité visuelle te rend reconnaissable au premier coup d'œil. Cohérence = pro.",
        cometMission: "Guide-moi pour créer une identité visuelle cohérente sur mes réseaux sociaux. Palette, filtres, templates, style.",
        type: "normal",
        theme: "visual"
    },
    {
        title: "🎯 DÉFI : Storytelling produit",
        description: "Choisis un produit/service (le tien ou un autre) et crée un storytelling captivant autour. Pas de promo directe !",
        cometMission: "Je veux créer un storytelling autour de [produit/service]. Aide-moi à trouver l'angle émotionnel et narratif pour captiver sans vendre frontalement.",
        type: "challenge",
        theme: "special"
    },
    {
        title: "Légendes qui incitent à l'action",
        description: "Ta légende (caption) doit créer de l'engagement : poser des questions, inviter au partage, donner envie de commenter.",
        cometMission: "Donne-moi 10 formules de légendes qui génèrent de l'engagement et incitent à l'action sur Instagram.",
        type: "normal",
        theme: "engagement"
    },
    {
        title: "Humour et authenticité",
        description: "L'humour désamorce, connecte, rend mémorable. L'authenticité crée la confiance. Trouve ton équilibre entre les deux.",
        cometMission: "Comment intégrer de l'humour dans mes contenus de façon authentique sans forcer ? Donne-moi des techniques et exemples.",
        type: "normal",
        theme: "emotions"
    },
    {
        title: "Révéler les coulisses",
        description: "Behind the scenes, échecs, process : montrer les coulisses humanise et crée une connexion plus forte.",
        cometMission: "Donne-moi 10 idées de contenus 'coulisses' authentiques que je peux partager pour créer du lien avec mon audience.",
        type: "normal",
        theme: "emotions"
    },
    {
        title: "Storytelling en publicité digitale",
        description: "Même en pub, le storytelling bat les messages promotionnels. Crée des pubs qui racontent plutôt que qui vendent.",
        cometMission: "Comment créer une publicité Instagram/Facebook avec du storytelling plutôt qu'un message promotionnel classique ?",
        type: "normal",
        theme: "growth"
    },
    {
        title: "Fédérer une communauté",
        description: "Une communauté se construit autour de valeurs et d'histoires partagées. Crée des rituels, du sens, de l'appartenance.",
        cometMission: "Donne-moi des stratégies concrètes pour transformer mes abonnés en communauté engagée qui partage mes valeurs.",
        type: "normal",
        theme: "engagement"
    },
    {
        title: "🎁 PARTENARIAT SURPRISE !",
        description: "Une marque te contacte pour une collaboration ! Cette opportunité te permet de sauter directement à une case de ton choix parmi les prochaines 10 cases !",
        cometMission: "Donne-moi les ingrédients d'un post viral sur Instagram ou TikTok. Qu'est-ce qui fait qu'un contenu est massivement partagé ?",
        type: "partnership",
        theme: "special"
    },
    // Cases 51-60 : Croissance et monétisation
    {
        title: "Gain de followers réels",
        description: "Oublie l'achat de followers ! Croissance organique = valeur, authenticité, contenus qui apportent quelque chose.",
        cometMission: "Donne-moi une stratégie en 7 étapes pour gagner 1000 vrais followers engagés sur Instagram en 3 mois.",
        type: "normal",
        theme: "growth"
    },
    {
        title: "Présence cross-plateforme",
        description: "Ne mets pas tous tes œufs dans le même panier : diversifie intelligemment sur plusieurs réseaux complémentaires.",
        cometMission: "Comment construire une présence cross-plateforme efficace sans me disperser ? Quels réseaux prioriser selon mon domaine ?",
        type: "normal",
        theme: "growth"
    },
    {
        title: "Créer des challenges",
        description: "Les challenges viralisent, créent du mouvement, fédèrent. Lance un challenge qui mobilise ta communauté !",
        cometMission: "Aide-moi à créer un challenge viral pour ma communauté sur Instagram ou TikTok. Structure, hashtag, mécanique.",
        type: "normal",
        theme: "engagement"
    },
    {
        title: "Newsletter liée aux réseaux",
        description: "Email > algorithmes. Construis une liste email en parallèle de tes réseaux pour créer une audience que tu possèdes vraiment.",
        cometMission: "Comment lancer une newsletter simple liée à mes réseaux sociaux ? Lead magnet, outils, fréquence, contenu.",
        type: "normal",
        theme: "growth"
    },
    {
        title: "Micro-moments : contenus courts",
        description: "Moins mais mieux, et souvent. Des micro-contenus réguliers valent mieux que des posts longs espacés.",
        cometMission: "Donne-moi 15 idées de micro-contenus courts (tips, quotes, mini-vidéos) que je peux créer rapidement et régulièrement.",
        type: "normal",
        theme: "video"
    },
    {
        title: "🎯 DÉFI : Concept de campagne virale",
        description: "Propose un concept créatif de campagne virale pour ton domaine : hashtag, mécanique, objectif, storytelling.",
        cometMission: "Je veux créer une campagne virale dans [ton domaine]. Aide-moi à conceptualiser l'idée, la mécanique et le storytelling.",
        type: "challenge",
        theme: "special"
    },
    {
        title: "Développer son personal branding",
        description: "Ton personal branding = ce que les gens disent de toi quand tu n'es pas là. Construis-le consciemment.",
        cometMission: "Guide-moi pour développer mon personal branding sur les réseaux sociaux. Valeurs, positionnement, différenciation.",
        type: "normal",
        theme: "growth"
    },
    {
        title: "Gestion des critiques et bad buzz",
        description: "Critiques, haters, bad buzz : apprends à gérer avec recul, authenticité et stratégie. Tout le monde en prend.",
        cometMission: "Donne-moi une méthode pour gérer les critiques négatives et un potentiel bad buzz sur les réseaux sociaux.",
        type: "normal",
        theme: "growth"
    },
    {
        title: "Évaluer sa stratégie par la data",
        description: "Les chiffres ne mentent pas : analyse régulièrement tes performances pour ajuster et optimiser en continu.",
        cometMission: "Aide-moi à créer un tableau de bord simple pour suivre et évaluer ma stratégie de contenu. Quels KPIs ? Quelle fréquence ?",
        type: "normal",
        theme: "tools"
    },
    {
        title: "Campagne de promotion efficace",
        description: "Lancement, offre, événement : structure une vraie campagne promo qui convertit sans être spam.",
        cometMission: "Je veux promouvoir [produit/service/événement]. Aide-moi à structurer une campagne promo efficace sur les réseaux sociaux.",
        type: "normal",
        theme: "growth"
    },
    // Cases 61-64 : Conclusion
    {
        title: "Résumé des apprentissages",
        description: "Tu as parcouru un chemin incroyable ! Prends un moment pour noter les 10 choses les plus importantes que tu as apprises.",
        cometMission: "Aide-moi à synthétiser tout ce que j'ai appris dans ce parcours. Quels sont mes 10 points clés à retenir absolument ?",
        type: "normal",
        theme: "special"
    },
    {
        title: "Plan d'action personnel",
        description: "Transformer l'apprentissage en action : crée ton plan d'action sur 30 jours pour mettre en pratique tout ce que tu as appris.",
        cometMission: "Aide-moi à créer un plan d'action sur 30 jours pour appliquer concrètement tout ce que j'ai appris. Étapes, priorités, objectifs.",
        type: "normal",
        theme: "special"
    },
    {
        title: "🏆 DÉFI FINAL",
        description: "🎉 BRAVO ! Tu as terminé le voyage ! Maintenant, crée un contenu complet (post + visuel + légende) qui intègre tout : storytelling, visuel impactant, engagement. Partage-le et tag-nous !",
        cometMission: "Pour mon défi final, je veux créer LE post parfait qui synthétise tout ce que j'ai appris. Aide-moi à le concevoir de A à Z : concept, visuel, légende, stratégie.",
        type: "challenge",
        theme: "special"
    },
    {
        title: "🏆 FÉLICITATIONS !",
        description: "Tu as terminé ton voyage créatif ! Tu maîtrises maintenant le storytelling, la création visuelle, l'engagement, et toutes les stratégies pour réussir sur les réseaux sociaux. Continue à créer, à partager, et à inspirer ! 🌟<br><br>🎮 <strong>Tu as aimé ? Découvre d'autres jeux !</strong><br><a href='https://linktr.ee/myinnerquest' target='_blank' style='color: #667eea; font-weight: bold; text-decoration: underline;'>Clique ici pour plus de jeux 🎨</a>",
        cometMission: "Je viens de terminer un parcours complet sur la création de contenu pour les réseaux sociaux. Donne-moi 3 défis avancés pour continuer à progresser et devenir encore meilleur·e.",
        type: "normal",
        theme: "special"
    }
];
