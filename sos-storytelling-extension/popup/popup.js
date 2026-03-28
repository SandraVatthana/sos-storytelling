// popup.js - SOS Tools Admin Extension

const API_BASE = 'https://sos-storytelling-api.sandra-devonssay.workers.dev';
// Projet Supabase B2B (sosstorytelling.fr)
const SUPABASE_URL = 'https://pyxidmnckpnrargygwnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGlkbW5ja3BucmFyZ3lnd25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzc4NzIsImV4cCI6MjA3OTgxMzg3Mn0.atm-LVna_TQyPuACZgA4ngJzzgIfJQJIdnLd9lCpOns';
const APP_URL = 'https://sosstorytelling.fr';
const ADMIN_EMAIL = 'sandra.devonssay@gmail.com';

// DOM Elements
const loginView = document.getElementById('login-view');
const connectedView = document.getElementById('connected-view');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const openAppBtn = document.getElementById('open-app-btn');

const userAvatar = document.getElementById('user-avatar');
const userEmail = document.getElementById('user-email');
const campaignSelect = document.getElementById('campaign-select');
const refreshCampaignsBtn = document.getElementById('refresh-campaigns-btn');
const leadsCountEl = document.getElementById('leads-count');
const exportBtn = document.getElementById('export-btn');
const exportStatus = document.getElementById('export-status');
const openDashboardBtn = document.getElementById('open-dashboard-btn');
const logoutBtn = document.getElementById('logout-btn');

// State
let selectedLeads = [];
let currentUser = null;
let authToken = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
  setupEventListeners();
  await getSelectedLeadsFromPage();
});

// Check authentication status
async function checkAuthStatus() {
  try {
    const result = await chrome.storage.local.get(['authToken', 'user']);

    if (result.authToken && result.user) {
      // Verify token is still valid
      const isValid = await verifyToken(result.authToken);

      if (isValid) {
        authToken = result.authToken;
        currentUser = result.user;
        showConnectedView();
        await loadCampaigns();
        return;
      } else {
        // Token expired, clear storage
        await chrome.storage.local.remove(['authToken', 'user']);
      }
    }

    showLoginView();
  } catch (error) {
    console.error('Auth check error:', error);
    showLoginView();
  }
}

// Verify token via background script (avoids CORS issues)
async function verifyToken(token) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'verifyToken',
      token: token
    });
    return response.valid;
  } catch {
    return false;
  }
}

// Setup event listeners
function setupEventListeners() {
  loginForm.addEventListener('submit', handleLogin);
  openAppBtn.addEventListener('click', () => chrome.tabs.create({ url: APP_URL }));
  refreshCampaignsBtn.addEventListener('click', loadCampaigns);
  exportBtn.addEventListener('click', handleExport);
  openDashboardBtn.addEventListener('click', () => chrome.tabs.create({ url: `${APP_URL}/prospects.html` }));
  logoutBtn.addEventListener('click', handleLogout);
  campaignSelect.addEventListener('change', updateExportButton);

  // Bouton nouvelle campagne
  const newCampaignBtn = document.getElementById('new-campaign-btn');
  if (newCampaignBtn) {
    newCampaignBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: `${APP_URL}/prospects.html?action=new_campaign` });
    });
  }

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all tabs and contents
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Add active to clicked tab and corresponding content
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      document.getElementById(`tab-${tabId}`)?.classList.add('active');
    });
  });

  // Search button
  const searchBtn = document.getElementById('search-posts-btn');
  if (searchBtn) {
    searchBtn.addEventListener('click', handlePostSearch);
  }

  // Keyword suggestions
  document.querySelectorAll('.keyword-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const keywordsInput = document.getElementById('search-keywords');
      const keyword = tag.dataset.keyword;

      if (keywordsInput) {
        const current = keywordsInput.value.trim();
        if (current) {
          // Ajouter à la liste existante si pas déjà présent
          const keywords = current.split(',').map(k => k.trim());
          if (!keywords.includes(keyword)) {
            keywordsInput.value = current + ', ' + keyword;
          }
        } else {
          keywordsInput.value = keyword;
        }
      }
    });
  });
}

// Handle post search - opens LinkedIn with search query
function handlePostSearch() {
  const keywordsInput = document.getElementById('search-keywords');
  const periodSelect = document.getElementById('search-period');
  const locationSelect = document.getElementById('search-location');

  const keywords = keywordsInput?.value?.trim();
  const period = periodSelect?.value || 'past-month';
  const location = locationSelect?.value || 'france';

  if (!keywords) {
    showStatus('Entrez des mots-cles pour rechercher', 'error');
    return;
  }

  // Build LinkedIn search URL
  const searchUrl = buildLinkedInSearchUrl(keywords, period, location);

  // Open in new tab
  chrome.tabs.create({ url: searchUrl });
}

// Build LinkedIn content search URL
function buildLinkedInSearchUrl(keywords, period, location) {
  const baseUrl = 'https://www.linkedin.com/search/results/content/';

  // LinkedIn uses specific format for date filters
  let dateFilter = '';
  switch (period) {
    case 'past-24h':
      dateFilter = 'past-24h';
      break;
    case 'past-week':
      dateFilter = 'past-week';
      break;
    case 'past-month':
      dateFilter = 'past-month';
      break;
  }

  // Geographic filters (geoUrn IDs pour LinkedIn)
  // France: 105015875, Belgium: 100565514, Switzerland: 106693272, Canada: 101174742
  let geoIds = [];
  switch (location) {
    case 'france':
      geoIds = ['105015875'];
      break;
    case 'francophone':
      geoIds = ['105015875', '100565514', '106693272', '101174742'];
      break;
    case 'all':
      geoIds = [];
      break;
  }

  const encodedKeywords = encodeURIComponent(keywords);

  // Construire l'URL avec le bon format LinkedIn
  let url = `${baseUrl}?keywords=${encodedKeywords}&origin=FACETED_SEARCH&sid=REPLACEME`;

  // Ajouter le filtre de date
  if (dateFilter) {
    url += `&datePosted="${dateFilter}"`;
  }

  // Ajouter le filtre géographique
  if (geoIds.length > 0) {
    const geoParam = geoIds.map(id => `"${id}"`).join(',');
    url += `&postedBy=["first"]&authorGeoRegion=[${geoParam}]`;
  }

  // Encoder correctement l'URL
  // Note: Les guillemets et crochets doivent être encodés
  url = url.replace(/"/g, '%22').replace(/\[/g, '%5B').replace(/\]/g, '%5D');

  console.log('[SOS Popup] Search URL:', url);
  return url;
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('Veuillez remplir tous les champs');
    return;
  }

  setButtonLoading(loginBtn, true);
  hideError();

  try {
    console.log('[SOS Popup] Tentative de connexion pour:', email);

    // Passer par le background script pour éviter les problèmes CORS
    let response;
    try {
      response = await chrome.runtime.sendMessage({
        action: 'login',
        email: email,
        password: password
      });
      console.log('[SOS Popup] Réponse du background:', response);
    } catch (msgError) {
      console.error('[SOS Popup] Erreur sendMessage:', msgError);
      throw new Error('Extension non chargée. Rechargez l\'extension dans chrome://extensions');
    }

    if (!response) {
      throw new Error('Pas de réponse du background script. Rechargez l\'extension.');
    }

    if (!response.success) {
      throw new Error(response.error || 'Erreur de connexion');
    }

    // Récupérer les données stockées par le background
    const storage = await chrome.storage.local.get(['authToken', 'user']);
    authToken = storage.authToken;
    currentUser = storage.user;

    showConnectedView();
    await loadCampaigns();

    // Notify content script that user is logged in
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'userLoggedIn' }).catch(() => {});
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    showError(error.message || 'Erreur de connexion');
  } finally {
    setButtonLoading(loginBtn, false);
  }
}

// Handle logout
async function handleLogout() {
  try {
    await chrome.storage.local.remove(['authToken', 'refreshToken', 'user']);
    authToken = null;
    currentUser = null;
    showLoginView();

    // Notify content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'userLoggedOut' }).catch(() => {});
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Load campaigns
async function loadCampaigns() {
  if (!authToken) {
    console.log('[SOS Popup] No auth token, skipping campaign load');
    return;
  }

  setButtonLoading(refreshCampaignsBtn, true);
  console.log('[SOS Popup] Loading campaigns...');

  // Toujours afficher l'option par défaut et "nouvelle campagne"
  campaignSelect.innerHTML = '<option value="">-- Selectionner une campagne --</option>';

  try {
    const response = await fetch(`${API_BASE}/api/campaigns?status=draft&limit=50`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    console.log('[SOS Popup] Campaigns API response:', response.status);

    if (response.ok) {
      const data = await response.json();
      const campaigns = data.campaigns || [];
      console.log('[SOS Popup] Found', campaigns.length, 'campaigns');

      campaigns.forEach(campaign => {
        const option = document.createElement('option');
        option.value = campaign.id;
        option.textContent = campaign.name;
        campaignSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('[SOS Popup] Load campaigns error:', error);
  }

  setButtonLoading(refreshCampaignsBtn, false);
}

// Get selected leads from LinkedIn page (Sales Navigator, profiles, or search)
async function getSelectedLeadsFromPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Supporter Sales Navigator, profils et recherches LinkedIn
    if (!tab?.url?.includes('linkedin.com')) {
      leadsCountEl.textContent = '-';
      return;
    }

    // Ask content script for selected leads
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedLeads' });

    if (response && response.leads) {
      selectedLeads = response.leads;
      leadsCountEl.textContent = selectedLeads.length.toString();
      updateExportButton();
    }
  } catch (error) {
    console.error('Get leads error:', error);
    leadsCountEl.textContent = '0';
  }
}

// Handle export
async function handleExport() {
  const campaignId = campaignSelect.value;

  if (!campaignId) {
    showStatus('Veuillez selectionner une campagne', 'error');
    return;
  }

  if (selectedLeads.length === 0) {
    showStatus('Aucun lead a exporter', 'error');
    return;
  }

  if (selectedLeads.length > 100) {
    showStatus('Maximum 100 leads par export', 'error');
    return;
  }

  setButtonLoading(exportBtn, true);
  hideStatus();

  try {
    // If "new campaign", redirect to app
    if (campaignId === 'new') {
      // Stocker les leads dans chrome.storage (evite erreur 414 URL trop longue)
      await chrome.storage.local.set({
        pendingLeadsImport: {
          leads: selectedLeads,
          timestamp: Date.now()
        }
      });
      chrome.tabs.create({ url: `${APP_URL}/prospects.html?import_leads=pending` });
      return;
    }

    // Export to existing campaign via background script
    const response = await chrome.runtime.sendMessage({
      action: 'exportLeads',
      data: {
        campaign_id: campaignId,
        leads: selectedLeads
      }
    });

    if (response.success) {
      const { imported, duplicates } = response.data;
      showStatus(`${imported} lead(s) importe(s)${duplicates > 0 ? `, ${duplicates} doublon(s)` : ''}`, 'success');

      // Notify content script to clear selection
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'clearSelection' }).catch(() => {});
      }

      selectedLeads = [];
      leadsCountEl.textContent = '0';
      updateExportButton();
    } else {
      throw new Error(response.error || 'Erreur export');
    }

  } catch (error) {
    console.error('Export error:', error);
    showStatus(error.message || 'Erreur lors de l\'export', 'error');
  } finally {
    setButtonLoading(exportBtn, false);
  }
}

// Update export button state
function updateExportButton() {
  const hasLeads = selectedLeads.length > 0;
  const hasCampaign = campaignSelect.value !== '';
  exportBtn.disabled = !hasLeads || !hasCampaign;
}

// UI Helpers
function showLoginView() {
  loginView.classList.remove('hidden');
  connectedView.classList.add('hidden');
}

function showConnectedView() {
  loginView.classList.add('hidden');
  connectedView.classList.remove('hidden');

  if (currentUser) {
    userEmail.textContent = currentUser.email;
    userAvatar.textContent = currentUser.email.charAt(0).toUpperCase();
  }
}

function setButtonLoading(btn, loading) {
  const textEl = btn.querySelector('.btn-text');
  const loaderEl = btn.querySelector('.btn-loader');

  if (loading) {
    btn.disabled = true;
    if (textEl) textEl.style.opacity = '0.5';
    if (loaderEl) loaderEl.classList.remove('hidden');
  } else {
    btn.disabled = false;
    if (textEl) textEl.style.opacity = '1';
    if (loaderEl) loaderEl.classList.add('hidden');
  }
}

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function hideError() {
  loginError.classList.add('hidden');
}

function showStatus(message, type) {
  exportStatus.textContent = message;
  exportStatus.className = `status ${type}`;
}

function hideStatus() {
  exportStatus.classList.add('hidden');
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'leadsUpdated') {
    selectedLeads = message.leads || [];
    leadsCountEl.textContent = selectedLeads.length.toString();
    updateExportButton();
  }
});
