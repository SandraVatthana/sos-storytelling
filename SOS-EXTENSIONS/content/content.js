// content.js - SOS Storytelling Chrome Extension
// Injecte dans les pages LinkedIn Sales Navigator

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    buttonId: 'sos-storytelling-export-btn',
    panelId: 'sos-storytelling-panel',
    maxLeads: 100,
    debounceDelay: 300
  };

  // State
  let selectedLeads = [];
  let isAuthenticated = false;
  let floatingButton = null;
  let selectionPanel = null;
  let observer = null;

  // Initialize
  function init() {
    console.log('[SOS Storytelling] Extension loaded on Sales Navigator');

    checkAuthStatus();
    injectUI();
    setupObserver();
    setupEventListeners();
  }

  // Check authentication status
  async function checkAuthStatus() {
    try {
      const result = await chrome.storage.local.get(['authToken', 'user']);
      isAuthenticated = !!(result.authToken && result.user);
      updateUIState();
    } catch (error) {
      console.error('[SOS Storytelling] Auth check error:', error);
      isAuthenticated = false;
    }
  }

  // Inject UI elements
  function injectUI() {
    // Remove existing elements if any
    document.getElementById(CONFIG.buttonId)?.remove();
    document.getElementById(CONFIG.panelId)?.remove();

    // Create floating button
    floatingButton = document.createElement('div');
    floatingButton.id = CONFIG.buttonId;
    floatingButton.className = 'sos-floating-btn';
    floatingButton.innerHTML = `
      <div class="sos-btn-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
      </div>
      <span class="sos-btn-text">SOS Storytelling</span>
      <span class="sos-btn-count">0</span>
    `;
    document.body.appendChild(floatingButton);

    // Create selection panel
    selectionPanel = document.createElement('div');
    selectionPanel.id = CONFIG.panelId;
    selectionPanel.className = 'sos-panel hidden';
    selectionPanel.innerHTML = `
      <div class="sos-panel-header">
        <h3>SOS Storytelling</h3>
        <button class="sos-panel-close">&times;</button>
      </div>
      <div class="sos-panel-content">
        <div class="sos-panel-auth-required hidden">
          <p>Connectez-vous via l'extension pour exporter vos leads</p>
          <button class="sos-btn-open-popup">Ouvrir l'extension</button>
        </div>
        <div class="sos-panel-main">
          <div class="sos-leads-info">
            <span class="sos-leads-count">0</span> lead(s) selectionne(s)
          </div>
          <div class="sos-actions">
            <button class="sos-btn sos-btn-select-all">Selectionner tout (page)</button>
            <button class="sos-btn sos-btn-clear">Effacer selection</button>
          </div>
          <div class="sos-leads-list"></div>
          <button class="sos-btn sos-btn-primary sos-btn-export" disabled>
            Exporter vers SOS Storytelling
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(selectionPanel);

    updateUIState();
  }

  // Update UI based on auth state
  function updateUIState() {
    if (!selectionPanel) return;

    const authRequired = selectionPanel.querySelector('.sos-panel-auth-required');
    const mainPanel = selectionPanel.querySelector('.sos-panel-main');

    // Toujours afficher le panneau principal pour permettre la sélection
    // L'export vérifiera l'auth au moment du clic
    authRequired.classList.add('hidden');
    mainPanel.classList.remove('hidden');

    updateLeadsCount();
  }

  // Setup MutationObserver to detect page changes
  function setupObserver() {
    // Disconnect existing observer
    if (observer) observer.disconnect();

    // Observe DOM changes for dynamic content
    observer = new MutationObserver(debounce(() => {
      injectCheckboxes();
    }, CONFIG.debounceDelay));

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial injection
    setTimeout(injectCheckboxes, 1000);
  }

  // Inject checkboxes next to leads
  function injectCheckboxes() {
    const leadRows = getLeadElements();

    leadRows.forEach(row => {
      if (row.querySelector('.sos-checkbox')) return;

      const checkbox = document.createElement('div');
      checkbox.className = 'sos-checkbox';
      checkbox.innerHTML = `
        <input type="checkbox" class="sos-checkbox-input">
        <span class="sos-checkbox-mark"></span>
      `;

      // Find the right position to insert
      const nameContainer = row.querySelector('[data-anonymize="person-name"]') ||
                           row.querySelector('.artdeco-entity-lockup__title') ||
                           row.querySelector('.ember-view');

      if (nameContainer) {
        const wrapper = nameContainer.closest('td') || nameContainer.closest('div');
        if (wrapper && !wrapper.querySelector('.sos-checkbox')) {
          wrapper.style.position = 'relative';
          wrapper.insertBefore(checkbox, wrapper.firstChild);
        }
      }

      // Handle checkbox click
      const input = checkbox.querySelector('input');
      input.addEventListener('change', (e) => {
        e.stopPropagation();
        const leadData = extractLeadData(row);
        if (leadData) {
          if (input.checked) {
            addLead(leadData);
          } else {
            removeLead(leadData);
          }
        }
      });
    });
  }

  // Get lead elements from the page
  function getLeadElements() {
    // Sales Navigator search results - primary selector (2024/2025)
    const listItems = document.querySelectorAll('li.artdeco-list__item');
    if (listItems.length > 0) return Array.from(listItems);

    // Fallback: Sales Navigator lead cards
    const searchResults = document.querySelectorAll('[data-x--lead-card]');
    if (searchResults.length > 0) return Array.from(searchResults);

    // Fallback: List view results
    const listResults = document.querySelectorAll('.artdeco-entity-lockup');
    if (listResults.length > 0) return Array.from(listResults);

    // Fallback: Table rows
    const tableRows = document.querySelectorAll('table tbody tr');
    if (tableRows.length > 0) return Array.from(tableRows);

    // Fallback: Generic lead cards
    const leadCards = document.querySelectorAll('[class*="lead-card"], [class*="search-result"]');
    return Array.from(leadCards);
  }

  // Extract lead data from a row element
  function extractLeadData(element) {
    try {
      // Get name
      const nameEl = element.querySelector('[data-anonymize="person-name"]') ||
                     element.querySelector('.artdeco-entity-lockup__title a') ||
                     element.querySelector('a[href*="/sales/lead/"]');

      if (!nameEl) return null;

      const fullName = nameEl.textContent.trim();
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Get LinkedIn URL
      let linkedinUrl = '';
      const linkEl = element.querySelector('a[href*="/sales/lead/"]') ||
                     element.querySelector('a[href*="/in/"]');
      if (linkEl) {
        linkedinUrl = linkEl.href;
        // Convert sales URL to regular LinkedIn URL if needed
        if (linkedinUrl.includes('/sales/lead/')) {
          const match = linkedinUrl.match(/\/sales\/lead\/([^,]+)/);
          if (match) {
            linkedinUrl = `https://www.linkedin.com/in/${match[1]}/`;
          }
        }
      }

      // Get job title
      const jobTitleEl = element.querySelector('[data-anonymize="title"]') ||
                         element.querySelector('.artdeco-entity-lockup__subtitle') ||
                         element.querySelector('[class*="job-title"]');
      const jobTitle = jobTitleEl ? jobTitleEl.textContent.trim().split(' at ')[0].split(' chez ')[0].trim() : '';

      // Get company
      const companyEl = element.querySelector('[data-anonymize="company-name"]') ||
                        element.querySelector('a[href*="/sales/company/"]') ||
                        element.querySelector('[class*="company"]');
      const company = companyEl ? companyEl.textContent.trim() : '';

      // Get location
      const locationEl = element.querySelector('[data-anonymize="location"]') ||
                         element.querySelector('[class*="location"]');
      const location = locationEl ? locationEl.textContent.trim() : '';

      // Create unique ID
      const id = linkedinUrl || `${firstName}-${lastName}-${company}`.toLowerCase().replace(/\s+/g, '-');

      return {
        id,
        first_name: firstName,
        last_name: lastName,
        job_title: jobTitle,
        company: company,
        linkedin_url: linkedinUrl,
        location: location,
        source: 'linkedin_sales_navigator'
      };
    } catch (error) {
      console.error('[SOS Storytelling] Error extracting lead data:', error);
      return null;
    }
  }

  // Add lead to selection
  function addLead(lead) {
    if (!lead || !lead.first_name) return;

    // Check for duplicates
    const exists = selectedLeads.some(l => l.id === lead.id || l.linkedin_url === lead.linkedin_url);
    if (exists) return;

    // Check max leads
    if (selectedLeads.length >= CONFIG.maxLeads) {
      showNotification(`Maximum ${CONFIG.maxLeads} leads par selection`, 'warning');
      return;
    }

    selectedLeads.push(lead);
    updateLeadsCount();
    notifyPopup();
  }

  // Remove lead from selection
  function removeLead(lead) {
    selectedLeads = selectedLeads.filter(l => l.id !== lead.id);
    updateLeadsCount();
    notifyPopup();
  }

  // Clear all selections
  function clearSelection() {
    selectedLeads = [];
    document.querySelectorAll('.sos-checkbox-input').forEach(cb => {
      cb.checked = false;
    });
    updateLeadsCount();
    notifyPopup();
  }

  // Select all leads on current page
  function selectAllOnPage() {
    const leadRows = getLeadElements();
    let added = 0;

    leadRows.forEach(row => {
      if (selectedLeads.length >= CONFIG.maxLeads) return;

      const leadData = extractLeadData(row);
      if (leadData && !selectedLeads.some(l => l.id === leadData.id)) {
        selectedLeads.push(leadData);
        const checkbox = row.querySelector('.sos-checkbox-input');
        if (checkbox) checkbox.checked = true;
        added++;
      }
    });

    if (added > 0) {
      showNotification(`${added} lead(s) ajoute(s)`, 'success');
      updateLeadsCount();
      notifyPopup();
    }
  }

  // Update leads count display
  function updateLeadsCount() {
    const count = selectedLeads.length;

    // Update floating button
    const btnCount = floatingButton?.querySelector('.sos-btn-count');
    if (btnCount) {
      btnCount.textContent = count.toString();
      btnCount.classList.toggle('has-leads', count > 0);
    }

    // Update panel
    const panelCount = selectionPanel?.querySelector('.sos-leads-count');
    if (panelCount) {
      panelCount.textContent = count.toString();
    }

    // Update export button - no auth required, export via URL
    const exportBtn = selectionPanel?.querySelector('.sos-btn-export');
    if (exportBtn) {
      exportBtn.disabled = count === 0;
      exportBtn.textContent = count > 0
        ? `Exporter ${count} lead(s)`
        : 'Exporter vers SOS Storytelling';
    }

    // Update leads list
    updateLeadsList();
  }

  // Update the leads list in panel
  function updateLeadsList() {
    const listEl = selectionPanel?.querySelector('.sos-leads-list');
    if (!listEl) return;

    if (selectedLeads.length === 0) {
      listEl.innerHTML = '<p class="sos-empty">Aucun lead selectionne</p>';
      return;
    }

    listEl.innerHTML = selectedLeads.slice(0, 10).map(lead => `
      <div class="sos-lead-item">
        <div class="sos-lead-info">
          <span class="sos-lead-name">${lead.first_name} ${lead.last_name}</span>
          <span class="sos-lead-title">${lead.job_title || ''} ${lead.company ? `@ ${lead.company}` : ''}</span>
        </div>
        <button class="sos-lead-remove" data-id="${lead.id}">&times;</button>
      </div>
    `).join('');

    if (selectedLeads.length > 10) {
      listEl.innerHTML += `<p class="sos-more">+ ${selectedLeads.length - 10} autre(s)</p>`;
    }

    // Add remove handlers
    listEl.querySelectorAll('.sos-lead-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        selectedLeads = selectedLeads.filter(l => l.id !== id);
        updateLeadsCount();
        notifyPopup();
      });
    });
  }

  // Notify popup of lead changes
  function notifyPopup() {
    chrome.runtime.sendMessage({
      action: 'leadsUpdated',
      leads: selectedLeads
    }).catch(() => {});
  }

  // Show notification
  function showNotification(message, type = 'info') {
    const existing = document.querySelector('.sos-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `sos-notification sos-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Setup event listeners
  function setupEventListeners() {
    // Floating button click
    floatingButton?.addEventListener('click', () => {
      selectionPanel?.classList.toggle('hidden');
    });

    // Panel close button
    selectionPanel?.querySelector('.sos-panel-close')?.addEventListener('click', () => {
      selectionPanel.classList.add('hidden');
    });

    // Open popup button
    selectionPanel?.querySelector('.sos-btn-open-popup')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openPopup' });
    });

    // Select all button
    selectionPanel?.querySelector('.sos-btn-select-all')?.addEventListener('click', selectAllOnPage);

    // Clear button
    selectionPanel?.querySelector('.sos-btn-clear')?.addEventListener('click', clearSelection);

    // Export button - opens app with leads data
    selectionPanel?.querySelector('.sos-btn-export')?.addEventListener('click', async () => {
      if (selectedLeads.length === 0) return;

      const exportBtn = selectionPanel.querySelector('.sos-btn-export');
      exportBtn.disabled = true;
      exportBtn.textContent = 'Export en cours...';

      try {
        // Encode leads data for URL
        const leadsData = encodeURIComponent(JSON.stringify(selectedLeads));

        // Open SOS Storytelling app with leads data
        const appUrl = `https://sos-storytelling.netlify.app/app.html?import_leads=${leadsData}`;

        // Use chrome.runtime to open new tab
        chrome.runtime.sendMessage({
          action: 'openTab',
          url: appUrl
        });

        showNotification(`${selectedLeads.length} lead(s) prets a importer!`, 'success');

        // Keep selection for now, user will clear after import
        selectionPanel.classList.add('hidden');
      } catch (error) {
        console.error('[SOS Storytelling] Export error:', error);
        showNotification('Erreur lors de l\'export', 'error');
      } finally {
        updateLeadsCount();
      }
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!selectionPanel?.classList.contains('hidden') &&
          !selectionPanel?.contains(e.target) &&
          !floatingButton?.contains(e.target)) {
        selectionPanel?.classList.add('hidden');
      }
    });
  }

  // Listen for messages from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'getSelectedLeads':
        sendResponse({ leads: selectedLeads });
        break;

      case 'clearSelection':
        clearSelection();
        sendResponse({ success: true });
        break;

      case 'userLoggedIn':
        isAuthenticated = true;
        updateUIState();
        sendResponse({ success: true });
        break;

      case 'userLoggedOut':
        isAuthenticated = false;
        updateUIState();
        sendResponse({ success: true });
        break;
    }
    return true;
  });

  // Utility: Debounce function
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
