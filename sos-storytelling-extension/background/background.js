// background.js - SOS Storytelling Chrome Extension
// Service Worker (Manifest V3)

const API_BASE = 'https://sos-storytelling-api.sandra-devonssay.workers.dev';
const SUPABASE_URL = 'https://cuwkbxleeapxeyzdzqdr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1d2tieGxlZWFweGV5emR6cWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEyNTEyNDAsImV4cCI6MjA0NjgyNzI0MH0.XYXMxXcLgvEd6DcS8Dxz5c_V9K3g4YqW5L0E4X8GRXE';

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(error => {
      console.error('[SOS Storytelling BG] Error:', error);
      sendResponse({ success: false, error: error.message });
    });

  return true; // Keep message channel open for async response
});

// Message handler
async function handleMessage(message, sender) {
  switch (message.action) {
    case 'exportLeads':
      return await handleExportLeads(message.data);

    case 'openPopup':
      // Can't programmatically open popup, but we can open the app
      chrome.tabs.create({ url: 'https://sos-storytelling.netlify.app/prospects.html' });
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

// Do the actual export API call
async function doExport(token, campaignId, leads) {
  // Format leads for API
  const formattedLeads = leads.map(lead => ({
    email: generatePlaceholderEmail(lead), // Placeholder since Sales Nav doesn't show emails
    first_name: lead.first_name,
    last_name: lead.last_name,
    job_title: lead.job_title,
    company: lead.company,
    linkedin_url: lead.linkedin_url,
    city: lead.location,
    source: 'linkedin_extension'
  }));

  // Use the existing import endpoint
  const response = await fetch(`${API_BASE}/api/prospects/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      prospects: formattedLeads,
      campaign_id: campaignId,
      source: 'linkedin_extension'
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Erreur API: ${response.status}`);
  }

  const result = await response.json();

  // Track successful import for analytics
  trackEvent('leads_imported', {
    count: leads.length,
    source: 'linkedin_extension'
  });

  return {
    success: true,
    data: {
      imported: result.imported || leads.length,
      duplicates: result.duplicates || 0
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
      url: 'https://sos-storytelling.netlify.app/prospects.html?source=extension_install'
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
