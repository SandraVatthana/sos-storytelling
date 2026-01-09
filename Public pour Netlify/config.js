/**
 * Configuration centralisée SOS Storytelling
 *
 * Ce fichier contient toutes les configurations de l'application.
 * Modifier ici pour changer les URLs/clés partout dans l'app.
 */

const CONFIG = {
    // Supabase - Projet principal
    SUPABASE_URL: 'https://pyxidmnckpnrargygwnf.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGlkbW5ja3BucmFyZ3lnd25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzc4NzIsImV4cCI6MjA3OTgxMzg3Mn0.atm-LVna_TQyPuACZgA4ngJzzgIfJQJIdnLd9lCpOns',

    // API Backend (Cloudflare Worker)
    API_URL: 'https://sos-storytelling-api.sandra-devonssay.workers.dev',

    // Version de l'app
    APP_VERSION: '1.0.0',

    // Feature flags
    FEATURES: {
        BETA_MODE: true,  // Mode beta test (pas de vérification d'abonnement)
        DEBUG: false      // Logs de debug
    }
};

// Initialiser le client Supabase
let supabaseClient = null;

function initSupabase() {
    if (!supabaseClient && window.supabase) {
        supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        // Exposer globalement pour les modules
        window.supabaseApp = supabaseClient;
    }
    return supabaseClient;
}

// Helper pour les appels API
async function apiCall(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    // Ajouter le token d'auth si disponible
    const session = await supabaseClient?.auth.getSession();
    if (session?.data?.session?.access_token) {
        defaultOptions.headers['Authorization'] = `Bearer ${session.data.session.access_token}`;
    }

    return fetch(url, { ...defaultOptions, ...options });
}

// Exporter pour utilisation globale
window.CONFIG = CONFIG;
window.initSupabase = initSupabase;
window.apiCall = apiCall;

// Log de chargement (si debug activé)
if (CONFIG.FEATURES.DEBUG) {
    console.log('Config loaded:', CONFIG.APP_VERSION);
}
