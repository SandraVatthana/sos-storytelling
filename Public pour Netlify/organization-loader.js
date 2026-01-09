// ============================================
// SOS STORYTELLING - ORGANIZATION LOADER
// Detection du sous-domaine et chargement white label
// ============================================

/**
 * Configuration des domaines
 */
const ORG_CONFIG = {
  // Domaine principal (landing page)
  mainDomain: 'sosstorytelling.fr',

  // Sous-domaine par defaut (app B2C)
  defaultSubdomain: 'app',

  // Sous-domaines speciaux qui ne sont pas des organisations
  reservedSubdomains: ['www', 'api', 'admin', 'mail', 'smtp', 'ftp', 'ns1', 'ns2'],

  // Pour le developpement local
  localDomains: ['localhost', '127.0.0.1'],

  // Cle localStorage pour cache
  cacheKey: 'sos_organization_cache',
  cacheDuration: 5 * 60 * 1000 // 5 minutes
};

/**
 * Detecte le sous-domaine ou domaine personnalise
 * @returns {Object} { subdomain, customDomain, isMainDomain, isLocalDev }
 */
function detectDomain() {
  const hostname = window.location.hostname;
  const parts = hostname.split('.');

  // Developpement local ou URLs Netlify de preview
  if (ORG_CONFIG.localDomains.includes(hostname) || hostname.includes('localhost') || hostname.includes('netlify.app')) {
    // En local, on peut simuler avec un parametre URL ?org=ramentafraise
    const urlParams = new URLSearchParams(window.location.search);
    const orgParam = urlParams.get('org');

    return {
      subdomain: orgParam || ORG_CONFIG.defaultSubdomain,
      customDomain: null,
      isMainDomain: !orgParam,
      isLocalDev: true
    };
  }

  // Domaine principal sans sous-domaine (sosstorytelling.fr)
  if (hostname === ORG_CONFIG.mainDomain || hostname === `www.${ORG_CONFIG.mainDomain}`) {
    return {
      subdomain: null,
      customDomain: null,
      isMainDomain: true,
      isLocalDev: false
    };
  }

  // Sous-domaine de SOS (xxx.sosstorytelling.fr)
  if (hostname.endsWith(`.${ORG_CONFIG.mainDomain}`)) {
    const subdomain = parts[0];

    // Verifier si c'est un sous-domaine reserve
    if (ORG_CONFIG.reservedSubdomains.includes(subdomain)) {
      return {
        subdomain: null,
        customDomain: null,
        isMainDomain: true,
        isLocalDev: false
      };
    }

    return {
      subdomain: subdomain,
      customDomain: null,
      isMainDomain: false,
      isLocalDev: false
    };
  }

  // Domaine personnalise (app.ninaramen.com)
  return {
    subdomain: null,
    customDomain: hostname,
    isMainDomain: false,
    isLocalDev: false
  };
}

/**
 * Charge les informations de l'organisation depuis Supabase
 * @param {string} subdomain - Sous-domaine ou null
 * @param {string} customDomain - Domaine personnalise ou null
 * @returns {Promise<Object|null>} Organisation ou null
 */
async function loadOrganizationFromDB(subdomain, customDomain) {
  // Verifier qu'on a bien Supabase
  if (typeof supabase === 'undefined') {
    console.error('[OrgLoader] Supabase non disponible');
    return null;
  }

  try {
    let query;

    if (customDomain) {
      // Recherche par domaine personnalise
      query = supabase
        .from('organizations')
        .select('*')
        .eq('custom_domain', customDomain)
        .single();
    } else if (subdomain) {
      // Recherche par sous-domaine
      query = supabase
        .from('organizations')
        .select('*')
        .eq('subdomain', subdomain)
        .single();
    } else {
      return null;
    }

    const { data, error } = await query;

    if (error) {
      console.error('[OrgLoader] Erreur chargement organisation:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[OrgLoader] Exception:', err);
    return null;
  }
}

/**
 * Recupere l'organisation depuis le cache ou la DB
 * @returns {Promise<Object|null>}
 */
async function getOrganization() {
  const domain = detectDomain();

  // Si domaine principal, pas d'organisation specifique
  if (domain.isMainDomain && !domain.isLocalDev) {
    return null;
  }

  // Cle de cache unique pour ce domaine
  const cacheKey = `${ORG_CONFIG.cacheKey}_${domain.subdomain || domain.customDomain || 'default'}`;

  // Verifier le cache
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < ORG_CONFIG.cacheDuration) {
        console.log('[OrgLoader] Organisation depuis cache:', data.app_name);
        return data;
      }
    }
  } catch (e) {
    // Ignorer les erreurs de cache
  }

  // Charger depuis la DB
  const org = await loadOrganizationFromDB(domain.subdomain, domain.customDomain);

  if (org) {
    // Mettre en cache
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        data: org,
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignorer les erreurs de cache
    }

    console.log('[OrgLoader] Organisation chargee:', org.app_name);
  }

  return org;
}

/**
 * Applique le theming white label
 * @param {Object} org - Organisation
 */
function applyOrganizationTheme(org) {
  if (!org) return;

  const root = document.documentElement;

  // Couleurs
  if (org.primary_color) {
    root.style.setProperty('--primary', org.primary_color);
    root.style.setProperty('--primary-color', org.primary_color);
  }
  if (org.secondary_color) {
    root.style.setProperty('--secondary', org.secondary_color);
    root.style.setProperty('--secondary-color', org.secondary_color);
  }
  if (org.accent_color) {
    root.style.setProperty('--accent', org.accent_color);
    root.style.setProperty('--accent-color', org.accent_color);
  }

  // Favicon
  if (org.favicon_url) {
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = org.favicon_url;
  }

  // Titre de la page
  if (org.app_name) {
    document.title = document.title.replace('SOS Storytelling', org.app_name);
  }

  // Logo dans le header
  if (org.logo_url) {
    const logos = document.querySelectorAll('.org-logo, .app-logo, #app-logo');
    logos.forEach(logo => {
      if (logo.tagName === 'IMG') {
        logo.src = org.logo_url;
      } else {
        logo.style.backgroundImage = `url(${org.logo_url})`;
      }
    });
  }

  // Nom de l'app
  if (org.app_name) {
    const appNames = document.querySelectorAll('.org-name, .app-name, #app-name');
    appNames.forEach(el => {
      el.textContent = org.app_name;
    });
  }

  // Message de chargement
  if (org.loading_message) {
    window.ORG_LOADING_MESSAGE = org.loading_message;
  }

  // Animation Lottie de chargement
  if (org.loading_lottie_url) {
    window.ORG_LOADING_LOTTIE = org.loading_lottie_url;
  }

  console.log('[OrgLoader] Theme applique pour:', org.app_name);
}

/**
 * Redirige vers la bonne page selon le domaine
 * @param {Object} domain - Info domaine
 * @param {Object} org - Organisation ou null
 */
function handleRouting(domain, org) {
  const currentPath = window.location.pathname;

  // Si domaine principal et pas sur la landing -> rediriger vers landing
  if (domain.isMainDomain && !domain.isLocalDev) {
    if (!currentPath.includes('landing') && !currentPath.includes('index')) {
      // On est sur le domaine principal mais pas sur la landing
      // Rediriger vers la landing
      // window.location.href = '/landing-b2b.html';
      return;
    }
  }

  // Si sous-domaine mais org non trouvee -> erreur ou rediriger
  if ((domain.subdomain || domain.customDomain) && !org) {
    console.warn('[OrgLoader] Organisation non trouvee pour:', domain.subdomain || domain.customDomain);
    // Option: afficher une page d'erreur ou rediriger vers la page principale
    // window.location.href = `https://${ORG_CONFIG.mainDomain}`;
  }
}

/**
 * Initialise le loader d'organisation
 * Appeler cette fonction au chargement de la page
 * @returns {Promise<Object|null>} Organisation ou null
 */
async function initOrganizationLoader() {
  const domain = detectDomain();
  console.log('[OrgLoader] Detection domaine:', domain);

  // Stocker les infos de domaine globalement
  window.ORG_DOMAIN = domain;

  // Si domaine principal, pas besoin de charger une org
  if (domain.isMainDomain && !domain.isLocalDev) {
    console.log('[OrgLoader] Domaine principal, pas d\'organisation specifique');
    return null;
  }

  // Charger l'organisation
  const org = await getOrganization();

  // Stocker l'organisation globalement
  window.CURRENT_ORGANIZATION = org;

  // Appliquer le theme
  if (org) {
    applyOrganizationTheme(org);
  }

  // Gerer le routage
  handleRouting(domain, org);

  // Emettre un evenement personnalise
  window.dispatchEvent(new CustomEvent('organizationLoaded', {
    detail: { domain, organization: org }
  }));

  return org;
}

/**
 * Recupere l'ID de l'organisation courante
 * @returns {string|null}
 */
function getCurrentOrganizationId() {
  return window.CURRENT_ORGANIZATION?.id || null;
}

/**
 * Verifie si on est sur une instance white label
 * @returns {boolean}
 */
function isWhiteLabel() {
  return window.CURRENT_ORGANIZATION !== null && window.CURRENT_ORGANIZATION !== undefined;
}

/**
 * Recupere le message de chargement personnalise
 * @param {string} defaultMessage - Message par defaut
 * @returns {string}
 */
function getLoadingMessage(defaultMessage = 'L\'IA reflechit...') {
  return window.ORG_LOADING_MESSAGE || window.CURRENT_ORGANIZATION?.loading_message || defaultMessage;
}

/**
 * Recupere l'URL de l'animation Lottie personnalisee
 * @param {string} defaultUrl - URL par defaut
 * @returns {string|null}
 */
function getLoadingLottie(defaultUrl = null) {
  return window.ORG_LOADING_LOTTIE || window.CURRENT_ORGANIZATION?.loading_lottie_url || defaultUrl;
}

// Exporter les fonctions pour usage global
window.OrganizationLoader = {
  init: initOrganizationLoader,
  detect: detectDomain,
  get: getOrganization,
  apply: applyOrganizationTheme,
  getCurrentId: getCurrentOrganizationId,
  isWhiteLabel: isWhiteLabel,
  getLoadingMessage: getLoadingMessage,
  getLoadingLottie: getLoadingLottie
};

// Log au chargement
console.log('[OrgLoader] Module charge');
