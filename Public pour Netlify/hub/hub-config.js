/**
 * Configuration HUB CRM
 * Utilise le même Supabase que SOS Storytelling
 */

const HUB_CONFIG = {
    // Supabase - Même projet que SOS Storytelling
    SUPABASE_URL: 'https://pyxidmnckpnrargygwnf.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGlkbW5ja3BucmFyZ3lnd25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzc4NzIsImV4cCI6MjA3OTgxMzg3Mn0.atm-LVna_TQyPuACZgA4ngJzzgIfJQJIdnLd9lCpOns',

    // API Backend (Cloudflare Worker)
    API_URL: 'https://sos-storytelling-api.sandra-devonssay.workers.dev',

    // Version
    APP_VERSION: '1.0.0',
    APP_NAME: 'HUB CRM',

    // Feature flags
    FEATURES: {
        BETA_MODE: true,
        DEBUG: false,
        TEAMS_ENABLED: true
    },

    // Statuts prospects
    PROSPECT_STATUSES: {
        new: { label: 'Nouveau', color: '#3b82f6', icon: '🔵' },
        contacted: { label: 'Contacté', color: '#eab308', icon: '🟡' },
        in_discussion: { label: 'En discussion', color: '#f97316', icon: '🟠' },
        rdv_booked: { label: 'RDV pris', color: '#8b5cf6', icon: '🟣' },
        converted: { label: 'Converti', color: '#22c55e', icon: '🟢' },
        lost: { label: 'Perdu', color: '#ef4444', icon: '🔴' },
        not_qualified: { label: 'Non qualifié', color: '#6b7280', icon: '⚫' }
    },

    // Résultats d'appel
    CALL_RESULTS: {
        rdv_booked: { label: 'RDV pris', icon: '📅' },
        callback: { label: 'À rappeler', icon: '🔄' },
        not_interested: { label: 'Pas intéressé', icon: '❌' },
        no_answer: { label: 'Pas de réponse', icon: '📵' },
        wrong_number: { label: 'Mauvais numéro', icon: '🚫' },
        other: { label: 'Autre', icon: '📝' }
    },

    // Sources
    SOURCES: {
        manual: { label: 'Ajout manuel', icon: '✏️' },
        csv: { label: 'Import CSV', icon: '📄' },
        linkedin: { label: 'LinkedIn', icon: '🔗' },
        pharow: { label: 'Pharow', icon: '🎯' },
        extension: { label: 'Extension', icon: '🧩' }
    },

    // Canaux
    CHANNELS: {
        email: { label: 'Email', icon: '📧', color: '#3b82f6' },
        dm: { label: 'DM', icon: '💬', color: '#8b5cf6' },
        call: { label: 'Appel', icon: '📞', color: '#22c55e' }
    },

    // Rôles équipe
    TEAM_ROLES: {
        owner: { label: 'Propriétaire', permissions: ['all'] },
        admin: { label: 'Admin', permissions: ['manage_members', 'manage_prospects'] },
        member: { label: 'Membre', permissions: ['view', 'edit_assigned'] }
    },

    // Mappings CSV pour import
    CSV_COLUMN_MAPPINGS: {
        email: ['email', 'e-mail', 'mail', 'courriel', 'adresse email', 'email address'],
        first_name: ['prenom', 'prénom', 'firstname', 'first_name', 'first name', 'nom'],
        last_name: ['nom', 'nom de famille', 'lastname', 'last_name', 'last name', 'surname'],
        company: ['entreprise', 'société', 'societe', 'company', 'organization', 'organisation', 'boite'],
        job_title: ['poste', 'fonction', 'titre', 'job', 'job_title', 'title', 'role', 'position'],
        linkedin_url: ['linkedin', 'linkedin_url', 'profil linkedin', 'linkedin profile', 'url linkedin'],
        phone: ['telephone', 'téléphone', 'phone', 'tel', 'mobile', 'portable', 'numero'],
        website: ['site', 'website', 'site web', 'url', 'site internet'],
        sector: ['secteur', 'sector', 'industry', 'industrie', 'domaine'],
        city: ['ville', 'city', 'location', 'localisation', 'lieu'],
        company_size: ['taille', 'size', 'effectif', 'employees', 'nb_employes', 'company_size'],
        notes: ['notes', 'observation', 'commentaire', 'remarque', 'comment', 'description'],
        email_contacted: ['email_envoye', 'email_sent', 'contacted_email', 'email_contacte'],
        dm_contacted: ['dm_envoye', 'dm_sent', 'contacted_dm', 'dm_contacte'],
        call_done: ['appel', 'appele', 'called', 'call', 'appel_fait'],
        call_result: ['resultat_appel', 'call_result', 'outcome', 'resultat']
    }
};

// Client Supabase
let hubSupabaseClient = null;

function initHubSupabase() {
    if (!hubSupabaseClient && window.supabase) {
        hubSupabaseClient = window.supabase.createClient(
            HUB_CONFIG.SUPABASE_URL,
            HUB_CONFIG.SUPABASE_ANON_KEY
        );
        window.hubSupabase = hubSupabaseClient;
    }
    return hubSupabaseClient;
}

// Helper pour fetch avec timeout
async function hubFetchWithTimeout(url, options = {}, timeout = 60000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('La requête a pris trop de temps. Vérifie ta connexion et réessaie.');
        }
        throw error;
    }
}

// Helper pour les appels API
async function hubApiCall(endpoint, options = {}, timeout = 60000) {
    const url = `${HUB_CONFIG.API_URL}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const session = await hubSupabaseClient?.auth.getSession();
    if (session?.data?.session?.access_token) {
        defaultOptions.headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
    }

    return hubFetchWithTimeout(url, { ...defaultOptions, ...options }, timeout);
}

// Utilitaires de formatage
const HubUtils = {
    // Formater une date
    formatDate(dateStr, options = {}) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const defaultOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
        return date.toLocaleDateString('fr-FR', { ...defaultOptions, ...options });
    },

    // Formater date et heure
    formatDateTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // Date relative (il y a X jours)
    formatRelativeDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Aujourd'hui";
        if (diffDays === 1) return 'Hier';
        if (diffDays < 7) return `Il y a ${diffDays} jours`;
        if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
        return this.formatDate(dateStr);
    },

    // Tronquer texte
    truncate(str, maxLength = 50) {
        if (!str || str.length <= maxLength) return str || '';
        return str.substring(0, maxLength) + '...';
    },

    // Générer initiales
    getInitials(firstName, lastName) {
        const f = firstName?.charAt(0)?.toUpperCase() || '';
        const l = lastName?.charAt(0)?.toUpperCase() || '';
        return f + l || '?';
    },

    // Valider email
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Nettoyer URL LinkedIn
    cleanLinkedInUrl(url) {
        if (!url) return '';
        if (url.includes('linkedin.com')) return url;
        if (url.startsWith('linkedin.com')) return 'https://' + url;
        return url;
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Générer UUID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // Parser CSV
    parseCSV(csvText, delimiter = ',') {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return { headers: [], rows: [] };

        // Detect delimiter
        const firstLine = lines[0];
        if (firstLine.includes(';') && !firstLine.includes(',')) {
            delimiter = ';';
        }

        const headers = this.parseCSVLine(lines[0], delimiter);
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i], delimiter);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, idx) => {
                    row[header.toLowerCase().trim()] = values[idx]?.trim() || '';
                });
                rows.push(row);
            }
        }

        return { headers, rows };
    },

    // Parser une ligne CSV (gère les guillemets)
    parseCSVLine(line, delimiter = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    },

    // Mapper colonnes CSV
    mapCSVColumns(csvHeaders) {
        const mapping = {};
        const normalizedHeaders = csvHeaders.map(h => h.toLowerCase().trim());

        for (const [field, aliases] of Object.entries(HUB_CONFIG.CSV_COLUMN_MAPPINGS)) {
            for (const alias of aliases) {
                const idx = normalizedHeaders.indexOf(alias.toLowerCase());
                if (idx !== -1) {
                    mapping[field] = csvHeaders[idx];
                    break;
                }
            }
        }

        return mapping;
    }
};

// Exporter globalement
window.HUB_CONFIG = HUB_CONFIG;
window.initHubSupabase = initHubSupabase;
window.hubApiCall = hubApiCall;
window.hubFetchWithTimeout = hubFetchWithTimeout;
window.HubUtils = HubUtils;

if (HUB_CONFIG.FEATURES.DEBUG) {
    console.log('HUB Config loaded:', HUB_CONFIG.APP_VERSION);
}
