// ===========================================
// prospects-module.js - Module Prospects
// SOS Storytelling - Import CSV & Gestion
// ===========================================

const ProspectsModule = {
    // State
    prospects: [],
    selectedProspects: new Set(),
    currentFilter: 'all',
    searchQuery: '',
    verificationInProgress: false,

    // API URL
    API_URL: 'https://sos-storytelling-api.sandra-devonssay.workers.dev',

    // Mapping des colonnes CSV
    COLUMN_MAPPINGS: {
        first_name: [
            'prenom', 'prénom', 'first name', 'firstname', 'first_name',
            'given name', 'givenname', 'name', 'nom complet'
        ],
        last_name: [
            'nom', 'last name', 'lastname', 'last_name',
            'family name', 'familyname', 'surname'
        ],
        email: [
            'email', 'e-mail', 'mail', 'email address', 'emailaddress',
            'courriel', 'adresse email', 'adresse e-mail'
        ],
        company: [
            'entreprise', 'société', 'societe', 'company', 'organization',
            'organisation', 'company name', 'companyname', 'nom entreprise'
        ],
        job_title: [
            'poste', 'fonction', 'titre', 'job title', 'jobtitle', 'title',
            'position', 'role', 'job', 'intitulé poste', 'intitule poste'
        ],
        linkedin: [
            'linkedin', 'linkedin url', 'linkedin_url', 'linkedinurl',
            'profil linkedin', 'lien linkedin', 'linkedin profile'
        ],
        phone: [
            'téléphone', 'telephone', 'phone', 'phone number', 'phonenumber',
            'mobile', 'tel', 'numéro', 'numero'
        ],
        website: [
            'site web', 'siteweb', 'website', 'site', 'url', 'web',
            'site internet', 'company website'
        ],
        sector: [
            'secteur', 'sector', 'industry', 'industrie', 'domaine'
        ],
        city: [
            'ville', 'city', 'location', 'localisation', 'lieu'
        ],
        company_size: [
            'effectif', 'taille', 'employees', 'company size', 'size',
            'nombre employés', 'headcount', 'nombre employes'
        ],
        notes: [
            'notes', 'note', 'commentaire', 'commentaires', 'comment',
            'comments', 'observation', 'observations', 'remarque', 'remarques'
        ]
    },

    /**
     * Initialise le module
     */
    async init() {
        await this.loadProspects();
    },

    /**
     * Charge les prospects depuis Supabase
     */
    async loadProspects() {
        console.log('[SOS Prospects] loadProspects called');
        if (!window.supabaseApp?.auth) {
            console.log('[SOS Prospects] No supabaseApp.auth available');
            return;
        }

        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            console.log('[SOS Prospects] User ID:', user?.id);
            if (!user) return;

            const { data, error } = await window.supabaseApp
                .from('prospects')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            console.log('[SOS Prospects] Query result - data:', data?.length, 'error:', error);
            if (error) throw error;
            this.prospects = data || [];
            console.log('[SOS Prospects] Loaded', this.prospects.length, 'prospects');

        } catch (error) {
            console.error('[SOS Prospects] Error loading:', error);
        }
    },

    /**
     * Auto-detecte le mapping des colonnes CSV
     */
    autoDetectMapping(headers) {
        const mapping = {};

        headers.forEach((header, index) => {
            const normalizedHeader = header.toLowerCase().trim().replace(/['"]/g, '');

            for (const [field, possibleNames] of Object.entries(this.COLUMN_MAPPINGS)) {
                if (possibleNames.includes(normalizedHeader)) {
                    mapping[index] = field;
                    break;
                }
            }
        });

        return mapping;
    },

    /**
     * Valide un email
     */
    isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return email && regex.test(email.trim());
    },

    /**
     * Parse le contenu CSV
     */
    parseCSV(csvContent) {
        const lines = csvContent.split(/\r?\n/);
        if (lines.length < 2) return { headers: [], rows: [] };

        // Detecter le separateur (virgule ou point-virgule)
        const firstLine = lines[0];
        const separator = firstLine.includes(';') ? ';' : ',';

        // Parser les headers
        const headers = this.parseCSVLine(firstLine, separator);

        // Parser les lignes
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = this.parseCSVLine(line, separator);
            if (values.length > 0) {
                rows.push(values);
            }
        }

        return { headers, rows, separator };
    },

    /**
     * Parse une ligne CSV (gere les guillemets)
     */
    parseCSVLine(line, separator = ',') {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === separator && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    },

    /**
     * Valide et prepare les prospects pour import
     */
    validateProspects(rows, mapping) {
        const prospects = [];
        const errors = [];
        const seenEmails = new Set();

        // Emails existants dans la base
        const existingEmails = new Set(this.prospects.map(p => p.email?.toLowerCase()));

        rows.forEach((values, rowIndex) => {
            const prospect = {};

            // Mapper les valeurs
            for (const [columnIndex, field] of Object.entries(mapping)) {
                const value = values[columnIndex] || '';
                prospect[field] = value.replace(/^["']|["']$/g, '').trim();
            }

            // Validation email
            if (!prospect.email || !this.isValidEmail(prospect.email)) {
                errors.push({
                    line: rowIndex + 2,
                    reason: 'invalid_email',
                    value: prospect.email || '(vide)'
                });
                return;
            }

            // Validation prenom
            if (!prospect.first_name || prospect.first_name.length < 1) {
                errors.push({
                    line: rowIndex + 2,
                    reason: 'missing_first_name',
                    value: prospect.first_name || '(vide)'
                });
                return;
            }

            // Check doublon dans le fichier CSV
            const emailLower = prospect.email.toLowerCase();
            if (seenEmails.has(emailLower)) {
                errors.push({
                    line: rowIndex + 2,
                    reason: 'duplicate_csv',
                    value: prospect.email
                });
                return;
            }

            // Check doublon contre la base existante
            if (existingEmails.has(emailLower)) {
                errors.push({
                    line: rowIndex + 2,
                    reason: 'duplicate_existing',
                    value: prospect.email
                });
                return;
            }

            seenEmails.add(emailLower);

            prospects.push(prospect);
        });

        return { prospects, errors };
    },

    /**
     * Importe les prospects dans Supabase
     */
    async importProspects(prospects, source = 'csv_import') {
        if (!window.supabaseApp) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const prospectsToInsert = prospects.map(p => ({
            user_id: user.id,
            email: p.email.toLowerCase().trim(),
            first_name: p.first_name,
            last_name: p.last_name || null,
            company: p.company || null,
            job_title: p.job_title || null,
            linkedin_url: p.linkedin || null,
            phone: p.phone || null,
            website: p.website || null,
            sector: p.sector || null,
            city: p.city || null,
            company_size: p.company_size || null,
            notes: p.notes || null,
            source: source,
            status: 'new'
        }));

        const { data, error } = await window.supabaseApp
            .from('prospects')
            .upsert(prospectsToInsert, {
                onConflict: 'user_id,email',
                ignoreDuplicates: true
            })
            .select();

        if (error) throw error;

        // Recharger la liste
        await this.loadProspects();

        return data;
    },

    /**
     * Ajoute un prospect manuellement
     */
    async addProspect(prospectData) {
        if (!window.supabaseApp) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.supabaseApp.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await window.supabaseApp
            .from('prospects')
            .insert({
                user_id: user.id,
                ...prospectData,
                email: prospectData.email.toLowerCase().trim(),
                source: 'manual',
                status: 'new'
            })
            .select()
            .single();

        if (error) throw error;

        await this.loadProspects();
        return data;
    },

    /**
     * Met a jour un prospect
     */
    async updateProspect(id, updates) {
        if (!window.supabaseApp) throw new Error('Supabase not initialized');

        const { data, error } = await window.supabaseApp
            .from('prospects')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await this.loadProspects();
        return data;
    },

    /**
     * Supprime un prospect
     */
    async deleteProspect(id) {
        if (!window.supabaseApp) throw new Error('Supabase not initialized');

        const { error } = await window.supabaseApp
            .from('prospects')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await this.loadProspects();
    },

    /**
     * Supprime plusieurs prospects
     */
    async deleteProspects(ids) {
        if (!window.supabaseApp) throw new Error('Supabase not initialized');

        const { error } = await window.supabaseApp
            .from('prospects')
            .delete()
            .in('id', ids);

        if (error) throw error;

        await this.loadProspects();
    },

    /**
     * Filtre les prospects
     */
    getFilteredProspects() {
        let filtered = [...this.prospects];

        // Filtre par statut
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(p => p.status === this.currentFilter);
        }

        // Filtre par recherche
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(p =>
                p.first_name?.toLowerCase().includes(query) ||
                p.last_name?.toLowerCase().includes(query) ||
                p.email?.toLowerCase().includes(query) ||
                p.company?.toLowerCase().includes(query)
            );
        }

        return filtered;
    },

    /**
     * Obtient les stats des prospects
     */
    getStats() {
        const stats = {
            total: this.prospects.length,
            new: 0,
            contacted: 0,
            opened: 0,
            clicked: 0,
            replied: 0,
            converted: 0,
            unsubscribed: 0,
            bounced: 0
        };

        this.prospects.forEach(p => {
            if (stats[p.status] !== undefined) {
                stats[p.status]++;
            }
        });

        return stats;
    },

    /**
     * Obtient les stats de verification
     */
    getVerificationStats() {
        const stats = {
            total: this.prospects.length,
            unverified: 0,
            valid: 0,
            risky: 0,
            invalid: 0,
            disposable: 0,
            catch_all: 0
        };

        this.prospects.forEach(p => {
            const status = p.verification_status || 'unverified';
            if (stats[status] !== undefined) {
                stats[status]++;
            }
        });

        stats.verified_rate = stats.total > 0 ?
            Math.round(((stats.total - stats.unverified) / stats.total) * 100) : 0;
        stats.quality_score = stats.total > 0 ?
            Math.round((stats.valid / stats.total) * 100) : 0;

        return stats;
    },

    /**
     * Verifie un seul email
     */
    async verifyEmail(email) {
        try {
            const { data: { session } } = await window.supabaseApp.auth.getSession();
            if (!session) throw new Error('Non authentifie');

            const response = await fetch(`${this.API_URL}/api/email-verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ email })
            });

            return await response.json();
        } catch (error) {
            console.error('Erreur verification email:', error);
            throw error;
        }
    },

    /**
     * Verifie les prospects selectionnes
     */
    async verifySelectedProspects() {
        if (this.selectedProspects.size === 0) {
            alert('Selectionnez des prospects a verifier');
            return;
        }

        if (this.verificationInProgress) {
            alert('Verification deja en cours');
            return;
        }

        this.verificationInProgress = true;
        const prospectsToVerify = this.prospects.filter(p => this.selectedProspects.has(p.id));
        const total = prospectsToVerify.length;
        let verified = 0;

        // Afficher modal de progression
        this.showVerificationProgress(0, total);

        try {
            const { data: { session } } = await window.supabaseApp.auth.getSession();
            if (!session) throw new Error('Non authentifie');

            for (const prospect of prospectsToVerify) {
                try {
                    const result = await this.verifyEmail(prospect.email);

                    // Mettre a jour le prospect dans Supabase
                    await window.supabaseApp
                        .from('prospects')
                        .update({
                            verification_status: result.status,
                            verification_result: result,
                            verified_at: new Date().toISOString(),
                            is_disposable: result.is_disposable || false,
                            is_catch_all: result.is_catch_all || false
                        })
                        .eq('id', prospect.id);

                    verified++;
                    this.updateVerificationProgress(verified, total);

                    // Pause pour eviter rate limiting
                    await new Promise(r => setTimeout(r, 200));
                } catch (e) {
                    console.error(`Erreur verification ${prospect.email}:`, e);
                }
            }

            // Recharger les prospects
            await this.loadProspects();
            this.showVerificationComplete(verified, total);

        } catch (error) {
            console.error('Erreur verification:', error);
            this.showVerificationError(error.message);
        } finally {
            this.verificationInProgress = false;
        }
    },

    /**
     * Verifie tous les prospects non verifies
     */
    async verifyAllUnverified() {
        const unverified = this.prospects.filter(p => !p.verification_status || p.verification_status === 'unverified');

        if (unverified.length === 0) {
            alert('Tous les prospects sont deja verifies');
            return;
        }

        if (!confirm(`Verifier ${unverified.length} email(s) ? Cela peut prendre quelques minutes.`)) {
            return;
        }

        // Selectionner tous les non verifies
        this.selectedProspects = new Set(unverified.map(p => p.id));
        await this.verifySelectedProspects();
    },

    /**
     * Affiche la modal de progression de verification
     */
    showVerificationProgress(current, total) {
        let modal = document.getElementById('verificationModal');

        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.id = 'verificationModal';
            document.body.appendChild(modal);
        }

        const percent = total > 0 ? Math.round((current / total) * 100) : 0;

        modal.innerHTML = `
            <div class="modal verification-modal">
                <div class="modal-header">
                    <h3>🔍 Verification en cours</h3>
                </div>
                <div class="modal-body" style="text-align: center; padding: 30px;">
                    <div class="verification-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${percent}%"></div>
                        </div>
                        <p class="progress-text">${current} / ${total} emails verifies (${percent}%)</p>
                    </div>
                    <p style="color: #666; font-size: 0.9em; margin-top: 15px;">
                        Ne fermez pas cette fenetre...
                    </p>
                </div>
            </div>
        `;
    },

    /**
     * Met a jour la progression
     */
    updateVerificationProgress(current, total) {
        const modal = document.getElementById('verificationModal');
        if (!modal) return;

        const percent = Math.round((current / total) * 100);
        const progressFill = modal.querySelector('.progress-fill');
        const progressText = modal.querySelector('.progress-text');

        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${current} / ${total} emails verifies (${percent}%)`;
    },

    /**
     * Affiche la completion de verification
     */
    showVerificationComplete(verified, total) {
        const modal = document.getElementById('verificationModal');
        if (!modal) return;

        const stats = this.getVerificationStats();

        modal.innerHTML = `
            <div class="modal verification-modal">
                <div class="modal-header">
                    <h3>✅ Verification terminee</h3>
                    <button class="modal-close" onclick="document.getElementById('verificationModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="verification-summary">
                        <div class="summary-icon">🎉</div>
                        <p><strong>${verified}</strong> email(s) verifie(s) sur ${total}</p>

                        <div class="verification-results">
                            <div class="result-item valid">
                                <span class="result-icon">✅</span>
                                <span class="result-label">Valides</span>
                                <span class="result-count">${stats.valid}</span>
                            </div>
                            <div class="result-item risky">
                                <span class="result-icon">⚠️</span>
                                <span class="result-label">Risques</span>
                                <span class="result-count">${stats.risky + stats.catch_all}</span>
                            </div>
                            <div class="result-item invalid">
                                <span class="result-icon">❌</span>
                                <span class="result-label">Invalides</span>
                                <span class="result-count">${stats.invalid + stats.disposable}</span>
                            </div>
                        </div>

                        ${stats.invalid + stats.disposable > 0 ? `
                            <div class="verification-warning">
                                ⚠️ ${stats.invalid + stats.disposable} email(s) invalide(s) detecte(s).
                                Nous recommandons de les supprimer avant d'envoyer une campagne.
                            </div>
                        ` : ''}
                    </div>

                    <div class="modal-actions">
                        <button class="btn btn-primary" onclick="document.getElementById('verificationModal').remove(); ProspectsModule.renderProspectsList();">
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Affiche une erreur de verification
     */
    showVerificationError(message) {
        const modal = document.getElementById('verificationModal');
        if (!modal) return;

        modal.innerHTML = `
            <div class="modal verification-modal">
                <div class="modal-header">
                    <h3>❌ Erreur</h3>
                    <button class="modal-close" onclick="document.getElementById('verificationModal').remove()">&times;</button>
                </div>
                <div class="modal-body" style="text-align: center;">
                    <div class="error-icon" style="font-size: 3em; margin-bottom: 15px;">⚠️</div>
                    <p>${message}</p>
                    <button class="btn btn-secondary" onclick="document.getElementById('verificationModal').remove()" style="margin-top: 20px;">
                        Fermer
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Retourne le badge de verification pour un prospect
     */
    getVerificationBadge(prospect) {
        const status = prospect.verification_status || 'unverified';
        const badges = {
            unverified: { icon: '❓', label: 'Non verifie', class: 'unverified' },
            valid: { icon: '✅', label: 'Valide', class: 'valid' },
            risky: { icon: '⚠️', label: 'Risque', class: 'risky' },
            invalid: { icon: '❌', label: 'Invalide', class: 'invalid' },
            disposable: { icon: '🗑️', label: 'Jetable', class: 'disposable' },
            catch_all: { icon: '📥', label: 'Catch-all', class: 'catch-all' }
        };
        return badges[status] || badges.unverified;
    },

    /**
     * Genere un template CSV basique
     */
    generateCSVTemplate() {
        const headers = ['Prenom', 'Nom', 'Email', 'Entreprise', 'Poste', 'LinkedIn', 'Telephone', 'Site web', 'Notes'];
        const example = ['Jean', 'Dupont', 'jean@example.com', 'Acme Inc', 'CEO', 'https://linkedin.com/in/jean', '+33612345678', 'https://acme.com', 'Rencontré au salon XYZ'];

        const csv = [
            headers.join(';'),
            example.join(';')
        ].join('\n');

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'template-prospects-sos-storytelling.csv';
        link.click();

        URL.revokeObjectURL(url);
    },

    /**
     * Telecharge le template Pharow
     */
    downloadPharowTemplate() {
        const link = document.createElement('a');
        link.href = 'template-pharow-sos-storytelling.csv';
        link.download = 'template-pharow-sos-storytelling.csv';
        link.click();
    },

    /**
     * Exporte les prospects en CSV
     */
    exportToCSV(prospects = null) {
        const data = prospects || this.prospects;
        if (data.length === 0) return;

        const headers = ['Prenom', 'Nom', 'Email', 'Entreprise', 'Poste', 'LinkedIn', 'Telephone', 'Site web', 'Notes', 'Statut', 'Source', 'Date creation'];

        const rows = data.map(p => [
            p.first_name || '',
            p.last_name || '',
            p.email || '',
            p.company || '',
            p.job_title || '',
            p.linkedin_url || '',
            p.phone || '',
            p.website || '',
            (p.notes || '').replace(/;/g, ',').replace(/\n/g, ' '),
            p.status || '',
            p.source || '',
            p.created_at ? new Date(p.created_at).toLocaleDateString() : ''
        ]);

        const csv = [
            headers.join(';'),
            ...rows.map(r => r.join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `prospects-sos-storytelling-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();

        URL.revokeObjectURL(url);
    },

    // ==========================================
    // UI COMPONENTS
    // ==========================================

    /**
     * Cree la page prospects complete
     */
    createProspectsPage() {
        const container = document.createElement('div');
        container.className = 'prospects-page';
        container.innerHTML = `
            <div class="prospects-header">
                <div class="prospects-title-section">
                    <h2>👥 ${t('prospects.title')}</h2>
                    <p>${t('prospects.subtitle')}</p>
                </div>
                <div class="prospects-actions">
                    <button class="btn btn-secondary" onclick="ProspectsModule.openImportModal()">
                        <span class="btn-icon">📥</span> ${t('actions.import')} CSV
                    </button>
                    <button class="btn btn-secondary" onclick="ProspectsModule.openAddModal()">
                        <span class="btn-icon">➕</span> ${t('actions.create')}
                    </button>
                    <button class="btn btn-verify" onclick="ProspectsModule.verifyAllUnverified()" title="Verifier les emails non verifies">
                        <span class="btn-icon">🔍</span> Verifier emails
                    </button>
                    <button class="btn btn-secondary" onclick="ProspectsModule.exportToCSV()">
                        <span class="btn-icon">📤</span> ${t('actions.export')}
                    </button>
                </div>
            </div>

            <div class="prospects-stats" id="prospectsStats"></div>

            <div class="prospects-filters">
                <div class="search-box">
                    <input type="text" placeholder="${t('prospects.list.search')}"
                           onkeyup="ProspectsModule.handleSearch(this.value)" id="prospectsSearch">
                </div>
                <div class="filter-buttons" id="filterButtons"></div>
            </div>

            <div class="prospects-list-container">
                <div class="prospects-list-header">
                    <label class="select-all-checkbox">
                        <input type="checkbox" onchange="ProspectsModule.toggleSelectAll(this.checked)">
                        ${t('actions.select_all')}
                    </label>
                    <span class="selected-count" id="selectedCount"></span>
                    <div class="bulk-actions" id="bulkActions" style="display:none;">
                        <button class="btn btn-small btn-danger" onclick="ProspectsModule.deleteSelected()">
                            ${t('actions.delete')}
                        </button>
                    </div>
                </div>
                <div class="prospects-list" id="prospectsList"></div>
            </div>
        `;

        return container;
    },

    /**
     * Rend la liste des prospects
     */
    renderProspectsList() {
        const listContainer = document.getElementById('prospectsList');
        const statsContainer = document.getElementById('prospectsStats');
        const filterContainer = document.getElementById('filterButtons');

        if (!listContainer) return;

        const filtered = this.getFilteredProspects();
        const stats = this.getStats();

        // Rendre les stats
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-card total">
                    <span class="stat-number">${stats.total}</span>
                    <span class="stat-label">${t('prospects.total')}</span>
                </div>
                <div class="stat-card new">
                    <span class="stat-number">${stats.new}</span>
                    <span class="stat-label">${t('prospects.list.new')}</span>
                </div>
                <div class="stat-card contacted">
                    <span class="stat-number">${stats.contacted}</span>
                    <span class="stat-label">${t('prospects.list.contacted')}</span>
                </div>
                <div class="stat-card replied">
                    <span class="stat-number">${stats.replied}</span>
                    <span class="stat-label">${t('prospects.list.replied')}</span>
                </div>
            `;
        }

        // Rendre les filtres
        const statusLabels = {
            all: t('prospects.list.all'),
            new: t('prospects.list.new'),
            contacted: t('prospects.list.contacted'),
            opened: t('prospects.status.opened'),
            replied: t('prospects.list.replied')
        };
        if (filterContainer) {
            const filters = ['all', 'new', 'contacted', 'opened', 'replied'];
            filterContainer.innerHTML = filters.map(f => `
                <button class="filter-btn ${this.currentFilter === f ? 'active' : ''}"
                        onclick="ProspectsModule.setFilter('${f}')">
                    ${statusLabels[f] || f}
                    ${f !== 'all' ? `(${stats[f] || 0})` : ''}
                </button>
            `).join('');
        }

        // Rendre la liste
        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <p>${t('prospects.empty')}</p>
                    <button class="btn btn-primary" onclick="ProspectsModule.openImportModal()">
                        ${t('actions.import')} CSV
                    </button>
                </div>
            `;
            return;
        }

        const statusBadges = {
            new: t('prospects.status.new'),
            contacted: t('prospects.status.contacted'),
            opened: t('prospects.status.opened'),
            clicked: t('prospects.status.clicked'),
            replied: t('prospects.status.replied'),
            bounced: t('prospects.status.bounced'),
            unsubscribed: t('prospects.status.unsubscribed')
        };
        listContainer.innerHTML = filtered.map(p => {
            const verifyBadge = this.getVerificationBadge(p);
            return `
            <div class="prospect-card ${this.selectedProspects.has(p.id) ? 'selected' : ''}" data-id="${p.id}">
                <div class="prospect-checkbox">
                    <input type="checkbox" ${this.selectedProspects.has(p.id) ? 'checked' : ''}
                           onchange="ProspectsModule.toggleSelect('${p.id}', this.checked)">
                </div>
                <div class="prospect-info">
                    <div class="prospect-name">
                        <strong>${p.first_name} ${p.last_name || ''}</strong>
                        <span class="status-badge status-${p.status}">${statusBadges[p.status] || p.status}</span>
                        <span class="verify-badge verify-${verifyBadge.class}" title="${verifyBadge.label}">
                            ${verifyBadge.icon}
                        </span>
                    </div>
                    <div class="prospect-details">
                        <span class="detail-email">${p.email}</span>
                        ${p.company ? `<span class="detail-company">@ ${p.company}</span>` : ''}
                        ${p.job_title ? `<span class="detail-job">${p.job_title}</span>` : ''}
                    </div>
                    ${p.notes ? `<div class="prospect-notes"><span class="notes-icon">📝</span> ${p.notes.length > 80 ? p.notes.substring(0, 80) + '...' : p.notes}</div>` : ''}
                </div>
                <div class="prospect-actions">
                    ${p.linkedin_url ? `<a href="${p.linkedin_url}" target="_blank" class="btn-icon-small" title="LinkedIn">🔗</a>` : ''}
                    <button class="btn-icon-small" onclick="ProspectsModule.showVideoLinkPicker('${p.id}')" title="Lien vidéo trackable">🎬</button>
                    <button class="btn-icon-small" onclick="ProspectsModule.openEditModal('${p.id}')" title="Modifier">✏️</button>
                    <button class="btn-icon-small" onclick="ProspectsModule.confirmDelete('${p.id}')" title="Supprimer">🗑️</button>
                </div>
            </div>
        `}).join('');

        this.updateSelectedCount();
    },

    /**
     * Gere la recherche
     */
    handleSearch(query) {
        this.searchQuery = query;
        this.renderProspectsList();
    },

    /**
     * Change le filtre
     */
    setFilter(filter) {
        this.currentFilter = filter;
        this.renderProspectsList();
    },

    /**
     * Toggle selection d'un prospect
     */
    toggleSelect(id, checked) {
        if (checked) {
            this.selectedProspects.add(id);
        } else {
            this.selectedProspects.delete(id);
        }
        this.updateSelectedCount();
    },

    /**
     * Toggle selection de tous les prospects
     */
    toggleSelectAll(checked) {
        const filtered = this.getFilteredProspects();
        if (checked) {
            filtered.forEach(p => this.selectedProspects.add(p.id));
        } else {
            this.selectedProspects.clear();
        }
        this.renderProspectsList();
    },

    /**
     * Met a jour le compteur de selection
     */
    updateSelectedCount() {
        const countEl = document.getElementById('selectedCount');
        const bulkActions = document.getElementById('bulkActions');

        if (countEl) {
            countEl.textContent = this.selectedProspects.size > 0
                ? t('prospects.list.selected', { count: this.selectedProspects.size })
                : '';
        }

        if (bulkActions) {
            bulkActions.style.display = this.selectedProspects.size > 0 ? 'flex' : 'none';
        }
    },

    /**
     * Supprime les prospects selectionnes
     */
    async deleteSelected() {
        if (this.selectedProspects.size === 0) return;

        if (!confirm(t('confirm_delete_multiple', { count: this.selectedProspects.size }))) return;

        try {
            await this.deleteProspects([...this.selectedProspects]);
            this.selectedProspects.clear();
            this.renderProspectsList();
        } catch (error) {
            console.error('Error deleting prospects:', error);
            alert(t('status.error'));
        }
    },

    /**
     * Affiche le picker de lien vidéo pour un prospect
     */
    async showVideoLinkPicker(prospectId) {
        const prospect = this.prospects.find(p => p.id === prospectId);
        if (!prospect) return;

        // Charger les vidéos disponibles
        const videos = await VideoTrackingModule.getVideoLinks();

        if (videos.length === 0) {
            // Pas de vidéo, proposer d'en créer une
            if (confirm('Tu n\'as pas encore de vidéo trackable. Veux-tu en créer une ?')) {
                VideoTrackingModule.showCreateVideoModal((video) => {
                    VideoTrackingModule.showLinkModal(video.id, prospect);
                });
            }
            return;
        }

        // Afficher le picker
        const modalHTML = `
            <div class="modal-overlay video-picker-overlay" onclick="ProspectsModule.closeVideoPicker(event)">
                <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>🎬 Lien vidéo pour ${prospect.name || prospect.email}</h2>
                        <button class="modal-close" onclick="ProspectsModule.closeVideoPicker()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 15px; color: #666;">Choisis une vidéo pour générer un lien trackable :</p>
                        <div class="video-list" style="max-height: 300px; overflow-y: auto;">
                            ${videos.map(v => `
                                <div class="video-item" style="padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; margin-bottom: 10px; cursor: pointer; transition: all 0.2s;"
                                     onmouseover="this.style.borderColor='#667eea'"
                                     onmouseout="this.style.borderColor='#e0e0e0'"
                                     onclick="ProspectsModule.selectVideoForProspect('${v.id}', '${prospectId}')">
                                    <div style="font-weight: 600;">${v.title}</div>
                                    <div style="font-size: 0.85em; color: #888; margin-top: 5px;">
                                        ${v.total_views || 0} vues • Seuil: ${v.notify_threshold}%
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <button class="btn btn-secondary" style="width: 100%; margin-top: 15px;"
                                onclick="ProspectsModule.closeVideoPicker(); VideoTrackingModule.showCreateVideoModal((v) => VideoTrackingModule.showLinkModal(v.id, ${JSON.stringify(prospect).replace(/"/g, '&quot;')}))">
                            + Créer une nouvelle vidéo
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    },

    selectVideoForProspect(videoId, prospectId) {
        const prospect = this.prospects.find(p => p.id === prospectId);
        this.closeVideoPicker();
        VideoTrackingModule.showLinkModal(videoId, prospect);
    },

    closeVideoPicker(event) {
        if (event && event.target !== event.currentTarget) return;
        const modal = document.querySelector('.video-picker-overlay');
        if (modal) modal.remove();
    },

    /**
     * Confirme la suppression d'un prospect
     */
    async confirmDelete(id) {
        if (!confirm(t('confirm_delete'))) return;

        try {
            await this.deleteProspect(id);
            this.renderProspectsList();
        } catch (error) {
            console.error('Error deleting prospect:', error);
            alert(t('status.error'));
        }
    },

    // ==========================================
    // MODALS
    // ==========================================

    /**
     * Ouvre le modal d'import CSV
     */
    openImportModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'importModal';
        modal.innerHTML = `
            <div class="modal import-modal">
                <div class="modal-header">
                    <h3>📥 ${t('prospects.import.title')}</h3>
                    <button class="modal-close" onclick="ProspectsModule.closeImportModal()">&times;</button>
                </div>
                <div class="modal-body" id="importModalBody">
                    ${this.renderImportStep1()}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup drag & drop
        setTimeout(() => this.setupDropzone(), 100);
    },

    /**
     * Ferme le modal d'import
     */
    closeImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) modal.remove();
        this.importState = null;
    },

    /**
     * Etape 1 : Upload fichier
     */
    renderImportStep1() {
        return `
            <div class="import-step import-step-1">
                <div class="dropzone" id="csvDropzone">
                    <input type="file" accept=".csv" id="csvFileInput" style="display:none"
                           onchange="ProspectsModule.handleFileSelect(this.files[0])">
                    <div class="dropzone-content">
                        <div class="dropzone-icon">📄</div>
                        <p>${t('prospects.import.drag_drop')}</p>
                        <p class="dropzone-formats">${t('prospects.import.formats')}</p>
                    </div>
                </div>

                <div class="import-tips">
                    <p>💡 ${t('prospects.import.pharow_tip')}</p>
                    <p>💡 ${t('prospects.import.apollo_tip')}</p>
                </div>

                <div class="templates-section">
                    <p class="templates-title">📋 Telecharger un modele CSV :</p>
                    <div class="templates-buttons">
                        <button class="btn btn-secondary btn-template" onclick="ProspectsModule.downloadPharowTemplate()">
                            <span class="template-icon">🎯</span>
                            <span class="template-text">
                                <strong>Template Pharow</strong>
                                <small>Compatible export Pharow</small>
                            </span>
                        </button>
                        <button class="btn btn-secondary btn-template" onclick="ProspectsModule.generateCSVTemplate()">
                            <span class="template-icon">📝</span>
                            <span class="template-text">
                                <strong>Template Simple</strong>
                                <small>Format basique</small>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Setup du dropzone
     */
    setupDropzone() {
        const dropzone = document.getElementById('csvDropzone');
        const fileInput = document.getElementById('csvFileInput');

        if (!dropzone) return;

        dropzone.onclick = () => fileInput.click();

        dropzone.ondragover = (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        };

        dropzone.ondragleave = () => {
            dropzone.classList.remove('dragover');
        };

        dropzone.ondrop = (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) this.handleFileSelect(file);
        };
    },

    /**
     * Gere la selection du fichier
     */
    handleFileSelect(file) {
        if (!file || !file.name.endsWith('.csv')) {
            alert(t('error_csv_required'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const { headers, rows } = this.parseCSV(content);

            if (headers.length === 0 || rows.length === 0) {
                alert(t('error_csv_empty'));
                return;
            }

            // Auto-detecter le mapping
            const mapping = this.autoDetectMapping(headers);

            this.importState = {
                headers,
                rows,
                mapping,
                fileName: file.name
            };

            // Passer a l'etape 2 (mapping)
            this.renderImportStep2();
        };

        reader.readAsText(file);
    },

    /**
     * Etape 2 : Mapping des colonnes
     */
    renderImportStep2() {
        const body = document.getElementById('importModalBody');
        if (!body || !this.importState) return;

        const { headers, mapping } = this.importState;
        const fields = Object.keys(this.COLUMN_MAPPINGS);
        const fieldLabels = {
            first_name: t('prospects.fields.first_name'),
            last_name: t('prospects.fields.last_name'),
            email: t('prospects.fields.email'),
            company: t('prospects.fields.company'),
            job_title: t('prospects.fields.job_title'),
            linkedin: t('prospects.fields.linkedin'),
            phone: t('prospects.fields.phone'),
            website: t('prospects.fields.website'),
            sector: t('prospects.fields.sector'),
            city: t('prospects.fields.city'),
            company_size: t('prospects.fields.company_size'),
            notes: 'Notes / Observations'
        };

        body.innerHTML = `
            <div class="import-step import-step-2">
                <h4>🔗 ${t('prospects.import.mapping_title')}</h4>
                <p>${t('prospects.import.mapping_description')}</p>

                <div class="mapping-grid">
                    ${headers.map((header, index) => `
                        <div class="mapping-row">
                            <span class="original-column">${header}</span>
                            <span class="mapping-arrow">→</span>
                            <select class="mapping-select" data-index="${index}">
                                <option value="">${t('prospects.import.ignore')}</option>
                                ${fields.map(f => `
                                    <option value="${f}" ${mapping[index] === f ? 'selected' : ''}>
                                        ${fieldLabels[f] || f}
                                        ${f === 'first_name' || f === 'email' ? ' *' : ''}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    `).join('')}
                </div>

                <p class="required-note">* ${t('prospects.import.required')}</p>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="ProspectsModule.closeImportModal()">
                        ${t('actions.cancel')}
                    </button>
                    <button class="btn btn-primary" onclick="ProspectsModule.goToPreview()">
                        ${t('actions.preview')} →
                    </button>
                </div>
            </div>
        `;

        // Ecouter les changements de mapping
        body.querySelectorAll('.mapping-select').forEach(select => {
            select.onchange = () => {
                const index = select.dataset.index;
                const value = select.value;
                if (value) {
                    this.importState.mapping[index] = value;
                } else {
                    delete this.importState.mapping[index];
                }
            };
        });
    },

    /**
     * Passe a l'apercu
     */
    goToPreview() {
        if (!this.importState) return;

        // Verifier que email et first_name sont mappes
        const mappedFields = Object.values(this.importState.mapping);
        if (!mappedFields.includes('email') || !mappedFields.includes('first_name')) {
            alert(t('error_required_fields'));
            return;
        }

        // Valider les prospects
        const { prospects, errors } = this.validateProspects(
            this.importState.rows,
            this.importState.mapping
        );

        this.importState.validProspects = prospects;
        this.importState.errors = errors;

        this.renderImportStep3();
    },

    /**
     * Etape 3 : Apercu et import
     */
    renderImportStep3() {
        const body = document.getElementById('importModalBody');
        if (!body || !this.importState) return;

        const { validProspects, errors } = this.importState;
        const invalidEmails = errors.filter(e => e.reason === 'invalid_email').length;
        const missingNames = errors.filter(e => e.reason === 'missing_first_name').length;
        const duplicatesCsv = errors.filter(e => e.reason === 'duplicate_csv').length;
        const duplicatesExisting = errors.filter(e => e.reason === 'duplicate_existing').length;

        body.innerHTML = `
            <div class="import-step import-step-3">
                <h4>👀 ${t('prospects.import.preview', { count: validProspects.length })}</h4>

                ${errors.length > 0 ? `
                    <div class="import-warnings">
                        ${invalidEmails > 0 ? `<p>⚠️ <strong>${invalidEmails}</strong> email(s) invalide(s) ignoré(s)</p>` : ''}
                        ${missingNames > 0 ? `<p>⚠️ <strong>${missingNames}</strong> ligne(s) sans prénom ignorée(s)</p>` : ''}
                        ${duplicatesCsv > 0 ? `<p>⚠️ <strong>${duplicatesCsv}</strong> doublon(s) dans le fichier CSV</p>` : ''}
                        ${duplicatesExisting > 0 ? `<p>🔄 <strong>${duplicatesExisting}</strong> prospect(s) déjà dans ta base (ignorés)</p>` : ''}
                    </div>
                ` : ''}

                <div class="preview-table-container">
                    <table class="preview-table">
                        <thead>
                            <tr>
                                <th>${t('prospects.fields.first_name')}</th>
                                <th>${t('prospects.fields.last_name')}</th>
                                <th>${t('prospects.fields.email')}</th>
                                <th>${t('prospects.fields.company')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${validProspects.slice(0, 10).map(p => `
                                <tr>
                                    <td>${p.first_name || '-'}</td>
                                    <td>${p.last_name || '-'}</td>
                                    <td>${p.email || '-'}</td>
                                    <td>${p.company || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${validProspects.length > 10 ? `
                        <p class="preview-more">+ ${validProspects.length - 10} ${t('more')}...</p>
                    ` : ''}
                </div>

                <!-- Case RGPD obligatoire -->
                <div class="rgpd-consent-box" style="background: linear-gradient(135deg, #fff5f5, #ffe8e8); border: 2px solid #f5576c; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <h4 style="color: #c0392b; margin: 0 0 15px; display: flex; align-items: center; gap: 8px;">
                        ⚠️ Déclaration RGPD obligatoire
                    </h4>

                    <label style="display: flex; gap: 12px; cursor: pointer; margin-bottom: 15px;">
                        <input type="checkbox" id="rgpdSourceCheckbox" style="width: 20px; height: 20px; accent-color: #667eea; flex-shrink: 0; margin-top: 3px;">
                        <span style="color: #333; line-height: 1.5;">
                            <strong>Origine des données :</strong> Je certifie que ces prospects proviennent de sources légitimes (opt-in, salons professionnels, échanges de cartes de visite, annuaires publics B2B) et non de scraping automatisé ou d'achat de listes non consenties.
                        </span>
                    </label>

                    <label style="display: flex; gap: 12px; cursor: pointer;">
                        <input type="checkbox" id="rgpdB2BCheckbox" style="width: 20px; height: 20px; accent-color: #667eea; flex-shrink: 0; margin-top: 3px;">
                        <span style="color: #333; line-height: 1.5;">
                            <strong>Contexte B2B :</strong> Je confirme que ces contacts sont des professionnels contactés dans le cadre de leur activité professionnelle (intérêt légitime B2B).
                        </span>
                    </label>
                </div>

                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="ProspectsModule.renderImportStep2()">
                        ← ${t('actions.back')}
                    </button>
                    <button class="btn btn-primary" id="importConfirmBtn" onclick="ProspectsModule.executeImport()" disabled style="opacity: 0.5;">
                        ${t('actions.import')} ${validProspects.length} prospects
                    </button>
                </div>
            </div>
        `;

        // Activer le bouton quand les 2 cases sont cochées
        setTimeout(() => {
            const sourceBox = document.getElementById('rgpdSourceCheckbox');
            const b2bBox = document.getElementById('rgpdB2BCheckbox');
            const btn = document.getElementById('importConfirmBtn');

            const updateBtn = () => {
                const allChecked = sourceBox?.checked && b2bBox?.checked;
                if (btn) {
                    btn.disabled = !allChecked;
                    btn.style.opacity = allChecked ? '1' : '0.5';
                }
            };

            sourceBox?.addEventListener('change', updateBtn);
            b2bBox?.addEventListener('change', updateBtn);
        }, 100);
    },

    /**
     * Execute l'import
     */
    async executeImport() {
        if (!this.importState || !this.importState.validProspects) return;

        const body = document.getElementById('importModalBody');
        body.innerHTML = `
            <div class="import-loading">
                <div class="spinner"></div>
                <p>${t('status.loading')}</p>
            </div>
        `;

        try {
            await this.importProspects(this.importState.validProspects);

            body.innerHTML = `
                <div class="import-success">
                    <div class="success-icon">✅</div>
                    <p>${t('prospects.import.success', { count: this.importState.validProspects.length })}</p>
                    <button class="btn btn-primary" onclick="ProspectsModule.closeImportModal(); ProspectsModule.renderProspectsList();">
                        ${t('actions.close')}
                    </button>
                </div>
            `;
        } catch (error) {
            console.error('Import error:', error);
            body.innerHTML = `
                <div class="import-error">
                    <div class="error-icon">❌</div>
                    <p>${t('status.error')}</p>
                    <p class="error-detail">${error.message}</p>
                    <button class="btn btn-secondary" onclick="ProspectsModule.closeImportModal()">
                        ${t('actions.close')}
                    </button>
                </div>
            `;
        }
    },

    /**
     * Ouvre le modal d'ajout manuel
     */
    openAddModal() {
        this.openProspectForm();
    },

    /**
     * Ouvre le modal d'edition
     */
    openEditModal(id) {
        const prospect = this.prospects.find(p => p.id === id);
        if (!prospect) return;
        this.openProspectForm(prospect);
    },

    /**
     * Ouvre le formulaire prospect (add/edit)
     */
    openProspectForm(prospect = null) {
        const isEdit = !!prospect;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'prospectFormModal';
        modal.innerHTML = `
            <div class="modal prospect-form-modal">
                <div class="modal-header">
                    <h3>${isEdit ? '✏️ ' + t('actions.edit') : '➕ ' + t('prospects.add_manual')}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="prospectForm" onsubmit="ProspectsModule.handleProspectFormSubmit(event, '${prospect?.id || ''}')">
                        <div class="form-row">
                            <div class="form-group">
                                <label>${t('prospects.fields.first_name')} *</label>
                                <input type="text" name="first_name" required value="${prospect?.first_name || ''}">
                            </div>
                            <div class="form-group">
                                <label>${t('prospects.fields.last_name')}</label>
                                <input type="text" name="last_name" value="${prospect?.last_name || ''}">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>${t('prospects.fields.email')} *</label>
                            <input type="email" name="email" required value="${prospect?.email || ''}">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>${t('prospects.fields.company')}</label>
                                <input type="text" name="company" value="${prospect?.company || ''}">
                            </div>
                            <div class="form-group">
                                <label>${t('prospects.fields.job_title')}</label>
                                <input type="text" name="job_title" value="${prospect?.job_title || ''}">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>${t('prospects.fields.linkedin')}</label>
                            <input type="url" name="linkedin_url" value="${prospect?.linkedin_url || ''}">
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>${t('prospects.fields.phone')}</label>
                                <input type="tel" name="phone" value="${prospect?.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label>${t('prospects.fields.website')}</label>
                                <input type="url" name="website" value="${prospect?.website || ''}">
                            </div>
                        </div>

                        <div class="form-group">
                            <label>${t('prospects.fields.notes')}</label>
                            <textarea name="notes" rows="3">${prospect?.notes || ''}</textarea>
                        </div>

                        <div class="modal-actions">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                ${t('actions.cancel')}
                            </button>
                            <button type="submit" class="btn btn-primary">
                                ${t('actions.save')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    /**
     * Gere la soumission du formulaire prospect
     */
    async handleProspectFormSubmit(event, id) {
        event.preventDefault();

        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            if (id) {
                await this.updateProspect(id, data);
            } else {
                await this.addProspect(data);
            }

            document.getElementById('prospectFormModal').remove();
            this.renderProspectsList();
        } catch (error) {
            console.error('Error saving prospect:', error);
            alert(error.message || t('status.error'));
        }
    },

    /**
     * Affiche le modal pour l'extension Sales Navigator
     */
    showExtensionModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'extensionModal';
        modal.innerHTML = `
            <div class="modal extension-modal">
                <div class="modal-header" style="background: linear-gradient(135deg, #0077B5, #00A0DC); color: white;">
                    <h3 style="color: white;">🔗 Extension Sales Navigator</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()" style="color: white;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 25px;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <div style="font-size: 3em; margin-bottom: 15px;">🚀</div>
                        <h4 style="margin: 0 0 10px 0; color: #333;">Importez vos leads LinkedIn en 1 clic</h4>
                        <p style="color: #666; margin: 0;">Notre extension Chrome gratuite vous permet d'exporter vos leads depuis Sales Navigator directement vers SOS Storytelling.</p>
                    </div>

                    <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <h5 style="margin: 0 0 15px 0; color: #333;">📋 Comment ça marche ?</h5>
                        <ol style="margin: 0; padding-left: 20px; color: #555; line-height: 1.8;">
                            <li>Téléchargez et installez l'extension Chrome</li>
                            <li>Connectez-vous avec vos identifiants SOS Storytelling</li>
                            <li>Allez sur LinkedIn Sales Navigator</li>
                            <li>Sélectionnez les leads que vous voulez exporter</li>
                            <li>Cliquez sur "Exporter" → Vos leads apparaissent ici !</li>
                        </ol>
                    </div>

                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <a href="sos-storytelling-extension.zip" download class="btn btn-linkedin" style="flex: 1; text-align: center; text-decoration: none; min-width: 200px;">
                            📥 Télécharger l'extension
                        </a>
                        <button class="btn btn-secondary" onclick="ProspectsModule.showExtensionGuide()" style="flex: 1; min-width: 200px;">
                            📖 Guide d'installation
                        </button>
                    </div>

                    <div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, rgba(0,119,181,0.1), rgba(0,160,220,0.1)); border-radius: 10px; border-left: 4px solid #0077B5;">
                        <p style="margin: 0; font-size: 0.9em; color: #555;">
                            <strong>💡 Astuce :</strong> L'extension détecte automatiquement quand vous êtes sur Sales Navigator et affiche un bouton pour sélectionner vos leads.
                        </p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.classList.add('active');
    },

    /**
     * Affiche le guide d'installation de l'extension
     */
    showExtensionGuide() {
        const currentModal = document.getElementById('extensionModal');
        if (!currentModal) return;

        const body = currentModal.querySelector('.modal-body');
        body.innerHTML = [
            '<div style="max-height: 400px; overflow-y: auto;">',
            '<h5>Installation en mode developpeur</h5>',
            '<ol style="line-height: 1.8; color: #555;">',
            '<li><strong>Telechargez</strong> le fichier ZIP de l\'extension</li>',
            '<li><strong>Decompressez</strong> le dossier sur votre ordinateur</li>',
            '<li>Ouvrez Chrome et allez sur <code>chrome://extensions/</code></li>',
            '<li>Activez le <strong>"Mode developpeur"</strong> en haut a droite</li>',
            '<li>Cliquez sur <strong>"Charger l\'extension non empaquetee"</strong></li>',
            '<li>Selectionnez le dossier decompresse</li>',
            '<li><strong>Epinglez</strong> l\'extension dans la barre Chrome (icone puzzle)</li>',
            '</ol>',
            '<h5 style="margin-top: 20px;">Utilisation</h5>',
            '<ol style="line-height: 1.8; color: #555;">',
            '<li>Cliquez sur l\'icone SOS Storytelling dans Chrome</li>',
            '<li>Connectez-vous avec vos identifiants</li>',
            '<li>Allez sur <strong>linkedin.com/sales/</strong></li>',
            '<li>Un bouton flottant apparait en bas a droite</li>',
            '<li>Cochez les leads a exporter et cliquez sur "Exporter"</li>',
            '</ol>',
            '<div style="margin-top: 20px; padding: 12px; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">',
            '<p style="margin: 0; font-size: 0.9em; color: #856404;">',
            '<strong>Important :</strong> LinkedIn n\'affiche pas les emails. Les prospects importes auront une adresse temporaire que vous pourrez enrichir avec un outil tiers (Dropcontact, Hunter...).',
            '</p>',
            '</div>',
            '</div>',
            '<button class="btn btn-secondary" style="width: 100%; margin-top: 20px;" id="backToExtensionBtn">Retour</button>'
        ].join('');

        document.getElementById('backToExtensionBtn').onclick = function() {
            document.getElementById('extensionModal').remove();
            ProspectsModule.showExtensionModal();
        };
    }
};

// Exposer globalement
window.ProspectsModule = ProspectsModule;

// CSS du module
const prospectsStyles = document.createElement('style');
prospectsStyles.textContent = `
/* ==========================================
   PROSPECTS MODULE STYLES
   ========================================== */

.prospects-page {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.prospects-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 25px;
    flex-wrap: wrap;
    gap: 15px;
}

.prospects-title-section h2 {
    margin: 0 0 5px;
    color: #333;
    font-size: 1.8em;
}

.prospects-title-section p {
    margin: 0;
    color: #666;
    font-size: 0.95em;
}

.prospects-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

/* Stats */
.prospects-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 15px;
    margin-bottom: 25px;
}

.stat-card {
    background: white;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    border-left: 4px solid #667eea;
}

.stat-card.new { border-left-color: #38ef7d; }
.stat-card.contacted { border-left-color: #ffc107; }
.stat-card.replied { border-left-color: #28a745; }

.stat-number {
    display: block;
    font-size: 2em;
    font-weight: 700;
    color: #333;
}

.stat-label {
    font-size: 0.85em;
    color: #666;
}

/* Filters */
.prospects-filters {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    align-items: center;
}

.search-box input {
    padding: 10px 15px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 0.95em;
    width: 250px;
    font-family: inherit;
}

.search-box input:focus {
    outline: none;
    border-color: #667eea;
}

.filter-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.filter-btn {
    padding: 8px 16px;
    border: 2px solid #e0e0e0;
    border-radius: 20px;
    background: white;
    font-family: inherit;
    font-size: 0.9em;
    cursor: pointer;
    transition: all 0.2s;
}

.filter-btn:hover {
    border-color: #667eea;
    background: #f8f9ff;
}

.filter-btn.active {
    background: #667eea;
    border-color: #667eea;
    color: white;
}

/* List */
.prospects-list-container {
    background: white;
    border-radius: 15px;
    box-shadow: 0 2px 15px rgba(0,0,0,0.08);
    overflow: hidden;
}

.prospects-list-header {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px 20px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
}

.select-all-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9em;
    cursor: pointer;
}

.selected-count {
    color: #667eea;
    font-weight: 600;
    font-size: 0.9em;
}

.bulk-actions {
    margin-left: auto;
}

.prospects-list {
    max-height: 600px;
    overflow-y: auto;
}

/* Prospect Card */
.prospect-card {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px 20px;
    border-bottom: 1px solid #f0f0f0;
    transition: background 0.2s;
}

.prospect-card:hover {
    background: #f8f9ff;
}

.prospect-card.selected {
    background: #e8ecff;
}

.prospect-checkbox {
    flex-shrink: 0;
}

.prospect-info {
    flex: 1;
    min-width: 0;
}

.prospect-name {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 5px;
}

.prospect-name strong {
    font-size: 1em;
    color: #333;
}

.status-badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 0.75em;
    font-weight: 600;
}

.status-badge.status-new { background: #e8f5e9; color: #2e7d32; }
.status-badge.status-contacted { background: #fff3e0; color: #e65100; }
.status-badge.status-opened { background: #e3f2fd; color: #1565c0; }
.status-badge.status-clicked { background: #f3e5f5; color: #7b1fa2; }
.status-badge.status-replied { background: #e8f5e9; color: #1b5e20; }
.status-badge.status-bounced { background: #ffebee; color: #c62828; }

.prospect-details {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 0.9em;
    color: #666;
}

.prospect-details span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.detail-company::before {
    content: "•";
    margin-right: 8px;
    color: #ccc;
}

.prospect-notes {
    margin-top: 8px;
    padding: 8px 12px;
    background: #fffbeb;
    border-left: 3px solid #f59e0b;
    border-radius: 0 8px 8px 0;
    font-size: 0.85em;
    color: #92400e;
    line-height: 1.4;
}

.notes-icon {
    margin-right: 6px;
}

.prospect-actions {
    display: flex;
    gap: 5px;
    flex-shrink: 0;
}

.btn-icon-small {
    padding: 6px 10px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1em;
    transition: background 0.2s;
    text-decoration: none;
}

.btn-icon-small:hover {
    background: #e0e0e0;
}

/* Empty State */
.empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #666;
}

.empty-icon {
    font-size: 4em;
    margin-bottom: 15px;
}

/* Import Modal */
.import-modal {
    max-width: 600px;
    width: 90%;
}

.dropzone {
    border: 3px dashed #d0d0d0;
    border-radius: 15px;
    padding: 50px 30px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    margin-bottom: 20px;
}

.dropzone:hover, .dropzone.dragover {
    border-color: #667eea;
    background: #f8f9ff;
}

.dropzone-icon {
    font-size: 3em;
    margin-bottom: 10px;
}

.dropzone-formats {
    font-size: 0.85em;
    color: #888;
    margin-top: 10px;
}

.import-tips {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 10px;
    margin-bottom: 15px;
}

.import-tips p {
    margin: 5px 0;
    font-size: 0.9em;
    color: #555;
}

/* Templates Section */
.templates-section {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
}

.templates-title {
    font-weight: 600;
    color: #333;
    margin-bottom: 12px;
    font-size: 0.95em;
}

.templates-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.btn-template {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 15px 18px;
    text-align: left;
    border: 2px solid #e0e5ff;
    background: #f8f9ff;
    border-radius: 12px;
    transition: all 0.3s;
}

.btn-template:hover {
    border-color: #667eea;
    background: #f0f4ff;
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102,126,234,0.2);
}

.template-icon {
    font-size: 1.8em;
    flex-shrink: 0;
}

.template-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.template-text strong {
    font-size: 0.95em;
    color: #333;
}

.template-text small {
    font-size: 0.8em;
    color: #888;
    font-weight: 400;
}

@media (max-width: 500px) {
    .templates-buttons {
        grid-template-columns: 1fr;
    }
}

/* Mapping */
.mapping-grid {
    max-height: 400px;
    overflow-y: auto;
    margin: 20px 0;
}

.mapping-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-bottom: 1px solid #f0f0f0;
}

.original-column {
    flex: 1;
    font-weight: 500;
    color: #333;
}

.mapping-arrow {
    color: #667eea;
    font-weight: bold;
}

.mapping-select {
    flex: 1;
    padding: 8px 12px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-family: inherit;
}

.required-note {
    font-size: 0.85em;
    color: #888;
    font-style: italic;
}

/* Preview Table */
.preview-table-container {
    max-height: 300px;
    overflow: auto;
    margin: 20px 0;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
}

.preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
}

.preview-table th,
.preview-table td {
    padding: 10px 15px;
    text-align: left;
    border-bottom: 1px solid #f0f0f0;
}

.preview-table th {
    background: #f8f9fa;
    font-weight: 600;
    color: #333;
    position: sticky;
    top: 0;
}

.preview-more {
    text-align: center;
    color: #666;
    font-size: 0.9em;
    padding: 10px;
}

/* Import States */
.import-loading,
.import-success,
.import-error {
    text-align: center;
    padding: 40px 20px;
}

.success-icon,
.error-icon {
    font-size: 3em;
    margin-bottom: 15px;
}

.import-warnings {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 10px;
    padding: 15px;
    margin-bottom: 15px;
}

.import-warnings p {
    margin: 5px 0;
    color: #856404;
    font-size: 0.9em;
}

/* Prospect Form */
.prospect-form-modal {
    max-width: 550px;
    width: 90%;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
    color: #333;
    font-size: 0.9em;
}

.form-group input,
.form-group textarea,
.form-group select {
    width: 100%;
    padding: 10px 12px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.95em;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
    outline: none;
    border-color: #667eea;
}

/* Modal Base */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
}

.modal {
    background: white;
    border-radius: 20px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 25px;
    border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
    margin: 0;
    font-size: 1.3em;
    color: #333;
}

.modal-close {
    background: none;
    border: none;
    font-size: 1.5em;
    cursor: pointer;
    color: #888;
    padding: 5px 10px;
}

.modal-close:hover {
    color: #333;
}

.modal-body {
    padding: 25px;
    overflow-y: auto;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
}

/* Buttons */
.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.95em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.btn-primary {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 15px rgba(102,126,234,0.4);
}

.btn-secondary {
    background: #f0f4ff;
    color: #667eea;
    border: 2px solid #e0e5ff;
}

.btn-secondary:hover {
    background: #e0e5ff;
}

.btn-linkedin {
    background: linear-gradient(135deg, #0077B5, #00A0DC);
    color: white;
    border: none;
}

.btn-linkedin:hover {
    background: linear-gradient(135deg, #005582, #0077B5);
    box-shadow: 0 4px 15px rgba(0,119,181,0.4);
}

.btn-danger {
    background: #ffebee;
    color: #c62828;
}

.btn-danger:hover {
    background: #ffcdd2;
}

.btn-small {
    padding: 6px 12px;
    font-size: 0.85em;
}

/* Spinner */
.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f0f0f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 768px) {
    .prospects-header {
        flex-direction: column;
    }

    .prospects-actions {
        width: 100%;
    }

    .prospects-actions .btn {
        flex: 1;
        justify-content: center;
    }

    .form-row {
        grid-template-columns: 1fr;
    }

    .search-box input {
        width: 100%;
    }
}

/* ==========================================
   EMAIL VERIFICATION STYLES
   ========================================== */

/* Verify Button */
.btn-verify {
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    border: none;
}

.btn-verify:hover {
    background: linear-gradient(135deg, #45a049, #3d8b40);
    box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
}

/* Verification Badges */
.verify-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 0.75em;
    cursor: help;
}

.verify-badge.verify-unverified {
    background: #f5f5f5;
}

.verify-badge.verify-valid {
    background: #e8f5e9;
}

.verify-badge.verify-risky,
.verify-badge.verify-catch-all {
    background: #fff3e0;
}

.verify-badge.verify-invalid,
.verify-badge.verify-disposable {
    background: #ffebee;
}

/* Verification Modal */
.verification-modal {
    max-width: 450px;
    width: 90%;
}

.verification-progress {
    margin: 20px 0;
}

.progress-bar {
    width: 100%;
    height: 20px;
    background: #e0e0e0;
    border-radius: 10px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(135deg, #4CAF50, #8BC34A);
    border-radius: 10px;
    transition: width 0.3s ease;
}

.progress-text {
    margin-top: 10px;
    font-weight: 600;
    color: #333;
}

/* Verification Summary */
.verification-summary {
    text-align: center;
}

.verification-summary .summary-icon {
    font-size: 3em;
    margin-bottom: 10px;
}

.verification-results {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin: 20px 0;
    flex-wrap: wrap;
}

.result-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 15px 20px;
    border-radius: 12px;
    min-width: 80px;
}

.result-item.valid {
    background: #e8f5e9;
}

.result-item.risky {
    background: #fff3e0;
}

.result-item.invalid {
    background: #ffebee;
}

.result-icon {
    font-size: 1.5em;
    margin-bottom: 5px;
}

.result-label {
    font-size: 0.8em;
    color: #666;
}

.result-count {
    font-size: 1.5em;
    font-weight: 700;
    color: #333;
}

.verification-warning {
    background: #fff3cd;
    border: 1px solid #ffc107;
    border-radius: 10px;
    padding: 15px;
    margin-top: 15px;
    font-size: 0.9em;
    color: #856404;
}
`;
document.head.appendChild(prospectsStyles);
