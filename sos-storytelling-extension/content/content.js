// content.js - SOS Tools Admin Extension
// Injecte dans les pages LinkedIn (Sales Navigator + LinkedIn classique)
// RESERVE A L'ADMIN UNIQUEMENT

console.log('[SOS Tools] Content script starting... URL:', window.location.href);

(function() {
  'use strict';

  console.log('[SOS Tools] IIFE started');

  // Configuration
  const CONFIG = {
    buttonId: 'sos-storytelling-export-btn',
    panelId: 'sos-storytelling-panel',
    maxLeads: 100,
    maxPosts: 5,
    debounceDelay: 300,
    // ADMIN UNIQUEMENT
    adminEmail: 'sandra.devonssay@gmail.com'
  };

  // State
  let selectedLeads = [];
  let scrapedPosts = []; // Posts du profil courant
  let searchResults = []; // Résultats de recherche de posts
  let isAuthenticated = false;
  let isAdmin = false;
  let floatingButton = null;
  let selectionPanel = null;
  let observer = null;
  let pageType = 'unknown'; // 'sales_navigator', 'linkedin_profile', 'linkedin_search', 'content_search'

  // Detect page type
  function detectPageType() {
    const url = window.location.href;
    if (url.includes('/sales/')) {
      return 'sales_navigator';
    } else if (url.includes('/in/') && url.includes('/recent-activity/')) {
      return 'profile_activity'; // Page d'activité d'un profil
    } else if (url.includes('/in/')) {
      return 'linkedin_profile';
    } else if (url.includes('/search/results/content/')) {
      return 'content_search'; // Recherche de posts
    } else if (url.includes('/search/')) {
      return 'linkedin_search';
    }
    return 'unknown';
  }

  // Initialize
  async function init() {
    try {
      pageType = detectPageType();
      console.log('[SOS Tools] Extension loaded on:', pageType);

      // Vérifier si l'utilisateur est admin
      const adminCheck = await checkAdminStatus();
      console.log('[SOS Tools] Admin check result:', adminCheck);

      // Toujours charger l'UI - la vérification se fait côté popup
      console.log('[SOS Tools] Loading UI...');
      checkAuthStatus();
      injectUI();
      setupObserver();
      setupEventListeners();
      console.log('[SOS Tools] UI loaded successfully');
    } catch (error) {
      console.error('[SOS Tools] Init error:', error);
      // Essayer de charger l'UI quand même
      try {
        injectUI();
        setupObserver();
        setupEventListeners();
      } catch (e) {
        console.error('[SOS Tools] Fallback init failed:', e);
      }
    }
  }

  // Check if current user is admin
  async function checkAdminStatus() {
    try {
      const result = await chrome.storage.local.get(['user', 'userEmail']);
      const userEmail = result.userEmail || result.user?.email;

      if (userEmail === CONFIG.adminEmail) {
        isAdmin = true;
        return true;
      }

      // Si pas d'email stocké, vérifier via le popup
      return false;
    } catch (error) {
      console.error('[SOS Tools] Admin check error:', error);
      return false;
    }
  }

  // Check authentication status
  async function checkAuthStatus() {
    try {
      const result = await chrome.storage.local.get(['authToken', 'user', 'userEmail']);
      isAuthenticated = !!(result.authToken && result.user);

      // Double check admin status
      const userEmail = result.userEmail || result.user?.email;
      isAdmin = userEmail === CONFIG.adminEmail;

      updateUIState();
    } catch (error) {
      console.error('[SOS Tools] Auth check error:', error);
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

    // Contenu différent selon le type de page
    const isProfilePage = pageType === 'linkedin_profile' || pageType === 'profile_activity';
    const isContentSearch = pageType === 'content_search';

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
          ${isContentSearch ? `
            <!-- Mode recherche de posts -->
            <div class="sos-search-mode">
              <div class="sos-search-info">
                <span class="sos-search-count">0</span> post(s) trouvé(s)
              </div>
              <div class="sos-actions">
                <button class="sos-btn sos-btn-scrape-search">🔍 Scanner les posts</button>
                <button class="sos-btn sos-btn-select-all-search">✅ Tout sélectionner</button>
              </div>
              <div class="sos-search-results-list"></div>
              <div class="sos-export-actions">
                <span class="sos-selected-count">0 sélectionné(s)</span>
                <button class="sos-btn sos-btn-primary sos-btn-export-csv" disabled>
                  📥 Exporter CSV
                </button>
                <button class="sos-btn sos-btn-add-prospects" disabled>
                  ➕ Ajouter aux prospects
                </button>
              </div>
            </div>
          ` : `
            <!-- Mode standard (leads + posts) -->
            <div class="sos-leads-info">
              <span class="sos-leads-count">0</span> lead(s) sélectionné(s)
            </div>
            <div class="sos-actions">
              <button class="sos-btn sos-btn-select-all">Sélectionner tout (page)</button>
              <button class="sos-btn sos-btn-clear">Effacer sélection</button>
            </div>
            <div class="sos-leads-list"></div>

            <!-- Campaign + Enrichment Options -->
            <div class="sos-enrichment-options">
              <div class="sos-option-row">
                <label class="sos-option-label">Campagne :</label>
                <select class="sos-campaign-select" id="sosCampaignSelect">
                  <option value="">-- Aucune campagne --</option>
                </select>
                <button class="sos-btn-refresh-campaigns" title="Rafraichir">&#x21bb;</button>
              </div>
              <div class="sos-option-row">
                <label class="sos-checkbox-option">
                  <input type="checkbox" class="sos-enrich-checkbox" checked>
                  <span>Enrichir les emails via Apollo</span>
                </label>
              </div>
            </div>

            <button class="sos-btn sos-btn-primary sos-btn-export" disabled>
              Enrichir & Exporter
            </button>

            ${isProfilePage ? `
              <!-- Section Posts (profil uniquement) -->
              <div class="sos-posts-section">
                <div class="sos-posts-header">
                  <h4>📝 Derniers posts</h4>
                  <div class="sos-posts-actions">
                    <button class="sos-btn-scrape-posts">🔄 Scraper</button>
                    <button class="sos-btn-activity-page" title="Ouvrir la page d'activité">📜</button>
                  </div>
                </div>
                <p class="sos-empty">Cliquez sur "Scraper" ou allez sur la page d'activité</p>
              </div>
            ` : ''}
          `}
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
      if (pageType === 'content_search') {
        injectContentSearchCheckboxes();
      } else {
        injectCheckboxes();
      }
    }, CONFIG.debounceDelay));

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial injection
    setTimeout(() => {
      if (pageType === 'content_search') {
        injectContentSearchCheckboxes();
      } else {
        injectCheckboxes();
      }
    }, 1000);
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

      // Handle checkbox click - both on input and on container
      const input = checkbox.querySelector('input');

      // Prevent event bubbling to parent elements (LinkedIn's own click handlers)
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        // Toggle the input manually since we stopped propagation
        input.checked = !input.checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

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

  // Inject checkboxes on content search results (posts)
  function injectContentSearchCheckboxes() {
    // Ne rien faire si on n'est pas sur une page de recherche de contenu
    if (pageType !== 'content_search') {
      return;
    }

    // Sélecteurs pour les posts dans les résultats de recherche
    const containerSelectors = [
      '.feed-shared-update-v2',
      '[data-urn*="activity"]',
      '.scaffold-finite-scroll__content > div > div'
    ];

    let postElements = [];
    for (const selector of containerSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        postElements = Array.from(elements).filter(el => {
          // Filtrer les éléments qui contiennent vraiment du contenu de post
          return el.querySelector('.update-components-actor__name, .feed-shared-actor__name, [class*="actor__name"]');
        });
        if (postElements.length > 0) break;
      }
    }

    postElements.forEach((postEl, index) => {
      // Ne pas réinjecter si déjà présent
      if (postEl.querySelector('.sos-content-checkbox')) return;

      // Créer la checkbox
      const checkboxContainer = document.createElement('div');
      checkboxContainer.className = 'sos-content-checkbox';
      checkboxContainer.setAttribute('data-sos-index', index.toString());
      checkboxContainer.innerHTML = `
        <input type="checkbox" class="sos-content-checkbox-input" data-index="${index}">
        <span class="sos-content-checkbox-mark"></span>
      `;

      // Trouver l'endroit où insérer (à gauche de l'avatar)
      const actorContainer = postEl.querySelector('.update-components-actor, .feed-shared-actor');
      if (actorContainer) {
        // Insérer au début du container actor (à gauche de la photo)
        actorContainer.style.display = 'flex';
        actorContainer.style.alignItems = 'flex-start';
        actorContainer.insertBefore(checkboxContainer, actorContainer.firstChild);
      }

      // Gérer le clic sur la checkbox
      const input = checkboxContainer.querySelector('input');

      checkboxContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        input.checked = !input.checked;
        handleContentCheckboxChange(postEl, index, input.checked);
      });

      input.addEventListener('change', (e) => {
        e.stopPropagation();
        handleContentCheckboxChange(postEl, index, input.checked);
      });
    });

    if (postElements.length > 0) {
      console.log('[SOS Tools] Injected', postElements.length, 'checkboxes on content search');
    }
  }

  // Gérer le changement d'état d'une checkbox de contenu
  function handleContentCheckboxChange(postEl, index, isChecked) {
    // Vérifier si ce post est déjà dans searchResults
    const existingIndex = findSearchResultIndex(postEl);

    if (existingIndex >= 0) {
      // Mettre à jour l'état de sélection
      searchResults[existingIndex].selected = isChecked;
    } else if (isChecked) {
      // Extraire les données et ajouter aux résultats
      const result = extractContentSearchResult(postEl);
      if (result) {
        result.selected = true;
        result._elementIndex = index;
        searchResults.push(result);
      }
    }

    updateSearchResultsDisplay();
    updateContentCheckboxes();
  }

  // Trouver l'index d'un post dans searchResults
  function findSearchResultIndex(postEl) {
    const authorLinkEl = postEl.querySelector('a[href*="/in/"]');
    const authorUrl = authorLinkEl?.href?.split('?')[0] || '';

    const postTextEl = postEl.querySelector('.feed-shared-text, .update-components-text, .break-words');
    const postText = postTextEl?.innerText?.trim()?.substring(0, 100) || '';

    return searchResults.findIndex(r => {
      return r.author.linkedin_url === authorUrl ||
             (r.post.text && postText && r.post.text.substring(0, 100) === postText);
    });
  }

  // Extraire les données d'un résultat de recherche de contenu
  function extractContentSearchResult(element) {
    try {
      // Nom de l'auteur
      const authorNameEl = element.querySelector('.update-components-actor__name span, [class*="actor__name"] span, a[href*="/in/"] span[dir="ltr"]');
      const authorName = authorNameEl?.innerText?.trim() || '';
      if (!authorName) return null;

      // Titre de l'auteur
      const authorTitleEl = element.querySelector('.update-components-actor__description, [class*="actor__description"]');
      const authorTitle = authorTitleEl?.innerText?.trim() || '';

      // URL LinkedIn de l'auteur
      const authorLinkEl = element.querySelector('a[href*="/in/"]');
      let authorUrl = authorLinkEl?.href || '';
      if (authorUrl) authorUrl = authorUrl.split('?')[0];

      // Texte du post
      const postTextEl = element.querySelector('.feed-shared-text, .update-components-text, .break-words');
      const postText = postTextEl?.innerText?.trim() || '';

      // Date
      const timeEl = element.querySelector('time');
      const postDate = timeEl?.getAttribute('datetime') || timeEl?.innerText?.trim() || '';

      // Engagement
      const likesEl = element.querySelector('[class*="reactions-count"], [class*="social-counts__reactions"]');
      const likes = parseInt(likesEl?.innerText?.replace(/[^0-9]/g, '')) || 0;

      const commentsEl = element.querySelector('[class*="comments-count"], button[aria-label*="comment"]');
      const comments = parseInt(commentsEl?.innerText?.replace(/[^0-9]/g, '')) || 0;

      // URL du post
      const postLinkEl = element.querySelector('a[href*="/feed/update/"], a[href*="/posts/"]');
      const postUrl = postLinkEl?.href || '';

      // Extraire prénom/nom
      const nameParts = authorName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        author: {
          name: authorName,
          first_name: firstName,
          last_name: lastName,
          title: authorTitle,
          linkedin_url: authorUrl
        },
        post: {
          text: postText.substring(0, 500),
          date: postDate,
          likes: likes,
          comments: comments,
          url: postUrl
        },
        selected: false
      };
    } catch (error) {
      console.error('[SOS Tools] Error extracting content result:', error);
      return null;
    }
  }

  // Mettre à jour les checkboxes de la page en fonction de l'état de searchResults
  function updateContentCheckboxes() {
    // Ne rien faire si on n'est pas sur une page de recherche de contenu
    if (pageType !== 'content_search') return;

    document.querySelectorAll('.sos-content-checkbox').forEach(container => {
      const postEl = container.closest('.feed-shared-update-v2, [data-urn*="activity"]') ||
                     container.parentElement?.closest('.scaffold-finite-scroll__content > div > div');

      if (!postEl) return;

      const resultIndex = findSearchResultIndex(postEl);
      const input = container.querySelector('input');

      if (input) {
        input.checked = resultIndex >= 0 && searchResults[resultIndex]?.selected === true;
      }
    });
  }

  // Get lead elements from the page
  function getLeadElements() {
    // LINKEDIN PROFILE PAGE - Single profile
    if (pageType === 'linkedin_profile') {
      const profileSection = document.querySelector('.pv-top-card') ||
                             document.querySelector('[class*="profile-card"]') ||
                             document.querySelector('main');
      return profileSection ? [profileSection] : [];
    }

    // LINKEDIN SEARCH RESULTS
    if (pageType === 'linkedin_search') {
      // Search results list items
      const searchResults = document.querySelectorAll('.reusable-search__result-container');
      if (searchResults.length > 0) return Array.from(searchResults);

      // Alternative selector
      const entityResults = document.querySelectorAll('[data-chameleon-result-urn]');
      if (entityResults.length > 0) return Array.from(entityResults);

      // Fallback
      const listItems = document.querySelectorAll('li.reusable-search-simple-insight');
      if (listItems.length > 0) return Array.from(listItems);
    }

    // SALES NAVIGATOR - Sales Navigator search results
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
      // LINKEDIN PROFILE PAGE
      if (pageType === 'linkedin_profile') {
        return extractFromLinkedInProfile(element);
      }

      // LINKEDIN SEARCH RESULTS
      if (pageType === 'linkedin_search') {
        return extractFromLinkedInSearch(element);
      }

      // SALES NAVIGATOR (default)
      return extractFromSalesNavigator(element);
    } catch (error) {
      console.error('[SOS Tools] Error extracting lead data:', error);
      return null;
    }
  }

  // Extract from LinkedIn Profile page
  function extractFromLinkedInProfile(element) {
    try {
      // Get name from profile
      const nameEl = element.querySelector('h1') ||
                     document.querySelector('h1.text-heading-xlarge');
      if (!nameEl) return null;

      const fullName = nameEl.textContent.trim();
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Get LinkedIn URL from current page
      const linkedinUrl = window.location.href.split('?')[0];

      // Get job title
      const jobTitleEl = document.querySelector('.text-body-medium.break-words') ||
                         document.querySelector('[data-generated-suggestion-target]');
      const jobTitle = jobTitleEl ? jobTitleEl.textContent.trim() : '';

      // Get company from experience or headline
      let company = '';
      const experienceSection = document.querySelector('#experience');
      if (experienceSection) {
        const companyEl = experienceSection.querySelector('.hoverable-link-text span');
        company = companyEl ? companyEl.textContent.trim() : '';
      }

      // Get location
      const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words');
      const location = locationEl ? locationEl.textContent.trim() : '';

      const id = linkedinUrl;

      return {
        id,
        first_name: firstName,
        last_name: lastName,
        job_title: jobTitle,
        company: company,
        linkedin_url: linkedinUrl,
        location: location,
        source: 'linkedin_profile'
      };
    } catch (error) {
      console.error('[SOS Tools] Error extracting profile data:', error);
      return null;
    }
  }

  // Extract from LinkedIn Search results
  function extractFromLinkedInSearch(element) {
    try {
      // Get name
      const nameEl = element.querySelector('.entity-result__title-text a span[aria-hidden="true"]') ||
                     element.querySelector('.entity-result__title-text a') ||
                     element.querySelector('[class*="actor-name"]');
      if (!nameEl) return null;

      const fullName = nameEl.textContent.trim();
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Get LinkedIn URL
      let linkedinUrl = '';
      const linkEl = element.querySelector('a[href*="/in/"]');
      if (linkEl) {
        linkedinUrl = linkEl.href.split('?')[0];
      }

      // Get job title (headline)
      const jobTitleEl = element.querySelector('.entity-result__primary-subtitle') ||
                         element.querySelector('[class*="subline-level-1"]');
      const jobTitle = jobTitleEl ? jobTitleEl.textContent.trim() : '';

      // Get company from headline
      let company = '';
      if (jobTitle.includes(' at ')) {
        company = jobTitle.split(' at ')[1]?.trim() || '';
      } else if (jobTitle.includes(' chez ')) {
        company = jobTitle.split(' chez ')[1]?.trim() || '';
      }

      // Get location
      const locationEl = element.querySelector('.entity-result__secondary-subtitle') ||
                         element.querySelector('[class*="subline-level-2"]');
      const location = locationEl ? locationEl.textContent.trim() : '';

      const id = linkedinUrl || `${firstName}-${lastName}`.toLowerCase().replace(/\s+/g, '-');

      return {
        id,
        first_name: firstName,
        last_name: lastName,
        job_title: jobTitle.split(' at ')[0].split(' chez ')[0].trim(),
        company: company,
        linkedin_url: linkedinUrl,
        location: location,
        source: 'linkedin_search'
      };
    } catch (error) {
      console.error('[SOS Tools] Error extracting search data:', error);
      return null;
    }
  }

  // Extract from Sales Navigator
  function extractFromSalesNavigator(element) {
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
      console.error('[SOS Tools] Error extracting sales navigator data:', error);
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

    // Update export button with dynamic text based on options
    const exportBtn = selectionPanel?.querySelector('.sos-btn-export');
    if (exportBtn) {
      exportBtn.disabled = count === 0;
      const enrichChecked = selectionPanel?.querySelector('.sos-enrich-checkbox')?.checked;
      const campaignSelected = selectionPanel?.querySelector('.sos-campaign-select')?.value;
      if (count > 0) {
        if (enrichChecked && campaignSelected) {
          exportBtn.textContent = `Enrichir & Ajouter ${count} lead(s)`;
        } else if (enrichChecked) {
          exportBtn.textContent = `Enrichir & Exporter ${count} lead(s)`;
        } else if (campaignSelected) {
          exportBtn.textContent = `Ajouter ${count} lead(s) a la campagne`;
        } else {
          exportBtn.textContent = `Exporter ${count} lead(s)`;
        }
      } else {
        exportBtn.textContent = 'Enrichir & Exporter';
      }
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

    // Posts scrape button (profil)
    selectionPanel?.querySelector('.sos-btn-scrape-posts')?.addEventListener('click', async () => {
      showNotification('Scraping des posts...', 'info');
      await scrapeProfilePosts();
      updatePostsDisplay();
      if (scrapedPosts.length > 0) {
        showNotification(`${scrapedPosts.length} post(s) trouvé(s)`, 'success');
      } else {
        // Construire l'URL de la page d'activité
        const currentUrl = window.location.href;
        if (currentUrl.includes('/in/') && !currentUrl.includes('/recent-activity/')) {
          const match = currentUrl.match(/\/in\/([^\/\?]+)/);
          if (match) {
            const activityUrl = `https://www.linkedin.com/in/${match[1]}/recent-activity/all/`;
            showNotification(`Aucun post trouvé ici. Allez sur: ${activityUrl}`, 'warning');
          } else {
            showNotification('Aucun post trouvé. Scrollez ou allez sur la page "Voir toute l\'activité"', 'warning');
          }
        } else {
          showNotification('Aucun post trouvé. Scrollez pour charger plus de contenu.', 'warning');
        }
      }
    });

    // Activity page button (ouvrir la page d'activité)
    selectionPanel?.querySelector('.sos-btn-activity-page')?.addEventListener('click', () => {
      const currentUrl = window.location.href;
      const match = currentUrl.match(/\/in\/([^\/\?]+)/);
      if (match) {
        const activityUrl = `https://www.linkedin.com/in/${match[1]}/recent-activity/all/`;
        window.open(activityUrl, '_blank');
      } else {
        showNotification('Impossible de trouver l\'URL du profil', 'error');
      }
    });

    // Content search - Scrape button
    selectionPanel?.querySelector('.sos-btn-scrape-search')?.addEventListener('click', async () => {
      showNotification('Scanning des posts...', 'info');
      await scrapeContentSearchResults();
      updateSearchResultsDisplay();
      if (searchResults.length > 0) {
        showNotification(`${searchResults.length} post(s) trouvé(s)`, 'success');
      } else {
        showNotification('Aucun post trouvé. Scrollez pour charger plus de résultats.', 'warning');
      }
    });

    // Content search - Select all
    selectionPanel?.querySelector('.sos-btn-select-all-search')?.addEventListener('click', async () => {
      // D'abord, scanner les posts visibles s'il n'y en a pas encore
      if (searchResults.length === 0) {
        await scrapeContentSearchResults();
      }

      // Sélectionner tous les résultats
      searchResults.forEach(r => r.selected = true);

      // Aussi, sélectionner directement les checkboxes sur la page
      document.querySelectorAll('.sos-content-checkbox').forEach(container => {
        const input = container.querySelector('input');
        if (input) {
          input.checked = true;
          // Extraire les données du post si pas encore fait
          const postEl = container.closest('.feed-shared-update-v2, [data-urn*="activity"]') ||
                        container.parentElement?.closest('.scaffold-finite-scroll__content > div > div');
          if (postEl) {
            const existingIndex = findSearchResultIndex(postEl);
            if (existingIndex < 0) {
              // Ajouter ce post aux résultats
              const result = extractContentSearchResult(postEl);
              if (result) {
                result.selected = true;
                searchResults.push(result);
              }
            }
          }
        }
      });

      updateSearchResultsDisplay();
      updateContentCheckboxes();
      showNotification(`${searchResults.length} résultat(s) sélectionné(s)`, 'success');
    });

    // Content search - Export CSV
    selectionPanel?.querySelector('.sos-btn-export-csv')?.addEventListener('click', () => {
      const selected = searchResults.filter(r => r.selected);
      if (selected.length > 0) {
        exportToCSV(selected, `sos-prospects-posts-${new Date().toISOString().split('T')[0]}.csv`);
      } else {
        showNotification('Sélectionnez des résultats à exporter', 'warning');
      }
    });

    // Content search - Add to prospects
    selectionPanel?.querySelector('.sos-btn-add-prospects')?.addEventListener('click', async () => {
      const selected = searchResults.filter(r => r.selected);
      if (selected.length === 0) {
        showNotification('Sélectionnez des résultats à ajouter', 'warning');
        return;
      }

      // Convertir en format leads
      const leads = selected.map(r => ({
        first_name: r.author.first_name,
        last_name: r.author.last_name,
        job_title: r.author.title,
        company: '',
        linkedin_url: r.author.linkedin_url,
        location: '',
        source: 'linkedin_content_search',
        recent_post: r.post.text,
        post_date: r.post.date,
        post_likes: r.post.likes
      }));

      // Stocker les leads dans chrome.storage et ouvrir l'app
      await chrome.storage.local.set({
        pendingLeadsImport: {
          leads: leads,
          timestamp: Date.now()
        }
      });

      chrome.runtime.sendMessage({
        action: 'openTab',
        url: 'https://sosstorytelling.fr/prospects.html?import_leads=pending'
      });

      showNotification(`${leads.length} prospect(s) prets a importer!`, 'success');
    });

    // Export button — enrichAndExport flow or classic export
    selectionPanel?.querySelector('.sos-btn-export')?.addEventListener('click', async () => {
      if (selectedLeads.length === 0) return;

      const exportBtn = selectionPanel.querySelector('.sos-btn-export');
      const enrichChecked = selectionPanel.querySelector('.sos-enrich-checkbox')?.checked;
      const campaignId = selectionPanel.querySelector('.sos-campaign-select')?.value;

      exportBtn.disabled = true;
      exportBtn.textContent = enrichChecked ? 'Enrichissement en cours...' : 'Export en cours...';

      try {
        if (enrichChecked || campaignId) {
          // New flow: enrichAndExport via background worker API
          const response = await chrome.runtime.sendMessage({
            action: 'enrichAndExport',
            data: {
              leads: selectedLeads,
              campaign_id: campaignId || null,
              enrich: enrichChecked
            }
          });

          if (response.success) {
            const msg = [];
            if (response.data?.imported > 0) msg.push(`${response.data.imported} importe(s)`);
            if (response.data?.queued_for_enrichment > 0) msg.push(`${response.data.queued_for_enrichment} en enrichissement`);
            if (response.data?.duplicates > 0) msg.push(`${response.data.duplicates} doublon(s)`);
            showNotification(msg.join(', ') || 'Export reussi!', 'success');
          } else {
            showNotification(response.error || 'Erreur lors de l\'enrichissement', 'error');
          }
        } else {
          // Classic flow: store in chrome.storage and open app
          await chrome.storage.local.set({
            pendingLeadsImport: {
              leads: selectedLeads,
              timestamp: Date.now()
            }
          });

          chrome.runtime.sendMessage({
            action: 'openTab',
            url: 'https://sosstorytelling.fr/prospects.html?import_leads=pending'
          });

          showNotification(`${selectedLeads.length} lead(s) prets a importer!`, 'success');
        }

        selectionPanel.classList.add('hidden');
      } catch (error) {
        console.error('[SOS Tools] Export error:', error);
        showNotification('Erreur lors de l\'export', 'error');
      } finally {
        updateLeadsCount();
      }
    });

    // Campaign select & enrichment checkbox
    selectionPanel?.querySelector('.sos-campaign-select')?.addEventListener('change', () => {
      updateLeadsCount(); // Refresh button text
    });

    selectionPanel?.querySelector('.sos-enrich-checkbox')?.addEventListener('change', () => {
      updateLeadsCount(); // Refresh button text
    });

    // Refresh campaigns button
    selectionPanel?.querySelector('.sos-btn-refresh-campaigns')?.addEventListener('click', loadCampaigns);

    // Load campaigns on init
    loadCampaigns();

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!selectionPanel?.classList.contains('hidden') &&
          !selectionPanel?.contains(e.target) &&
          !floatingButton?.contains(e.target)) {
        selectionPanel?.classList.add('hidden');
      }
    });
  }

  // =====================================================
  // SCRAPING DES POSTS
  // =====================================================

  // Scraper les posts depuis une page de profil ou d'activité
  async function scrapeProfilePosts() {
    console.log('[SOS Tools] Scraping posts from profile... pageType:', pageType);
    scrapedPosts = [];

    // Sélecteurs mis à jour pour LinkedIn 2025
    const postSelectors = [
      // Posts dans le feed ou activité
      '[data-urn*="activity"]',
      '.feed-shared-update-v2',
      '.occludable-update',
      // Section activité du profil
      '.pv-recent-activity-section article',
      '.pv-recent-activity-section__card-container',
      // Nouvelle structure LinkedIn
      '[data-id*="urn:li:activity"]',
      'article[data-activity-urn]',
      // Feed posts
      '.scaffold-finite-scroll__content > div > div',
      // Generic fallback
      '[class*="feed-shared"][class*="update"]'
    ];

    // Si on est sur une page profil
    if (pageType === 'linkedin_profile' || pageType === 'profile_activity') {
      // Essayer de trouver la section activité
      const activitySectionSelectors = [
        '#content_collections',
        '[class*="pv-recent-activity"]',
        '[class*="profile-creator-shared-feed"]',
        'section.artdeco-card[class*="activity"]',
        // Nouvelle structure
        'div[class*="scaffold-finite-scroll"]'
      ];

      let postElements = [];

      // Chercher dans la section activité d'abord
      for (const sectionSelector of activitySectionSelectors) {
        const section = document.querySelector(sectionSelector);
        if (section) {
          console.log('[SOS Tools] Found activity section:', sectionSelector);
          for (const postSelector of postSelectors) {
            const elements = section.querySelectorAll(postSelector);
            if (elements.length > 0) {
              console.log('[SOS Tools] Found', elements.length, 'posts with selector:', postSelector);
              postElements = Array.from(elements);
              break;
            }
          }
          if (postElements.length > 0) break;
        }
      }

      // Si pas trouvé dans une section, chercher globalement
      if (postElements.length === 0) {
        console.log('[SOS Tools] No section found, searching globally...');
        for (const postSelector of postSelectors) {
          const elements = document.querySelectorAll(postSelector);
          if (elements.length > 0) {
            console.log('[SOS Tools] Found', elements.length, 'posts globally with:', postSelector);
            postElements = Array.from(elements);
            break;
          }
        }
      }

      // Extraire les données
      postElements.slice(0, CONFIG.maxPosts).forEach((el, index) => {
        const post = extractPostData(el);
        if (post && post.text) {
          console.log('[SOS Tools] Extracted post', index + 1, ':', post.text.substring(0, 50) + '...');
          scrapedPosts.push(post);
        }
      });
    }

    console.log('[SOS Tools] Total scraped:', scrapedPosts.length, 'posts');

    // Si aucun post trouvé, donner des instructions
    if (scrapedPosts.length === 0) {
      console.log('[SOS Tools] No posts found. Try going to the profile activity page.');
    }

    return scrapedPosts;
  }

  // Extraire les données d'un post
  function extractPostData(element) {
    try {
      // Sélecteurs pour le texte du post (LinkedIn 2025)
      const textSelectors = [
        '.feed-shared-text',
        '.update-components-text',
        '[class*="feed-shared-text"]',
        '[class*="update-components-text"]',
        '.break-words',
        'span[dir="ltr"]',
        '[data-test-id="main-feed-activity-card__commentary"]',
        '.feed-shared-update-v2__description'
      ];

      let text = '';
      for (const selector of textSelectors) {
        const textEl = element.querySelector(selector);
        if (textEl && textEl.innerText?.trim().length > 10) {
          text = textEl.innerText.trim();
          break;
        }
      }

      if (!text || text.length < 10) {
        console.log('[SOS Tools] No text found in element');
        return null;
      }

      // Date du post
      const timeSelectors = [
        'time',
        '[class*="actor__sub-description"] span',
        '.update-components-actor__sub-description span',
        '[class*="feed-shared-actor__sub-description"]'
      ];
      let date = '';
      for (const selector of timeSelectors) {
        const timeEl = element.querySelector(selector);
        if (timeEl) {
          date = timeEl.getAttribute('datetime') || timeEl.innerText?.trim() || '';
          if (date) break;
        }
      }

      // Engagement (likes)
      const likesSelectors = [
        '[class*="social-details-social-counts__reactions-count"]',
        '[class*="reactions-count"]',
        '.social-details-social-counts__reactions',
        'button[aria-label*="reaction"] span',
        '[data-test-id="social-actions__reaction-count"]'
      ];
      let likes = 0;
      for (const selector of likesSelectors) {
        const likesEl = element.querySelector(selector);
        if (likesEl) {
          const likesText = likesEl.innerText || likesEl.getAttribute('aria-label') || '';
          likes = parseInt(likesText.replace(/[^0-9]/g, '')) || 0;
          if (likes > 0) break;
        }
      }

      // Commentaires
      const commentsSelectors = [
        '[class*="social-details-social-counts__comments"]',
        'button[aria-label*="comment"]',
        '[data-test-id="social-actions__comment-count"]'
      ];
      let comments = 0;
      for (const selector of commentsSelectors) {
        const commentsEl = element.querySelector(selector);
        if (commentsEl) {
          const commentsText = commentsEl.innerText || commentsEl.getAttribute('aria-label') || '';
          comments = parseInt(commentsText.replace(/[^0-9]/g, '')) || 0;
          if (comments > 0) break;
        }
      }

      // URL du post
      const urlSelectors = [
        'a[href*="/feed/update/"]',
        'a[href*="/posts/"]',
        'a[href*="/pulse/"]',
        'a[href*="activity-"]'
      ];
      let url = '';
      for (const selector of urlSelectors) {
        const linkEl = element.querySelector(selector);
        if (linkEl?.href) {
          url = linkEl.href;
          break;
        }
      }

      // Si pas d'URL, essayer depuis l'URN
      if (!url) {
        const urn = element.getAttribute('data-urn') ||
                    element.getAttribute('data-id') ||
                    element.querySelector('[data-urn]')?.getAttribute('data-urn');
        if (urn && urn.includes('activity')) {
          const activityId = urn.split(':').pop();
          url = `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}`;
        }
      }

      return {
        text: text.substring(0, 500),
        date: date,
        likes: likes,
        comments: comments,
        shares: 0,
        url: url
      };
    } catch (error) {
      console.error('[SOS Tools] Error extracting post data:', error);
      return null;
    }
  }

  // Scraper les résultats de recherche de contenu
  async function scrapeContentSearchResults() {
    console.log('[SOS Tools] Scraping content search results... pageType:', pageType);
    searchResults = [];

    // Sélecteurs pour les posts dans les résultats de recherche (LinkedIn 2025)
    const containerSelectors = [
      '.feed-shared-update-v2',
      '[class*="feed-shared-update-v2"]',
      '.reusable-search__result-container',
      '[class*="search-results__result-item"]',
      '[data-urn*="activity"]',
      '.scaffold-finite-scroll__content > div'
    ];

    let postElements = [];
    for (const selector of containerSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log('[SOS Tools] Found', elements.length, 'posts with selector:', selector);
        postElements = Array.from(elements);
        break;
      }
    }

    console.log('[SOS Tools] Processing', postElements.length, 'elements...');

    postElements.forEach((element, idx) => {
      try {
        // Sélecteurs pour l'auteur
        const authorNameSelectors = [
          '.update-components-actor__name span',
          '[class*="update-components-actor__name"]',
          '[class*="actor__name"]',
          '.feed-shared-actor__name span',
          'a[href*="/in/"] span[dir="ltr"]'
        ];

        let authorName = '';
        for (const selector of authorNameSelectors) {
          const el = element.querySelector(selector);
          if (el?.innerText?.trim()) {
            authorName = el.innerText.trim();
            break;
          }
        }

        if (!authorName) {
          console.log('[SOS Tools] No author name in element', idx);
          return;
        }

        // Titre de l'auteur
        const authorTitleSelectors = [
          '.update-components-actor__description',
          '[class*="actor__description"]',
          '.feed-shared-actor__description'
        ];
        let authorTitle = '';
        for (const selector of authorTitleSelectors) {
          const el = element.querySelector(selector);
          if (el?.innerText?.trim()) {
            authorTitle = el.innerText.trim();
            break;
          }
        }

        // URL LinkedIn de l'auteur
        const authorLinkEl = element.querySelector('a[href*="/in/"]');
        let authorUrl = authorLinkEl?.href || '';
        if (authorUrl) {
          authorUrl = authorUrl.split('?')[0];
        }

        // Texte du post
        const postTextSelectors = [
          '.feed-shared-text',
          '[class*="feed-shared-text"]',
          '.update-components-text',
          '.break-words'
        ];
        let postText = '';
        for (const selector of postTextSelectors) {
          const el = element.querySelector(selector);
          if (el?.innerText?.trim().length > 10) {
            postText = el.innerText.trim();
            break;
          }
        }

        // Date
        const timeEl = element.querySelector('time');
        let postDate = timeEl?.getAttribute('datetime') || timeEl?.innerText?.trim() || '';

        // Engagement
        const likesEl = element.querySelector('[class*="reactions-count"], [class*="social-details-social-counts__reactions"]');
        const likes = parseInt(likesEl?.innerText?.replace(/[^0-9]/g, '')) || 0;

        const commentsEl = element.querySelector('[class*="comments-count"], button[aria-label*="comment"]');
        const comments = parseInt(commentsEl?.innerText?.replace(/[^0-9]/g, '')) || 0;

        // URL du post
        const postLinkEl = element.querySelector('a[href*="/feed/update/"], a[href*="/posts/"]');
        const postUrl = postLinkEl?.href || '';

        // Extraire prénom/nom
        const nameParts = authorName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        console.log('[SOS Tools] Found author:', authorName, '| Post:', postText.substring(0, 30) + '...');

        searchResults.push({
          author: {
            name: authorName,
            first_name: firstName,
            last_name: lastName,
            title: authorTitle,
            linkedin_url: authorUrl
          },
          post: {
            text: postText.substring(0, 500),
            date: postDate,
            likes: likes,
            comments: comments,
            url: postUrl
          },
          selected: false
        });
      } catch (error) {
        console.error('[SOS Tools] Error extracting search result:', error);
      }
    });

    console.log('[SOS Tools] Total search results:', searchResults.length);
    return searchResults;
  }

  // Mettre à jour l'affichage des posts dans le panel
  function updatePostsDisplay() {
    const postsContainer = selectionPanel?.querySelector('.sos-posts-section');
    if (!postsContainer) return;

    if (scrapedPosts.length === 0) {
      postsContainer.innerHTML = `
        <div class="sos-posts-header">
          <h4>📝 Derniers posts</h4>
          <button class="sos-btn-scrape-posts" onclick="window.sosScrapePosts()">🔄 Scraper</button>
        </div>
        <p class="sos-empty">Cliquez sur "Scraper" pour récupérer les posts</p>
      `;
      return;
    }

    postsContainer.innerHTML = `
      <div class="sos-posts-header">
        <h4>📝 Derniers posts (${scrapedPosts.length})</h4>
        <button class="sos-btn-scrape-posts" onclick="window.sosScrapePosts()">🔄</button>
      </div>
      <div class="sos-posts-list">
        ${scrapedPosts.map((post, i) => `
          <div class="sos-post-item">
            <div class="sos-post-meta">
              <span class="sos-post-date">${formatDate(post.date)}</span>
              <span class="sos-post-engagement">${post.likes} 👍 · ${post.comments} 💬</span>
            </div>
            <p class="sos-post-text">"${post.text.substring(0, 150)}..."</p>
            ${post.url ? `<a href="${post.url}" class="sos-post-link" target="_blank">Voir le post →</a>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // Formater la date
  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr; // Retourner tel quel si pas parsable
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  // Mettre à jour l'affichage des résultats de recherche
  function updateSearchResultsDisplay() {
    const countEl = selectionPanel?.querySelector('.sos-search-count');
    const listEl = selectionPanel?.querySelector('.sos-search-results-list');
    const selectedCountEl = selectionPanel?.querySelector('.sos-selected-count');
    const exportCsvBtn = selectionPanel?.querySelector('.sos-btn-export-csv');
    const addProspectsBtn = selectionPanel?.querySelector('.sos-btn-add-prospects');

    if (countEl) countEl.textContent = searchResults.length;

    const selectedCount = searchResults.filter(r => r.selected).length;
    if (selectedCountEl) selectedCountEl.textContent = `${selectedCount} sélectionné(s)`;
    if (exportCsvBtn) exportCsvBtn.disabled = selectedCount === 0;
    if (addProspectsBtn) addProspectsBtn.disabled = selectedCount === 0;

    if (!listEl) return;

    if (searchResults.length === 0) {
      listEl.innerHTML = '<p class="sos-empty">Cliquez sur "Scanner les posts" pour récupérer les auteurs</p>';
      return;
    }

    listEl.innerHTML = searchResults.slice(0, 20).map((result, index) => `
      <div class="sos-search-result-item ${result.selected ? 'selected' : ''}" data-index="${index}">
        <input type="checkbox" class="sos-result-checkbox" ${result.selected ? 'checked' : ''}>
        <div class="sos-result-content">
          <div class="sos-result-author">
            <strong>${result.author.name}</strong>
            <span class="sos-result-title">${result.author.title}</span>
          </div>
          <p class="sos-result-post">"${result.post.text?.substring(0, 100) || ''}..."</p>
          <div class="sos-result-meta">
            <span>${formatDate(result.post.date)}</span>
            <span>${result.post.likes} 👍</span>
          </div>
        </div>
      </div>
    `).join('');

    if (searchResults.length > 20) {
      listEl.innerHTML += `<p class="sos-more">+ ${searchResults.length - 20} autre(s) résultat(s)</p>`;
    }

    // Add click handlers for checkboxes
    listEl.querySelectorAll('.sos-search-result-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('sos-result-checkbox')) return;
        const index = parseInt(item.dataset.index);
        if (index >= 0 && index < searchResults.length) {
          searchResults[index].selected = !searchResults[index].selected;
          updateSearchResultsDisplay();
        }
      });

      const checkbox = item.querySelector('.sos-result-checkbox');
      checkbox?.addEventListener('change', () => {
        const index = parseInt(item.dataset.index);
        if (index >= 0 && index < searchResults.length) {
          searchResults[index].selected = checkbox.checked;
          updateSearchResultsDisplay();
        }
      });
    });
  }

  // Fonction globale pour scraper les posts (appelée depuis le HTML)
  window.sosScrapePosts = async function() {
    showNotification('Scraping des posts...', 'info');
    await scrapeProfilePosts();
    updatePostsDisplay();
    if (scrapedPosts.length > 0) {
      showNotification(`${scrapedPosts.length} post(s) trouvé(s)`, 'success');
    } else {
      showNotification('Aucun post trouvé. Essayez sur la page d\'activité du profil.', 'warning');
    }
  };

  // Exporter en CSV
  function exportToCSV(data, filename) {
    const headers = ['Nom', 'Prénom', 'Titre', 'Entreprise', 'LinkedIn URL', 'Post récent', 'Date post', 'Likes', 'Commentaires'];

    const rows = data.map(item => {
      const author = item.author || item;
      const post = item.post || {};
      return [
        author.name || `${author.first_name || ''} ${author.last_name || ''}`.trim(),
        author.first_name || '',
        author.title || author.job_title || '',
        author.company || '',
        author.linkedin_url || '',
        `"${(post.text || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        post.date || '',
        post.likes || 0,
        post.comments || 0
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const BOM = '\uFEFF'; // Pour Excel
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `sos-prospects-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification(`${data.length} prospect(s) exporté(s) en CSV`, 'success');
  }

  // Fonction globale pour exporter les résultats de recherche
  window.sosExportSearchResults = function() {
    const selected = searchResults.filter(r => r.selected);
    if (selected.length === 0) {
      showNotification('Sélectionnez des résultats à exporter', 'warning');
      return;
    }
    exportToCSV(selected, `sos-prospects-posts-${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Load campaigns into dropdown
  async function loadCampaigns() {
    const select = selectionPanel?.querySelector('.sos-campaign-select');
    if (!select) return;

    try {
      const response = await chrome.runtime.sendMessage({ action: 'loadCampaigns' });
      if (response.success && response.campaigns) {
        // Keep first option
        select.innerHTML = '<option value="">-- Aucune campagne --</option>';
        response.campaigns.forEach(c => {
          const option = document.createElement('option');
          option.value = c.id;
          option.textContent = `${c.name} (${c.prospects_count || 0} prospects)`;
          select.appendChild(option);
        });
      }
    } catch (error) {
      console.log('[SOS Tools] Could not load campaigns:', error.message);
    }
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

      case 'getScrapedPosts':
        sendResponse({ posts: scrapedPosts });
        break;

      case 'scrapeProfilePosts':
        scrapeProfilePosts().then(posts => {
          sendResponse({ posts });
        });
        return true; // Keep channel open for async

      case 'getSearchResults':
        sendResponse({ results: searchResults });
        break;

      case 'scrapeContentSearch':
        scrapeContentSearchResults().then(results => {
          sendResponse({ results });
        });
        return true;

      case 'toggleSearchResult':
        if (message.index >= 0 && message.index < searchResults.length) {
          searchResults[message.index].selected = !searchResults[message.index].selected;
        }
        sendResponse({ success: true, results: searchResults });
        break;

      case 'selectAllSearchResults':
        searchResults.forEach(r => r.selected = true);
        sendResponse({ success: true, results: searchResults });
        break;

      case 'clearSearchSelection':
        searchResults.forEach(r => r.selected = false);
        sendResponse({ success: true, results: searchResults });
        break;

      case 'exportSearchResultsCSV':
        const selected = searchResults.filter(r => r.selected);
        if (selected.length > 0) {
          exportToCSV(selected);
        }
        sendResponse({ success: true, exported: selected.length });
        break;

      case 'getPageType':
        sendResponse({ pageType });
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
