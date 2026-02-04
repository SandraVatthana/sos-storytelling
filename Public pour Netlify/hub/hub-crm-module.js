/**
 * HUB CRM Module
 * Gestion des prospects, canaux et activités
 */

const HubCRM = {
    // État
    prospects: [],
    currentProspect: null,
    filters: {
        search: '',
        status: 'all',
        channel: 'all',
        assignedTo: 'all'
    },
    pagination: {
        page: 1,
        perPage: 25,
        total: 0
    },
    userSettings: null,
    currentTeam: null,
    isTeamMode: false,

    // ============================================
    // INITIALISATION
    // ============================================

    async init() {
        console.log('HubCRM: Initializing...');

        // Vérifier l'authentification
        const { data: { user } } = await hubSupabase.auth.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        this.currentUser = user;

        // Charger les paramètres utilisateur
        await this.loadUserSettings();

        // Setup UI
        this.setupEventListeners();
        this.renderFilters();

        // Charger les prospects
        await this.loadProspects();

        console.log('HubCRM: Initialized');
    },

    async loadUserSettings() {
        const { data, error } = await hubSupabase
            .from('hub_user_settings')
            .select('*')
            .eq('user_id', this.currentUser.id)
            .single();

        if (data) {
            this.userSettings = data;
            this.isTeamMode = data.work_mode === 'team';
            if (data.default_team_id) {
                await this.loadTeam(data.default_team_id);
            }
        } else {
            // Créer les paramètres par défaut
            const { data: newSettings } = await hubSupabase
                .from('hub_user_settings')
                .insert({
                    user_id: this.currentUser.id,
                    work_mode: 'solo',
                    onboarding_completed: false
                })
                .select()
                .single();

            this.userSettings = newSettings;

            // Afficher onboarding si pas complété
            if (!newSettings?.onboarding_completed) {
                this.showOnboarding();
            }
        }

        this.updateModeUI();
    },

    async loadTeam(teamId) {
        const { data } = await hubSupabase
            .from('hub_teams')
            .select('*')
            .eq('id', teamId)
            .single();

        if (data) {
            this.currentTeam = data;
        }
    },

    updateModeUI() {
        const modeSwitch = document.getElementById('modeSwitch');
        if (modeSwitch) {
            modeSwitch.innerHTML = this.isTeamMode
                ? `<span>👥</span> ${this.currentTeam?.name || 'Équipe'} <span>▼</span>`
                : `<span>👤</span> Mode Solo <span>▼</span>`;
        }

        // Afficher/masquer colonne assigné
        const assignedColumn = document.querySelectorAll('.hub-assigned-column');
        assignedColumn.forEach(el => {
            el.style.display = this.isTeamMode ? 'block' : 'none';
        });
    },

    // ============================================
    // CHARGEMENT DES PROSPECTS
    // ============================================

    async loadProspects() {
        this.showLoading(true);

        try {
            let query = hubSupabase
                .from('hub_prospects')
                .select('*', { count: 'exact' });

            // Filtrer par user ou team
            if (this.isTeamMode && this.currentTeam) {
                query = query.eq('team_id', this.currentTeam.id);
            } else {
                query = query.eq('user_id', this.currentUser.id);
            }

            // Appliquer les filtres
            if (this.filters.status !== 'all') {
                query = query.eq('status', this.filters.status);
            }

            if (this.filters.channel !== 'all') {
                if (this.filters.channel === 'email') {
                    query = query.eq('email_contacted', true);
                } else if (this.filters.channel === 'dm') {
                    query = query.eq('dm_contacted', true);
                } else if (this.filters.channel === 'call') {
                    query = query.eq('call_done', true);
                }
            }

            if (this.filters.assignedTo !== 'all' && this.isTeamMode) {
                query = query.eq('assigned_to', this.filters.assignedTo);
            }

            if (this.filters.search) {
                query = query.or(`first_name.ilike.%${this.filters.search}%,last_name.ilike.%${this.filters.search}%,email.ilike.%${this.filters.search}%,company.ilike.%${this.filters.search}%`);
            }

            // Pagination et tri
            const from = (this.pagination.page - 1) * this.pagination.perPage;
            const to = from + this.pagination.perPage - 1;

            query = query
                .order('created_at', { ascending: false })
                .range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;

            this.prospects = data || [];
            this.pagination.total = count || 0;

            this.renderProspects();
            this.renderPagination();
            this.updateStats();

        } catch (error) {
            console.error('Error loading prospects:', error);
            this.showToast('Erreur lors du chargement des prospects', 'error');
        }

        this.showLoading(false);
    },

    // ============================================
    // RENDU UI
    // ============================================

    renderProspects() {
        const container = document.getElementById('prospectsList');
        if (!container) return;

        if (this.prospects.length === 0) {
            container.innerHTML = `
                <div class="hub-empty-state">
                    <div class="hub-empty-icon">🎯</div>
                    <h3 class="hub-empty-title">Aucun prospect</h3>
                    <p class="hub-empty-text">Commence par ajouter ton premier prospect ou importer un fichier CSV.</p>
                    <button class="hub-btn hub-btn-primary" onclick="HubCRM.showAddProspectModal()">
                        <span>+</span> Ajouter un prospect
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.prospects.map(prospect => this.renderProspectCard(prospect)).join('');
    },

    renderProspectCard(prospect) {
        const status = HUB_CONFIG.PROSPECT_STATUSES[prospect.status] || HUB_CONFIG.PROSPECT_STATUSES.new;
        const initials = HubUtils.getInitials(prospect.first_name, prospect.last_name);

        // Statut canaux
        const emailStatus = this.getChannelStatusHTML('email', prospect);
        const dmStatus = this.getChannelStatusHTML('dm', prospect);
        const callStatus = this.getChannelStatusHTML('call', prospect);

        return `
            <div class="hub-prospect-card" data-id="${prospect.id}" onclick="HubCRM.openProspectDetail('${prospect.id}')">
                <div class="hub-prospect-header">
                    <div class="hub-prospect-info">
                        <div class="hub-prospect-avatar">${initials}</div>
                        <div>
                            <div class="hub-prospect-name">${prospect.first_name} ${prospect.last_name || ''}</div>
                            <div class="hub-prospect-company">
                                ${prospect.job_title ? `${prospect.job_title}` : ''}
                                ${prospect.company ? `@ ${prospect.company}` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="hub-prospect-actions">
                        <button class="hub-btn hub-btn-ghost hub-btn-icon" onclick="event.stopPropagation(); HubCRM.editProspect('${prospect.id}')" title="Modifier">
                            ✏️
                        </button>
                        <button class="hub-btn hub-btn-ghost hub-btn-icon" onclick="event.stopPropagation(); HubCRM.deleteProspect('${prospect.id}')" title="Supprimer">
                            🗑️
                        </button>
                    </div>
                </div>

                <div class="hub-prospect-channels">
                    ${emailStatus}
                    ${dmStatus}
                    ${callStatus}
                </div>

                ${prospect.notes ? `
                    <div class="hub-prospect-notes">
                        <span class="hub-prospect-notes-icon">📝</span>
                        <span>${HubUtils.truncate(prospect.notes, 100)}</span>
                    </div>
                ` : ''}

                <div class="hub-prospect-footer">
                    <div class="hub-prospect-meta">
                        <span class="hub-badge hub-badge-${prospect.status.replace('_', '-')}">${status.icon} ${status.label}</span>
                        <span>${HubUtils.formatRelativeDate(prospect.created_at)}</span>
                    </div>
                    ${this.isTeamMode && prospect.assigned_to ? `
                        <span class="hub-prospect-assigned">Assigné</span>
                    ` : ''}
                </div>
            </div>
        `;
    },

    getChannelStatusHTML(channel, prospect) {
        const config = HUB_CONFIG.CHANNELS[channel];
        let statusClass = '';
        let dateStr = '';

        if (channel === 'email') {
            if (prospect.email_replied) {
                statusClass = 'replied';
                dateStr = HubUtils.formatDate(prospect.email_replied_at);
            } else if (prospect.email_contacted) {
                statusClass = 'active';
                dateStr = HubUtils.formatDate(prospect.email_contacted_at);
            }
        } else if (channel === 'dm') {
            if (prospect.dm_replied) {
                statusClass = 'replied';
                dateStr = HubUtils.formatDate(prospect.dm_replied_at);
            } else if (prospect.dm_contacted) {
                statusClass = 'active';
                dateStr = HubUtils.formatDate(prospect.dm_contacted_at);
            }
        } else if (channel === 'call') {
            if (prospect.call_done) {
                statusClass = 'active';
                dateStr = HubUtils.formatDate(prospect.call_done_at);
                if (prospect.call_result) {
                    const result = HUB_CONFIG.CALL_RESULTS[prospect.call_result];
                    dateStr = result ? result.label : dateStr;
                }
            }
        }

        return `
            <div class="hub-channel-status ${statusClass}">
                <span class="hub-channel-icon">${config.icon}</span>
                <span>${statusClass ? (dateStr || 'Oui') : 'Non contacté'}</span>
            </div>
        `;
    },

    renderFilters() {
        const filtersContainer = document.getElementById('filtersContainer');
        if (!filtersContainer) return;

        // Générer options de statut
        const statusOptions = Object.entries(HUB_CONFIG.PROSPECT_STATUSES)
            .map(([key, val]) => `<option value="${key}">${val.icon} ${val.label}</option>`)
            .join('');

        filtersContainer.innerHTML = `
            <div class="hub-filter-group">
                <select class="hub-input hub-filter-select" id="filterStatus" onchange="HubCRM.applyFilters()">
                    <option value="all">Tous les statuts</option>
                    ${statusOptions}
                </select>
            </div>
            <div class="hub-filter-group">
                <select class="hub-input hub-filter-select" id="filterChannel" onchange="HubCRM.applyFilters()">
                    <option value="all">Tous les canaux</option>
                    <option value="email">📧 Email contacté</option>
                    <option value="dm">💬 DM contacté</option>
                    <option value="call">📞 Appelé</option>
                </select>
            </div>
            ${this.isTeamMode ? `
                <div class="hub-filter-group hub-assigned-column">
                    <select class="hub-input hub-filter-select" id="filterAssigned" onchange="HubCRM.applyFilters()">
                        <option value="all">Tous les membres</option>
                    </select>
                </div>
            ` : ''}
        `;
    },

    renderPagination() {
        const container = document.getElementById('paginationContainer');
        if (!container) return;

        const totalPages = Math.ceil(this.pagination.total / this.pagination.perPage);

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; justify-content: center; margin-top: 24px;">
                <button class="hub-btn hub-btn-secondary hub-btn-sm"
                    ${this.pagination.page === 1 ? 'disabled' : ''}
                    onclick="HubCRM.goToPage(${this.pagination.page - 1})">
                    ← Précédent
                </button>
                <span style="color: var(--hub-text-muted);">
                    Page ${this.pagination.page} sur ${totalPages}
                </span>
                <button class="hub-btn hub-btn-secondary hub-btn-sm"
                    ${this.pagination.page === totalPages ? 'disabled' : ''}
                    onclick="HubCRM.goToPage(${this.pagination.page + 1})">
                    Suivant →
                </button>
            </div>
        `;
    },

    async updateStats() {
        const statsContainer = document.getElementById('statsContainer');
        if (!statsContainer) return;

        // Calculer les stats depuis les données actuelles
        const total = this.pagination.total;
        const byStatus = {};

        // Charger les stats depuis Supabase
        let query = hubSupabase
            .from('hub_prospects')
            .select('status');

        if (this.isTeamMode && this.currentTeam) {
            query = query.eq('team_id', this.currentTeam.id);
        } else {
            query = query.eq('user_id', this.currentUser.id);
        }

        const { data } = await query;

        if (data) {
            data.forEach(p => {
                byStatus[p.status] = (byStatus[p.status] || 0) + 1;
            });
        }

        statsContainer.innerHTML = `
            <div class="hub-stat-card">
                <div class="hub-stat-label">Total prospects</div>
                <div class="hub-stat-value">${data?.length || 0}</div>
            </div>
            <div class="hub-stat-card">
                <div class="hub-stat-label">🔵 Nouveaux</div>
                <div class="hub-stat-value">${byStatus.new || 0}</div>
            </div>
            <div class="hub-stat-card">
                <div class="hub-stat-label">🟠 En discussion</div>
                <div class="hub-stat-value">${byStatus.in_discussion || 0}</div>
            </div>
            <div class="hub-stat-card">
                <div class="hub-stat-label">🟢 Convertis</div>
                <div class="hub-stat-value">${byStatus.converted || 0}</div>
            </div>
        `;
    },

    // ============================================
    // CRUD PROSPECTS
    // ============================================

    showAddProspectModal() {
        this.currentProspect = null;
        this.showProspectModal();
    },

    async editProspect(id) {
        const prospect = this.prospects.find(p => p.id === id);
        if (!prospect) return;

        this.currentProspect = prospect;
        this.showProspectModal();
    },

    showProspectModal() {
        const isEdit = !!this.currentProspect;
        const p = this.currentProspect || {};

        const modal = document.getElementById('prospectModal');
        const title = document.getElementById('prospectModalTitle');
        const form = document.getElementById('prospectForm');

        title.textContent = isEdit ? 'Modifier le prospect' : 'Ajouter un prospect';

        form.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="hub-form-group">
                    <label class="hub-form-label">Prénom *</label>
                    <input type="text" class="hub-input" id="prospectFirstName" value="${p.first_name || ''}" required>
                </div>
                <div class="hub-form-group">
                    <label class="hub-form-label">Nom</label>
                    <input type="text" class="hub-input" id="prospectLastName" value="${p.last_name || ''}">
                </div>
            </div>

            <div class="hub-form-group">
                <label class="hub-form-label">Email</label>
                <input type="email" class="hub-input" id="prospectEmail" value="${p.email || ''}">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="hub-form-group">
                    <label class="hub-form-label">Entreprise</label>
                    <input type="text" class="hub-input" id="prospectCompany" value="${p.company || ''}">
                </div>
                <div class="hub-form-group">
                    <label class="hub-form-label">Poste</label>
                    <input type="text" class="hub-input" id="prospectJobTitle" value="${p.job_title || ''}">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="hub-form-group">
                    <label class="hub-form-label">Téléphone</label>
                    <input type="tel" class="hub-input" id="prospectPhone" value="${p.phone || ''}">
                </div>
                <div class="hub-form-group">
                    <label class="hub-form-label">LinkedIn</label>
                    <input type="url" class="hub-input" id="prospectLinkedin" value="${p.linkedin_url || ''}" placeholder="https://linkedin.com/in/...">
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div class="hub-form-group">
                    <label class="hub-form-label">Secteur</label>
                    <input type="text" class="hub-input" id="prospectSector" value="${p.sector || ''}">
                </div>
                <div class="hub-form-group">
                    <label class="hub-form-label">Ville</label>
                    <input type="text" class="hub-input" id="prospectCity" value="${p.city || ''}">
                </div>
            </div>

            <div class="hub-form-group">
                <label class="hub-form-label">Notes</label>
                <textarea class="hub-input hub-textarea" id="prospectNotes" rows="3" placeholder="Notes libres sur ce prospect...">${p.notes || ''}</textarea>
            </div>

            <div class="hub-form-group">
                <label class="hub-form-label">Statut</label>
                <select class="hub-input" id="prospectStatus">
                    ${Object.entries(HUB_CONFIG.PROSPECT_STATUSES).map(([key, val]) =>
                        `<option value="${key}" ${p.status === key ? 'selected' : ''}>${val.icon} ${val.label}</option>`
                    ).join('')}
                </select>
            </div>
        `;

        this.openModal('prospectModal');
    },

    async saveProspect() {
        const data = {
            first_name: document.getElementById('prospectFirstName').value.trim(),
            last_name: document.getElementById('prospectLastName').value.trim(),
            email: document.getElementById('prospectEmail').value.trim(),
            company: document.getElementById('prospectCompany').value.trim(),
            job_title: document.getElementById('prospectJobTitle').value.trim(),
            phone: document.getElementById('prospectPhone').value.trim(),
            linkedin_url: HubUtils.cleanLinkedInUrl(document.getElementById('prospectLinkedin').value.trim()),
            sector: document.getElementById('prospectSector').value.trim(),
            city: document.getElementById('prospectCity').value.trim(),
            notes: document.getElementById('prospectNotes').value.trim(),
            status: document.getElementById('prospectStatus').value
        };

        if (!data.first_name) {
            this.showToast('Le prénom est obligatoire', 'error');
            return;
        }

        // Vérifier doublons par email
        if (data.email && !this.currentProspect) {
            const { data: existing } = await hubSupabase
                .from('hub_prospects')
                .select('id')
                .eq('email', data.email)
                .eq('user_id', this.currentUser.id)
                .single();

            if (existing) {
                this.showToast('Un prospect avec cet email existe déjà', 'error');
                return;
            }
        }

        try {
            if (this.currentProspect) {
                // Update
                const { error } = await hubSupabase
                    .from('hub_prospects')
                    .update(data)
                    .eq('id', this.currentProspect.id);

                if (error) throw error;

                // Log activity
                await this.logActivity(this.currentProspect.id, 'prospect_updated', null, 'Prospect modifié');

                this.showToast('Prospect mis à jour', 'success');
            } else {
                // Insert
                data.user_id = this.isTeamMode ? null : this.currentUser.id;
                data.team_id = this.isTeamMode ? this.currentTeam?.id : null;
                data.source = 'manual';

                const { data: newProspect, error } = await hubSupabase
                    .from('hub_prospects')
                    .insert(data)
                    .select()
                    .single();

                if (error) throw error;

                // Log activity
                await this.logActivity(newProspect.id, 'prospect_created', null, 'Prospect créé');

                this.showToast('Prospect ajouté', 'success');
            }

            this.closeModal('prospectModal');
            await this.loadProspects();

        } catch (error) {
            console.error('Error saving prospect:', error);
            this.showToast('Erreur lors de la sauvegarde', 'error');
        }
    },

    async deleteProspect(id) {
        if (!confirm('Supprimer ce prospect ?')) return;

        try {
            const { error } = await hubSupabase
                .from('hub_prospects')
                .delete()
                .eq('id', id);

            if (error) throw error;

            this.showToast('Prospect supprimé', 'success');
            await this.loadProspects();

        } catch (error) {
            console.error('Error deleting prospect:', error);
            this.showToast('Erreur lors de la suppression', 'error');
        }
    },

    // ============================================
    // DÉTAIL PROSPECT
    // ============================================

    async openProspectDetail(id) {
        const prospect = this.prospects.find(p => p.id === id);
        if (!prospect) return;

        this.currentProspect = prospect;

        // Charger l'historique
        const { data: activities } = await hubSupabase
            .from('hub_activities')
            .select('*')
            .eq('prospect_id', id)
            .order('created_at', { ascending: false })
            .limit(20);

        this.renderProspectDetail(prospect, activities || []);
        this.openModal('detailModal');
    },

    renderProspectDetail(prospect, activities) {
        const container = document.getElementById('detailContent');
        const status = HUB_CONFIG.PROSPECT_STATUSES[prospect.status];
        const initials = HubUtils.getInitials(prospect.first_name, prospect.last_name);

        container.innerHTML = `
            <div class="hub-detail-header">
                <div class="hub-detail-avatar">${initials}</div>
                <div>
                    <h2 class="hub-detail-name">${prospect.first_name} ${prospect.last_name || ''}</h2>
                    <p class="hub-detail-company">
                        ${prospect.job_title || ''} ${prospect.company ? `@ ${prospect.company}` : ''}
                    </p>
                    <div class="hub-detail-contacts">
                        ${prospect.email ? `<span class="hub-detail-contact">📧 <a href="mailto:${prospect.email}">${prospect.email}</a></span>` : ''}
                        ${prospect.phone ? `<span class="hub-detail-contact">📱 <a href="tel:${prospect.phone}">${prospect.phone}</a></span>` : ''}
                        ${prospect.linkedin_url ? `<span class="hub-detail-contact">🔗 <a href="${prospect.linkedin_url}" target="_blank">LinkedIn</a></span>` : ''}
                    </div>
                </div>
            </div>

            <!-- Notes -->
            <div class="hub-detail-section">
                <h3 class="hub-detail-section-title">📝 Notes</h3>
                <div class="hub-notes-box ${!prospect.notes ? 'empty' : ''}" id="notesDisplay" onclick="HubCRM.editNotes()">
                    ${prospect.notes || 'Cliquer pour ajouter des notes...'}
                </div>
                <div id="notesEdit" style="display: none;">
                    <textarea class="hub-input hub-textarea" id="notesTextarea" rows="4">${prospect.notes || ''}</textarea>
                    <div style="margin-top: 8px; display: flex; gap: 8px;">
                        <button class="hub-btn hub-btn-primary hub-btn-sm" onclick="HubCRM.saveNotes()">Enregistrer</button>
                        <button class="hub-btn hub-btn-secondary hub-btn-sm" onclick="HubCRM.cancelEditNotes()">Annuler</button>
                    </div>
                </div>
            </div>

            <!-- Canaux -->
            <div class="hub-detail-section">
                <h3 class="hub-detail-section-title">📡 Canaux de contact</h3>
                <div class="hub-channels-grid">
                    <!-- Email -->
                    <div class="hub-channel-box email">
                        <div class="hub-channel-box-header">📧 Email</div>
                        <label class="hub-channel-checkbox">
                            <input type="checkbox" id="emailContacted" ${prospect.email_contacted ? 'checked' : ''} onchange="HubCRM.updateChannel('email', 'contacted', this.checked)">
                            Contacté
                        </label>
                        ${prospect.email_contacted ? `<div class="hub-channel-date-label">${HubUtils.formatDate(prospect.email_contacted_at)}</div>` : ''}
                        <label class="hub-channel-checkbox">
                            <input type="checkbox" id="emailReplied" ${prospect.email_replied ? 'checked' : ''} onchange="HubCRM.updateChannel('email', 'replied', this.checked)">
                            Répondu
                        </label>
                        ${prospect.email_replied ? `<div class="hub-channel-date-label">${HubUtils.formatDate(prospect.email_replied_at)}</div>` : ''}
                        <div class="hub-channel-notes">
                            <textarea class="hub-input hub-textarea" placeholder="Notes email..." rows="2"
                                onchange="HubCRM.updateChannelNotes('email', this.value)">${prospect.email_notes || ''}</textarea>
                        </div>
                    </div>

                    <!-- DM -->
                    <div class="hub-channel-box dm">
                        <div class="hub-channel-box-header">💬 DM</div>
                        <label class="hub-channel-checkbox">
                            <input type="checkbox" id="dmContacted" ${prospect.dm_contacted ? 'checked' : ''} onchange="HubCRM.updateChannel('dm', 'contacted', this.checked)">
                            Contacté
                        </label>
                        ${prospect.dm_contacted ? `<div class="hub-channel-date-label">${HubUtils.formatDate(prospect.dm_contacted_at)}</div>` : ''}
                        <label class="hub-channel-checkbox">
                            <input type="checkbox" id="dmReplied" ${prospect.dm_replied ? 'checked' : ''} onchange="HubCRM.updateChannel('dm', 'replied', this.checked)">
                            Répondu
                        </label>
                        ${prospect.dm_replied ? `<div class="hub-channel-date-label">${HubUtils.formatDate(prospect.dm_replied_at)}</div>` : ''}
                        <div class="hub-channel-notes">
                            <textarea class="hub-input hub-textarea" placeholder="Notes DM..." rows="2"
                                onchange="HubCRM.updateChannelNotes('dm', this.value)">${prospect.dm_notes || ''}</textarea>
                        </div>
                    </div>

                    <!-- Appel -->
                    <div class="hub-channel-box call">
                        <div class="hub-channel-box-header">📞 Appel</div>
                        <label class="hub-channel-checkbox">
                            <input type="checkbox" id="callDone" ${prospect.call_done ? 'checked' : ''} onchange="HubCRM.updateChannel('call', 'done', this.checked)">
                            Appel effectué
                        </label>
                        ${prospect.call_done ? `<div class="hub-channel-date-label">${HubUtils.formatDate(prospect.call_done_at)}</div>` : ''}
                        <div class="hub-form-group" style="margin-top: 8px;">
                            <select class="hub-input" id="callResult" onchange="HubCRM.updateCallResult(this.value)" ${!prospect.call_done ? 'disabled' : ''}>
                                <option value="">-- Résultat --</option>
                                ${Object.entries(HUB_CONFIG.CALL_RESULTS).map(([key, val]) =>
                                    `<option value="${key}" ${prospect.call_result === key ? 'selected' : ''}>${val.icon} ${val.label}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="hub-channel-notes">
                            <textarea class="hub-input hub-textarea" placeholder="Notes appel..." rows="2"
                                onchange="HubCRM.updateChannelNotes('call', this.value)">${prospect.call_notes || ''}</textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Historique -->
            <div class="hub-detail-section">
                <h3 class="hub-detail-section-title">⏱️ Historique</h3>
                <div class="hub-timeline">
                    ${activities.length > 0 ? activities.map(a => `
                        <div class="hub-timeline-item">
                            <div class="hub-timeline-content">
                                ${a.description || a.activity_type}
                            </div>
                            <div class="hub-timeline-date">${HubUtils.formatDateTime(a.created_at)}</div>
                        </div>
                    `).join('') : '<p style="color: var(--hub-text-muted);">Aucune activité enregistrée</p>'}
                </div>
            </div>

            <!-- Statut et assignation -->
            <div class="hub-detail-section" style="display: flex; gap: 16px; align-items: center;">
                <div class="hub-form-group" style="margin: 0; flex: 1;">
                    <label class="hub-form-label">Statut</label>
                    <select class="hub-input" id="detailStatus" onchange="HubCRM.updateProspectStatus(this.value)">
                        ${Object.entries(HUB_CONFIG.PROSPECT_STATUSES).map(([key, val]) =>
                            `<option value="${key}" ${prospect.status === key ? 'selected' : ''}>${val.icon} ${val.label}</option>`
                        ).join('')}
                    </select>
                </div>
                ${this.isTeamMode ? `
                    <div class="hub-form-group hub-assigned-column" style="margin: 0; flex: 1;">
                        <label class="hub-form-label">Assigné à</label>
                        <select class="hub-input" id="detailAssigned" onchange="HubCRM.updateProspectAssignment(this.value)">
                            <option value="">Non assigné</option>
                        </select>
                    </div>
                ` : ''}
            </div>
        `;
    },

    editNotes() {
        document.getElementById('notesDisplay').style.display = 'none';
        document.getElementById('notesEdit').style.display = 'block';
        document.getElementById('notesTextarea').focus();
    },

    cancelEditNotes() {
        document.getElementById('notesDisplay').style.display = 'block';
        document.getElementById('notesEdit').style.display = 'none';
    },

    async saveNotes() {
        if (!this.currentProspect) return;

        const notes = document.getElementById('notesTextarea').value.trim();

        try {
            const { error } = await hubSupabase
                .from('hub_prospects')
                .update({ notes })
                .eq('id', this.currentProspect.id);

            if (error) throw error;

            this.currentProspect.notes = notes;

            // Update display
            const display = document.getElementById('notesDisplay');
            display.textContent = notes || 'Cliquer pour ajouter des notes...';
            display.classList.toggle('empty', !notes);

            this.cancelEditNotes();

            // Log activity
            await this.logActivity(this.currentProspect.id, 'note_added', null, 'Notes modifiées');

            // Refresh list
            await this.loadProspects();

        } catch (error) {
            console.error('Error saving notes:', error);
            this.showToast('Erreur lors de la sauvegarde', 'error');
        }
    },

    async updateChannel(channel, action, value) {
        if (!this.currentProspect) return;

        const updates = {};
        const now = new Date().toISOString();

        if (channel === 'email') {
            if (action === 'contacted') {
                updates.email_contacted = value;
                updates.email_contacted_at = value ? now : null;
            } else if (action === 'replied') {
                updates.email_replied = value;
                updates.email_replied_at = value ? now : null;
            }
        } else if (channel === 'dm') {
            if (action === 'contacted') {
                updates.dm_contacted = value;
                updates.dm_contacted_at = value ? now : null;
            } else if (action === 'replied') {
                updates.dm_replied = value;
                updates.dm_replied_at = value ? now : null;
            }
        } else if (channel === 'call') {
            if (action === 'done') {
                updates.call_done = value;
                updates.call_done_at = value ? now : null;
                if (!value) {
                    updates.call_result = null;
                    document.getElementById('callResult').value = '';
                    document.getElementById('callResult').disabled = true;
                } else {
                    document.getElementById('callResult').disabled = false;
                }
            }
        }

        try {
            const { error } = await hubSupabase
                .from('hub_prospects')
                .update(updates)
                .eq('id', this.currentProspect.id);

            if (error) throw error;

            // Update local
            Object.assign(this.currentProspect, updates);

            // Log activity
            const activityType = channel === 'call' ? 'call_made' : `${channel}_${action === 'replied' ? 'reply' : 'sent'}`;
            await this.logActivity(this.currentProspect.id, activityType, channel,
                `${HUB_CONFIG.CHANNELS[channel].label} - ${action === 'contacted' || action === 'done' ? 'Contacté' : 'Répondu'}`);

            // Refresh list
            await this.loadProspects();

        } catch (error) {
            console.error('Error updating channel:', error);
            this.showToast('Erreur lors de la mise à jour', 'error');
        }
    },

    async updateChannelNotes(channel, value) {
        if (!this.currentProspect) return;

        const field = channel === 'call' ? 'call_notes' : `${channel}_notes`;
        const updates = { [field]: value };

        try {
            const { error } = await hubSupabase
                .from('hub_prospects')
                .update(updates)
                .eq('id', this.currentProspect.id);

            if (error) throw error;

            this.currentProspect[field] = value;

        } catch (error) {
            console.error('Error updating channel notes:', error);
        }
    },

    async updateCallResult(value) {
        if (!this.currentProspect) return;

        try {
            const { error } = await hubSupabase
                .from('hub_prospects')
                .update({ call_result: value || null })
                .eq('id', this.currentProspect.id);

            if (error) throw error;

            this.currentProspect.call_result = value;

            // Log activity
            if (value) {
                const result = HUB_CONFIG.CALL_RESULTS[value];
                await this.logActivity(this.currentProspect.id, 'call_result', 'call', `Résultat appel: ${result?.label || value}`);
            }

            await this.loadProspects();

        } catch (error) {
            console.error('Error updating call result:', error);
        }
    },

    async updateProspectStatus(status) {
        if (!this.currentProspect) return;

        const oldStatus = this.currentProspect.status;

        try {
            const { error } = await hubSupabase
                .from('hub_prospects')
                .update({ status })
                .eq('id', this.currentProspect.id);

            if (error) throw error;

            this.currentProspect.status = status;

            // Log activity
            const oldLabel = HUB_CONFIG.PROSPECT_STATUSES[oldStatus]?.label || oldStatus;
            const newLabel = HUB_CONFIG.PROSPECT_STATUSES[status]?.label || status;
            await this.logActivity(this.currentProspect.id, 'status_changed', null,
                `Statut: ${oldLabel} → ${newLabel}`, { old_value: oldStatus, new_value: status });

            this.showToast('Statut mis à jour', 'success');
            await this.loadProspects();

        } catch (error) {
            console.error('Error updating status:', error);
            this.showToast('Erreur lors de la mise à jour', 'error');
        }
    },

    // ============================================
    // IMPORT CSV
    // ============================================

    showImportModal() {
        this.openModal('importModal');
        this.resetImport();
    },

    resetImport() {
        const dropzone = document.getElementById('importDropzone');
        const preview = document.getElementById('importPreview');

        dropzone.style.display = 'block';
        preview.innerHTML = '';

        this.importData = null;
    },

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processCSVFile(file);
        }
    },

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();

        const dropzone = document.getElementById('importDropzone');
        dropzone.classList.remove('dragover');

        const file = event.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            this.processCSVFile(file);
        } else {
            this.showToast('Fichier CSV requis', 'error');
        }
    },

    handleDragOver(event) {
        event.preventDefault();
        document.getElementById('importDropzone').classList.add('dragover');
    },

    handleDragLeave(event) {
        document.getElementById('importDropzone').classList.remove('dragover');
    },

    processCSVFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const csvText = e.target.result;
            const { headers, rows } = HubUtils.parseCSV(csvText);

            if (rows.length === 0) {
                this.showToast('Le fichier CSV est vide', 'error');
                return;
            }

            // Mapper les colonnes
            const mapping = HubUtils.mapCSVColumns(headers);

            this.importData = {
                headers,
                rows,
                mapping,
                fileName: file.name
            };

            this.showImportPreview();
        };
        reader.readAsText(file);
    },

    showImportPreview() {
        document.getElementById('importDropzone').style.display = 'none';

        const preview = document.getElementById('importPreview');
        const { headers, rows, mapping, fileName } = this.importData;

        // Stats
        const validRows = rows.filter(r => r[mapping.first_name?.toLowerCase()] || r[mapping.email?.toLowerCase()]);

        preview.innerHTML = `
            <h4 style="margin-bottom: 16px;">📄 ${fileName}</h4>

            <div class="hub-import-stats">
                <div class="hub-import-stat">
                    <div class="hub-import-stat-value">${rows.length}</div>
                    <div class="hub-import-stat-label">Lignes trouvées</div>
                </div>
                <div class="hub-import-stat">
                    <div class="hub-import-stat-value">${validRows.length}</div>
                    <div class="hub-import-stat-label">Prospects valides</div>
                </div>
                <div class="hub-import-stat">
                    <div class="hub-import-stat-value">${Object.keys(mapping).length}</div>
                    <div class="hub-import-stat-label">Colonnes mappées</div>
                </div>
            </div>

            <h5 style="margin: 16px 0 8px;">Mapping des colonnes :</h5>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
                ${Object.entries(mapping).map(([field, col]) => `
                    <span class="hub-badge hub-badge-new">${field} ← ${col}</span>
                `).join('')}
            </div>

            <h5 style="margin-bottom: 8px;">Aperçu (5 premières lignes) :</h5>
            <div style="overflow-x: auto;">
                <table class="hub-import-preview-table">
                    <thead>
                        <tr>
                            <th>Prénom</th>
                            <th>Nom</th>
                            <th>Email</th>
                            <th>Entreprise</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.slice(0, 5).map(row => `
                            <tr>
                                <td>${row[mapping.first_name?.toLowerCase()] || '-'}</td>
                                <td>${row[mapping.last_name?.toLowerCase()] || '-'}</td>
                                <td>${row[mapping.email?.toLowerCase()] || '-'}</td>
                                <td>${row[mapping.company?.toLowerCase()] || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end;">
                <button class="hub-btn hub-btn-secondary" onclick="HubCRM.resetImport()">Annuler</button>
                <button class="hub-btn hub-btn-primary" onclick="HubCRM.executeImport()">
                    Importer ${validRows.length} prospects
                </button>
            </div>
        `;
    },

    async executeImport() {
        if (!this.importData) return;

        const { rows, mapping } = this.importData;
        const prospects = [];
        let skipped = 0;
        let duplicates = 0;

        // Charger emails existants pour vérifier doublons
        const { data: existingProspects } = await hubSupabase
            .from('hub_prospects')
            .select('email')
            .eq('user_id', this.currentUser.id);

        const existingEmails = new Set((existingProspects || []).map(p => p.email?.toLowerCase()));

        for (const row of rows) {
            const firstName = row[mapping.first_name?.toLowerCase()]?.trim();
            const email = row[mapping.email?.toLowerCase()]?.trim()?.toLowerCase();

            // Skip si pas de prénom
            if (!firstName) {
                skipped++;
                continue;
            }

            // Check doublon
            if (email && existingEmails.has(email)) {
                duplicates++;
                continue;
            }

            if (email) {
                existingEmails.add(email);
            }

            const prospect = {
                user_id: this.isTeamMode ? null : this.currentUser.id,
                team_id: this.isTeamMode ? this.currentTeam?.id : null,
                source: 'csv',
                first_name: firstName,
                last_name: row[mapping.last_name?.toLowerCase()]?.trim() || null,
                email: email || null,
                company: row[mapping.company?.toLowerCase()]?.trim() || null,
                job_title: row[mapping.job_title?.toLowerCase()]?.trim() || null,
                phone: row[mapping.phone?.toLowerCase()]?.trim() || null,
                linkedin_url: row[mapping.linkedin_url?.toLowerCase()]?.trim() || null,
                sector: row[mapping.sector?.toLowerCase()]?.trim() || null,
                city: row[mapping.city?.toLowerCase()]?.trim() || null,
                notes: row[mapping.notes?.toLowerCase()]?.trim() || null,
                status: 'new'
            };

            // Canaux si présents
            if (row[mapping.email_contacted?.toLowerCase()]) {
                prospect.email_contacted = ['oui', 'yes', 'true', '1'].includes(row[mapping.email_contacted.toLowerCase()].toLowerCase());
                if (prospect.email_contacted) prospect.email_contacted_at = new Date().toISOString();
            }
            if (row[mapping.dm_contacted?.toLowerCase()]) {
                prospect.dm_contacted = ['oui', 'yes', 'true', '1'].includes(row[mapping.dm_contacted.toLowerCase()].toLowerCase());
                if (prospect.dm_contacted) prospect.dm_contacted_at = new Date().toISOString();
            }
            if (row[mapping.call_done?.toLowerCase()]) {
                prospect.call_done = ['oui', 'yes', 'true', '1'].includes(row[mapping.call_done.toLowerCase()].toLowerCase());
                if (prospect.call_done) prospect.call_done_at = new Date().toISOString();
            }
            if (row[mapping.call_result?.toLowerCase()]) {
                prospect.call_result = row[mapping.call_result.toLowerCase()].trim();
            }

            prospects.push(prospect);
        }

        if (prospects.length === 0) {
            this.showToast('Aucun prospect valide à importer', 'error');
            return;
        }

        try {
            // Insert par batch
            const batchSize = 100;
            for (let i = 0; i < prospects.length; i += batchSize) {
                const batch = prospects.slice(i, i + batchSize);
                const { error } = await hubSupabase
                    .from('hub_prospects')
                    .insert(batch);

                if (error) throw error;
            }

            this.closeModal('importModal');
            this.showToast(`${prospects.length} prospects importés (${duplicates} doublons ignorés)`, 'success');
            await this.loadProspects();

        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Erreur lors de l\'import', 'error');
        }
    },

    // ============================================
    // ACTIVITÉS / LOG
    // ============================================

    async logActivity(prospectId, activityType, channel, description, metadata = {}) {
        try {
            await hubSupabase
                .from('hub_activities')
                .insert({
                    prospect_id: prospectId,
                    user_id: this.currentUser.id,
                    activity_type: activityType,
                    channel: channel,
                    description: description,
                    metadata: metadata
                });
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    },

    // ============================================
    // FILTRES
    // ============================================

    applyFilters() {
        this.filters.status = document.getElementById('filterStatus')?.value || 'all';
        this.filters.channel = document.getElementById('filterChannel')?.value || 'all';
        this.filters.assignedTo = document.getElementById('filterAssigned')?.value || 'all';
        this.pagination.page = 1;
        this.loadProspects();
    },

    handleSearch: HubUtils.debounce(function(value) {
        HubCRM.filters.search = value;
        HubCRM.pagination.page = 1;
        HubCRM.loadProspects();
    }, 300),

    goToPage(page) {
        this.pagination.page = page;
        this.loadProspects();
    },

    // ============================================
    // ONBOARDING
    // ============================================

    showOnboarding() {
        const modal = document.getElementById('onboardingModal');
        if (modal) {
            this.onboardingStep = 1;
            this.onboardingData = {
                mode: 'solo',
                teamName: '',
                channels: { email: true, dm: true, call: true }
            };
            this.renderOnboardingStep();
            this.openModal('onboardingModal');
        }
    },

    renderOnboardingStep() {
        const container = document.getElementById('onboardingContent');

        if (this.onboardingStep === 1) {
            container.innerHTML = `
                <div class="hub-onboarding-step">
                    <div class="hub-onboarding-progress">
                        <div class="hub-onboarding-dot active"></div>
                        <div class="hub-onboarding-dot"></div>
                        <div class="hub-onboarding-dot"></div>
                    </div>
                    <h2 class="hub-onboarding-title">Comment utilises-tu le HUB ?</h2>
                    <p class="hub-onboarding-subtitle">Tu pourras changer ce paramètre plus tard.</p>

                    <div class="hub-onboarding-options">
                        <div class="hub-onboarding-option ${this.onboardingData.mode === 'solo' ? 'selected' : ''}" onclick="HubCRM.selectOnboardingMode('solo')">
                            <span class="hub-onboarding-option-icon">👤</span>
                            <div>
                                <div class="hub-onboarding-option-label">Seul(e)</div>
                                <div class="hub-onboarding-option-desc">Je gère ma prospection perso</div>
                            </div>
                        </div>
                        <div class="hub-onboarding-option ${this.onboardingData.mode === 'team' ? 'selected' : ''}" onclick="HubCRM.selectOnboardingMode('team')">
                            <span class="hub-onboarding-option-icon">👥</span>
                            <div>
                                <div class="hub-onboarding-option-label">En équipe</div>
                                <div class="hub-onboarding-option-desc">On prospecte à plusieurs</div>
                            </div>
                        </div>
                    </div>

                    <button class="hub-btn hub-btn-primary" style="width: 100%;" onclick="HubCRM.nextOnboardingStep()">
                        Continuer →
                    </button>
                </div>
            `;
        } else if (this.onboardingStep === 2 && this.onboardingData.mode === 'team') {
            container.innerHTML = `
                <div class="hub-onboarding-step">
                    <div class="hub-onboarding-progress">
                        <div class="hub-onboarding-dot active"></div>
                        <div class="hub-onboarding-dot active"></div>
                        <div class="hub-onboarding-dot"></div>
                    </div>
                    <h2 class="hub-onboarding-title">Crée ton équipe</h2>
                    <p class="hub-onboarding-subtitle">Tu pourras inviter des membres ensuite.</p>

                    <div class="hub-form-group" style="text-align: left;">
                        <label class="hub-form-label">Nom de l'équipe</label>
                        <input type="text" class="hub-input" id="onboardingTeamName"
                            value="${this.onboardingData.teamName}"
                            placeholder="Ex: Équipe commerciale">
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button class="hub-btn hub-btn-secondary" style="flex: 1;" onclick="HubCRM.prevOnboardingStep()">
                            ← Retour
                        </button>
                        <button class="hub-btn hub-btn-primary" style="flex: 1;" onclick="HubCRM.nextOnboardingStep()">
                            Continuer →
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Step 3 (ou 2 si solo) : Canaux
            container.innerHTML = `
                <div class="hub-onboarding-step">
                    <div class="hub-onboarding-progress">
                        <div class="hub-onboarding-dot active"></div>
                        <div class="hub-onboarding-dot active"></div>
                        <div class="hub-onboarding-dot active"></div>
                    </div>
                    <h2 class="hub-onboarding-title">Quels canaux utilises-tu ?</h2>
                    <p class="hub-onboarding-subtitle">Sélectionne les canaux que tu utilises pour prospecter.</p>

                    <div class="hub-onboarding-channels">
                        <label class="hub-onboarding-channel">
                            <input type="checkbox" ${this.onboardingData.channels.email ? 'checked' : ''} onchange="HubCRM.onboardingData.channels.email = this.checked">
                            <span>📧</span>
                            <span>Email</span>
                        </label>
                        <label class="hub-onboarding-channel">
                            <input type="checkbox" ${this.onboardingData.channels.dm ? 'checked' : ''} onchange="HubCRM.onboardingData.channels.dm = this.checked">
                            <span>💬</span>
                            <span>DM (LinkedIn, Instagram...)</span>
                        </label>
                        <label class="hub-onboarding-channel">
                            <input type="checkbox" ${this.onboardingData.channels.call ? 'checked' : ''} onchange="HubCRM.onboardingData.channels.call = this.checked">
                            <span>📞</span>
                            <span>Appels téléphoniques</span>
                        </label>
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 24px;">
                        <button class="hub-btn hub-btn-secondary" style="flex: 1;" onclick="HubCRM.prevOnboardingStep()">
                            ← Retour
                        </button>
                        <button class="hub-btn hub-btn-primary" style="flex: 1;" onclick="HubCRM.completeOnboarding()">
                            Terminer ✓
                        </button>
                    </div>
                </div>
            `;
        }
    },

    selectOnboardingMode(mode) {
        this.onboardingData.mode = mode;
        this.renderOnboardingStep();
    },

    nextOnboardingStep() {
        if (this.onboardingStep === 2 && this.onboardingData.mode === 'team') {
            const teamName = document.getElementById('onboardingTeamName')?.value.trim();
            if (!teamName) {
                this.showToast('Le nom de l\'équipe est requis', 'error');
                return;
            }
            this.onboardingData.teamName = teamName;
        }

        if (this.onboardingData.mode === 'solo' && this.onboardingStep === 1) {
            this.onboardingStep = 3;
        } else {
            this.onboardingStep++;
        }

        this.renderOnboardingStep();
    },

    prevOnboardingStep() {
        if (this.onboardingData.mode === 'solo' && this.onboardingStep === 3) {
            this.onboardingStep = 1;
        } else {
            this.onboardingStep--;
        }
        this.renderOnboardingStep();
    },

    async completeOnboarding() {
        try {
            // Créer équipe si mode team
            if (this.onboardingData.mode === 'team') {
                const { data: team, error: teamError } = await hubSupabase
                    .from('hub_teams')
                    .insert({
                        name: this.onboardingData.teamName,
                        owner_id: this.currentUser.id,
                        channels_enabled: this.onboardingData.channels
                    })
                    .select()
                    .single();

                if (teamError) throw teamError;

                // Ajouter owner comme membre
                await hubSupabase
                    .from('hub_team_members')
                    .insert({
                        team_id: team.id,
                        user_id: this.currentUser.id,
                        role: 'owner',
                        invitation_status: 'accepted',
                        joined_at: new Date().toISOString()
                    });

                this.currentTeam = team;
            }

            // Mettre à jour les settings
            const { error } = await hubSupabase
                .from('hub_user_settings')
                .update({
                    work_mode: this.onboardingData.mode,
                    default_team_id: this.currentTeam?.id || null,
                    channels_enabled: this.onboardingData.channels,
                    onboarding_completed: true
                })
                .eq('user_id', this.currentUser.id);

            if (error) throw error;

            this.isTeamMode = this.onboardingData.mode === 'team';
            this.closeModal('onboardingModal');
            this.updateModeUI();
            this.renderFilters();

            this.showToast('Configuration terminée !', 'success');

        } catch (error) {
            console.error('Onboarding error:', error);
            this.showToast('Erreur lors de la configuration', 'error');
        }
    },

    // ============================================
    // UI HELPERS
    // ============================================

    setupEventListeners() {
        // Recherche
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Import drag & drop
        const dropzone = document.getElementById('importDropzone');
        if (dropzone) {
            dropzone.addEventListener('dragover', (e) => this.handleDragOver(e));
            dropzone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            dropzone.addEventListener('drop', (e) => this.handleDrop(e));
        }

        // Click outside modals
        document.querySelectorAll('.hub-modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    const modalId = overlay.id;
                    if (modalId !== 'onboardingModal') {
                        this.closeModal(modalId);
                    }
                }
            });
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.hub-modal-overlay.active').forEach(modal => {
                    if (modal.id !== 'onboardingModal') {
                        this.closeModal(modal.id);
                    }
                });
            }
        });
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    showLoading(show) {
        const loader = document.getElementById('loadingOverlay');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer') || this.createToastContainer();

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const toast = document.createElement('div');
        toast.className = `hub-toast hub-toast-${type}`;
        toast.innerHTML = `
            <span class="hub-toast-icon">${icons[type]}</span>
            <span>${message}</span>
            <button class="hub-toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'hub-slide-in 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'hub-toast-container';
        document.body.appendChild(container);
        return container;
    },

    // ============================================
    // MODE SWITCH
    // ============================================

    toggleModeMenu() {
        // TODO: Dropdown pour changer de mode ou d'équipe
        if (this.isTeamMode) {
            if (confirm('Revenir en mode Solo ?')) {
                this.switchToSoloMode();
            }
        } else {
            if (confirm('Passer en mode Équipe ?')) {
                this.showOnboarding();
            }
        }
    },

    async switchToSoloMode() {
        try {
            await hubSupabase
                .from('hub_user_settings')
                .update({
                    work_mode: 'solo',
                    default_team_id: null
                })
                .eq('user_id', this.currentUser.id);

            this.isTeamMode = false;
            this.currentTeam = null;
            this.updateModeUI();
            this.renderFilters();
            await this.loadProspects();

            this.showToast('Mode Solo activé', 'success');

        } catch (error) {
            console.error('Error switching mode:', error);
            this.showToast('Erreur lors du changement de mode', 'error');
        }
    }
};

// Export global
window.HubCRM = HubCRM;
