// popup.js - SOS Storytelling Chrome Extension

// Configuration - Projet Supabase principal
const API_BASE = 'https://sos-storytelling-api.sandra-devonssay.workers.dev';
const SUPABASE_URL = 'https://pyxidmnckpnrargygwnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGlkbW5ja3BucmFyZ3lnd25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzc4NzIsImV4cCI6MjA3OTgxMzg3Mn0.atm-LVna_TQyPuACZgA4ngJzzgIfJQJIdnLd9lCpOns';
const APP_URL = 'https://sos-storytelling.netlify.app';

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

// Verify token with Supabase
async function verifyToken(token) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    return response.ok;
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
    // Authenticate with Supabase
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || data.msg || 'Erreur de connexion');
    }

    // Store auth data
    authToken = data.access_token;
    currentUser = data.user;

    await chrome.storage.local.set({
      authToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user
    });

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
  if (!authToken) return;

  setButtonLoading(refreshCampaignsBtn, true);

  try {
    const response = await fetch(`${API_BASE}/api/campaigns?status=draft&limit=50`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Erreur chargement campagnes');
    }

    const data = await response.json();
    const campaigns = data.campaigns || [];

    // Populate select
    campaignSelect.innerHTML = '<option value="">-- Selectionner une campagne --</option>';

    campaigns.forEach(campaign => {
      const option = document.createElement('option');
      option.value = campaign.id;
      option.textContent = campaign.name;
      campaignSelect.appendChild(option);
    });

    // Add option to create new campaign
    const newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.textContent = '+ Creer une nouvelle campagne';
    campaignSelect.appendChild(newOption);

  } catch (error) {
    console.error('Load campaigns error:', error);
  } finally {
    setButtonLoading(refreshCampaignsBtn, false);
  }
}

// Get selected leads from Sales Navigator page
async function getSelectedLeadsFromPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes('linkedin.com/sales')) {
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
      // Store leads temporarily and open app
      await chrome.storage.local.set({ pendingLeads: selectedLeads });
      chrome.tabs.create({ url: `${APP_URL}/prospects.html?import=extension` });
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
