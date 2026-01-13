// ===========================================
// i18n.js - Systeme d'internationalisation
// SOS Storytelling - FR/EN
// ===========================================

const I18N = {
    // Langue actuelle
    currentLanguage: 'fr',

    // Traductions
    translations: {
        // ================== FRANCAIS ==================
        fr: {
            // Common
            app_name: "SOS Storytelling",
            nav: {
                dashboard: "Tableau de bord",
                generate: "Générer",
                prospects: "Prospects",
                campaigns: "Campagnes",
                settings: "Paramètres",
                my_voice: "Mon Style",
                newsletters: "Newsletters",
                visuals: "Visuels"
            },

            // Config Panel
            config: {
                title: "Configuration",
                structure: "Structure narrative",
                format: "Format",
                platform: "Plateforme",
                ad_platform: "Plateforme publicitaire",
                ad_objective: "Objectif de la campagne",
                agency_mode: "Mode Agence",
                agency_desc: "Multi-clients, dashboard & exports",
                unlock: "Débloquer",
                active_client: "Client actif",
                no_client: "-- Aucun client --",
                framework: "Framework",
                manage_frameworks: "Gérer mes frameworks",
                idea: "Ton idée / sujet",
                idea_placeholder: "Décris ton idée ou colle ici un texte que tu veux améliorer...",
                trends_hint: "Ou laisse l'IA sélectionner les dernières tendances dans ta niche",
                trends_btn: "TRENDS",
                then_press: "Puis appuie sur",
                generate_btn: "Générer mon contenu",
                your_content: "Ton contenu",
                ad_info: "L'IA va générer ta pub avec 3 variantes A/B + les prompts visuels adaptés à la plateforme !"
            },

            // Structures
            structures: {
                aida: "AIDA",
                golden_circle: "Golden Circle",
                hero_journey: "Voyage du Héros",
                before_after: "Avant / Après",
                hook_story_cta: "Hook + Story + CTA",
                storybrand: "StoryBrand",
                pattern_interrupt: "Pattern Interrupt",
                three_acts: "3 Actes"
            },

            // Formats
            formats: {
                post: "Post",
                carousel: "Carousel",
                reel: "Reel",
                story: "Story",
                thread: "Thread",
                article: "Article",
                pub: "PUB"
            },

            // Ad objectives
            ad_objectives: {
                conversion: "Conversion",
                traffic: "Trafic",
                awareness: "Notoriété",
                engagement: "Engagement",
                leads: "Leads"
            },

            // Home page
            home: {
                title: "Que veux-tu faire ?",
                subtitle: "Clique et c'est parti !"
            },

            // Modals
            modals: {
                cascade: "Ma Cascade",
                plan_content: "Planifier un contenu",
                trends: "Idées tendance pour toi",
                email_choice: "Quel type d'email veux-tu créer ?",
                newsletters: "Newsletters qui Convertissent",
                brevo_connection: "Connexion Brevo",
                prospects: "Mes Prospects",
                campaigns: "Prospection par email",
                favorites: "Mes contenus favoris",
                help: "Help! Améliore mon texte",
                stats: "Ma progression",
                planning: "Planning IA",
                voice: "Mon Style",
                agency_dashboard: "Dashboard Agence",
                agency_unlock: "Débloquer Mode Agence",
                client_form: "Fiche Client",
                register: "Crée ton compte gratuit",
                onboarding: "Bienvenue"
            },

            actions: {
                save: "Enregistrer",
                cancel: "Annuler",
                delete: "Supprimer",
                edit: "Modifier",
                copy: "Copier",
                download: "Télécharger",
                import: "Importer",
                export: "Exporter",
                generate: "Générer",
                send: "Envoyer",
                preview: "Prévisualiser",
                close: "Fermer",
                confirm: "Confirmer",
                back: "Retour",
                next: "Suivant",
                create: "Réseaux Sociaux",
                search: "Rechercher",
                filter: "Filtrer",
                select_all: "Tout sélectionner",
                regenerate: "Régénérer",
                variants: "3 Variantes",
                save_fav: "Sauver",
                save_to_posts: "Sauvegarder dans Mes Posts",
                analyze: "Analyser et améliorer",
                validate: "Valider",
                today: "Aujourd'hui",
                new_client: "Nouveau client",
                add: "Ajouter"
            },

            // Menu buttons
            menu: {
                create: "Réseaux Sociaux",
                content: "Contenu",
                visuals: "Visuels",
                emails: "Emails",
                newsletters: "Newsletters",
                sequences: "Séquences",
                prospects: "Prospects",
                dashboard: "Dashboard",
                stats: "Stats",
                planning: "Planning",
                agency: "Agence",
                settings: "Paramètres",
                my_profile: "Mon Profil",
                my_voice: "Mon Style",
                help: "Aide",
                autopilot: "Autopilot",
                write_post: "Écrire un post",
                newsletter_section: "Newsletter (nurturing)",
                create_newsletter: "Créer une newsletter",
                connect_brevo: "Connecter Brevo/Mailchimp",
                outreach_section: "Cold Outreach (prospection)",
                my_prospects: "Mes prospects",
                create_campaign: "Créer une campagne",
                my_stats: "Mes stats",
                my_posts: "Mes posts",
                favorites: "Favoris",
                agency_dashboard: "Dashboard Agence",
                brevo_connection: "Connexion Brevo",
                logout: "Déconnexion",
                team: "Mon équipe",
                missions: "Missions Multi-Agents"
            },
            status: {
                loading: "Chargement...",
                success: "Succès !",
                error: "Une erreur est survenue",
                saved: "Enregistré",
                sending: "Envoi en cours...",
                sent: "Envoyé",
                pending: "En attente"
            },

            // Toast messages
            toasts: {
                copied: "Copié !",
                saved: "Enregistré !",
                deleted: "Supprimé !",
                error: "Une erreur est survenue",
                idea_required: "Décris ton idée !",
                generating: "Génération...",
                framework_saved: "Framework enregistré !",
                framework_deleted: "Framework supprimé",
                framework_duplicated: "Framework dupliqué !",
                framework_selected: "Framework sélectionné !",
                template_added: "Template ajouté à vos frameworks !",
                method_added: "Méthode ajoutée à vos frameworks !",
                client_saved: "Client sauvegardé !",
                text_added: "Texte ajouté !",
                text_deleted: "Texte supprimé",
                agency_activated: "Mode Agence activé !",
                agency_deactivated: "Mode Agence désactivé",
                level_up: "Niveau {level} atteint !",
                name_required: "Veuillez entrer un nom",
                step_required: "Ajoutez au moins une étape",
                text_too_short: "Le texte doit faire au moins 50 caractères",
                text_too_long: "Le texte est trop long (max 5000 caractères)",
                max_texts: "Maximum 10 textes",
                import_cancelled: "Import annulé",
                data_deleted: "Données supprimées",
                all_clients_deleted: "Toutes les données clients supprimées",
                coming_soon: "Bientôt disponible !",
                client_name_required: "Le nom du client est requis",
                min_2_texts: "Ajoute au moins 2 textes",
                voice_analyzed: "Voix du client analysée !",
                client_deleted: "Client supprimé",
                csv_template_downloaded: "Modèle CSV téléchargé avec 3 exemples !",
                rgpd_required: "Veuillez accepter les conditions RGPD",
                clients_imported: "{count} client(s) importé(s) avec succès !",
                csv_exported: "Export CSV téléchargé !",
                client_selected: "{name} sélectionné",
                no_client_to_export: "Aucun client à exporter",
                rgpd_exported: "Données clients exportées (RGPD) !",
                consent_revoked: "Consentement révoqué et données supprimées",
                add_content: "Ajoute du contenu !",
                content_planned: "Contenu planifié !",
                no_content_to_export: "Aucun contenu à exporter",
                content_exported: "{count} contenus exportés !",
                saved_to_posts: "Sauvegardé dans Mes Posts !",
                generate_first: "Génère d'abord du contenu !",
                generate_first_short: "Génère d'abord",
                valid_email_required: "Entre un email valide !",
                welcome_user: "Bienvenue {name} !",
                error_retry: "Erreur, réessaie !",
                register_first: "Inscris-toi d'abord pour utiliser un code !",
                enter_code: "Entre un code !",
                code_activated: "Code activé ! Profite de ton accès {plan}",
                max_ideas: "Maximum 50 idées sauvegardées !",
                already_saved: "Déjà sauvegardée !",
                idea_not_found: "Erreur : idée non trouvée. Régénère les idées.",
                idea_saved: "Idée sauvegardée !",
                idea_deleted: "Idée supprimée",
                session_deleted: "Session supprimée",
                idea_copied: "Idée copiée ! Tu peux générer ton contenu",
                ad_angle_selected: "Angle pub sélectionné ! Génère ta pub",
                style_saved: "Style enregistré !",
                configure_voice: "Configure d'abord ta voix pour continuer",
                voice_profile_deleted: "Profil de voix supprimé",
                voice_profile_created: "Profil de voix créé !",
                paste_text: "Colle un texte",
                no_content: "Aucun contenu",
                loaded: "Chargé !",
                tour_paused: "Tour en pause - fermez le modal pour continuer",
                onboarding_complete: "Tu es prêt·e à créer ! (Clique sur 'Démo guidée' pour revoir)",
                add_more_texts_voice: "Ajoute plus de textes dans 'Ma Voix' pour améliorer la fidélité !",
                saved_to_favorites: "Sauvegardé !"
            },

            // Placeholders
            placeholders: {
                idea: "Décris ton idée ou colle ici un texte que tu veux améliorer...",
                paste_text: "Colle ton texte ici...",
                search: "Rechercher...",
                api_key: "xkeysib-xxxxxxxx...",
                email: "toi@tondomaine.com",
                name: "Ton prénom",
                activation_code: "CODE D'ACTIVATION",
                client_name: "Ex: Café Joyeux, Marie Dupont Coaching...",
                domain: "Ex: Optique, Coaching, SaaS, Restauration...",
                unique_message: "Ce qui rend ce client unique, sa proposition de valeur...",
                audience: "Ex: Femmes 25-45 ans, CSP+, urbaines...",
                pillars: "Ex: conseils mode, coulisses, témoignages clients",
                tags: "Ex: #optique #lunettes #style",
                voice_sample: "Colle ici un texte écrit par le client...",
                notes: "Contraintes, ton à éviter, anecdotes...",
                framework_name: "Ex: Script appel découverte",
                framework_desc: "Ex: Pour qualifier un prospect en 15 min",
                step_name: "Nom de l'étape (ex: Accroche)",
                step_desc: "Description (ex: Créer le lien)",
                chatbot_question: "Posez votre question..."
            },

            // Quick actions (home page cards)
            quick_actions: {
                write_post: "Écrire un post",
                create_campaign: "Créer une campagne mail",
                what_to_do: "Que veux-tu faire ?",
                click_go: "Clique et c'est parti !"
            },

            // Frameworks
            frameworks: {
                no_framework: "Sans framework",
                manage: "Gérer mes frameworks"
            },

            // Tour guide (démo guidée)
            tour: {
                step: "Étape",
                of: "sur",
                skip: "Passer",
                next: "Suivant",
                finish: "Terminer",
                step1_title: "Commencez ici !",
                step1_text: "<strong>Étape 1 :</strong> Cliquez sur \"<strong>Mon profil</strong>\" pour remplir le questionnaire onboarding. C'est essentiel pour personnaliser vos contenus !<br><br>Ensuite, configurez \"<strong>Ma Voix</strong>\" pour que l'IA capture votre style d'écriture unique.",
                step2_title: "Ma Voix",
                step2_text: "<strong>Étape 2 :</strong> Colle des textes <strong>vraiment écrits par toi</strong> (pas générés par IA) pour que l'analyse capture ton <strong>ton authentique</strong>. Plus tes textes sont personnels, plus ta voix sera fidèle !",
                step3_title: "TRENDS",
                step3_text: "Découvre les tendances du moment ! 5 idées de contenu qui buzzent, adaptées à ton profil. Clique sur une idée pour la développer.",
                step4_title: "Structures narratives",
                step4_text: "<strong>AIDA</strong> pour vendre, <strong>Voyage du Héros</strong> pour inspirer, <strong>Pattern Interrupt</strong> pour surprendre... Chaque structure a son super-pouvoir !",
                step5_title: "Gérer mes frameworks",
                step5_text: "Crée tes propres frameworks ou <strong>importe-les</strong> depuis un fichier CSV/JSON ! <br><br>Après avoir importé un framework, clique sur \"<strong>Enregistrer</strong>\" pour qu'il apparaisse dans la liste de gauche.",
                step6_title: "Formats & Plateformes",
                step6_text: "Post classique, Carousel, Reel, Story... L'IA adapte la longueur et le ton selon la plateforme choisie.",
                step7_title: "Ton idée",
                step7_text: "Décris ton sujet en quelques mots, ou colle un texte existant à améliorer. Pas d'inspiration ? Explore les <strong>TRENDS</strong> !",
                step8_title: "Zone de résultat",
                step8_text: "Ton contenu apparaît ici avec l'effet machine à écrire. L'IA se souvient de tes anciens contenus pour toujours proposer du <strong>nouveau</strong> !",
                step9_title: "Mode Agence",
                step9_text: "Active le <strong>Mode Agence</strong> pour accéder au Dashboard : gestion multi-clients, <strong>import CSV</strong>, stats de production et export des données !<br><br>Une fois activé, clique sur \"Dashboard Agence\" dans le menu en haut.",
                step10_title: "Stats & Progression",
                step10_text: "Suis ta progression personnelle : XP, badges débloqués, niveaux atteints. Chaque contenu généré te fait gagner de l'expérience !",
                step11_title: "Planning IA",
                step11_text: "L'IA analyse tes contenus sauvegardés et te suggère un <strong>planning optimal</strong> : meilleurs créneaux par plateforme, équilibre des piliers, prochaines priorités !",
                step12_title: "Favoris",
                step12_text: "Sauvegarde tes meilleurs contenus pour les retrouver facilement. Jusqu'à 20 favoris stockés dans ton navigateur.",
                step13_title: "Mémoire intelligente",
                step13_text: "Tithot se souvient de tes contenus ! Elle alterne automatiquement tes piliers et évite de répéter les mêmes sujets."
            },

            // Chatbot FAQ
            chatbot: {
                title: "Assistant SOS",
                subtitle: "Je réponds à tes questions !",
                placeholder: "Posez votre question...",
                greeting: "Bonjour ! Je suis l'assistant SOS Storytelling. Je peux répondre à vos questions sur les fonctionnalités, les tarifs, Ma Voix, le Planning IA... Que souhaitez-vous savoir ?",
                typing: "En train d'écrire..."
            },

            // Welcome popup
            welcome: {
                title: "Bienvenue sur SOS Storytelling !",
                profile_edit: "Modifier mon profil",
                profile_create: "Bienvenue !"
            },

            // Confirmations et erreurs
            confirm_delete: "Supprimer cet élément ?",
            confirm_delete_multiple: "Supprimer {count} élément(s) ?",
            error_csv_required: "Veuillez sélectionner un fichier CSV",
            error_csv_empty: "Le fichier CSV semble vide ou mal formaté",
            error_required_fields: "Les champs Email et Prénom sont obligatoires",
            more: "autres",
            view_details: "Voir détails",

            // Prospects
            prospects: {
                title: "Mes Prospects",
                subtitle: "Gère ta liste de prospects et lance des campagnes personnalisées",
                empty: "Aucun prospect. Importe ta première liste !",
                add_manual: "Ajouter manuellement",
                total: "Total",

                import: {
                    title: "Importer des prospects",
                    drag_drop: "Glisse ton fichier CSV ici ou clique pour parcourir",
                    formats: "Formats acceptés : CSV",
                    template: "Télécharger un modèle CSV",
                    pharow_tip: "Tu utilises Pharow ? Exporte en CSV et importe ici.",
                    apollo_tip: "Tu utilises Apollo ? Exporte ta liste et importe ici.",
                    mapping_title: "Associer les colonnes",
                    mapping_description: "Associe les colonnes de ton fichier aux champs SOS Storytelling",
                    required: "Champs obligatoires",
                    ignore: "-- Ignorer --",
                    preview: "Aperçu : {count} prospects détectés",
                    duplicates: "{count} doublons ignorés",
                    invalid_emails: "{count} emails invalides",
                    success: "{count} prospects importés avec succès !"
                },

                fields: {
                    first_name: "Prénom",
                    last_name: "Nom",
                    email: "Email",
                    company: "Entreprise",
                    job_title: "Poste",
                    linkedin: "LinkedIn",
                    phone: "Téléphone",
                    website: "Site web",
                    sector: "Secteur",
                    city: "Ville",
                    company_size: "Effectif",
                    notes: "Notes",
                    tags: "Tags",
                    source: "Source"
                },

                list: {
                    search: "Rechercher...",
                    filters: "Filtres",
                    all: "Tous",
                    new: "Nouveaux",
                    contacted: "Contactés",
                    replied: "Ont répondu",
                    selected: "{count} sélectionné(s)"
                },

                status: {
                    new: "Nouveau",
                    contacted: "Contacté",
                    opened: "A ouvert",
                    clicked: "A cliqué",
                    replied: "A répondu",
                    converted: "Converti",
                    unsubscribed: "Désabonné",
                    bounced: "Bounce"
                }
            },

            // Campaigns
            campaigns: {
                title: "Mes Campagnes",
                subtitle: "Crée et gère tes campagnes email personnalisées",
                empty: "Aucune campagne. Crée ta première campagne !",
                new_campaign: "Nouvelle Campagne",
                no_prospects: "Aucun prospect à contacter",

                form: {
                    name: "Nom de la campagne",
                    name_placeholder: "Ex: Prospection agences Q1 2025",
                    goal: "Objectif de la campagne",
                    goal_placeholder: "Ex: Proposer mes services de création de contenu aux agences",
                    sender_email: "Email expéditeur",
                    sender_name: "Nom expéditeur",
                    sender_name_placeholder: "Ex: Sandra Devonssay",
                    reply_to: "Répondre à (optionnel)",
                    use_my_voice: "Utiliser 'Ma Voix' pour personnaliser",
                    generate_unique: "Générer un email unique par prospect",
                    language: "Langue des emails"
                },

                prospects_selection: {
                    title: "Sélection des prospects",
                    all: "Tous mes prospects",
                    only_new: "Seulement les nouveaux",
                    with_tag: "Avec le tag",
                    count: "{count} prospects sélectionnés"
                },

                email_creation: {
                    title: "Création de l'email",
                    generate_ai: "Générer avec l'IA",
                    write_manual: "Écrire moi-même",
                    subject: "Objet",
                    subject_options: "Options d'objet",
                    body: "Corps de l'email",
                    variables_hint: "Variables disponibles : {first_name}, {company}, {job_title}"
                },

                preview: {
                    title: "Prévisualisation",
                    for_prospect: "Pour : {name} ({company})",
                    previous: "Précédent",
                    next: "Suivant",
                    ready: "{count} emails prêts à envoyer"
                },

                status: {
                    draft: "Brouillon",
                    scheduled: "Programmée",
                    sending: "En cours",
                    sent: "Envoyée",
                    paused: "En pause"
                },

                actions: {
                    send_now: "Envoyer maintenant",
                    schedule: "Programmer",
                    pause: "Mettre en pause",
                    resume: "Reprendre"
                },

                stats: {
                    sent: "Envoyés",
                    opened: "Ouverts",
                    clicked: "Cliqués",
                    replied: "Réponses",
                    bounced: "Bounces"
                }
            },

            // AI Generation
            ai: {
                generating: "Génération en cours...",
                generated: "Contenu généré !",
                regenerate: "Régénérer",
                use_my_voice: "Utiliser Ma Voix",
                tone: "Ton",
                tone_professional: "Professionnel",
                tone_friendly: "Amical",
                tone_casual: "Décontracté"
            },

            // Settings
            settings: {
                title: "Paramètres",
                language: {
                    title: "Langue de l'interface",
                    french: "Français",
                    english: "English"
                },
                brevo: {
                    title: "Intégration Brevo",
                    connected: "Connecté",
                    not_connected: "Non connecté",
                    api_key: "Clé API Brevo",
                    verify_domain: "Vérifier le domaine"
                }
            },

            // Errors
            errors: {
                required_field: "Ce champ est requis",
                invalid_email: "Email invalide",
                no_prospects: "Aucun prospect sélectionné",
                send_failed: "Échec de l'envoi",
                import_failed: "Échec de l'import"
            }
        },

        // ================== ENGLISH ==================
        en: {
            // Common
            app_name: "SOS Storytelling",
            nav: {
                dashboard: "Dashboard",
                generate: "Generate",
                prospects: "Prospects",
                campaigns: "Campaigns",
                settings: "Settings",
                my_voice: "My Voice",
                newsletters: "Newsletters",
                visuals: "Visuals"
            },

            // Config Panel
            config: {
                title: "Configuration",
                structure: "Narrative Structure",
                format: "Format",
                platform: "Platform",
                ad_platform: "Ad Platform",
                ad_objective: "Campaign Objective",
                agency_mode: "Agency Mode",
                agency_desc: "Multi-clients, dashboard & exports",
                unlock: "Unlock",
                active_client: "Active Client",
                no_client: "-- No client --",
                framework: "Framework",
                manage_frameworks: "Manage my frameworks",
                idea: "Your idea / topic",
                idea_placeholder: "Describe your idea or paste text you want to improve...",
                trends_hint: "Or let AI select the latest trends in your niche",
                trends_btn: "TRENDS",
                then_press: "Then press",
                generate_btn: "Generate my content",
                your_content: "Your content",
                ad_info: "AI will generate your ad with 3 A/B variants + visual prompts adapted to the platform!"
            },

            // Structures
            structures: {
                aida: "AIDA",
                golden_circle: "Golden Circle",
                hero_journey: "Hero's Journey",
                before_after: "Before / After",
                hook_story_cta: "Hook + Story + CTA",
                storybrand: "StoryBrand",
                pattern_interrupt: "Pattern Interrupt",
                three_acts: "3 Acts"
            },

            // Formats
            formats: {
                post: "Post",
                carousel: "Carousel",
                reel: "Reel",
                story: "Story",
                thread: "Thread",
                article: "Article",
                pub: "AD"
            },

            // Ad objectives
            ad_objectives: {
                conversion: "Conversion",
                traffic: "Traffic",
                awareness: "Awareness",
                engagement: "Engagement",
                leads: "Leads"
            },

            // Home page
            home: {
                title: "What do you want to do?",
                subtitle: "Click and let's go!"
            },

            // Modals
            modals: {
                cascade: "My Cascade",
                plan_content: "Plan content",
                trends: "Trending ideas for you",
                email_choice: "What type of email do you want to create?",
                newsletters: "Newsletters that Convert",
                brevo_connection: "Brevo Connection",
                prospects: "My Prospects",
                campaigns: "Email Prospecting",
                favorites: "My favorite content",
                help: "Help! Improve my text",
                stats: "My progress",
                planning: "AI Planning",
                voice: "My Voice",
                agency_dashboard: "Agency Dashboard",
                agency_unlock: "Unlock Agency Mode",
                client_form: "Client Profile",
                register: "Create your free account",
                onboarding: "Welcome"
            },

            actions: {
                save: "Save",
                cancel: "Cancel",
                delete: "Delete",
                edit: "Edit",
                copy: "Copy",
                download: "Download",
                import: "Import",
                export: "Export",
                generate: "Generate",
                send: "Send",
                preview: "Preview",
                close: "Close",
                confirm: "Confirm",
                back: "Back",
                next: "Next",
                create: "Create",
                search: "Search",
                filter: "Filter",
                select_all: "Select all",
                regenerate: "Regenerate",
                variants: "3 Variants",
                save_fav: "Save",
                save_to_posts: "Save to My Posts",
                analyze: "Analyze and improve",
                validate: "Validate",
                today: "Today",
                new_client: "New client",
                add: "Add"
            },

            // Menu buttons
            menu: {
                create: "Create",
                content: "Content",
                visuals: "Visuals",
                emails: "Emails",
                newsletters: "Newsletters",
                sequences: "Sequences",
                prospects: "Prospects",
                dashboard: "Dashboard",
                stats: "Stats",
                planning: "Planning",
                agency: "Agency",
                settings: "Settings",
                my_profile: "My Profile",
                my_voice: "My Voice",
                help: "Help",
                autopilot: "Autopilot",
                write_post: "Write a post",
                newsletter_section: "Newsletter (nurturing)",
                create_newsletter: "Create a newsletter",
                connect_brevo: "Connect Brevo/Mailchimp",
                outreach_section: "Cold Outreach (prospecting)",
                my_prospects: "My prospects",
                create_campaign: "Create a campaign",
                my_stats: "My stats",
                my_posts: "My posts",
                favorites: "Favorites",
                agency_dashboard: "Agency Dashboard",
                brevo_connection: "Brevo Connection"
            },
            status: {
                loading: "Loading...",
                success: "Success!",
                error: "An error occurred",
                saved: "Saved",
                sending: "Sending...",
                sent: "Sent",
                pending: "Pending"
            },

            // Toast messages
            toasts: {
                copied: "Copied!",
                saved: "Saved!",
                deleted: "Deleted!",
                error: "An error occurred",
                idea_required: "Describe your idea!",
                generating: "Generating...",
                framework_saved: "Framework saved!",
                framework_deleted: "Framework deleted",
                framework_duplicated: "Framework duplicated!",
                framework_selected: "Framework selected!",
                template_added: "Template added to your frameworks!",
                method_added: "Method added to your frameworks!",
                client_saved: "Client saved!",
                text_added: "Text added!",
                text_deleted: "Text deleted",
                agency_activated: "Agency Mode activated!",
                agency_deactivated: "Agency Mode deactivated",
                level_up: "Level {level} reached!",
                name_required: "Please enter a name",
                step_required: "Add at least one step",
                text_too_short: "Text must be at least 50 characters",
                text_too_long: "Text is too long (max 5000 characters)",
                max_texts: "Maximum 10 texts",
                import_cancelled: "Import cancelled",
                data_deleted: "Data deleted",
                all_clients_deleted: "All client data deleted",
                coming_soon: "Coming soon!",
                client_name_required: "Client name is required",
                min_2_texts: "Add at least 2 texts",
                voice_analyzed: "Client voice analyzed!",
                client_deleted: "Client deleted",
                csv_template_downloaded: "CSV template downloaded with 3 examples!",
                rgpd_required: "Please accept GDPR conditions",
                clients_imported: "{count} client(s) imported successfully!",
                csv_exported: "CSV export downloaded!",
                client_selected: "{name} selected",
                no_client_to_export: "No client to export",
                rgpd_exported: "Client data exported (GDPR)!",
                consent_revoked: "Consent revoked and data deleted",
                add_content: "Add content!",
                content_planned: "Content planned!",
                no_content_to_export: "No content to export",
                content_exported: "{count} contents exported!",
                saved_to_posts: "Saved to My Posts!",
                generate_first: "Generate content first!",
                generate_first_short: "Generate first",
                valid_email_required: "Enter a valid email!",
                welcome_user: "Welcome {name}!",
                error_retry: "Error, try again!",
                register_first: "Sign up first to use a code!",
                enter_code: "Enter a code!",
                code_activated: "Code activated! Enjoy your {plan} access",
                max_ideas: "Maximum 50 ideas saved!",
                already_saved: "Already saved!",
                idea_not_found: "Error: idea not found. Regenerate ideas.",
                idea_saved: "Idea saved!",
                idea_deleted: "Idea deleted",
                session_deleted: "Session deleted",
                idea_copied: "Idea copied! You can generate your content",
                ad_angle_selected: "Ad angle selected! Generate your ad",
                style_saved: "Style saved!",
                configure_voice: "Configure your voice first to continue",
                voice_profile_deleted: "Voice profile deleted",
                voice_profile_created: "Voice profile created!",
                paste_text: "Paste some text",
                no_content: "No content",
                loaded: "Loaded!",
                tour_paused: "Tour paused - close the modal to continue",
                onboarding_complete: "You're ready to create! (Click 'Guided Demo' to review)",
                add_more_texts_voice: "Add more texts in 'My Voice' to improve accuracy!",
                saved_to_favorites: "Saved!"
            },

            // Placeholders
            placeholders: {
                idea: "Describe your idea or paste text you want to improve...",
                paste_text: "Paste your text here...",
                search: "Search...",
                api_key: "xkeysib-xxxxxxxx...",
                email: "you@yourdomain.com",
                name: "Your name",
                activation_code: "ACTIVATION CODE",
                client_name: "Ex: Happy Cafe, John Doe Coaching...",
                domain: "Ex: Optics, Coaching, SaaS, Restaurant...",
                unique_message: "What makes this client unique, their value proposition...",
                audience: "Ex: Women 25-45, urban professionals...",
                pillars: "Ex: fashion tips, behind the scenes, testimonials",
                tags: "Ex: #optics #glasses #style",
                voice_sample: "Paste here a text written by the client...",
                notes: "Constraints, tone to avoid, anecdotes...",
                framework_name: "Ex: Discovery call script",
                framework_desc: "Ex: To qualify a prospect in 15 min",
                step_name: "Step name (ex: Hook)",
                step_desc: "Description (ex: Create connection)",
                chatbot_question: "Ask your question..."
            },

            // Quick actions (home page cards)
            quick_actions: {
                write_post: "Write a post",
                create_campaign: "Create an email campaign",
                what_to_do: "What do you want to do?",
                click_go: "Click and let's go!"
            },

            // Frameworks
            frameworks: {
                no_framework: "No framework",
                manage: "Manage my frameworks"
            },

            // Tour guide (guided demo)
            tour: {
                step: "Step",
                of: "of",
                skip: "Skip",
                next: "Next",
                finish: "Finish",
                step1_title: "Start here!",
                step1_text: "<strong>Step 1:</strong> Click on \"<strong>My Profile</strong>\" to fill the onboarding questionnaire. It's essential to personalize your content!<br><br>Then, configure \"<strong>My Voice</strong>\" so AI captures your unique writing style.",
                step2_title: "My Voice",
                step2_text: "<strong>Step 2:</strong> Paste texts <strong>actually written by you</strong> (not AI-generated) so the analysis captures your <strong>authentic tone</strong>. The more personal your texts, the more faithful your voice!",
                step3_title: "TRENDS",
                step3_text: "Discover trending topics! 5 content ideas that are buzzing, adapted to your profile. Click on an idea to develop it.",
                step4_title: "Narrative Structures",
                step4_text: "<strong>AIDA</strong> to sell, <strong>Hero's Journey</strong> to inspire, <strong>Pattern Interrupt</strong> to surprise... Each structure has its superpower!",
                step5_title: "Manage my frameworks",
                step5_text: "Create your own frameworks or <strong>import them</strong> from a CSV/JSON file!<br><br>After importing a framework, click \"<strong>Save</strong>\" for it to appear in the left list.",
                step6_title: "Formats & Platforms",
                step6_text: "Classic Post, Carousel, Reel, Story... AI adapts length and tone based on the chosen platform.",
                step7_title: "Your idea",
                step7_text: "Describe your topic in a few words, or paste existing text to improve. No inspiration? Explore <strong>TRENDS</strong>!",
                step8_title: "Result area",
                step8_text: "Your content appears here with a typewriter effect. AI remembers your old content to always suggest something <strong>new</strong>!",
                step9_title: "Agency Mode",
                step9_text: "Activate <strong>Agency Mode</strong> to access the Dashboard: multi-client management, <strong>CSV import</strong>, production stats and data export!<br><br>Once activated, click on \"Agency Dashboard\" in the top menu.",
                step10_title: "Stats & Progress",
                step10_text: "Track your personal progress: XP, unlocked badges, levels reached. Each generated content earns you experience!",
                step11_title: "AI Planning",
                step11_text: "AI analyzes your saved content and suggests an <strong>optimal schedule</strong>: best time slots per platform, pillar balance, next priorities!",
                step12_title: "Favorites",
                step12_text: "Save your best content to find it easily. Up to 20 favorites stored in your browser.",
                step13_title: "Smart Memory",
                step13_text: "Tithot remembers your content! It automatically alternates your pillars and avoids repeating the same topics."
            },

            // Chatbot FAQ
            chatbot: {
                title: "SOS Assistant",
                subtitle: "I answer your questions!",
                placeholder: "Ask your question...",
                greeting: "Hello! I'm the SOS Storytelling assistant. I can answer your questions about features, pricing, My Voice, AI Planning... What would you like to know?",
                typing: "Typing..."
            },

            // Welcome popup
            welcome: {
                title: "Welcome to SOS Storytelling!",
                profile_edit: "Edit my profile",
                profile_create: "Welcome!"
            },

            // Confirmations and errors
            confirm_delete: "Delete this item?",
            confirm_delete_multiple: "Delete {count} item(s)?",
            error_csv_required: "Please select a CSV file",
            error_csv_empty: "The CSV file appears to be empty or malformed",
            error_required_fields: "Email and First Name fields are required",
            more: "more",
            view_details: "View details",

            // Prospects
            prospects: {
                title: "My Prospects",
                subtitle: "Manage your prospect list and launch personalized campaigns",
                empty: "No prospects yet. Import your first list!",
                add_manual: "Add manually",
                total: "Total",

                import: {
                    title: "Import Prospects",
                    drag_drop: "Drag your CSV file here or click to browse",
                    formats: "Accepted formats: CSV",
                    template: "Download CSV template",
                    pharow_tip: "Using Pharow? Export as CSV and import here.",
                    apollo_tip: "Using Apollo? Export your list and import here.",
                    mapping_title: "Map Columns",
                    mapping_description: "Match your file columns to SOS Storytelling fields",
                    required: "Required fields",
                    ignore: "-- Ignore --",
                    preview: "Preview: {count} prospects detected",
                    duplicates: "{count} duplicates ignored",
                    invalid_emails: "{count} invalid emails",
                    success: "{count} prospects imported successfully!"
                },

                fields: {
                    first_name: "First Name",
                    last_name: "Last Name",
                    email: "Email",
                    company: "Company",
                    job_title: "Job Title",
                    linkedin: "LinkedIn",
                    phone: "Phone",
                    website: "Website",
                    sector: "Sector",
                    city: "City",
                    company_size: "Company Size",
                    notes: "Notes",
                    tags: "Tags",
                    source: "Source"
                },

                list: {
                    search: "Search...",
                    filters: "Filters",
                    all: "All",
                    new: "New",
                    contacted: "Contacted",
                    replied: "Replied",
                    selected: "{count} selected"
                },

                status: {
                    new: "New",
                    contacted: "Contacted",
                    opened: "Opened",
                    clicked: "Clicked",
                    replied: "Replied",
                    converted: "Converted",
                    unsubscribed: "Unsubscribed",
                    bounced: "Bounced"
                }
            },

            // Campaigns
            campaigns: {
                title: "My Campaigns",
                subtitle: "Create and manage your personalized email campaigns",
                empty: "No campaigns yet. Create your first campaign!",
                new_campaign: "New Campaign",
                no_prospects: "No prospects to contact",

                form: {
                    name: "Campaign name",
                    name_placeholder: "Ex: Agency outreach Q1 2025",
                    goal: "Campaign goal",
                    goal_placeholder: "Ex: Offer my content creation services to agencies",
                    sender_email: "Sender email",
                    sender_name: "Sender name",
                    sender_name_placeholder: "Ex: Sandra Devonssay",
                    reply_to: "Reply to (optional)",
                    use_my_voice: "Use 'My Voice' for personalization",
                    generate_unique: "Generate unique email per prospect",
                    language: "Email language"
                },

                prospects_selection: {
                    title: "Prospect selection",
                    all: "All my prospects",
                    only_new: "Only new ones",
                    with_tag: "With tag",
                    count: "{count} prospects selected"
                },

                email_creation: {
                    title: "Email creation",
                    generate_ai: "Generate with AI",
                    write_manual: "Write myself",
                    subject: "Subject",
                    subject_options: "Subject options",
                    body: "Email body",
                    variables_hint: "Available variables: {first_name}, {company}, {job_title}"
                },

                preview: {
                    title: "Preview",
                    for_prospect: "For: {name} ({company})",
                    previous: "Previous",
                    next: "Next",
                    ready: "{count} emails ready to send"
                },

                status: {
                    draft: "Draft",
                    scheduled: "Scheduled",
                    sending: "Sending",
                    sent: "Sent",
                    paused: "Paused"
                },

                actions: {
                    send_now: "Send now",
                    schedule: "Schedule",
                    pause: "Pause",
                    resume: "Resume"
                },

                stats: {
                    sent: "Sent",
                    opened: "Opened",
                    clicked: "Clicked",
                    replied: "Replies",
                    bounced: "Bounced"
                }
            },

            // AI Generation
            ai: {
                generating: "Generating...",
                generated: "Content generated!",
                regenerate: "Regenerate",
                use_my_voice: "Use My Voice",
                tone: "Tone",
                tone_professional: "Professional",
                tone_friendly: "Friendly",
                tone_casual: "Casual"
            },

            // Settings
            settings: {
                title: "Settings",
                language: {
                    title: "Interface language",
                    french: "Francais",
                    english: "English"
                },
                brevo: {
                    title: "Brevo Integration",
                    connected: "Connected",
                    not_connected: "Not connected",
                    api_key: "Brevo API Key",
                    verify_domain: "Verify domain"
                }
            },

            // Errors
            errors: {
                required_field: "This field is required",
                invalid_email: "Invalid email",
                no_prospects: "No prospects selected",
                send_failed: "Send failed",
                import_failed: "Import failed"
            }
        }
    },

    /**
     * Initialise le systeme i18n
     */
    async init() {
        // Charger la langue depuis localStorage ou profil utilisateur
        const savedLang = localStorage.getItem('sos_language');
        if (savedLang && ['fr', 'en'].includes(savedLang)) {
            this.currentLanguage = savedLang;
        }

        // Langue gérée via localStorage uniquement (app française par défaut)

        // Mettre a jour l'attribut lang du HTML
        document.documentElement.lang = this.currentLanguage;

        return this.currentLanguage;
    },

    /**
     * Obtenir une traduction
     * @param {string} key - Cle de traduction (ex: "prospects.title")
     * @param {object} params - Parametres pour interpolation (ex: {count: 5})
     */
    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];

        for (const k of keys) {
            if (value && value[k] !== undefined) {
                value = value[k];
            } else {
                // Fallback vers francais
                value = this.translations['fr'];
                for (const fk of keys) {
                    if (value && value[fk] !== undefined) {
                        value = value[fk];
                    } else {
                        return key; // Retourner la cle si non trouve
                    }
                }
                break;
            }
        }

        // Interpolation des parametres
        if (typeof value === 'string' && Object.keys(params).length > 0) {
            for (const [param, val] of Object.entries(params)) {
                value = value.replace(new RegExp(`{${param}}`, 'g'), val);
            }
        }

        return value;
    },

    /**
     * Changer la langue
     * @param {string} lang - 'fr' ou 'en'
     */
    async setLanguage(lang) {
        if (!['fr', 'en'].includes(lang)) return;

        // Ne rien faire si c'est déjà la langue actuelle
        if (lang === this.currentLanguage) return lang;

        this.currentLanguage = lang;
        localStorage.setItem('sos_language', lang);
        document.documentElement.lang = lang;

        // Sauvegarder en BDD si connecte
        if (window.supabaseApp) {
            try {
                const { data: { user } } = await window.supabaseApp.auth.getUser();
                if (user) {
                    await window.supabaseApp
                        .from('users')
                        .update({ language: lang })
                        .eq('id', user.id);
                }
            } catch (e) {
                console.log('Could not save language to profile');
            }
        }

        // Declencher un evenement pour mettre a jour l'UI
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));

        // Recharger la page pour appliquer la nouvelle langue
        window.location.reload();

        return lang;
    },

    /**
     * Obtenir la langue actuelle
     */
    getLanguage() {
        return this.currentLanguage;
    },

    /**
     * Creer le composant toggle langue
     */
    createLanguageToggle() {
        const container = document.createElement('div');
        container.className = 'language-toggle';
        container.innerHTML = `
            <button class="lang-btn ${this.currentLanguage === 'fr' ? 'active' : ''}" data-lang="fr">
                FR
            </button>
            <button class="lang-btn ${this.currentLanguage === 'en' ? 'active' : ''}" data-lang="en">
                EN
            </button>
        `;

        container.querySelectorAll('.lang-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.dataset.lang;
                this.setLanguage(lang);
                container.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        return container;
    }
};

// Raccourci global pour les traductions
window.t = (key, params) => I18N.t(key, params);
window.I18N = I18N;

/**
 * Mettre à jour tous les éléments avec data-i18n
 */
I18N.updateAllTranslations = function() {
    // Mettre à jour les éléments avec data-i18n (textContent)
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translation = this.t(key);
        if (translation && translation !== key) {
            el.textContent = translation;
        }
    });

    // Mettre à jour les placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translation = this.t(key);
        if (translation && translation !== key) {
            el.placeholder = translation;
        }
    });

    // Mettre à jour les titres (title attribute)
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const translation = this.t(key);
        if (translation && translation !== key) {
            el.title = translation;
        }
    });
};

// Écouter les changements de langue
window.addEventListener('languageChanged', () => {
    I18N.updateAllTranslations();
});

// CSS pour le toggle langue
const i18nStyles = document.createElement('style');
i18nStyles.textContent = `
.language-toggle {
    display: inline-flex;
    gap: 5px;
    background: #f0f4ff;
    padding: 4px;
    border-radius: 8px;
}

.lang-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.85em;
    font-weight: 600;
    cursor: pointer;
    background: transparent;
    color: #667eea;
    transition: all 0.2s;
}

.lang-btn:hover {
    background: rgba(102, 126, 234, 0.1);
}

.lang-btn.active {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}
`;
document.head.appendChild(i18nStyles);
