// background.js - SOS Tools Admin Extension
// Service Worker (Manifest V3)

const API_BASE = 'https://sos-storytelling-api.sandra-devonssay.workers.dev';
// Projet Supabase B2B (sosstorytelling.fr)
const SUPABASE_URL = 'https://pyxidmnckpnrargygwnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5eGlkbW5ja3BucmFyZ3lnd25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzc4NzIsImV4cCI6MjA3OTgxMzg3Mn0.atm-LVna_TQyPuACZgA4ngJzzgIfJQJIdnLd9lCpOns';
const ADMIN_EMAIL = 'sandra.devonssay@gmail.com';

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[SOS BG] Message received:', message.action);

  handleMessage(message, sender)
    .then(response => {
      console.log('[SOS BG] Sending response for:', message.action);
      sendResponse(response);
    })
    .catch(error => {
      console.error('[SOS BG] Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    });

  return true; // Keep message channel open for async response
});

// Message handler
async function handleMessage(message, sender) {
  switch (message.action) {
    case 'login':
      return await handleLogin(message.email, message.password);

    case 'verifyToken':
      return await handleVerifyToken(message.token);

    case 'exportLeads':
      return await handleExportLeads(message.data);

    case 'enrichAndExport':
      return await handleEnrichAndExport(message.data);

    case 'loadCampaigns':
      return await handleLoadCampaigns();

    case 'openPopup':
      // Can't programmatically open popup, but we can open the app
      chrome.tabs.create({ url: 'https://sosstorytelling.fr/app.html' });
      return { success: true };

    case 'openTab':
      // Open a new tab with the given URL
      chrome.tabs.create({ url: message.url });
      return { success: true };

    case 'refreshToken':
      return await handleRefreshToken();

    case 'leadsUpdated':
      // Forward to popup if open
      chrome.runtime.sendMessage(message).catch(() => {});
      return { success: true };

    default:
      return { success: false, error: 'Unknown action' };
  }
}

// Verify token via background (avoids CORS issues)
async function handleVerifyToken(token) {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY
      }
    });
    return { valid: response.ok };
  } catch {
    return { valid: false };
  }
}

// Handle login via background (avoids CORS issues)
async function handleLogin(email, password) {
  console.log('[SOS BG] handleLogin called for:', email);

  // Vérifier que c'est l'admin
  if (email !== ADMIN_EMAIL) {
    console.log('[SOS BG] Not admin email, rejecting');
    return { success: false, error: 'Cette extension est réservée à l\'administrateur' };
  }

  try {
    console.log('[SOS BG] Calling Supabase auth...');
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ email, password })
    });

    console.log('[SOS BG] Supabase response status:', response.status);
    const data = await response.json();
    console.log('[SOS BG] Supabase response data:', data.error ? data : 'OK');

    if (!response.ok) {
      return { success: false, error: data.error_description || data.msg || 'Erreur de connexion' };
    }

    // Store auth data + userEmail for admin verification
    await chrome.storage.local.set({
      authToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
      userEmail: email
    });

    return { success: true, user: data.user };
  } catch (error) {
    console.error('[SOS BG] Login fetch error:', error);
    console.error('[SOS BG] Error name:', error.name);
    console.error('[SOS BG] Error message:', error.message);
    return { success: false, error: `Erreur réseau: ${error.message}` };
  }
}

// Export leads to SOS Storytelling API
async function handleExportLeads(data) {
  const { campaign_id, leads } = data;

  if (!leads || leads.length === 0) {
    throw new Error('Aucun lead a exporter');
  }

  if (leads.length > 100) {
    throw new Error('Maximum 100 leads par export');
  }

  // Get auth token
  const storage = await chrome.storage.local.get(['authToken']);
  let authToken = storage.authToken;

  if (!authToken) {
    throw new Error('Non connecte. Ouvrez l\'extension pour vous connecter.');
  }

  // Try to export, refresh token if needed
  try {
    return await doExport(authToken, campaign_id, leads);
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('token')) {
      // Try refreshing token
      const newToken = await refreshToken();
      if (newToken) {
        return await doExport(newToken, campaign_id, leads);
      }
    }
    throw error;
  }
}

// Enrich and export leads via the Cloudflare Worker API
async function handleEnrichAndExport(data) {
  const { leads, campaign_id, enrich = true } = data;

  if (!leads || leads.length === 0) {
    throw new Error('Aucun lead a exporter');
  }

  if (leads.length > 100) {
    throw new Error('Maximum 100 leads par export');
  }

  const storage = await chrome.storage.local.get(['authToken']);
  let authToken = storage.authToken;

  if (!authToken) {
    throw new Error('Non connecte. Ouvrez l\'extension pour vous connecter.');
  }

  try {
    return await doEnrichAndExport(authToken, leads, campaign_id, enrich);
  } catch (error) {
    if (error.message.includes('401') || error.message.includes('token')) {
      const newToken = await refreshToken();
      if (newToken) {
        return await doEnrichAndExport(newToken, leads, campaign_id, enrich);
      }
    }
    throw error;
  }
}

async function doEnrichAndExport(token, leads, campaignId, enrich) {
  console.log('[SOS BG] Enriching', leads.length, 'leads, campaign:', campaignId, 'enrich:', enrich);

  const response = await fetch(`${API_BASE}/api/enrichment/enrich-and-campaign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      leads,
      campaign_id: campaignId || null,
      source: 'linkedin_extension',
      enrich
    })
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('401 Unauthorized');
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erreur API: ${response.status}`);
  }

  const result = await response.json();
  console.log('[SOS BG] Enrich result:', result);

  trackEvent('leads_enriched', {
    imported: result.imported,
    queued: result.queued_for_enrichment,
    source: 'linkedin_extension'
  });

  return { success: true, data: result };
}

// Load campaigns from the API
async function handleLoadCampaigns() {
  const storage = await chrome.storage.local.get(['authToken']);
  const authToken = storage.authToken;

  if (!authToken) {
    return { success: false, error: 'Non connecte', campaigns: [] };
  }

  try {
    const response = await fetch(`${API_BASE}/api/extension/campaigns`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, campaigns: [] };
    }

    const data = await response.json();
    return { success: true, campaigns: data.campaigns || [] };
  } catch (error) {
    console.error('[SOS BG] Load campaigns error:', error);
    return { success: false, error: error.message, campaigns: [] };
  }
}

// Do the actual export - directly to Supabase
async function doExport(token, campaignId, leads) {
  console.log('[SOS BG] Exporting', leads.length, 'leads to campaign', campaignId);

  // Get user ID from token
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': SUPABASE_ANON_KEY
    }
  });

  if (!userResponse.ok) {
    throw new Error('Token invalide');
  }

  const userData = await userResponse.json();
  const userId = userData.id;

  // Format leads for Supabase
  const formattedLeads = leads.map(lead => ({
    user_id: userId,
    campaign_id: campaignId,
    email: generatePlaceholderEmail(lead),
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
    position: lead.job_title || '',
    company: lead.company || '',
    linkedin_url: lead.linkedin_url || '',
    city: lead.location || '',
    source: 'linkedin_extension',
    agent_status: 'pending',
    created_at: new Date().toISOString()
  }));

  // Insert into Supabase prospects table
  const response = await fetch(`${SUPABASE_URL}/rest/v1/prospects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(formattedLeads)
  });

  console.log('[SOS BG] Supabase insert response:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('[SOS BG] Supabase error:', errorData);
    throw new Error(errorData.message || `Erreur Supabase: ${response.status}`);
  }

  const result = await response.json();
  console.log('[SOS BG] Inserted', result.length, 'prospects');

  // Track successful import
  trackEvent('leads_imported', {
    count: leads.length,
    source: 'linkedin_extension'
  });

  return {
    success: true,
    data: {
      imported: result.length,
      duplicates: 0
    }
  };
}

// Generate a placeholder email from LinkedIn data
// Note: Real email will need to be enriched later via other tools
function generatePlaceholderEmail(lead) {
  // Create a deterministic placeholder email that can be enriched later
  const firstName = (lead.first_name || 'unknown').toLowerCase().replace(/[^a-z]/g, '');
  const lastName = (lead.last_name || '').toLowerCase().replace(/[^a-z]/g, '');
  const company = (lead.company || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);

  // Use LinkedIn URL hash if available for uniqueness
  let uniqueId = '';
  if (lead.linkedin_url) {
    const match = lead.linkedin_url.match(/\/in\/([^\/]+)/);
    if (match) {
      uniqueId = match[1].slice(0, 10);
    }
  }

  return `${firstName}.${lastName}${uniqueId ? '.' + uniqueId : ''}@${company}.linkedin.placeholder`;
}

// Refresh auth token
async function refreshToken() {
  try {
    const storage = await chrome.storage.local.get(['refreshToken']);
    const refreshToken = storage.refreshToken;

    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const data = await response.json();

    // Update stored tokens
    await chrome.storage.local.set({
      authToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user
    });

    return data.access_token;
  } catch (error) {
    console.error('[SOS Storytelling BG] Token refresh error:', error);
    // Clear invalid tokens
    await chrome.storage.local.remove(['authToken', 'refreshToken', 'user']);
    return null;
  }
}

// Handle token refresh message
async function handleRefreshToken() {
  const newToken = await refreshToken();
  return {
    success: !!newToken,
    token: newToken
  };
}

// Simple event tracking (can be extended)
function trackEvent(eventName, data) {
  console.log(`[SOS Storytelling] Event: ${eventName}`, data);
  // Could send to analytics service here
}

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[SOS Storytelling] Extension installed');
    trackEvent('extension_installed', { version: chrome.runtime.getManifest().version });

    // Open welcome page
    chrome.tabs.create({
      url: 'https://sosstorytelling.fr/prospects.html?source=extension_install'
    });
  } else if (details.reason === 'update') {
    console.log('[SOS Storytelling] Extension updated');
    trackEvent('extension_updated', {
      previousVersion: details.previousVersion,
      version: chrome.runtime.getManifest().version
    });
  }
});

// Alarm for periodic token refresh (every 45 minutes)
chrome.alarms.create('refreshToken', { periodInMinutes: 45 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshToken') {
    refreshToken().catch(console.error);
  }
});
