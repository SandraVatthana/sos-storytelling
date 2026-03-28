/**
 * Module Prospecter - Intégration Social Prospector dans SOS Storytelling
 * Permet la recherche de prospects, génération de messages et gestion des prospects
 */

window.ProspecterModule = (function() {
    'use strict';

    // Configuration
    const API_URL = 'https://social-prospector-production.up.railway.app/api';

    // State
    let currentUser = null;
    let currentProspects = [];
    let currentView = 'menu'; // 'menu', 'search', 'prospects', 'messages'
    let voiceProfile = null;
    let selectedProspect = null;

    // ==================== INITIALIZATION ====================

    async function init() {
        console.log('[Prospecter] Initializing...');

        // Get current user
        try {
            if (window.currentUser) {
                currentUser = window.currentUser;
            } else if (typeof supabaseApp !== 'undefined') {
                const { data: { user } } = await supabaseApp.auth.getUser();
                currentUser = user;
            }
        } catch (e) {
            console.warn('[Prospecter] Could not get user:', e);
        }

        // Load voice profile
        await loadVoiceProfile();

        // Create modal if not exists
        createModal();

        console.log('[Prospecter] Initialized');
    }

    async function loadVoiceProfile() {
        if (!currentUser) return;

        // Use default voice profile - no database query needed
        voiceProfile = {
            tone: 'decontracte',
            style: 'amical',
            business_context: {}
        };

        // Try to get business context from localStorage if available
        try {
            const savedContext = localStorage.getItem('sos_business_context');
            if (savedContext) {
                voiceProfile.business_context = JSON.parse(savedContext);
            }
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    // ==================== MODAL CREATION ====================

    function createModal() {
        if (document.getElementById('prospecter-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'prospecter-modal';
        modal.className = 'prospecter-modal-overlay';
        modal.innerHTML = `
            <div class="prospecter-modal-content">
                <button class="prospecter-close-btn" onclick="ProspecterModule.closeModal()">&times;</button>

                <!-- Header avec navigation -->
                <div class="prospecter-header">
                    <button class="prospecter-back-btn" onclick="ProspecterModule.goBack()" style="display: none;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                        </svg>
                    </button>
                    <h2 class="prospecter-title">Prospecter</h2>
                </div>

                <!-- Container principal -->
                <div id="prospecter-container">
                    <!-- Menu principal -->
                    <div id="prospecter-menu" class="prospecter-view">
                        <p class="prospecter-subtitle">Trouve et contacte tes prospects idéaux</p>

                        <div class="prospecter-menu-grid">
                            <div class="prospecter-menu-card" onclick="ProspecterModule.showSearch()">
                                <div class="prospecter-menu-icon">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="11" cy="11" r="8"/>
                                        <path d="M21 21l-4.35-4.35"/>
                                    </svg>
                                </div>
                                <h3>Recherche</h3>
                                <p>Trouve des prospects par hashtag, compte ou lieu</p>
                            </div>

                            <div class="prospecter-menu-card" onclick="ProspecterModule.showProspects()">
                                <div class="prospecter-menu-icon">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                        <circle cx="9" cy="7" r="4"/>
                                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                    </svg>
                                </div>
                                <h3>Mes Prospects</h3>
                                <p>Gère ta liste de prospects sauvegardés</p>
                                <span class="prospecter-badge" id="prospects-count">0</span>
                            </div>

                            <div class="prospecter-menu-card" onclick="ProspecterModule.showMessages()">
                                <div class="prospecter-menu-icon">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                    </svg>
                                </div>
                                <h3>Messages</h3>
                                <p>Génère et gère tes messages de prospection</p>
                                <span class="prospecter-badge" id="messages-count">0</span>
                            </div>
                        </div>
                    </div>

                    <!-- Vue Recherche -->
                    <div id="prospecter-search" class="prospecter-view" style="display: none;">
                        <div class="prospecter-search-form">
                            <div class="prospecter-search-tabs">
                                <button class="prospecter-tab active" data-type="hashtag" onclick="ProspecterModule.setSearchType('hashtag')">
                                    # Hashtag
                                </button>
                                <button class="prospecter-tab" data-type="account" onclick="ProspecterModule.setSearchType('account')">
                                    @ Compte
                                </button>
                                <button class="prospecter-tab" data-type="location" onclick="ProspecterModule.setSearchType('location')">
                                    📍 Lieu
                                </button>
                            </div>

                            <div class="prospecter-search-input-wrapper">
                                <input type="text"
                                       id="prospecter-search-input"
                                       class="prospecter-search-input"
                                       placeholder="Ex: entrepreneuriat, coaching, fitness..."
                                       onkeypress="if(event.key==='Enter') ProspecterModule.doSearch()">
                                <button class="prospecter-search-btn" onclick="ProspecterModule.doSearch()">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="11" cy="11" r="8"/>
                                        <path d="M21 21l-4.35-4.35"/>
                                    </svg>
                                    Rechercher
                                </button>
                            </div>

                            <div class="prospecter-search-options">
                                <label>
                                    <input type="checkbox" id="prospecter-french-only" checked>
                                    Profils francophones uniquement
                                </label>
                            </div>
                        </div>

                        <!-- Résultats -->
                        <div id="prospecter-results" class="prospecter-results">
                            <div class="prospecter-results-empty">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5">
                                    <circle cx="11" cy="11" r="8"/>
                                    <path d="M21 21l-4.35-4.35"/>
                                </svg>
                                <p>Lance une recherche pour trouver des prospects</p>
                            </div>
                        </div>
                    </div>

                    <!-- Vue Prospects -->
                    <div id="prospecter-prospects" class="prospecter-view" style="display: none;">
                        <div class="prospecter-prospects-header">
                            <div class="prospecter-prospects-filters">
                                <select id="prospecter-status-filter" onchange="ProspecterModule.filterProspects()">
                                    <option value="">Tous les statuts</option>
                                    <option value="new">Nouveaux</option>
                                    <option value="contacted">Contactés</option>
                                    <option value="responded">Ont répondu</option>
                                    <option value="converted">Convertis</option>
                                </select>
                            </div>
                        </div>
                        <div id="prospecter-prospects-list" class="prospecter-prospects-list">
                            <!-- Liste des prospects -->
                        </div>
                    </div>

                    <!-- Vue Messages -->
                    <div id="prospecter-messages" class="prospecter-view" style="display: none;">
                        <div id="prospecter-messages-list" class="prospecter-messages-list">
                            <!-- Liste des messages -->
                        </div>
                    </div>

                    <!-- Vue Détail Prospect -->
                    <div id="prospecter-prospect-detail" class="prospecter-view" style="display: none;">
                        <!-- Détail du prospect sélectionné -->
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // ==================== NAVIGATION ====================

    function openModal() {
        init().then(() => {
            const modal = document.getElementById('prospecter-modal');
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
                showMenu();
                loadCounts();
            }
        });
    }

    function closeModal() {
        const modal = document.getElementById('prospecter-modal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    function goBack() {
        if (currentView === 'prospect-detail') {
            showProspects();
        } else {
            showMenu();
        }
    }

    function showView(viewId, title) {
        // Hide all views
        document.querySelectorAll('.prospecter-view').forEach(v => v.style.display = 'none');

        // Show selected view
        const view = document.getElementById(`prospecter-${viewId}`);
        if (view) view.style.display = 'block';

        // Update title
        document.querySelector('.prospecter-title').textContent = title;

        // Show/hide back button
        const backBtn = document.querySelector('.prospecter-back-btn');
        if (backBtn) {
            backBtn.style.display = viewId === 'menu' ? 'none' : 'flex';
        }

        currentView = viewId;
    }

    function showMenu() {
        showView('menu', 'Prospecter');
    }

    function showSearch() {
        showView('search', 'Recherche de prospects');
    }

    function showProspects() {
        showView('prospects', 'Mes Prospects');
        loadProspects();
    }

    function showMessages() {
        showView('messages', 'Messages');
        loadMessages();
    }

    // ==================== SEARCH ====================

    let currentSearchType = 'hashtag';

    function setSearchType(type) {
        currentSearchType = type;

        // Update tabs
        document.querySelectorAll('.prospecter-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });

        // Update placeholder
        const input = document.getElementById('prospecter-search-input');
        const placeholders = {
            hashtag: 'Ex: entrepreneuriat, coaching, fitness...',
            account: 'Ex: @garyvee, @simonsinek...',
            location: 'Ex: Paris, Lyon, Bordeaux...'
        };
        input.placeholder = placeholders[type];
    }

    async function doSearch() {
        const query = document.getElementById('prospecter-search-input').value.trim();
        if (!query) {
            showNotification('Entrez un terme de recherche', 'warning');
            return;
        }

        const frenchOnly = document.getElementById('prospecter-french-only').checked;
        const resultsContainer = document.getElementById('prospecter-results');

        // Show loading
        resultsContainer.innerHTML = `
            <div class="prospecter-loading">
                <div class="prospecter-spinner"></div>
                <p>Recherche en cours...</p>
            </div>
        `;

        try {
            // Clean query
            let cleanQuery = query;
            if (currentSearchType === 'hashtag') {
                cleanQuery = query.replace(/^#/, '');
            } else if (currentSearchType === 'account') {
                cleanQuery = query.replace(/^@/, '');
            }

            // Call Social Prospector API
            const params = new URLSearchParams({
                sourceType: currentSearchType,
                query: cleanQuery,
                limit: 30,
                country: frenchOnly ? 'fr' : ''
            });

            const response = await fetch(`${API_URL}/search/source?${params}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getAuthToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erreur ${response.status}`);
            }

            const result = await response.json();
            const prospects = result.data?.prospects || [];

            if (prospects.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="prospecter-results-empty">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M8 15h8M9 9h.01M15 9h.01"/>
                        </svg>
                        <p>Aucun prospect trouvé pour "${query}"</p>
                        <p class="prospecter-hint">Essayez un autre terme ou désactivez le filtre francophone</p>
                    </div>
                `;
                return;
            }

            // Display results
            currentProspects = prospects;
            renderSearchResults(prospects);

        } catch (error) {
            console.error('[Prospecter] Search error:', error);
            resultsContainer.innerHTML = `
                <div class="prospecter-results-empty prospecter-error">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M15 9l-6 6M9 9l6 6"/>
                    </svg>
                    <p>Erreur lors de la recherche</p>
                    <p class="prospecter-hint">${error.message}</p>
                </div>
            `;
        }
    }

    function renderSearchResults(prospects) {
        const container = document.getElementById('prospecter-results');

        container.innerHTML = `
            <div class="prospecter-results-header">
                <span>${prospects.length} prospects trouvés</span>
                <button class="prospecter-select-all-btn" onclick="ProspecterModule.selectAllProspects()">
                    Tout sélectionner
                </button>
            </div>
            <div class="prospecter-results-grid">
                ${prospects.map((p, idx) => renderProspectCard(p, idx)).join('')}
            </div>
            <div class="prospecter-results-actions" style="display: none;">
                <span id="prospecter-selected-count">0 sélectionné(s)</span>
                <button class="prospecter-action-btn" onclick="ProspecterModule.saveSelectedProspects()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17,21 17,13 7,13 7,21"/>
                        <polyline points="7,3 7,8 15,8"/>
                    </svg>
                    Sauvegarder
                </button>
                <button class="prospecter-action-btn primary" onclick="ProspecterModule.generateMessagesForSelected()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    Générer messages
                </button>
            </div>
        `;
    }

    function renderProspectCard(prospect, index) {
        const engagement = prospect.engagement || calculateEngagement(prospect);
        const score = prospect.score || 75;

        return `
            <div class="prospecter-prospect-card" data-index="${index}">
                <div class="prospecter-prospect-checkbox">
                    <input type="checkbox"
                           id="prospect-${index}"
                           onchange="ProspecterModule.updateSelection()">
                </div>
                <div class="prospecter-prospect-avatar">
                    <img src="${prospect.avatar || 'https://i.pravatar.cc/150?u=' + prospect.username}"
                         alt="${prospect.username}"
                         onerror="this.src='https://i.pravatar.cc/150?u=${prospect.username}'">
                </div>
                <div class="prospecter-prospect-info">
                    <div class="prospecter-prospect-name">
                        <strong>${prospect.fullName || prospect.username}</strong>
                        ${prospect.isVerified ? '<span class="prospecter-verified">✓</span>' : ''}
                    </div>
                    <div class="prospecter-prospect-username">@${prospect.username}</div>
                    <div class="prospecter-prospect-bio">${truncate(prospect.bio || '', 100)}</div>
                    <div class="prospecter-prospect-stats">
                        <span>${formatNumber(prospect.followers || 0)} abonnés</span>
                        <span class="prospecter-engagement">${engagement}% engagement</span>
                    </div>
                </div>
                <div class="prospecter-prospect-actions">
                    <button class="prospecter-icon-btn" onclick="ProspecterModule.viewProspect(${index})" title="Voir le profil">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="prospecter-icon-btn primary" onclick="ProspecterModule.quickGenerateMessage(${index})" title="Générer un message">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                    </button>
                </div>
                <div class="prospecter-prospect-score" style="--score: ${score}">
                    <span>${score}</span>
                </div>
            </div>
        `;
    }

    function calculateEngagement(prospect) {
        if (!prospect.recentPosts || prospect.recentPosts.length === 0) return 0;
        const followers = prospect.followers || 1;
        const avgLikes = prospect.recentPosts.reduce((sum, p) => sum + (p.likes || 0), 0) / prospect.recentPosts.length;
        return ((avgLikes / followers) * 100).toFixed(1);
    }

    function updateSelection() {
        const checkboxes = document.querySelectorAll('.prospecter-prospect-card input[type="checkbox"]');
        const selectedCount = [...checkboxes].filter(cb => cb.checked).length;

        const countEl = document.getElementById('prospecter-selected-count');
        const actionsEl = document.querySelector('.prospecter-results-actions');

        if (countEl) countEl.textContent = `${selectedCount} sélectionné(s)`;
        if (actionsEl) actionsEl.style.display = selectedCount > 0 ? 'flex' : 'none';
    }

    function selectAllProspects() {
        const checkboxes = document.querySelectorAll('.prospecter-prospect-card input[type="checkbox"]');
        const allChecked = [...checkboxes].every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
        updateSelection();
    }

    function getSelectedProspects() {
        const checkboxes = document.querySelectorAll('.prospecter-prospect-card input[type="checkbox"]:checked');
        return [...checkboxes].map(cb => {
            const card = cb.closest('.prospecter-prospect-card');
            const index = parseInt(card.dataset.index);
            return currentProspects[index];
        });
    }

    // ==================== PROSPECTS MANAGEMENT ====================

    async function loadProspects() {
        const container = document.getElementById('prospecter-prospects-list');

        container.innerHTML = `
            <div class="prospecter-loading">
                <div class="prospecter-spinner"></div>
                <p>Chargement des prospects...</p>
            </div>
        `;

        try {
            const { data, error } = await supabaseApp
                .from('prospects')
                .select('*')
                .eq('user_id', currentUser?.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div class="prospecter-empty">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <p>Aucun prospect sauvegardé</p>
                        <button class="prospecter-btn primary" onclick="ProspecterModule.showSearch()">
                            Rechercher des prospects
                        </button>
                    </div>
                `;
                return;
            }

            renderProspectsList(data);

        } catch (error) {
            console.error('[Prospecter] Load prospects error:', error);
            container.innerHTML = `
                <div class="prospecter-error">
                    <p>Erreur lors du chargement</p>
                </div>
            `;
        }
    }

    function renderProspectsList(prospects) {
        const container = document.getElementById('prospecter-prospects-list');

        container.innerHTML = prospects.map(p => `
            <div class="prospecter-prospect-row" data-id="${p.id}">
                <div class="prospecter-prospect-avatar">
                    <img src="${p.avatar_url || 'https://i.pravatar.cc/150?u=' + p.username}"
                         alt="${p.username}">
                </div>
                <div class="prospecter-prospect-info">
                    <div class="prospecter-prospect-name">
                        <strong>${p.full_name || p.username}</strong>
                    </div>
                    <div class="prospecter-prospect-username">@${p.username}</div>
                </div>
                <div class="prospecter-prospect-status status-${p.status || 'new'}">
                    ${getStatusLabel(p.status)}
                </div>
                <div class="prospecter-prospect-actions">
                    <button class="prospecter-icon-btn" onclick="ProspecterModule.openInstagram('${p.username}')" title="Ouvrir Instagram">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                        </svg>
                    </button>
                    <button class="prospecter-icon-btn primary" onclick="ProspecterModule.generateMessageForProspect('${p.id}')" title="Générer un message">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    function getStatusLabel(status) {
        const labels = {
            new: 'Nouveau',
            contacted: 'Contacté',
            responded: 'A répondu',
            converted: 'Converti',
            archived: 'Archivé'
        };
        return labels[status] || 'Nouveau';
    }

    async function saveSelectedProspects() {
        const selected = getSelectedProspects();
        if (selected.length === 0) {
            showNotification('Sélectionnez au moins un prospect', 'warning');
            return;
        }

        try {
            const prospectsToSave = selected.map(p => ({
                user_id: currentUser.id,
                username: p.username,
                platform: p.platform || 'instagram',
                full_name: p.fullName || p.username,
                bio: p.bio || '',
                avatar_url: p.avatar || '',
                followers_count: p.followers || 0,
                status: 'new',
                source: `search_${currentSearchType}`,
                raw_data: p
            }));

            const { error } = await supabaseApp
                .from('prospects')
                .upsert(prospectsToSave, {
                    onConflict: 'user_id,username,platform'
                });

            if (error) throw error;

            showNotification(`${selected.length} prospect(s) sauvegardé(s)`, 'success');
            loadCounts();

        } catch (error) {
            console.error('[Prospecter] Save error:', error);
            showNotification('Erreur lors de la sauvegarde', 'error');
        }
    }

    // ==================== MESSAGES ====================

    async function loadMessages() {
        const container = document.getElementById('prospecter-messages-list');

        container.innerHTML = `
            <div class="prospecter-loading">
                <div class="prospecter-spinner"></div>
                <p>Chargement des messages...</p>
            </div>
        `;

        try {
            const { data, error } = await supabaseApp
                .from('messages')
                .select(`
                    *,
                    prospect:prospects(id, username, full_name, avatar_url)
                `)
                .eq('user_id', currentUser?.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div class="prospecter-empty">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <p>Aucun message généré</p>
                        <button class="prospecter-btn primary" onclick="ProspecterModule.showSearch()">
                            Trouver des prospects
                        </button>
                    </div>
                `;
                return;
            }

            renderMessagesList(data);

        } catch (error) {
            console.error('[Prospecter] Load messages error:', error);
        }
    }

    function renderMessagesList(messages) {
        const container = document.getElementById('prospecter-messages-list');

        container.innerHTML = messages.map(m => `
            <div class="prospecter-message-card" data-id="${m.id}">
                <div class="prospecter-message-header">
                    ${m.prospect ? `
                        <img src="${m.prospect.avatar_url || 'https://i.pravatar.cc/40'}" class="prospecter-message-avatar">
                        <span class="prospecter-message-recipient">@${m.prospect.username}</span>
                    ` : '<span class="prospecter-message-recipient">Prospect inconnu</span>'}
                    <span class="prospecter-message-status status-${m.status}">${m.status === 'sent' ? 'Envoyé' : 'Brouillon'}</span>
                </div>
                <div class="prospecter-message-content">${m.content}</div>
                <div class="prospecter-message-footer">
                    <span class="prospecter-message-date">${formatDate(m.created_at)}</span>
                    <div class="prospecter-message-actions">
                        <button class="prospecter-icon-btn" onclick="ProspecterModule.copyMessage('${m.id}')" title="Copier">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                        ${m.status !== 'sent' ? `
                            <button class="prospecter-icon-btn success" onclick="ProspecterModule.markAsSent('${m.id}')" title="Marquer envoyé">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    async function quickGenerateMessage(index) {
        const prospect = currentProspects[index];
        if (!prospect) return;

        selectedProspect = prospect;

        // Show generating modal
        showGeneratingModal(prospect);

        try {
            const response = await fetch(`${API_URL}/messages/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getAuthToken()}`
                },
                body: JSON.stringify({
                    prospect: {
                        username: prospect.username,
                        bio: prospect.bio,
                        followers: prospect.followers,
                        platform: prospect.platform || 'instagram'
                    },
                    posts: prospect.recentPosts || [],
                    voice_profile: voiceProfile,
                    approach_method: 'mini_aida'
                })
            });

            if (!response.ok) throw new Error('Erreur génération');

            const result = await response.json();
            const message = result.data?.message || result.message;

            showMessageResult(prospect, message);

        } catch (error) {
            console.error('[Prospecter] Generate error:', error);
            closeGeneratingModal();
            showNotification('Erreur lors de la génération', 'error');
        }
    }

    function showGeneratingModal(prospect) {
        const modal = document.createElement('div');
        modal.id = 'prospecter-generating-modal';
        modal.className = 'prospecter-generating-overlay';
        modal.innerHTML = `
            <div class="prospecter-generating-content">
                <div class="prospecter-spinner large"></div>
                <h3>Génération en cours...</h3>
                <p>Analyse du profil @${prospect.username}</p>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    }

    function closeGeneratingModal() {
        const modal = document.getElementById('prospecter-generating-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    }

    function showMessageResult(prospect, message) {
        closeGeneratingModal();

        const modal = document.createElement('div');
        modal.id = 'prospecter-message-modal';
        modal.className = 'prospecter-message-overlay';
        modal.innerHTML = `
            <div class="prospecter-message-result">
                <button class="prospecter-close-btn" onclick="ProspecterModule.closeMessageModal()">&times;</button>

                <div class="prospecter-message-result-header">
                    <img src="${prospect.avatar || 'https://i.pravatar.cc/60?u=' + prospect.username}" class="prospecter-result-avatar">
                    <div>
                        <strong>${prospect.fullName || prospect.username}</strong>
                        <span>@${prospect.username}</span>
                    </div>
                </div>

                <div class="prospecter-message-result-content">
                    <textarea id="prospecter-generated-message" rows="6">${message}</textarea>
                </div>

                <div class="prospecter-message-result-actions">
                    <button class="prospecter-btn" onclick="ProspecterModule.regenerateMessage()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"/>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                        </svg>
                        Régénérer
                    </button>
                    <button class="prospecter-btn" onclick="ProspecterModule.copyGeneratedMessage()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copier
                    </button>
                    <button class="prospecter-btn primary" onclick="ProspecterModule.saveAndOpenInstagram()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                        </svg>
                        Ouvrir Instagram
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
    }

    function closeMessageModal() {
        const modal = document.getElementById('prospecter-message-modal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    }

    async function regenerateMessage() {
        if (!selectedProspect) return;
        closeMessageModal();
        await quickGenerateMessage(currentProspects.indexOf(selectedProspect));
    }

    function copyGeneratedMessage() {
        const textarea = document.getElementById('prospecter-generated-message');
        if (textarea) {
            navigator.clipboard.writeText(textarea.value);
            showNotification('Message copié !', 'success');
        }
    }

    async function saveAndOpenInstagram() {
        const textarea = document.getElementById('prospecter-generated-message');
        if (!textarea || !selectedProspect) return;

        // Copy message
        await navigator.clipboard.writeText(textarea.value);

        // Save message to DB
        try {
            await supabaseApp.from('messages').insert({
                user_id: currentUser.id,
                content: textarea.value,
                status: 'draft',
                generated_by: 'ai'
            });
        } catch (e) {
            console.warn('Could not save message:', e);
        }

        // Open Instagram
        window.open(`https://instagram.com/${selectedProspect.username}`, '_blank');

        closeMessageModal();
        showNotification('Message copié ! Instagram ouvert.', 'success');
    }

    // ==================== UTILITIES ====================

    async function getAuthToken() {
        try {
            const { data: { session } } = await supabaseApp.auth.getSession();
            return session?.access_token || '';
        } catch (e) {
            return '';
        }
    }

    async function loadCounts() {
        try {
            // Load prospects count
            const { count: prospectsCount } = await supabaseApp
                .from('prospects')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser?.id);

            const prospectsEl = document.getElementById('prospects-count');
            if (prospectsEl) prospectsEl.textContent = prospectsCount || 0;

            // Load messages count
            const { count: messagesCount } = await supabaseApp
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUser?.id);

            const messagesEl = document.getElementById('messages-count');
            if (messagesEl) messagesEl.textContent = messagesCount || 0;

        } catch (e) {
            console.warn('Could not load counts:', e);
        }
    }

    function showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (typeof showToast === 'function') {
            showToast(message, type);
            return;
        }

        const notification = document.createElement('div');
        notification.className = `prospecter-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => notification.classList.add('show'), 10);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    function truncate(str, length) {
        if (!str) return '';
        return str.length > length ? str.substring(0, length) + '...' : str;
    }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'À l\'instant';
        if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
        if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
        return date.toLocaleDateString('fr-FR');
    }

    function openInstagram(username) {
        window.open(`https://instagram.com/${username}`, '_blank');
    }

    // ==================== PUBLIC API ====================

    return {
        init,
        openModal,
        closeModal,
        goBack,
        showMenu,
        showSearch,
        showProspects,
        showMessages,
        setSearchType,
        doSearch,
        updateSelection,
        selectAllProspects,
        saveSelectedProspects,
        quickGenerateMessage,
        closeMessageModal,
        regenerateMessage,
        copyGeneratedMessage,
        saveAndOpenInstagram,
        openInstagram,
        viewProspect: (index) => console.log('View prospect:', currentProspects[index]),
        generateMessagesForSelected: () => console.log('Generate for selected'),
        generateMessageForProspect: (id) => console.log('Generate for:', id),
        copyMessage: (id) => console.log('Copy message:', id),
        markAsSent: (id) => console.log('Mark sent:', id),
        filterProspects: () => loadProspects()
    };
})();

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', function() {
    if (typeof ProspecterModule !== 'undefined') {
        ProspecterModule.init();
    }
});
