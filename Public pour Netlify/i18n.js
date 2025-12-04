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
                generate: "Generer",
                prospects: "Prospects",
                campaigns: "Campagnes",
                settings: "Parametres",
                my_voice: "Ma Voix",
                newsletters: "Newsletters",
                visuals: "Visuels"
            },
            actions: {
                save: "Enregistrer",
                cancel: "Annuler",
                delete: "Supprimer",
                edit: "Modifier",
                copy: "Copier",
                download: "Telecharger",
                import: "Importer",
                export: "Exporter",
                generate: "Generer",
                send: "Envoyer",
                preview: "Previsualiser",
                close: "Fermer",
                confirm: "Confirmer",
                back: "Retour",
                next: "Suivant",
                create: "Creer",
                search: "Rechercher",
                filter: "Filtrer",
                select_all: "Tout selectionner",
                regenerate: "Regenerer"
            },
            status: {
                loading: "Chargement...",
                success: "Succes !",
                error: "Une erreur est survenue",
                saved: "Enregistre",
                sending: "Envoi en cours...",
                sent: "Envoye",
                pending: "En attente"
            },

            // Prospects
            prospects: {
                title: "Mes Prospects",
                subtitle: "Gere ta liste de prospects et lance des campagnes personnalisees",
                empty: "Aucun prospect. Importe ta premiere liste !",
                add_manual: "Ajouter manuellement",
                total: "Total",

                import: {
                    title: "Importer des prospects",
                    drag_drop: "Glisse ton fichier CSV ici ou clique pour parcourir",
                    formats: "Formats acceptes : CSV",
                    template: "Telecharger un modele CSV",
                    pharow_tip: "Tu utilises Pharow ? Exporte en CSV et importe ici.",
                    apollo_tip: "Tu utilises Apollo ? Exporte ta liste et importe ici.",
                    mapping_title: "Associer les colonnes",
                    mapping_description: "Associe les colonnes de ton fichier aux champs SOS Storytelling",
                    required: "Champs obligatoires",
                    ignore: "-- Ignorer --",
                    preview: "Apercu : {count} prospects detectes",
                    duplicates: "{count} doublons ignores",
                    invalid_emails: "{count} emails invalides",
                    success: "{count} prospects importes avec succes !"
                },

                fields: {
                    first_name: "Prenom",
                    last_name: "Nom",
                    email: "Email",
                    company: "Entreprise",
                    job_title: "Poste",
                    linkedin: "LinkedIn",
                    phone: "Telephone",
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
                    contacted: "Contactes",
                    replied: "Ont repondu",
                    selected: "{count} selectionne(s)"
                },

                status: {
                    new: "Nouveau",
                    contacted: "Contacte",
                    opened: "A ouvert",
                    clicked: "A clique",
                    replied: "A repondu",
                    converted: "Converti",
                    unsubscribed: "Desabonne",
                    bounced: "Bounce"
                }
            },

            // Campaigns
            campaigns: {
                title: "Mes Campagnes",
                subtitle: "Cree et gere tes campagnes email personnalisees",
                empty: "Aucune campagne. Cree ta premiere campagne !",
                new_campaign: "Nouvelle Campagne",

                form: {
                    name: "Nom de la campagne",
                    name_placeholder: "Ex: Prospection agences Q1 2025",
                    goal: "Objectif de la campagne",
                    goal_placeholder: "Ex: Proposer mes services de creation de contenu aux agences",
                    sender_email: "Email expediteur",
                    sender_name: "Nom expediteur",
                    sender_name_placeholder: "Ex: Sandra Devonssay",
                    reply_to: "Repondre a (optionnel)",
                    use_my_voice: "Utiliser 'Ma Voix' pour personnaliser",
                    generate_unique: "Generer un email unique par prospect",
                    language: "Langue des emails"
                },

                prospects_selection: {
                    title: "Selection des prospects",
                    all: "Tous mes prospects",
                    only_new: "Seulement les nouveaux",
                    with_tag: "Avec le tag",
                    count: "{count} prospects selectionnes"
                },

                email_creation: {
                    title: "Creation de l'email",
                    generate_ai: "Generer avec l'IA",
                    write_manual: "Ecrire moi-meme",
                    subject: "Objet",
                    subject_options: "Options d'objet",
                    body: "Corps de l'email",
                    variables_hint: "Variables disponibles : {first_name}, {company}, {job_title}"
                },

                preview: {
                    title: "Previsualisation",
                    for_prospect: "Pour : {name} ({company})",
                    previous: "Precedent",
                    next: "Suivant",
                    ready: "{count} emails prets a envoyer"
                },

                status: {
                    draft: "Brouillon",
                    scheduled: "Programmee",
                    sending: "En cours",
                    sent: "Envoyee",
                    paused: "En pause"
                },

                actions: {
                    send_now: "Envoyer maintenant",
                    schedule: "Programmer",
                    pause: "Mettre en pause",
                    resume: "Reprendre"
                },

                stats: {
                    sent: "Envoyes",
                    opened: "Ouverts",
                    clicked: "Cliques",
                    replied: "Reponses",
                    bounced: "Bounces"
                }
            },

            // AI Generation
            ai: {
                generating: "Generation en cours...",
                generated: "Contenu genere !",
                regenerate: "Regenerer",
                use_my_voice: "Utiliser Ma Voix",
                tone: "Ton",
                tone_professional: "Professionnel",
                tone_friendly: "Amical",
                tone_casual: "Decontracte"
            },

            // Settings
            settings: {
                title: "Parametres",
                language: {
                    title: "Langue de l'interface",
                    french: "Francais",
                    english: "English"
                },
                brevo: {
                    title: "Integration Brevo",
                    connected: "Connecte",
                    not_connected: "Non connecte",
                    api_key: "Cle API Brevo",
                    verify_domain: "Verifier le domaine"
                }
            },

            // Errors
            errors: {
                required_field: "Ce champ est requis",
                invalid_email: "Email invalide",
                no_prospects: "Aucun prospect selectionne",
                send_failed: "Echec de l'envoi",
                import_failed: "Echec de l'import"
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
                regenerate: "Regenerate"
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

        // Essayer de charger depuis le profil Supabase
        if (window.supabase) {
            try {
                const { data: { user } } = await window.supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await window.supabase
                        .from('users')
                        .select('language')
                        .eq('id', user.id)
                        .single();

                    if (profile?.language) {
                        this.currentLanguage = profile.language;
                        localStorage.setItem('sos_language', profile.language);
                    }
                }
            } catch (e) {
                console.log('Could not load language from profile');
            }
        }

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

        this.currentLanguage = lang;
        localStorage.setItem('sos_language', lang);
        document.documentElement.lang = lang;

        // Sauvegarder en BDD si connecte
        if (window.supabase) {
            try {
                const { data: { user } } = await window.supabase.auth.getUser();
                if (user) {
                    await window.supabase
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
