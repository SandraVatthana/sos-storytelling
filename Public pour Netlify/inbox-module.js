/**
 * INBOX INTELLIGENTE - Module JavaScript
 * SOS Storytelling
 *
 * Gère l'interface de tri automatique des réponses emails
 */

// Configuration
const INBOX_CONFIG = {
  // Worker Cloudflare déployé
  apiUrl: 'https://sos-inbox-worker.sandra-devonssay.workers.dev',

  // OAuth Gmail
  gmail: {
    clientId: '801460571379-cotm0n14spd573tjlvnhj5t7rfj6u6nf.apps.googleusercontent.com',
    redirectUri: window.location.origin + '/oauth-callback.html',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth'
  }
};

// Module Inbox
const InboxModule = {
  responses: [],
  currentFilter: 'all',
  selectedResponse: null,
  isConnected: false,
  connectedEmail: null,
  isLoading: false,
  isSyncing: false,

  // =====================================================
  // INITIALISATION
  // =====================================================

  async init() {
    console.log('📬 Initializing Inbox Module...');

    // Créer le HTML du module
    this.createInboxHTML();

    // Setup des événements
    this.setupEventListeners();

    // IMPORTANT: Vérifier d'abord si on revient d'un OAuth callback
    const hasOAuthCallback = await this.checkOAuthCallback();

    // Si pas de callback OAuth, vérifier la connexion existante
    if (!hasOAuthCallback) {
      await this.checkEmailConnection();

      // Charger les réponses si connecté
      if (this.isConnected) {
        await this.loadResponses();
      }
    }

    console.log('✅ Inbox Module initialized');
  },

  // Créer le HTML dynamiquement
  createInboxHTML() {
    const container = document.getElementById('inboxContainer');
    if (!container) return;

    container.innerHTML = `
      <!-- Section connexion email -->
      <div class="email-connect-section" id="emailConnectSection">
        <h3>📬 Connecte ta boîte email</h3>
        <p>Pour recevoir et trier automatiquement les réponses à tes campagnes de prospection.</p>

        <div class="connect-buttons" id="connectButtons">
          <button class="btn-gmail" onclick="InboxModule.connectGmail()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 11L4 6H20ZM20 18H4V8L12 13L20 8V18Z" fill="#EA4335"/>
            </svg>
            Connecter Gmail
          </button>
          <button class="btn-outlook" onclick="InboxModule.connectOutlook()">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7V17L12 22L22 17V7L12 2ZM12 4.2L19.3 7.8L12 11.4L4.7 7.8L12 4.2ZM4 9.5L11 12.8V19.1L4 15.8V9.5ZM13 19.1V12.8L20 9.5V15.8L13 19.1Z" fill="#0078D4"/>
            </svg>
            Connecter Outlook
          </button>
        </div>

        <div class="connected-account" id="connectedAccount" style="display: none;">
          <span class="status-dot green"></span>
          <span id="connectedEmail">email@gmail.com</span>
          <button class="btn-disconnect" onclick="InboxModule.disconnectEmail()">Déconnecter</button>
        </div>
      </div>

      <!-- Header Inbox -->
      <div class="inbox-header" id="inboxHeader" style="display: none;">
        <div class="inbox-title">
          <h2>📬 Inbox Intelligente</h2>
          <span class="inbox-badge" id="unreadCount">0 nouvelles</span>
        </div>
        <div class="inbox-actions">
          <button class="btn-sync" id="btnSync" onclick="InboxModule.syncEmails()">
            <span class="sync-icon">🔄</span> Synchroniser
          </button>
          <button class="btn-settings" onclick="InboxModule.openSettings()" title="Paramètres">
            ⚙️
          </button>
        </div>
      </div>

      <!-- Filtres -->
      <div class="inbox-filters" id="inboxFilters" style="display: none;">
        <button class="filter-btn active" data-filter="all" onclick="InboxModule.filterResponses('all')">
          Toutes <span class="count" id="countAll">0</span>
        </button>
        <button class="filter-btn priority-high" data-filter="high" onclick="InboxModule.filterResponses('high')">
          🔴 Prioritaires <span class="count" id="countHigh">0</span>
        </button>
        <button class="filter-btn" data-filter="MEETING" onclick="InboxModule.filterResponses('MEETING')">
          📅 RDV <span class="count" id="countMeeting">0</span>
        </button>
        <button class="filter-btn" data-filter="INTERESTED" onclick="InboxModule.filterResponses('INTERESTED')">
          🟢 Intéressés <span class="count" id="countInterested">0</span>
        </button>
        <button class="filter-btn" data-filter="OBJECTION" onclick="InboxModule.filterResponses('OBJECTION')">
          🟡 Objections <span class="count" id="countObjection">0</span>
        </button>
        <button class="filter-btn" data-filter="done" onclick="InboxModule.filterResponses('done')">
          ✅ Traités <span class="count" id="countDone">0</span>
        </button>
      </div>

      <!-- Liste des réponses -->
      <div class="inbox-list" id="inboxList" style="display: none;">
        <div class="inbox-loading"></div>
      </div>

      <!-- Overlay pour le panel -->
      <div class="inbox-overlay" id="inboxOverlay" onclick="InboxModule.closeDetailPanel()"></div>

      <!-- Panel de détail -->
      <div class="inbox-detail-panel" id="detailPanel">
        <div class="panel-header">
          <button class="btn-close" onclick="InboxModule.closeDetailPanel()">✕</button>
          <h3 id="detailSubject">Sujet de l'email</h3>
        </div>
        <div class="panel-content">
          <div class="detail-meta">
            <span class="detail-from" id="detailFrom">email@example.com</span>
            <span class="detail-date" id="detailDate">2 jan 2026, 14:32</span>
          </div>
          <div class="detail-classification">
            <span class="category-badge" id="detailCategory">📅 RDV</span>
            <span class="confidence" id="detailConfidence">Confiance: 95%</span>
          </div>
          <div class="detail-summary">
            <strong>💡 Résumé IA</strong>
            <p id="detailSummary">Résumé de l'email...</p>
          </div>
          <div class="detail-suggested">
            <strong>🎯 Action suggérée</strong>
            <p id="detailAction">Action suggérée...</p>
          </div>
          <div class="detail-body">
            <strong>📧 Email complet</strong>
            <div class="email-body" id="detailBody"></div>
          </div>
          <div class="detail-actions">
            <button class="btn-action primary" id="btnGenerateReply" onclick="InboxModule.generateReply()">
              ✨ Générer une réponse
            </button>
            <button class="btn-action success" onclick="InboxModule.markAsDone()">
              ✅ Marquer comme traité
            </button>
            <button class="btn-action" onclick="InboxModule.scheduleCall()">
              📅 Proposer un RDV
            </button>
            <button class="btn-action danger" onclick="InboxModule.blacklistProspect()">
              🚫 Ne plus contacter
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // =====================================================
  // CONNEXION EMAIL
  // =====================================================

  async checkEmailConnection() {
    try {
      const token = await this.getAuthToken();
      if (!token) return;

      const response = await fetch(`${INBOX_CONFIG.apiUrl}/api/inbox/connection`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();

      // Vérifier connected OU connection (compatibilité avec les deux formats)
      if (data.connected || data.connection) {
        this.isConnected = true;
        this.connectedEmail = data.email || data.connection?.email;
        this.showConnectedState();
      }
    } catch (e) {
      console.log('No email connection:', e);
    }
  },

  showConnectedState() {
    document.getElementById('connectButtons').style.display = 'none';
    document.getElementById('connectedAccount').style.display = 'flex';
    document.getElementById('connectedEmail').textContent = this.connectedEmail;

    // Afficher l'interface inbox
    document.getElementById('inboxHeader').style.display = 'flex';
    document.getElementById('inboxFilters').style.display = 'flex';
    document.getElementById('inboxList').style.display = 'block';
  },

  connectGmail() {
    const params = new URLSearchParams({
      client_id: INBOX_CONFIG.gmail.clientId,
      redirect_uri: INBOX_CONFIG.gmail.redirectUri,
      response_type: 'code',
      scope: INBOX_CONFIG.gmail.scope,
      access_type: 'offline',
      prompt: 'consent',
      state: 'gmail_oauth'
    });

    window.location.href = `${INBOX_CONFIG.gmail.authUrl}?${params}`;
  },

  connectOutlook() {
    // TODO: Implémenter OAuth Outlook
    showNotification('Outlook sera bientôt disponible !', 'info');
  },

  async disconnectEmail() {
    if (!confirm('Déconnecter ta boîte email ? Tu ne recevras plus les réponses automatiquement.')) {
      return;
    }

    try {
      const token = await this.getAuthToken();
      await fetch(`${INBOX_CONFIG.apiUrl}/api/inbox/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      this.isConnected = false;
      this.connectedEmail = null;

      // Réafficher les boutons de connexion
      document.getElementById('connectButtons').style.display = 'flex';
      document.getElementById('connectedAccount').style.display = 'none';
      document.getElementById('inboxHeader').style.display = 'none';
      document.getElementById('inboxFilters').style.display = 'none';
      document.getElementById('inboxList').style.display = 'none';

      showNotification('Email déconnecté', 'success');
    } catch (e) {
      showNotification('Erreur lors de la déconnexion', 'error');
    }
  },

  async checkOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state === 'gmail_oauth') {
      // Traiter le callback OAuth de manière synchrone
      await this.handleGmailCallback(code);
      // Nettoyer l'URL après traitement
      window.history.replaceState({}, document.title, window.location.pathname);
      return true; // Indique qu'un callback a été traité
    }
    return false;
  },

  async handleGmailCallback(code) {
    try {
      showNotification('Connexion Gmail en cours...', 'info');

      const token = await this.getAuthToken();
      const userId = await this.getCurrentUserId();

      // Passer le redirectUri pour que l'échange de tokens fonctionne
      const redirectUri = INBOX_CONFIG.gmail.redirectUri;

      const response = await fetch(`${INBOX_CONFIG.apiUrl}/api/oauth/gmail/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code, userId, redirectUri })
      });

      const result = await response.json();

      if (result.success) {
        this.isConnected = true;
        this.connectedEmail = result.email;
        this.showConnectedState();
        await this.loadResponses();
        showNotification(`✅ ${result.email} connecté avec succès !`, 'success');
      } else {
        throw new Error(result.error || 'Erreur inconnue');
      }
    } catch (e) {
      console.error('Gmail OAuth error:', e);
      showNotification('Erreur de connexion Gmail: ' + e.message, 'error');
    }
  },

  // =====================================================
  // CHARGEMENT DES RÉPONSES
  // =====================================================

  async loadResponses() {
    if (this.isLoading) return;
    this.isLoading = true;

    const listContainer = document.getElementById('inboxList');
    listContainer.innerHTML = '<div class="inbox-loading"></div>';

    try {
      const token = await this.getAuthToken();
      const response = await fetch(`${INBOX_CONFIG.apiUrl}/api/inbox/responses?filter=${this.currentFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      this.responses = data.responses || [];

      this.updateCounts();
      this.render();
    } catch (e) {
      console.error('Error loading responses:', e);
      listContainer.innerHTML = `
        <div class="inbox-empty">
          <span class="empty-icon">❌</span>
          <p>Erreur de chargement</p>
        </div>
      `;
    } finally {
      this.isLoading = false;
    }
  },

  async syncEmails() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const btn = document.getElementById('btnSync');
    btn.classList.add('syncing');
    btn.disabled = true;

    try {
      const token = await this.getAuthToken();
      const response = await fetch(`${INBOX_CONFIG.apiUrl}/api/inbox/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.synced > 0) {
        showNotification(`✅ ${result.synced} nouvelle(s) réponse(s) trouvée(s) !`, 'success');
        await this.loadResponses();
      } else {
        showNotification('📬 Aucune nouvelle réponse', 'info');
      }
    } catch (e) {
      console.error('Sync error:', e);
      showNotification('Erreur de synchronisation', 'error');
    } finally {
      btn.classList.remove('syncing');
      btn.disabled = false;
      this.isSyncing = false;
    }
  },

  // =====================================================
  // FILTRAGE ET AFFICHAGE
  // =====================================================

  updateCounts() {
    const counts = {
      all: this.responses.filter(r => r.status !== 'archived').length,
      high: this.responses.filter(r => r.priority === 'high' && r.status !== 'done').length,
      MEETING: this.responses.filter(r => r.category === 'MEETING').length,
      INTERESTED: this.responses.filter(r => r.category === 'INTERESTED').length,
      OBJECTION: this.responses.filter(r => r.category === 'OBJECTION').length,
      done: this.responses.filter(r => r.status === 'done').length
    };

    // Mettre à jour les compteurs dans les boutons
    const countElements = {
      countAll: counts.all,
      countHigh: counts.high,
      countMeeting: counts.MEETING,
      countInterested: counts.INTERESTED,
      countObjection: counts.OBJECTION,
      countDone: counts.done
    };

    Object.entries(countElements).forEach(([id, count]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count;
    });

    // Badge header
    const newCount = this.responses.filter(r => r.status === 'new').length;
    const badge = document.getElementById('unreadCount');
    if (badge) {
      badge.textContent = newCount > 0 ? `${newCount} nouvelle${newCount > 1 ? 's' : ''}` : 'À jour';
      badge.classList.toggle('empty', newCount === 0);
    }

    // Badge menu (si existe)
    const menuBadge = document.getElementById('menuInboxBadge');
    if (menuBadge) {
      menuBadge.textContent = newCount;
      menuBadge.style.display = newCount > 0 ? 'inline' : 'none';
    }
  },

  filterResponses(filter) {
    this.currentFilter = filter;

    // Mettre à jour l'état actif des boutons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    this.render();
  },

  getFilteredResponses() {
    let filtered = [...this.responses];

    switch (this.currentFilter) {
      case 'high':
        filtered = filtered.filter(r => r.priority === 'high' && r.status !== 'done');
        break;
      case 'done':
        filtered = filtered.filter(r => r.status === 'done');
        break;
      case 'MEETING':
      case 'INTERESTED':
      case 'OBJECTION':
        filtered = filtered.filter(r => r.category === this.currentFilter);
        break;
      default:
        filtered = filtered.filter(r => r.status !== 'archived');
    }

    return filtered;
  },

  render() {
    const container = document.getElementById('inboxList');
    const filtered = this.getFilteredResponses();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="inbox-empty">
          <span class="empty-icon">📭</span>
          <p>${this.currentFilter === 'all'
            ? 'Aucune réponse pour le moment. Clique sur "Synchroniser" pour vérifier !'
            : 'Aucune réponse dans cette catégorie'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(response => this.renderRow(response)).join('');
  },

  renderRow(response) {
    const categoryConfig = {
      MEETING: { icon: '📅', label: 'RDV' },
      INTERESTED: { icon: '🟢', label: 'Intéressé' },
      OBJECTION: { icon: '🟡', label: 'Objection' },
      NOT_INTERESTED: { icon: '⚫', label: 'Pas intéressé' },
      UNSUBSCRIBE: { icon: '🚫', label: 'Désabo' },
      OUT_OF_OFFICE: { icon: '🏖️', label: 'Absent' },
      OTHER: { icon: '❓', label: 'Autre' }
    };

    const cat = categoryConfig[response.category] || categoryConfig.OTHER;
    const fromParts = this.parseFromField(response.from_email, response.from_name);

    const statusClass = response.status === 'done' ? 'status-done' : '';
    const unreadClass = response.status === 'new' ? 'unread' : '';

    return `
      <div class="inbox-row ${statusClass} ${unreadClass}"
           data-id="${response.id}"
           onclick="InboxModule.openDetail('${response.id}')">
        <div class="row-priority">
          <span class="priority-dot ${response.priority}"></span>
        </div>
        <div class="row-category">
          <span class="category-badge ${response.category}">${cat.icon} ${cat.label}</span>
        </div>
        <div class="row-from">
          <span class="from-name">${this.escapeHtml(fromParts.name || fromParts.email)}</span>
          <span class="from-email">${this.escapeHtml(fromParts.email)}</span>
        </div>
        <div class="row-summary">
          <span class="subject">${this.escapeHtml(response.subject || '(sans sujet)')}</span>
          <span class="snippet">${this.escapeHtml(response.summary || response.body_snippet || '')}</span>
        </div>
        <div class="row-action">
          <span class="suggested-action">${this.escapeHtml(response.suggested_action || '')}</span>
        </div>
        <div class="row-date">
          ${this.formatRelativeDate(response.received_at)}
        </div>
      </div>
    `;
  },

  // =====================================================
  // PANEL DE DÉTAIL
  // =====================================================

  async openDetail(id) {
    const response = this.responses.find(r => r.id === id);
    if (!response) return;

    this.selectedResponse = response;

    // Remplir le panel
    document.getElementById('detailSubject').textContent = response.subject || '(sans sujet)';
    document.getElementById('detailFrom').textContent = response.from_email;
    document.getElementById('detailDate').textContent = this.formatDate(response.received_at);

    const categoryLabels = {
      MEETING: '📅 Demande de RDV',
      INTERESTED: '🟢 Intéressé',
      OBJECTION: '🟡 Objection',
      NOT_INTERESTED: '⚫ Pas intéressé',
      UNSUBSCRIBE: '🚫 Désabonnement',
      OUT_OF_OFFICE: '🏖️ Absent',
      OTHER: '❓ Autre'
    };

    const categoryBadge = document.getElementById('detailCategory');
    categoryBadge.textContent = categoryLabels[response.category] || response.category;
    categoryBadge.className = `category-badge ${response.category}`;

    document.getElementById('detailConfidence').textContent = `Confiance: ${Math.round((response.confidence || 0) * 100)}%`;
    document.getElementById('detailSummary').textContent = response.summary || 'Pas de résumé disponible';
    document.getElementById('detailAction').textContent = response.suggested_action || '-';
    document.getElementById('detailBody').textContent = response.body_text || response.body_snippet || '';

    // Afficher le panel
    document.getElementById('detailPanel').classList.add('open');
    document.getElementById('inboxOverlay').classList.add('visible');

    // Marquer comme "en cours" si nouveau
    if (response.status === 'new') {
      await this.updateStatus(id, 'in_progress');
    }
  },

  closeDetailPanel() {
    document.getElementById('detailPanel').classList.remove('open');
    document.getElementById('inboxOverlay').classList.remove('visible');
    this.selectedResponse = null;
  },

  // =====================================================
  // ACTIONS
  // =====================================================

  async updateStatus(id, status) {
    try {
      const token = await this.getAuthToken();
      await fetch(`${INBOX_CONFIG.apiUrl}/api/inbox/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ responseId: id, status })
      });

      // Mettre à jour localement
      const response = this.responses.find(r => r.id === id);
      if (response) {
        response.status = status;
        this.updateCounts();
        this.render();
      }
    } catch (e) {
      console.error('Update status error:', e);
    }
  },

  async markAsDone() {
    if (!this.selectedResponse) return;

    await this.updateStatus(this.selectedResponse.id, 'done');
    showNotification('✅ Marqué comme traité', 'success');
    this.closeDetailPanel();
  },

  async generateReply() {
    if (!this.selectedResponse) return;

    const btn = document.getElementById('btnGenerateReply');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Génération...';

    try {
      const token = await this.getAuthToken();
      const response = await fetch(`${INBOX_CONFIG.apiUrl}/api/inbox/generate-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          responseId: this.selectedResponse.id,
          tone: 'professional'
        })
      });

      const result = await response.json();

      if (result.reply) {
        this.showReplyModal(result.reply);
      } else {
        throw new Error('No reply generated');
      }
    } catch (e) {
      console.error('Generate reply error:', e);
      showNotification('Erreur de génération', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  showReplyModal(reply) {
    const modal = document.createElement('div');
    modal.className = 'reply-modal';
    modal.id = 'replyModal';
    modal.innerHTML = `
      <div class="reply-modal-content">
        <h3>✨ Réponse suggérée</h3>
        <textarea id="generatedReply" rows="10">${this.escapeHtml(reply)}</textarea>
        <div class="reply-actions">
          <button onclick="InboxModule.copyReply()">📋 Copier</button>
          <button onclick="InboxModule.closeReplyModal()">Fermer</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  copyReply() {
    const textarea = document.getElementById('generatedReply');
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
      showNotification('📋 Réponse copiée !', 'success');
    });
  },

  closeReplyModal() {
    const modal = document.getElementById('replyModal');
    if (modal) modal.remove();
  },

  scheduleCall() {
    if (!this.selectedResponse) return;

    // Ouvrir Calendly ou afficher un formulaire de créneaux
    showNotification('Fonctionnalité bientôt disponible !', 'info');
  },

  async blacklistProspect() {
    if (!this.selectedResponse) return;

    if (!confirm('Ajouter ce prospect à la liste noire ?\nIl ne recevra plus aucune campagne de ta part.')) {
      return;
    }

    try {
      const token = await this.getAuthToken();
      await fetch(`${INBOX_CONFIG.apiUrl}/api/inbox/blacklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: this.selectedResponse.from_email,
          reason: 'Blacklisté via Inbox Intelligente',
          responseId: this.selectedResponse.id
        })
      });

      showNotification('🚫 Prospect ajouté à la liste noire', 'success');
      this.closeDetailPanel();
      await this.loadResponses();
    } catch (e) {
      console.error('Blacklist error:', e);
      showNotification('Erreur lors du blacklistage', 'error');
    }
  },

  openSettings() {
    showNotification('Paramètres Inbox bientôt disponibles !', 'info');
  },

  // =====================================================
  // HELPERS
  // =====================================================

  async getAuthToken() {
    // Utilise la méthode d'auth existante de l'app
    if (typeof getAccessToken === 'function') {
      return await getAccessToken();
    }
    // Fallback: récupérer depuis Supabase si disponible
    if (typeof supabase !== 'undefined') {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token;
    }
    return null;
  },

  async getCurrentUserId() {
    if (typeof currentUser !== 'undefined' && currentUser?.id) {
      return currentUser.id;
    }
    if (typeof supabase !== 'undefined') {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id;
    }
    return null;
  },

  parseFromField(email, name) {
    if (name) {
      return { name: name.replace(/"/g, ''), email };
    }
    const match = email?.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].replace(/"/g, ''), email: match[2] };
    }
    return { name: '', email: email || '' };
  },

  formatRelativeDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // =====================================================
  // EVENT LISTENERS
  // =====================================================

  setupEventListeners() {
    // Raccourci clavier Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDetailPanel();
        this.closeReplyModal();
      }
    });

    // Auto-sync toutes les 5 minutes si connecté
    setInterval(() => {
      if (this.isConnected && !this.isSyncing && document.visibilityState === 'visible') {
        this.syncEmails();
      }
    }, 5 * 60 * 1000);
  }
};

// Exposer les fonctions globalement pour les onclick HTML
window.InboxModule = InboxModule;

// Initialiser quand le DOM est prêt et que l'élément existe
document.addEventListener('DOMContentLoaded', () => {
  // On attend que l'utilisateur navigue vers la section inbox
  // L'init sera appelée quand on affiche la section
});

// Fonction d'init à appeler quand on affiche la section inbox
function initInboxModule() {
  if (document.getElementById('inboxContainer')) {
    InboxModule.init();
  }
}
