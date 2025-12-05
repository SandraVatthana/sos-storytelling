// ===========================================
// campaigns-module-v2.js - Module Campagnes Email avec Sequences
// SOS Storytelling - J+0, J+3, J+7 automatises
// ===========================================

const CampaignsModule = {
    // State
    campaigns: [],
    currentCampaign: null,
    selectedProspects: [],
    sequenceEmails: [], // [{position, delay_days, subject_template, body_template}]
    generatedPreviews: [],
    previewIndex: 0,

    // API URL
    API_URL: 'https://sos-storytelling-api.sandra-devonssay.workers.dev',

    /**
     * Initialise le module
     */
    async init() {
        await this.loadCampaigns();
    },

    /**
     * Charge les campagnes depuis Supabase
     */
    async loadCampaigns() {
        if (!window.supabase) return;

        try {
            const { data: { user } } = await window.supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await window.supabase
                .from('email_campaigns')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.campaigns = data || [];

        } catch (error) {
            console.error('Error loading campaigns:', error);
        }
    },

    /**
     * Obtient le token d'auth
     */
    async getAuthToken() {
        const { data: { session } } = await window.supabase.auth.getSession();
        return session?.access_token;
    },

    // ==========================================
    // UI - PAGE PRINCIPALE
    // ==========================================

    createCampaignsPage() {
        const container = document.createElement('div');
        container.className = 'campaigns-page';
        container.innerHTML = `
            <div class="campaigns-header">
                <div class="campaigns-title-section">
                    <h2>📧 Mes Campagnes Email</h2>
                    <p>Crée et gère tes séquences d'emails automatisées</p>
                </div>
                <div class="campaigns-actions">
                    <button class="btn btn-primary" onclick="CampaignsModule.openNewCampaignWizard()">
                        <span class="btn-icon">+</span> Nouvelle campagne
                    </button>
                </div>
            </div>

            <div class="campaigns-list" id="campaignsList"></div>
        `;

        return container;
    },

    renderCampaignsList() {
        const container = document.getElementById('campaignsList');
        if (!container) return;

        if (this.campaigns.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📧</div>
                    <p>Aucune campagne pour le moment</p>
                    <button class="btn btn-primary" onclick="CampaignsModule.openNewCampaignWizard()">
                        Nouvelle campagne
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.campaigns.map(c => `
            <div class="campaign-card ${c.status}" data-id="${c.id}">
                <div class="campaign-info">
                    <div class="campaign-name">
                        <strong>${c.name}</strong>
                        <span class="campaign-status status-${c.status}">${this.getStatusLabel(c.status)}</span>
                    </div>
                    <div class="campaign-meta">
                        <span>${c.total_prospects || 0} prospects</span>
                        <span>•</span>
                        <span>${new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="campaign-stats">
                    <div class="stat">
                        <span class="stat-value">${c.emails_sent || 0}</span>
                        <span class="stat-label">Envoyés</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${c.emails_opened || 0}</span>
                        <span class="stat-label">Ouverts</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${c.emails_replied || 0}</span>
                        <span class="stat-label">Réponses</span>
                    </div>
                </div>
                <div class="campaign-actions">
                    ${this.getCampaignActions(c)}
                </div>
            </div>
        `).join('');
    },

    getStatusLabel(status) {
        const labels = {
            draft: 'Brouillon',
            scheduled: 'Programme',
            sending: 'En cours',
            paused: 'En pause',
            sent: 'Termine',
            completed: 'Termine'
        };
        return labels[status] || status;
    },

    getCampaignActions(campaign) {
        switch (campaign.status) {
            case 'draft':
                return `
                    <button class="btn btn-primary btn-small" onclick="CampaignsModule.openEditWizard('${campaign.id}')">
                        Configurer
                    </button>
                    <button class="btn btn-small btn-danger" onclick="CampaignsModule.confirmDelete('${campaign.id}')">
                        Supprimer
                    </button>
                `;
            case 'sending':
                return `
                    <button class="btn btn-small" onclick="CampaignsModule.viewCampaignDetails('${campaign.id}')">
                        Voir details
                    </button>
                    <button class="btn btn-small btn-warning" onclick="CampaignsModule.pauseCampaign('${campaign.id}')">
                        Pause
                    </button>
                `;
            case 'paused':
                return `
                    <button class="btn btn-small btn-primary" onclick="CampaignsModule.resumeCampaign('${campaign.id}')">
                        Reprendre
                    </button>
                    <button class="btn btn-small" onclick="CampaignsModule.viewCampaignDetails('${campaign.id}')">
                        Voir details
                    </button>
                `;
            default:
                return `
                    <button class="btn btn-small" onclick="CampaignsModule.viewCampaignDetails('${campaign.id}')">
                        Voir details
                    </button>
                `;
        }
    },

    // ==========================================
    // WIZARD - NOUVELLE CAMPAGNE
    // ==========================================

    openNewCampaignWizard() {
        this.currentCampaign = null;
        this.selectedProspects = [];
        this.sequenceEmails = [
            { position: 1, delay_days: 0, subject_template: '', body_template: '', send_condition: 'always' }
        ];
        this.generatedPreviews = [];
        this.previewIndex = 0;
        this.currentStep = 1;
        this.openWizardModal();
    },

    openEditWizard(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        this.currentCampaign = campaign;
        this.selectedProspects = [];
        this.sequenceEmails = [];
        this.currentStep = 1;
        this.loadCampaignSequence(campaignId);
        this.openWizardModal();
    },

    async loadCampaignSequence(campaignId) {
        try {
            const token = await this.getAuthToken();
            const response = await fetch(`${this.API_URL}/api/campaigns/${campaignId}/sequence`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.sequence && data.sequence.length > 0) {
                this.sequenceEmails = data.sequence;
            } else {
                this.sequenceEmails = [
                    { position: 1, delay_days: 0, subject_template: '', body_template: '', send_condition: 'always' }
                ];
            }
        } catch (e) {
            console.error('Error loading sequence:', e);
        }
    },

    openWizardModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'campaignWizard';
        modal.innerHTML = `
            <div class="modal campaign-wizard-modal">
                <div class="wizard-steps" id="wizardSteps">
                    ${this.renderWizardSteps()}
                </div>
                <button class="modal-close" onclick="CampaignsModule.closeWizard()">&times;</button>
                <div class="wizard-content" id="wizardContent">
                    ${this.renderCurrentStep()}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    renderWizardSteps() {
        const steps = [
            { num: 1, label: 'Campagne' },
            { num: 2, label: 'Prospects' },
            { num: 3, label: 'Sequence' },
            { num: 4, label: 'Lancement' }
        ];

        return steps.map(s => `
            <div class="wizard-step ${this.currentStep === s.num ? 'active' : ''} ${this.currentStep > s.num ? 'completed' : ''}" data-step="${s.num}">
                <span class="step-number">${this.currentStep > s.num ? '✓' : s.num}</span>
                <span class="step-label">${s.label}</span>
            </div>
        `).join('');
    },

    renderCurrentStep() {
        switch (this.currentStep) {
            case 1: return this.renderStep1();
            case 2: return this.renderStep2();
            case 3: return this.renderStep3();
            case 4: return this.renderStep4();
            default: return '';
        }
    },

    updateWizard() {
        document.getElementById('wizardSteps').innerHTML = this.renderWizardSteps();
        document.getElementById('wizardContent').innerHTML = this.renderCurrentStep();
    },

    closeWizard() {
        const modal = document.getElementById('campaignWizard');
        if (modal) modal.remove();
        this.currentCampaign = null;
        this.sequenceEmails = [];
        this.selectedProspects = [];
    },

    // ==========================================
    // STEP 1: INFOS CAMPAGNE
    // ==========================================

    renderStep1() {
        const c = this.currentCampaign || {};

        return `
            <div class="wizard-step-content">
                <h3>📧 Informations de la campagne</h3>

                <div class="form-group">
                    <label>Nom de la campagne *</label>
                    <input type="text" id="campaignName" value="${c.name || ''}"
                           placeholder="Ex: Prospection agences Q1 2025">
                </div>

                <div class="form-group">
                    <label>Objectif de la campagne *</label>
                    <textarea id="campaignGoal" rows="3"
                              placeholder="Ex: Presenter mes services de storytelling aux agences marketing pour obtenir des RDV">${c.goal || ''}</textarea>
                    <p class="field-hint">L'IA utilisera cet objectif pour personnaliser les emails</p>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Email expediteur *</label>
                        <input type="email" id="senderEmail" value="${c.sender_email || ''}"
                               placeholder="vous@votredomaine.com">
                    </div>
                    <div class="form-group">
                        <label>Nom expediteur *</label>
                        <input type="text" id="senderName" value="${c.sender_name || ''}"
                               placeholder="Votre prenom et nom">
                    </div>
                </div>

                <div class="form-group">
                    <label>Langue des emails</label>
                    <select id="campaignLanguage">
                        <option value="fr" ${(c.language || 'fr') === 'fr' ? 'selected' : ''}>Francais</option>
                        <option value="en" ${c.language === 'en' ? 'selected' : ''}>English</option>
                    </select>
                </div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.closeWizard()">
                        Annuler
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveStep1()">
                        Continuer →
                    </button>
                </div>
            </div>
        `;
    },

    async saveStep1() {
        const name = document.getElementById('campaignName').value.trim();
        const goal = document.getElementById('campaignGoal').value.trim();
        const senderEmail = document.getElementById('senderEmail').value.trim();
        const senderName = document.getElementById('senderName').value.trim();
        const language = document.getElementById('campaignLanguage').value;

        if (!name || !goal || !senderEmail || !senderName) {
            alert('Tous les champs marques * sont obligatoires');
            return;
        }

        try {
            const campaignData = {
                name, goal,
                sender_email: senderEmail,
                sender_name: senderName,
                language
            };

            const token = await this.getAuthToken();

            if (this.currentCampaign) {
                // Update
                const response = await fetch(`${this.API_URL}/api/campaigns/${this.currentCampaign.id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(campaignData)
                });
                const data = await response.json();
                this.currentCampaign = data.campaign;
            } else {
                // Create
                const response = await fetch(`${this.API_URL}/api/campaigns`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(campaignData)
                });
                const data = await response.json();
                this.currentCampaign = data.campaign;
            }

            this.currentStep = 2;
            this.updateWizard();

        } catch (error) {
            console.error('Error saving campaign:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    // ==========================================
    // STEP 2: SELECTION PROSPECTS
    // ==========================================

    renderStep2() {
        const prospects = ProspectsModule?.prospects || [];
        const stats = ProspectsModule?.getStats() || { total: 0, new: 0 };

        return `
            <div class="wizard-step-content">
                <h3>👥 Selectionner les prospects</h3>

                <div class="prospect-filter-options">
                    <label class="radio-card">
                        <input type="radio" name="prospectFilter" value="all" checked>
                        <div class="radio-content">
                            <strong>Tous les prospects</strong>
                            <span class="count">${stats.total}</span>
                        </div>
                    </label>
                    <label class="radio-card">
                        <input type="radio" name="prospectFilter" value="new">
                        <div class="radio-content">
                            <strong>Nouveaux uniquement</strong>
                            <span class="count">${stats.new}</span>
                        </div>
                    </label>
                </div>

                ${prospects.length === 0 ? `
                    <div class="warning-box">
                        <p>⚠️ Aucun prospect importe. <a href="#" onclick="document.querySelector('[data-tab=prospects]').click()">Importer des prospects</a> d'abord.</p>
                    </div>
                ` : `
                    <div class="selected-prospects-preview">
                        <h4>Apercu des prospects</h4>
                        <div class="prospects-mini-list">
                            ${prospects.slice(0, 5).map(p => `
                                <div class="prospect-mini">
                                    <strong>${p.first_name} ${p.last_name || ''}</strong>
                                    <span>${p.company || p.email}</span>
                                </div>
                            `).join('')}
                            ${prospects.length > 5 ? `<p class="more">+ ${prospects.length - 5} autres...</p>` : ''}
                        </div>
                    </div>
                `}

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(1)">
                        ← Retour
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveStep2()" ${prospects.length === 0 ? 'disabled' : ''}>
                        Continuer →
                    </button>
                </div>
            </div>
        `;
    },

    async saveStep2() {
        const filter = document.querySelector('input[name="prospectFilter"]:checked').value;
        let prospects = ProspectsModule?.prospects || [];

        if (filter === 'new') {
            prospects = prospects.filter(p => p.status === 'new');
        }

        if (prospects.length === 0) {
            alert('Aucun prospect a contacter');
            return;
        }

        this.selectedProspects = prospects;

        // Mettre a jour la campagne
        const token = await this.getAuthToken();
        await fetch(`${this.API_URL}/api/campaigns/${this.currentCampaign.id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                total_prospects: prospects.length,
                prospect_filter: { status: filter }
            })
        });

        this.currentStep = 3;
        this.updateWizard();
    },

    goToStep(step) {
        this.currentStep = step;
        this.updateWizard();
    },

    // ==========================================
    // STEP 3: SEQUENCE D'EMAILS
    // ==========================================

    renderStep3() {
        return `
            <div class="wizard-step-content">
                <h3>📝 Creer la sequence d'emails</h3>
                <p class="step-description">Definissez les emails de votre sequence. L'IA peut generer le contenu ou vous pouvez l'ecrire vous-meme.</p>

                <div class="sequence-emails" id="sequenceEmails">
                    ${this.sequenceEmails.map((email, index) => this.renderSequenceEmail(email, index)).join('')}
                </div>

                ${this.sequenceEmails.length < 5 ? `
                    <button class="btn btn-secondary btn-add-email" onclick="CampaignsModule.addSequenceEmail()">
                        + Ajouter un email de relance
                    </button>
                ` : ''}

                <div class="sequence-tips">
                    <p>💡 <strong>Conseil :</strong> 3 emails max dans une sequence, au-dela ca devient du spam.</p>
                    <p>💡 Les relances ne sont envoyees que si le prospect n'a pas repondu.</p>
                </div>

                <div class="ai-generation-box">
                    <h4>🤖 Generation IA</h4>
                    <p>L'IA peut generer une sequence complete basee sur votre objectif</p>
                    <button class="btn btn-secondary" onclick="CampaignsModule.generateSequenceWithAI()">
                        Generer avec l'IA
                    </button>
                </div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(2)">
                        ← Retour
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveStep3()">
                        Continuer →
                    </button>
                </div>
            </div>
        `;
    },

    renderSequenceEmail(email, index) {
        const isFirst = index === 0;
        const position = index + 1;
        const delayOptions = [0, 1, 2, 3, 4, 5, 7, 10, 14];

        return `
            <div class="sequence-email-card" data-index="${index}">
                <div class="sequence-email-header">
                    <span class="email-badge">Email ${position}</span>
                    <span class="email-timing">
                        ${isFirst ? 'Envoi immediat (J+0)' : `
                            <select class="delay-select" onchange="CampaignsModule.updateEmailDelay(${index}, this.value)">
                                ${delayOptions.map(d => `
                                    <option value="${d}" ${email.delay_days === d ? 'selected' : ''}>
                                        J+${d} ${d === 0 ? '(immediat)' : `(${d} jour${d > 1 ? 's' : ''} apres)`}
                                    </option>
                                `).join('')}
                            </select>
                        `}
                    </span>
                    ${!isFirst ? `
                        <button class="btn-remove-email" onclick="CampaignsModule.removeSequenceEmail(${index})">
                            🗑️
                        </button>
                    ` : ''}
                </div>

                ${!isFirst ? `
                    <div class="send-condition">
                        <label>Condition d'envoi :</label>
                        <select onchange="CampaignsModule.updateEmailCondition(${index}, this.value)">
                            <option value="no_reply" ${email.send_condition === 'no_reply' ? 'selected' : ''}>Si pas de reponse</option>
                            <option value="no_open" ${email.send_condition === 'no_open' ? 'selected' : ''}>Si pas d'ouverture</option>
                            <option value="always" ${email.send_condition === 'always' ? 'selected' : ''}>Toujours envoyer</option>
                        </select>
                    </div>
                ` : ''}

                <div class="form-group">
                    <label>Objet</label>
                    <input type="text" class="email-subject" value="${email.subject_template || ''}"
                           placeholder="${isFirst ? 'Ex: Une idee pour {company} ?' : 'Ex: Re: Une idee pour {company} ?'}"
                           onchange="CampaignsModule.updateEmailSubject(${index}, this.value)">
                </div>

                <div class="form-group">
                    <label>Corps de l'email</label>
                    <textarea class="email-body" rows="6"
                              placeholder="Hello {first_name},

${isFirst ? 'Votre premier message de contact...' : 'Votre message de relance...'}"
                              onchange="CampaignsModule.updateEmailBody(${index}, this.value)">${email.body_template || ''}</textarea>
                    <p class="field-hint">Variables : {first_name}, {last_name}, {company}, {job_title}</p>
                </div>
            </div>
        `;
    },

    addSequenceEmail() {
        const lastEmail = this.sequenceEmails[this.sequenceEmails.length - 1];
        const newDelay = (lastEmail?.delay_days || 0) + 3;

        this.sequenceEmails.push({
            position: this.sequenceEmails.length + 1,
            delay_days: newDelay,
            subject_template: '',
            body_template: '',
            send_condition: 'no_reply'
        });

        document.getElementById('sequenceEmails').innerHTML =
            this.sequenceEmails.map((email, index) => this.renderSequenceEmail(email, index)).join('');
    },

    removeSequenceEmail(index) {
        if (index === 0) return;
        this.sequenceEmails.splice(index, 1);
        this.sequenceEmails.forEach((e, i) => e.position = i + 1);
        document.getElementById('sequenceEmails').innerHTML =
            this.sequenceEmails.map((email, i) => this.renderSequenceEmail(email, i)).join('');
    },

    updateEmailDelay(index, value) {
        this.sequenceEmails[index].delay_days = parseInt(value);
    },

    updateEmailCondition(index, value) {
        this.sequenceEmails[index].send_condition = value;
    },

    updateEmailSubject(index, value) {
        this.sequenceEmails[index].subject_template = value;
    },

    updateEmailBody(index, value) {
        this.sequenceEmails[index].body_template = value;
    },

    async generateSequenceWithAI() {
        const content = document.getElementById('wizardContent');
        const originalContent = content.innerHTML;

        content.innerHTML = `
            <div class="generating-state">
                <div class="spinner"></div>
                <p>Generation de la sequence en cours...</p>
            </div>
        `;

        try {
            const token = await this.getAuthToken();
            const response = await fetch(`${this.API_URL}/api/campaigns/${this.currentCampaign.id}/sequence/generate`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    num_emails: 3,
                    delays: [0, 3, 7]
                })
            });

            const data = await response.json();

            if (data.generated_emails) {
                this.sequenceEmails = data.generated_emails;
            }

            this.updateWizard();

        } catch (error) {
            console.error('Error generating sequence:', error);
            content.innerHTML = originalContent;
            alert('Erreur lors de la generation');
        }
    },

    async saveStep3() {
        // Valider qu'au moins le premier email est rempli
        const firstEmail = this.sequenceEmails[0];
        if (!firstEmail.subject_template || !firstEmail.body_template) {
            alert('Veuillez remplir au moins le premier email de la sequence');
            return;
        }

        try {
            const token = await this.getAuthToken();
            await fetch(`${this.API_URL}/api/campaigns/${this.currentCampaign.id}/sequence`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ emails: this.sequenceEmails })
            });

            // Generer les previews
            this.generatedPreviews = this.selectedProspects.slice(0, 5).map(prospect => ({
                prospect,
                emails: this.sequenceEmails.map(seq => ({
                    subject: this.personalizeTemplate(seq.subject_template, prospect),
                    body: this.personalizeTemplate(seq.body_template, prospect),
                    delay_days: seq.delay_days
                }))
            }));

            this.currentStep = 4;
            this.updateWizard();

        } catch (error) {
            console.error('Error saving sequence:', error);
            alert('Erreur lors de la sauvegarde');
        }
    },

    personalizeTemplate(template, prospect) {
        if (!template) return '';
        return template
            .replace(/{first_name}/g, prospect.first_name || '')
            .replace(/{last_name}/g, prospect.last_name || '')
            .replace(/{company}/g, prospect.company || 'ton entreprise')
            .replace(/{job_title}/g, prospect.job_title || '');
    },

    // ==========================================
    // STEP 4: PREVIEW & LANCEMENT
    // ==========================================

    renderStep4() {
        const preview = this.generatedPreviews[this.previewIndex];
        if (!preview) {
            return `
                <div class="wizard-step-content">
                    <p>Aucun apercu disponible</p>
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(3)">← Retour</button>
                </div>
            `;
        }

        const prospect = preview.prospect;
        const c = this.currentCampaign;

        return `
            <div class="wizard-step-content">
                <h3>👀 Apercu et lancement</h3>

                <div class="preview-navigation">
                    <span>Apercu pour : <strong>${prospect.first_name}</strong> (${prospect.company || prospect.email})</span>
                    <div class="preview-nav-buttons">
                        <button class="btn btn-small" onclick="CampaignsModule.prevPreview()" ${this.previewIndex === 0 ? 'disabled' : ''}>←</button>
                        <span>${this.previewIndex + 1} / ${this.generatedPreviews.length}</span>
                        <button class="btn btn-small" onclick="CampaignsModule.nextPreview()" ${this.previewIndex >= this.generatedPreviews.length - 1 ? 'disabled' : ''}>→</button>
                    </div>
                </div>

                <div class="sequence-preview">
                    ${preview.emails.map((email, i) => `
                        <div class="email-preview-card ${i > 0 ? 'follow-up' : ''}">
                            <div class="email-preview-badge">
                                Email ${i + 1} ${i === 0 ? '(J+0)' : `(J+${email.delay_days})`}
                            </div>
                            <div class="email-preview-header">
                                <div class="preview-field">
                                    <span class="label">De:</span> ${c.sender_name} &lt;${c.sender_email}&gt;
                                </div>
                                <div class="preview-field">
                                    <span class="label">A:</span> ${prospect.first_name} &lt;${prospect.email}&gt;
                                </div>
                                <div class="preview-field">
                                    <span class="label">Objet:</span> ${email.subject}
                                </div>
                            </div>
                            <div class="email-preview-body">
                                ${email.body.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="launch-options">
                    <h4>⏰ Options de lancement</h4>

                    <div class="option-group">
                        <label class="radio-option">
                            <input type="radio" name="launchTime" value="now" checked>
                            <span>Envoyer maintenant</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="launchTime" value="scheduled">
                            <span>Programmer l'envoi</span>
                        </label>
                    </div>

                    <div class="scheduled-options" id="scheduledOptions" style="display:none;">
                        <div class="form-row">
                            <div class="form-group">
                                <label>Date</label>
                                <input type="date" id="scheduledDate" min="${new Date().toISOString().split('T')[0]}">
                            </div>
                            <div class="form-group">
                                <label>Heure</label>
                                <input type="time" id="scheduledTime" value="09:00">
                            </div>
                        </div>
                    </div>

                    <div class="sending-constraints">
                        <label class="checkbox-option">
                            <input type="checkbox" id="weekdaysOnly" checked>
                            <span>Envoyer uniquement en semaine (lun-ven)</span>
                        </label>
                        <label class="checkbox-option">
                            <input type="checkbox" id="businessHours" checked>
                            <span>Envoyer uniquement entre 9h et 18h</span>
                        </label>
                    </div>
                </div>

                <div class="campaign-summary">
                    <h4>📊 Recapitulatif</h4>
                    <ul>
                        <li><strong>${this.selectedProspects.length}</strong> prospects</li>
                        <li><strong>${this.sequenceEmails.length}</strong> email(s) dans la sequence</li>
                        <li>Delais : ${this.sequenceEmails.map((e, i) => `J+${e.delay_days}`).join(', ')}</li>
                    </ul>
                </div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(3)">
                        ← Retour
                    </button>
                    <button class="btn btn-primary btn-launch" onclick="CampaignsModule.launchCampaign()">
                        🚀 Lancer la campagne
                    </button>
                </div>
            </div>
        `;
    },

    prevPreview() {
        if (this.previewIndex > 0) {
            this.previewIndex--;
            this.updateWizard();
        }
    },

    nextPreview() {
        if (this.previewIndex < this.generatedPreviews.length - 1) {
            this.previewIndex++;
            this.updateWizard();
        }
    },

    async launchCampaign() {
        const launchTime = document.querySelector('input[name="launchTime"]:checked').value;
        const weekdaysOnly = document.getElementById('weekdaysOnly').checked;
        const businessHours = document.getElementById('businessHours').checked;

        let scheduled_at = null;
        if (launchTime === 'scheduled') {
            const date = document.getElementById('scheduledDate').value;
            const time = document.getElementById('scheduledTime').value;
            if (!date || !time) {
                alert('Veuillez selectionner une date et heure');
                return;
            }
            scheduled_at = new Date(`${date}T${time}`).toISOString();
        }

        const confirm = window.confirm(
            `Lancer la campagne "${this.currentCampaign.name}" ?\n\n` +
            `• ${this.selectedProspects.length} prospects\n` +
            `• ${this.sequenceEmails.length} email(s) dans la sequence\n` +
            `• ${scheduled_at ? 'Programmee pour ' + new Date(scheduled_at).toLocaleString() : 'Envoi immediat'}`
        );

        if (!confirm) return;

        const content = document.getElementById('wizardContent');
        content.innerHTML = `
            <div class="launching-state">
                <div class="spinner"></div>
                <p>Lancement de la campagne...</p>
            </div>
        `;

        try {
            const token = await this.getAuthToken();
            const response = await fetch(`${this.API_URL}/api/campaigns/${this.currentCampaign.id}/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prospect_ids: this.selectedProspects.map(p => p.id),
                    scheduled_at,
                    send_weekdays_only: weekdaysOnly,
                    send_hours_start: businessHours ? 9 : 0,
                    send_hours_end: businessHours ? 18 : 24
                })
            });

            const data = await response.json();

            if (data.success) {
                content.innerHTML = `
                    <div class="launch-success">
                        <div class="success-icon">🚀</div>
                        <h3>Campagne lancee !</h3>
                        <p>${data.prospects_count} prospects vont recevoir ${data.sequence_emails} email(s)</p>
                        ${scheduled_at ? `<p>Premier envoi prevu : ${new Date(data.first_send_at).toLocaleString()}</p>` : ''}
                        <button class="btn btn-primary" onclick="CampaignsModule.closeWizard(); CampaignsModule.loadCampaigns(); CampaignsModule.renderCampaignsList();">
                            Fermer
                        </button>
                    </div>
                `;
            } else {
                throw new Error(data.error || 'Erreur inconnue');
            }

        } catch (error) {
            console.error('Error launching campaign:', error);
            content.innerHTML = `
                <div class="launch-error">
                    <div class="error-icon">❌</div>
                    <h3>Erreur</h3>
                    <p>${error.message}</p>
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(4)">
                        Reessayer
                    </button>
                </div>
            `;
        }
    },

    // ==========================================
    // CAMPAIGN ACTIONS
    // ==========================================

    async pauseCampaign(campaignId) {
        if (!confirm('Mettre la campagne en pause ?')) return;

        try {
            const token = await this.getAuthToken();
            await fetch(`${this.API_URL}/api/campaigns/${campaignId}/pause`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            await this.loadCampaigns();
            this.renderCampaignsList();

        } catch (error) {
            console.error('Error pausing campaign:', error);
            alert('Erreur');
        }
    },

    async resumeCampaign(campaignId) {
        if (!confirm('Reprendre la campagne ?')) return;

        try {
            const token = await this.getAuthToken();
            await fetch(`${this.API_URL}/api/campaigns/${campaignId}/resume`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            await this.loadCampaigns();
            this.renderCampaignsList();

        } catch (error) {
            console.error('Error resuming campaign:', error);
            alert('Erreur');
        }
    },

    async viewCampaignDetails(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        // Charger les prospects de la campagne
        let prospectStats = [];
        try {
            const token = await this.getAuthToken();
            const response = await fetch(`${this.API_URL}/api/campaigns/${campaignId}/prospects`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            prospectStats = data.prospects || [];
        } catch (e) {
            console.error('Error loading prospect stats:', e);
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'campaignDetailsModal';
        modal.innerHTML = `
            <div class="modal campaign-details-modal">
                <div class="modal-header">
                    <h3>📊 ${campaign.name}</h3>
                    <button class="modal-close" onclick="document.getElementById('campaignDetailsModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="campaign-status-banner status-${campaign.status}">
                        ${this.getStatusLabel(campaign.status)}
                    </div>

                    <div class="stats-overview">
                        <div class="stat-box">
                            <span class="stat-number">${campaign.total_prospects || 0}</span>
                            <span class="stat-label">Prospects</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-number">${campaign.emails_sent || 0}</span>
                            <span class="stat-label">Envoyés</span>
                        </div>
                        <div class="stat-box highlight-open">
                            <span class="stat-number">${campaign.emails_opened || 0}</span>
                            <span class="stat-label">Ouverts</span>
                            <span class="stat-percent">${campaign.emails_sent ? Math.round((campaign.emails_opened / campaign.emails_sent) * 100) : 0}%</span>
                        </div>
                        <div class="stat-box highlight-click">
                            <span class="stat-number">${campaign.emails_clicked || 0}</span>
                            <span class="stat-label">Cliqués</span>
                            <span class="stat-percent">${campaign.emails_sent ? Math.round((campaign.emails_clicked / campaign.emails_sent) * 100) : 0}%</span>
                        </div>
                        <div class="stat-box highlight-reply">
                            <span class="stat-number">${campaign.emails_replied || 0}</span>
                            <span class="stat-label">Réponses</span>
                            <span class="stat-percent">${campaign.emails_sent ? Math.round((campaign.emails_replied / campaign.emails_sent) * 100) : 0}%</span>
                        </div>
                    </div>

                    <div class="sequence-progress">
                        <h4>📈 Progression de la séquence</h4>
                        ${this.renderSequenceProgress(campaign)}
                    </div>

                    <div class="prospects-status-list">
                        <h4>👥 Statut des prospects (${prospectStats.length})</h4>
                        <div class="prospects-filter-bar">
                            <input type="text" placeholder="Rechercher..." onkeyup="CampaignsModule.filterProspectsList(this.value)">
                            <select onchange="CampaignsModule.filterProspectsByStatus(this.value)">
                                <option value="all">Tous</option>
                                <option value="opened">Ouverts</option>
                                <option value="clicked">Cliqués</option>
                                <option value="replied">Répondu</option>
                                <option value="pending">En attente</option>
                            </select>
                        </div>
                        <div class="prospects-status-table" id="prospectsStatusTable">
                            ${this.renderProspectsStatusTable(prospectStats)}
                        </div>
                    </div>

                    <div class="campaign-actions-bar">
                        ${campaign.status === 'sending' ? `
                            <button class="btn btn-warning" onclick="CampaignsModule.pauseCampaign('${campaignId}'); document.getElementById('campaignDetailsModal').remove();">
                                ⏸️ Mettre en pause
                            </button>
                        ` : ''}
                        ${campaign.status === 'paused' ? `
                            <button class="btn btn-primary" onclick="CampaignsModule.resumeCampaign('${campaignId}'); document.getElementById('campaignDetailsModal').remove();">
                                ▶️ Reprendre
                            </button>
                        ` : ''}
                        <button class="btn btn-secondary" onclick="CampaignsModule.exportCampaignStats('${campaignId}')">
                            📤 Exporter CSV
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.currentDetailProspects = prospectStats;
    },

    renderSequenceProgress(campaign) {
        // Simuler la progression si pas de données détaillées
        const total = campaign.total_prospects || 0;
        const sent = campaign.emails_sent || 0;

        return `
            <div class="progress-bars">
                <div class="progress-item">
                    <span class="progress-label">Email 1 (J+0)</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${total ? (sent / total * 100) : 0}%"></div>
                    </div>
                    <span class="progress-count">${sent}/${total}</span>
                </div>
                <div class="progress-item">
                    <span class="progress-label">Email 2 (J+3)</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span class="progress-count">-/${total}</span>
                </div>
                <div class="progress-item">
                    <span class="progress-label">Email 3 (J+7)</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span class="progress-count">-/${total}</span>
                </div>
            </div>
        `;
    },

    renderProspectsStatusTable(prospects) {
        if (!prospects || prospects.length === 0) {
            return '<p class="empty-table">Aucun prospect dans cette campagne</p>';
        }

        return prospects.map(p => `
            <div class="prospect-status-row" data-status="${p.status || 'pending'}" data-name="${(p.first_name + ' ' + (p.last_name || '')).toLowerCase()}" data-email="${p.email?.toLowerCase() || ''}">
                <div class="prospect-info-col">
                    <strong>${p.first_name || ''} ${p.last_name || ''}</strong>
                    <span class="email">${p.email || ''}</span>
                </div>
                <div class="prospect-company-col">
                    ${p.company || '-'}
                </div>
                <div class="prospect-step-col">
                    <span class="step-badge">Email ${p.current_step || 1}</span>
                </div>
                <div class="prospect-status-col">
                    ${this.getProspectStatusBadges(p)}
                </div>
            </div>
        `).join('');
    },

    getProspectStatusBadges(prospect) {
        let badges = [];

        if (prospect.has_replied || prospect.status === 'replied') {
            badges.push('<span class="badge badge-replied">💬 Répondu</span>');
        } else if (prospect.total_clicked > 0 || prospect.status === 'clicked') {
            badges.push('<span class="badge badge-clicked">🖱️ Cliqué</span>');
        } else if (prospect.total_opened > 0 || prospect.status === 'opened') {
            badges.push('<span class="badge badge-opened">👁️ Ouvert</span>');
        } else if (prospect.total_sent > 0 || prospect.status === 'sent') {
            badges.push('<span class="badge badge-sent">📧 Envoyé</span>');
        } else {
            badges.push('<span class="badge badge-pending">⏳ En attente</span>');
        }

        return badges.join(' ');
    },

    filterProspectsList(query) {
        const rows = document.querySelectorAll('.prospect-status-row');
        const q = query.toLowerCase();

        rows.forEach(row => {
            const name = row.dataset.name || '';
            const email = row.dataset.email || '';
            row.style.display = (name.includes(q) || email.includes(q)) ? 'flex' : 'none';
        });
    },

    filterProspectsByStatus(status) {
        const rows = document.querySelectorAll('.prospect-status-row');

        rows.forEach(row => {
            if (status === 'all') {
                row.style.display = 'flex';
            } else {
                row.style.display = row.dataset.status === status ? 'flex' : 'none';
            }
        });
    },

    async exportCampaignStats(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        const prospects = this.currentDetailProspects || [];

        const csvContent = [
            ['Prénom', 'Nom', 'Email', 'Entreprise', 'Étape', 'Statut', 'Ouvertures', 'Clics'].join(';'),
            ...prospects.map(p => [
                p.first_name || '',
                p.last_name || '',
                p.email || '',
                p.company || '',
                p.current_step || 1,
                p.status || 'pending',
                p.total_opened || 0,
                p.total_clicked || 0
            ].join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `campagne-${campaign.name.replace(/\s+/g, '-')}-stats.csv`;
        link.click();
    },

    async confirmDelete(campaignId) {
        if (!confirm('Supprimer cette campagne ?')) return;

        try {
            const token = await this.getAuthToken();
            await fetch(`${this.API_URL}/api/campaigns/${campaignId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            await this.loadCampaigns();
            this.renderCampaignsList();

        } catch (error) {
            console.error('Error deleting campaign:', error);
            alert('Erreur');
        }
    }
};

// Exposer globalement
window.CampaignsModule = CampaignsModule;

// Event listener pour le toggle scheduled/now
document.addEventListener('change', (e) => {
    if (e.target.name === 'launchTime') {
        const scheduledOptions = document.getElementById('scheduledOptions');
        if (scheduledOptions) {
            scheduledOptions.style.display = e.target.value === 'scheduled' ? 'block' : 'none';
        }
    }
});

// CSS additionnel pour les campagnes et sequences
const sequenceStyles = document.createElement('style');
sequenceStyles.textContent = `
/* Campaigns Page */
.campaigns-page {
    padding: 20px;
    max-width: 1000px;
    margin: 0 auto;
}

.campaigns-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 15px;
}

.campaigns-title-section h2 {
    margin: 0 0 5px;
    color: #333;
}

.campaigns-title-section p {
    margin: 0;
    color: #666;
    font-size: 0.95em;
}

/* Campaign Cards */
.campaigns-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.campaign-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 15px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    transition: box-shadow 0.2s;
}

.campaign-card:hover {
    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.campaign-card.sending {
    border-left: 4px solid #11998e;
}

.campaign-card.paused {
    border-left: 4px solid #f5a623;
}

.campaign-card.completed, .campaign-card.sent {
    border-left: 4px solid #4caf50;
}

.campaign-info {
    flex: 1;
    min-width: 200px;
}

.campaign-name {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 5px;
}

.campaign-name strong {
    font-size: 1.1em;
}

.campaign-status {
    font-size: 0.75em;
    padding: 3px 10px;
    border-radius: 20px;
    font-weight: 600;
}

.status-draft { background: #f0f0f0; color: #666; }
.status-scheduled { background: #e3f2fd; color: #1976d2; }
.status-sending { background: #e8f5e9; color: #2e7d32; }
.status-paused { background: #fff3e0; color: #f57c00; }
.status-sent, .status-completed { background: #e8f5e9; color: #388e3c; }

.campaign-meta {
    font-size: 0.9em;
    color: #888;
}

.campaign-stats {
    display: flex;
    gap: 20px;
}

.campaign-stats .stat {
    text-align: center;
}

.campaign-stats .stat-value {
    display: block;
    font-size: 1.3em;
    font-weight: bold;
    color: #333;
}

.campaign-stats .stat-label {
    font-size: 0.8em;
    color: #888;
}

.campaign-actions {
    display: flex;
    gap: 10px;
}

/* Wizard Modal */
.campaign-wizard-modal {
    width: 95%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
}

.wizard-steps {
    display: flex;
    justify-content: space-between;
    padding: 20px 30px;
    background: #f8f9fa;
    border-bottom: 1px solid #e0e0e0;
    position: relative;
}

.wizard-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    flex: 1;
    position: relative;
    z-index: 1;
}

.wizard-step::after {
    content: '';
    position: absolute;
    top: 15px;
    left: 50%;
    width: 100%;
    height: 2px;
    background: #e0e0e0;
    z-index: -1;
}

.wizard-step:last-child::after {
    display: none;
}

.wizard-step.completed::after {
    background: linear-gradient(135deg, #667eea, #764ba2);
}

.step-number {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 0.9em;
    color: #666;
}

.wizard-step.active .step-number {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.wizard-step.completed .step-number {
    background: #4caf50;
    color: white;
}

.step-label {
    font-size: 0.85em;
    color: #666;
}

.wizard-step.active .step-label {
    color: #667eea;
    font-weight: 600;
}

.wizard-content {
    flex: 1;
    overflow-y: auto;
    padding: 30px;
}

.wizard-step-content h3 {
    margin: 0 0 20px;
    color: #333;
}

.step-description {
    color: #666;
    margin-bottom: 25px;
}

.wizard-actions {
    display: flex;
    justify-content: space-between;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
}

/* Prospect Selection */
.prospect-filter-options {
    display: flex;
    gap: 15px;
    margin-bottom: 25px;
    flex-wrap: wrap;
}

.radio-card {
    flex: 1;
    min-width: 180px;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    padding: 15px;
    cursor: pointer;
    transition: all 0.2s;
}

.radio-card:has(input:checked) {
    border-color: #667eea;
    background: #f0f4ff;
}

.radio-card input {
    display: none;
}

.radio-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.radio-content .count {
    background: #667eea;
    color: white;
    padding: 2px 10px;
    border-radius: 15px;
    font-size: 0.85em;
}

.selected-prospects-preview {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 20px;
}

.selected-prospects-preview h4 {
    margin: 0 0 15px;
    color: #333;
}

.prospects-mini-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.prospect-mini {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    background: white;
    border-radius: 8px;
}

.prospect-mini span {
    color: #666;
    font-size: 0.9em;
}

.prospects-mini-list .more {
    text-align: center;
    color: #888;
    font-style: italic;
    margin: 10px 0 0;
}

/* Preview Navigation */
.preview-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background: #f0f4ff;
    border-radius: 10px;
    margin-bottom: 20px;
}

.preview-nav-buttons {
    display: flex;
    align-items: center;
    gap: 10px;
}

.preview-nav-buttons button {
    width: 36px;
    height: 36px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Empty state */
.empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #666;
}

.empty-state .empty-icon {
    font-size: 4em;
    margin-bottom: 20px;
}

.generating-state {
    text-align: center;
    padding: 50px 20px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e0e0e0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Field hint */
.field-hint {
    font-size: 0.85em;
    color: #888;
    margin-top: 5px;
}

/* Sequence Emails */
.sequence-emails {
    display: flex;
    flex-direction: column;
    gap: 20px;
    margin-bottom: 20px;
}

.sequence-email-card {
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 15px;
    padding: 20px;
    position: relative;
}

.sequence-email-card:not(:first-child)::before {
    content: '';
    position: absolute;
    top: -20px;
    left: 30px;
    width: 2px;
    height: 20px;
    background: linear-gradient(to bottom, #667eea, #764ba2);
}

.sequence-email-header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 15px;
    padding-bottom: 15px;
    border-bottom: 1px solid #f0f0f0;
}

.email-badge {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: 600;
}

.email-timing {
    flex: 1;
    color: #666;
    font-size: 0.9em;
}

.delay-select {
    padding: 5px 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    font-family: inherit;
}

.btn-remove-email {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2em;
    opacity: 0.5;
}

.btn-remove-email:hover {
    opacity: 1;
}

.send-condition {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
    font-size: 0.9em;
}

.send-condition select {
    padding: 5px 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
    font-family: inherit;
}

.btn-add-email {
    margin-bottom: 20px;
}

.sequence-tips {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 10px;
    margin-bottom: 20px;
}

.sequence-tips p {
    margin: 5px 0;
    font-size: 0.9em;
    color: #666;
}

.ai-generation-box {
    background: linear-gradient(135deg, #f0f4ff, #e8ecff);
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    margin-bottom: 20px;
}

.ai-generation-box h4 {
    margin: 0 0 10px;
    color: #333;
}

.ai-generation-box p {
    margin: 0 0 15px;
    color: #666;
    font-size: 0.9em;
}

/* Preview */
.sequence-preview {
    display: flex;
    flex-direction: column;
    gap: 15px;
    margin-bottom: 25px;
}

.email-preview-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    overflow: hidden;
}

.email-preview-card.follow-up {
    margin-left: 30px;
    border-left: 3px solid #667eea;
}

.email-preview-badge {
    background: #f8f9fa;
    padding: 8px 15px;
    font-size: 0.85em;
    font-weight: 600;
    color: #667eea;
    border-bottom: 1px solid #e0e0e0;
}

.email-preview-header {
    padding: 15px;
    background: #fafafa;
    font-size: 0.9em;
}

.preview-field {
    margin-bottom: 5px;
}

.preview-field .label {
    font-weight: 600;
    color: #666;
}

.email-preview-body {
    padding: 20px;
    line-height: 1.7;
}

/* Launch Options */
.launch-options {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 12px;
    margin-bottom: 20px;
}

.launch-options h4 {
    margin: 0 0 15px;
}

.option-group {
    display: flex;
    gap: 20px;
    margin-bottom: 15px;
}

.radio-option, .checkbox-option {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.scheduled-options {
    background: white;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 15px;
}

.sending-constraints {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.campaign-summary {
    background: #e8f5e9;
    padding: 15px 20px;
    border-radius: 10px;
    margin-bottom: 20px;
}

.campaign-summary h4 {
    margin: 0 0 10px;
    color: #2e7d32;
}

.campaign-summary ul {
    margin: 0;
    padding-left: 20px;
}

.campaign-summary li {
    margin: 5px 0;
    color: #333;
}

.btn-launch {
    background: linear-gradient(135deg, #11998e, #38ef7d) !important;
}

/* States */
.launching-state, .launch-success, .launch-error {
    text-align: center;
    padding: 60px 20px;
}

.launch-success .success-icon, .launch-error .error-icon {
    font-size: 4em;
    margin-bottom: 20px;
}

.warning-box {
    background: #fff3cd;
    border: 1px solid #ffc107;
    padding: 15px;
    border-radius: 10px;
    margin-bottom: 20px;
}

.warning-box p {
    margin: 0;
    color: #856404;
}

/* Campaign Details Modal */
.campaign-details-modal {
    width: 95%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
}

.campaign-details-modal .modal-body {
    overflow-y: auto;
    padding: 25px;
}

.campaign-status-banner {
    text-align: center;
    padding: 10px;
    border-radius: 10px;
    font-weight: 600;
    margin-bottom: 25px;
}

.campaign-status-banner.status-sending {
    background: #e8f5e9;
    color: #2e7d32;
}

.campaign-status-banner.status-paused {
    background: #fff3e0;
    color: #f57c00;
}

.campaign-status-banner.status-completed,
.campaign-status-banner.status-sent {
    background: #e3f2fd;
    color: #1976d2;
}

.stats-overview {
    display: flex;
    gap: 15px;
    margin-bottom: 30px;
    flex-wrap: wrap;
}

.stat-box {
    flex: 1;
    min-width: 100px;
    background: #f8f9fa;
    padding: 20px 15px;
    border-radius: 12px;
    text-align: center;
}

.stat-box.highlight-open { background: #e3f2fd; }
.stat-box.highlight-click { background: #fff3e0; }
.stat-box.highlight-reply { background: #e8f5e9; }

.stat-box .stat-number {
    display: block;
    font-size: 1.8em;
    font-weight: bold;
    color: #333;
}

.stat-box .stat-label {
    font-size: 0.85em;
    color: #666;
}

.stat-box .stat-percent {
    display: block;
    font-size: 0.9em;
    color: #888;
    margin-top: 5px;
}

.sequence-progress {
    margin-bottom: 30px;
}

.sequence-progress h4 {
    margin: 0 0 15px;
    color: #333;
}

.progress-bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.progress-item {
    display: flex;
    align-items: center;
    gap: 15px;
}

.progress-label {
    width: 120px;
    font-size: 0.9em;
    color: #555;
}

.progress-bar {
    flex: 1;
    height: 12px;
    background: #e0e0e0;
    border-radius: 6px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-radius: 6px;
    transition: width 0.3s;
}

.progress-count {
    width: 70px;
    text-align: right;
    font-size: 0.9em;
    color: #666;
}

.prospects-status-list h4 {
    margin: 0 0 15px;
    color: #333;
}

.prospects-filter-bar {
    display: flex;
    gap: 15px;
    margin-bottom: 15px;
}

.prospects-filter-bar input {
    flex: 1;
    padding: 10px 15px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-family: inherit;
}

.prospects-filter-bar select {
    padding: 10px 15px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-family: inherit;
    min-width: 150px;
}

.prospects-status-table {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
}

.prospect-status-row {
    display: flex;
    align-items: center;
    padding: 12px 15px;
    border-bottom: 1px solid #f0f0f0;
    gap: 15px;
}

.prospect-status-row:last-child {
    border-bottom: none;
}

.prospect-status-row:hover {
    background: #f8f9fa;
}

.prospect-info-col {
    flex: 2;
    min-width: 150px;
}

.prospect-info-col strong {
    display: block;
    color: #333;
}

.prospect-info-col .email {
    font-size: 0.85em;
    color: #888;
}

.prospect-company-col {
    flex: 1;
    color: #666;
    font-size: 0.9em;
}

.prospect-step-col {
    width: 80px;
}

.step-badge {
    background: #f0f0f0;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 0.8em;
    color: #666;
}

.prospect-status-col {
    width: 120px;
    text-align: right;
}

.badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.8em;
    font-weight: 500;
}

.badge-pending { background: #f0f0f0; color: #666; }
.badge-sent { background: #e3f2fd; color: #1976d2; }
.badge-opened { background: #e8f5e9; color: #2e7d32; }
.badge-clicked { background: #fff3e0; color: #f57c00; }
.badge-replied { background: #f3e5f5; color: #7b1fa2; }

.empty-table {
    text-align: center;
    padding: 30px;
    color: #888;
}

.campaign-actions-bar {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 25px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
}

.btn-warning {
    background: #ff9800;
    color: white;
}

.btn-warning:hover {
    background: #f57c00;
}

@media (max-width: 600px) {
    .stats-overview {
        flex-direction: column;
    }

    .prospect-status-row {
        flex-wrap: wrap;
    }

    .prospect-company-col,
    .prospect-step-col {
        display: none;
    }
}
`;
document.head.appendChild(sequenceStyles);
