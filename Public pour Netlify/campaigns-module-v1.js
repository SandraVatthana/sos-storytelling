// ===========================================
// campaigns-module.js - Module Campagnes Email
// SOS Storytelling - Generation IA + Brevo
// ===========================================

const CampaignsModule = {
    // State
    campaigns: [],
    currentCampaign: null,
    generatedEmails: [],
    previewIndex: 0,

    // API URL (Cloudflare Worker)
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

    // ==========================================
    // GENERATION IA
    // ==========================================

    /**
     * Genere le prompt systeme pour l'IA
     */
    getEmailPrompt({ language, userVoice, prospect, campaignGoal }) {
        const languageInstructions = language === 'en'
            ? `
LANGUAGE: Write in American English.
CULTURAL ADAPTATION:
- Use American business conventions
- Be direct and get to the point quickly
- Use contractions (I'm, you're, we'll)
- Reference American business culture when relevant
- Keep it casual but professional
- Americans appreciate confidence and clarity
`
            : `
LANGUE : Ecris en francais.
ADAPTATION CULTURELLE :
- Utilise les conventions business francaises
- Tu peux etre un peu plus relationnel avant d'entrer dans le vif
- Tutoiement OU vouvoiement selon le ton de "Ma Voix"
- References culturelles francaises si pertinent
- Ton chaleureux mais professionnel
`;

        const voiceInstructions = userVoice
            ? `
STYLE "MA VOIX" :
Voici des exemples de textes ecrits par l'utilisateur. Imite son style :
- Son vocabulaire
- Ses tournures de phrases
- Son niveau de formalite
- Ses expressions favorites

Exemples de reference :
${userVoice.samples ? userVoice.samples.map(s => `"${s}"`).join('\n') : ''}

Analyse du style :
- Ton : ${userVoice.tone || 'professionnel'}
- Formalite : ${userVoice.formality || 'moyenne'}
- Expressions cles : ${userVoice.keywords?.join(', ') || ''}
`
            : '';

        return `
Tu es un expert en copywriting et en cold emailing.
Tu generes des emails de prospection personnalises et authentiques.

${languageInstructions}

${voiceInstructions}

PROSPECT :
- Prenom : ${prospect.first_name}
- Nom : ${prospect.last_name || 'N/A'}
- Entreprise : ${prospect.company || 'N/A'}
- Poste : ${prospect.job_title || 'N/A'}
- Secteur : ${prospect.sector || 'N/A'}

OBJECTIF DE L'EMAIL : ${campaignGoal}

REGLES :
1. L'email doit sembler ecrit par un humain, pas par une IA
2. Personnalise avec les infos du prospect (entreprise, poste)
3. Garde le style de "Ma Voix" si fourni
4. Pas de phrases cliches ("j'espere que vous allez bien", "I hope this email finds you well")
5. Sois concis (max 150 mots)
6. Termine par une question ouverte, pas un CTA agressif
7. Pas de lien dans le premier email

FORMAT DE REPONSE (JSON) :
{
  "subject_lines": ["Option 1", "Option 2", "Option 3"],
  "body": "Le corps de l'email...",
  "preview_text": "Texte de preview (50 caracteres max)"
}
`;
    },

    /**
     * Genere un email pour un prospect via l'API
     */
    async generateEmail({ prospect, campaign, userVoice }) {
        const token = await this.getAuthToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${this.API_URL}/api/campaigns/generate-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                prospect,
                campaign_goal: campaign.goal,
                language: campaign.language || I18N.currentLanguage,
                use_my_voice: campaign.use_my_voice
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Generation failed');
        }

        return response.json();
    },

    /**
     * Genere des emails pour tous les prospects selectionnes
     */
    async generateEmailsForProspects(prospects, campaign) {
        const emails = [];

        for (const prospect of prospects) {
            try {
                const result = await this.generateEmail({
                    prospect,
                    campaign,
                    userVoice: campaign.use_my_voice ? await this.getUserVoice() : null
                });

                emails.push({
                    prospect_id: prospect.id,
                    prospect,
                    subject: result.subject_lines[0],
                    subject_options: result.subject_lines,
                    body: result.body,
                    preview_text: result.preview_text
                });

            } catch (error) {
                console.error(`Error generating email for ${prospect.email}:`, error);
                emails.push({
                    prospect_id: prospect.id,
                    prospect,
                    error: error.message
                });
            }
        }

        return emails;
    },

    /**
     * Recupere le profil "Ma Voix" de l'utilisateur
     */
    async getUserVoice() {
        if (!window.supabase) return null;

        try {
            const { data: { user } } = await window.supabase.auth.getUser();
            if (!user) return null;

            const { data } = await window.supabase
                .from('users')
                .select('voice_samples, voice_tone, voice_formality, voice_keywords')
                .eq('id', user.id)
                .single();

            if (data && data.voice_samples) {
                return {
                    samples: data.voice_samples,
                    tone: data.voice_tone,
                    formality: data.voice_formality,
                    keywords: data.voice_keywords
                };
            }

            return null;
        } catch (error) {
            console.error('Error loading user voice:', error);
            return null;
        }
    },

    /**
     * Obtient le token d'authentification
     */
    async getAuthToken() {
        if (!window.supabase) return null;

        const { data: { session } } = await window.supabase.auth.getSession();
        return session?.access_token;
    },

    // ==========================================
    // BREVO INTEGRATION
    // ==========================================

    /**
     * Envoie un email via Brevo
     */
    async sendEmail(emailData) {
        const token = await this.getAuthToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${this.API_URL}/api/campaigns/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Send failed');
        }

        return response.json();
    },

    /**
     * Envoie une campagne complete
     */
    async sendCampaign(campaignId) {
        const token = await this.getAuthToken();
        if (!token) throw new Error('Not authenticated');

        const response = await fetch(`${this.API_URL}/api/campaigns/${campaignId}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Campaign send failed');
        }

        return response.json();
    },

    // ==========================================
    // CRUD CAMPAGNES
    // ==========================================

    /**
     * Cree une nouvelle campagne
     */
    async createCampaign(campaignData) {
        if (!window.supabase) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await window.supabase
            .from('email_campaigns')
            .insert({
                user_id: user.id,
                ...campaignData,
                status: 'draft'
            })
            .select()
            .single();

        if (error) throw error;

        await this.loadCampaigns();
        return data;
    },

    /**
     * Met a jour une campagne
     */
    async updateCampaign(id, updates) {
        if (!window.supabase) throw new Error('Supabase not initialized');

        const { data, error } = await window.supabase
            .from('email_campaigns')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        await this.loadCampaigns();
        return data;
    },

    /**
     * Supprime une campagne
     */
    async deleteCampaign(id) {
        if (!window.supabase) throw new Error('Supabase not initialized');

        const { error } = await window.supabase
            .from('email_campaigns')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await this.loadCampaigns();
    },

    /**
     * Sauvegarde les emails generes pour une campagne
     */
    async saveCampaignEmails(campaignId, emails) {
        if (!window.supabase) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const emailsToInsert = emails.filter(e => !e.error).map(e => ({
            campaign_id: campaignId,
            prospect_id: e.prospect_id,
            user_id: user.id,
            subject: e.subject,
            body: e.body,
            preview_text: e.preview_text,
            status: 'pending'
        }));

        const { data, error } = await window.supabase
            .from('campaign_emails')
            .upsert(emailsToInsert, {
                onConflict: 'campaign_id,prospect_id'
            })
            .select();

        if (error) throw error;

        return data;
    },

    // ==========================================
    // PERSONNALISATION
    // ==========================================

    /**
     * Remplace les variables dans un template
     */
    personalizeEmail(template, prospect) {
        const language = I18N.currentLanguage;
        const fallbacks = language === 'en'
            ? {
                first_name: 'there',
                company: 'your company',
                job_title: 'your role'
            }
            : {
                first_name: '',
                company: 'ton entreprise',
                job_title: 'ton poste'
            };

        let result = template;

        result = result.replace(/{first_name}/g, prospect.first_name || fallbacks.first_name);
        result = result.replace(/{last_name}/g, prospect.last_name || '');
        result = result.replace(/{company}/g, prospect.company || fallbacks.company);
        result = result.replace(/{job_title}/g, prospect.job_title || fallbacks.job_title);
        result = result.replace(/{email}/g, prospect.email || '');
        result = result.replace(/{linkedin}/g, prospect.linkedin_url || '');

        // Nettoyer les doubles espaces
        result = result.replace(/\s+/g, ' ').trim();

        return result;
    },

    // ==========================================
    // UI COMPONENTS
    // ==========================================

    /**
     * Cree la page campagnes
     */
    createCampaignsPage() {
        const container = document.createElement('div');
        container.className = 'campaigns-page';
        container.innerHTML = `
            <div class="campaigns-header">
                <div class="campaigns-title-section">
                    <h2>${t('campaigns.title')}</h2>
                    <p>${t('campaigns.subtitle')}</p>
                </div>
                <div class="campaigns-actions">
                    <button class="btn btn-primary" onclick="CampaignsModule.openNewCampaignModal()">
                        <span class="btn-icon">➕</span> ${t('campaigns.new_campaign')}
                    </button>
                </div>
            </div>

            <div class="campaigns-list" id="campaignsList"></div>
        `;

        return container;
    },

    /**
     * Rend la liste des campagnes
     */
    renderCampaignsList() {
        const container = document.getElementById('campaignsList');
        if (!container) return;

        if (this.campaigns.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📧</div>
                    <p>${t('campaigns.empty')}</p>
                    <button class="btn btn-primary" onclick="CampaignsModule.openNewCampaignModal()">
                        ${t('campaigns.new_campaign')}
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.campaigns.map(c => `
            <div class="campaign-card" data-id="${c.id}">
                <div class="campaign-info">
                    <div class="campaign-name">
                        <strong>${c.name}</strong>
                        <span class="campaign-status status-${c.status}">${t('campaigns.status.' + c.status)}</span>
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
                        <span class="stat-label">${t('campaigns.stats.sent')}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${c.emails_opened || 0}</span>
                        <span class="stat-label">${t('campaigns.stats.opened')}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-value">${c.emails_replied || 0}</span>
                        <span class="stat-label">${t('campaigns.stats.replied')}</span>
                    </div>
                </div>
                <div class="campaign-actions">
                    ${c.status === 'draft' ? `
                        <button class="btn btn-primary btn-small" onclick="CampaignsModule.openCampaignEditor('${c.id}')">
                            ${t('actions.edit')}
                        </button>
                    ` : ''}
                    ${c.status === 'draft' ? `
                        <button class="btn btn-small" onclick="CampaignsModule.confirmDelete('${c.id}')">
                            ${t('actions.delete')}
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },

    /**
     * Ouvre le modal de nouvelle campagne
     */
    openNewCampaignModal() {
        this.currentCampaign = null;
        this.generatedEmails = [];
        this.previewIndex = 0;
        this.openCampaignWizard();
    },

    /**
     * Ouvre l'editeur de campagne
     */
    openCampaignEditor(id) {
        this.currentCampaign = this.campaigns.find(c => c.id === id);
        if (!this.currentCampaign) return;
        this.openCampaignWizard();
    },

    /**
     * Ouvre le wizard de campagne
     */
    openCampaignWizard() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'campaignWizard';
        modal.innerHTML = `
            <div class="modal campaign-wizard-modal">
                <div class="wizard-steps">
                    <div class="wizard-step active" data-step="1">
                        <span class="step-number">1</span>
                        <span class="step-label">${t('campaigns.form.name')}</span>
                    </div>
                    <div class="wizard-step" data-step="2">
                        <span class="step-number">2</span>
                        <span class="step-label">${t('campaigns.prospects_selection.title')}</span>
                    </div>
                    <div class="wizard-step" data-step="3">
                        <span class="step-number">3</span>
                        <span class="step-label">${t('campaigns.email_creation.title')}</span>
                    </div>
                    <div class="wizard-step" data-step="4">
                        <span class="step-number">4</span>
                        <span class="step-label">${t('campaigns.preview.title')}</span>
                    </div>
                </div>
                <button class="modal-close" onclick="CampaignsModule.closeWizard()">&times;</button>
                <div class="wizard-content" id="wizardContent">
                    ${this.renderWizardStep1()}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    /**
     * Ferme le wizard
     */
    closeWizard() {
        const modal = document.getElementById('campaignWizard');
        if (modal) modal.remove();
        this.currentCampaign = null;
        this.generatedEmails = [];
    },

    /**
     * Navigue vers une etape du wizard
     */
    goToStep(step) {
        const content = document.getElementById('wizardContent');
        if (!content) return;

        // Update step indicators
        document.querySelectorAll('.wizard-step').forEach(s => {
            const stepNum = parseInt(s.dataset.step);
            s.classList.toggle('active', stepNum === step);
            s.classList.toggle('completed', stepNum < step);
        });

        switch (step) {
            case 1:
                content.innerHTML = this.renderWizardStep1();
                break;
            case 2:
                content.innerHTML = this.renderWizardStep2();
                break;
            case 3:
                content.innerHTML = this.renderWizardStep3();
                break;
            case 4:
                content.innerHTML = this.renderWizardStep4();
                break;
        }
    },

    /**
     * Step 1: Infos campagne
     */
    renderWizardStep1() {
        const c = this.currentCampaign || {};

        return `
            <div class="wizard-step-content">
                <h3>📧 ${t('campaigns.new_campaign')}</h3>

                <div class="form-group">
                    <label>${t('campaigns.form.name')} *</label>
                    <input type="text" id="campaignName" value="${c.name || ''}"
                           placeholder="${t('campaigns.form.name_placeholder')}">
                </div>

                <div class="form-group">
                    <label>${t('campaigns.form.goal')} *</label>
                    <textarea id="campaignGoal" rows="3"
                              placeholder="${t('campaigns.form.goal_placeholder')}">${c.goal || ''}</textarea>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>${t('campaigns.form.sender_email')} *</label>
                        <input type="email" id="senderEmail" value="${c.sender_email || ''}"
                               placeholder="you@example.com">
                    </div>
                    <div class="form-group">
                        <label>${t('campaigns.form.sender_name')} *</label>
                        <input type="text" id="senderName" value="${c.sender_name || ''}"
                               placeholder="${t('campaigns.form.sender_name_placeholder')}">
                    </div>
                </div>

                <div class="form-group">
                    <label>${t('campaigns.form.language')}</label>
                    <select id="campaignLanguage">
                        <option value="fr" ${(c.language || 'fr') === 'fr' ? 'selected' : ''}>Francais</option>
                        <option value="en" ${c.language === 'en' ? 'selected' : ''}>English</option>
                    </select>
                </div>

                <div class="form-options">
                    <label class="checkbox-label">
                        <input type="checkbox" id="useMyVoice" ${c.use_my_voice !== false ? 'checked' : ''}>
                        ${t('campaigns.form.use_my_voice')}
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="generateUnique" ${c.generate_unique_per_prospect !== false ? 'checked' : ''}>
                        ${t('campaigns.form.generate_unique')}
                    </label>
                </div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.closeWizard()">
                        ${t('actions.cancel')}
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveStep1AndContinue()">
                        ${t('actions.next')} →
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Sauvegarde step 1 et continue
     */
    async saveStep1AndContinue() {
        const name = document.getElementById('campaignName').value.trim();
        const goal = document.getElementById('campaignGoal').value.trim();
        const senderEmail = document.getElementById('senderEmail').value.trim();
        const senderName = document.getElementById('senderName').value.trim();
        const language = document.getElementById('campaignLanguage').value;
        const useMyVoice = document.getElementById('useMyVoice').checked;
        const generateUnique = document.getElementById('generateUnique').checked;

        if (!name || !goal || !senderEmail || !senderName) {
            alert(t('errors.required_field'));
            return;
        }

        try {
            const campaignData = {
                name,
                goal,
                sender_email: senderEmail,
                sender_name: senderName,
                language,
                use_my_voice: useMyVoice,
                generate_unique_per_prospect: generateUnique
            };

            if (this.currentCampaign) {
                this.currentCampaign = await this.updateCampaign(this.currentCampaign.id, campaignData);
            } else {
                this.currentCampaign = await this.createCampaign(campaignData);
            }

            this.goToStep(2);
        } catch (error) {
            console.error('Error saving campaign:', error);
            alert(t('errors.error'));
        }
    },

    /**
     * Step 2: Selection des prospects
     */
    renderWizardStep2() {
        const prospects = ProspectsModule.prospects || [];
        const stats = ProspectsModule.getStats();

        return `
            <div class="wizard-step-content">
                <h3>👥 ${t('campaigns.prospects_selection.title')}</h3>

                <div class="prospect-filter-options">
                    <label class="radio-card">
                        <input type="radio" name="prospectFilter" value="all" checked>
                        <div class="radio-content">
                            <strong>${t('campaigns.prospects_selection.all')}</strong>
                            <span>(${stats.total})</span>
                        </div>
                    </label>
                    <label class="radio-card">
                        <input type="radio" name="prospectFilter" value="new">
                        <div class="radio-content">
                            <strong>${t('campaigns.prospects_selection.only_new')}</strong>
                            <span>(${stats.new})</span>
                        </div>
                    </label>
                </div>

                <div class="selected-prospects-preview">
                    <h4>${t('campaigns.prospects_selection.count', { count: prospects.length })}</h4>
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

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(1)">
                        ← ${t('actions.back')}
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveStep2AndContinue()">
                        ${t('actions.next')} →
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Sauvegarde step 2 et continue
     */
    async saveStep2AndContinue() {
        const filter = document.querySelector('input[name="prospectFilter"]:checked').value;

        let prospects = ProspectsModule.prospects || [];
        if (filter === 'new') {
            prospects = prospects.filter(p => p.status === 'new');
        }

        if (prospects.length === 0) {
            alert(t('errors.no_prospects'));
            return;
        }

        // Store selected prospects
        this.selectedProspects = prospects;

        // Update campaign with total
        await this.updateCampaign(this.currentCampaign.id, {
            total_prospects: prospects.length,
            prospect_filter: { status: filter }
        });

        this.goToStep(3);
    },

    /**
     * Step 3: Creation email
     */
    renderWizardStep3() {
        return `
            <div class="wizard-step-content">
                <h3>✍️ ${t('campaigns.email_creation.title')}</h3>

                <div class="email-creation-options">
                    <button class="email-option-card" onclick="CampaignsModule.generateWithAI()">
                        <div class="option-icon">🤖</div>
                        <strong>${t('campaigns.email_creation.generate_ai')}</strong>
                        <p>L'IA genere des emails personnalises pour chaque prospect</p>
                    </button>
                    <button class="email-option-card" onclick="CampaignsModule.writeManual()">
                        <div class="option-icon">✏️</div>
                        <strong>${t('campaigns.email_creation.write_manual')}</strong>
                        <p>Ecris un template avec des variables</p>
                    </button>
                </div>

                <div id="emailCreationContent"></div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(2)">
                        ← ${t('actions.back')}
                    </button>
                    <button class="btn btn-primary" id="step3NextBtn" style="display:none" onclick="CampaignsModule.goToStep(4)">
                        ${t('actions.next')} →
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Genere les emails avec l'IA
     */
    async generateWithAI() {
        const content = document.getElementById('emailCreationContent');
        content.innerHTML = `
            <div class="generating-state">
                <div class="spinner"></div>
                <p>${t('ai.generating')}</p>
                <p class="generating-progress" id="generatingProgress">0 / ${this.selectedProspects.length}</p>
            </div>
        `;

        try {
            // Generate emails for each prospect
            this.generatedEmails = [];

            for (let i = 0; i < this.selectedProspects.length; i++) {
                const prospect = this.selectedProspects[i];

                document.getElementById('generatingProgress').textContent =
                    `${i + 1} / ${this.selectedProspects.length}`;

                try {
                    const result = await this.generateEmail({
                        prospect,
                        campaign: this.currentCampaign
                    });

                    this.generatedEmails.push({
                        prospect_id: prospect.id,
                        prospect,
                        subject: result.subject_lines[0],
                        subject_options: result.subject_lines,
                        body: result.body,
                        preview_text: result.preview_text
                    });
                } catch (error) {
                    console.error(`Error generating for ${prospect.email}:`, error);
                    this.generatedEmails.push({
                        prospect_id: prospect.id,
                        prospect,
                        error: error.message
                    });
                }
            }

            content.innerHTML = `
                <div class="generation-success">
                    <div class="success-icon">✅</div>
                    <p>${t('ai.generated')}</p>
                    <p>${this.generatedEmails.filter(e => !e.error).length} emails generes</p>
                </div>
            `;

            document.getElementById('step3NextBtn').style.display = 'inline-flex';

        } catch (error) {
            console.error('Generation error:', error);
            content.innerHTML = `
                <div class="generation-error">
                    <div class="error-icon">❌</div>
                    <p>${t('status.error')}</p>
                    <button class="btn btn-secondary" onclick="CampaignsModule.generateWithAI()">
                        ${t('actions.regenerate')}
                    </button>
                </div>
            `;
        }
    },

    /**
     * Ecriture manuelle du template
     */
    writeManual() {
        const content = document.getElementById('emailCreationContent');
        content.innerHTML = `
            <div class="manual-email-form">
                <div class="form-group">
                    <label>${t('campaigns.email_creation.subject')} *</label>
                    <input type="text" id="manualSubject" placeholder="Ex: Une idee pour {company} ?">
                </div>

                <div class="form-group">
                    <label>${t('campaigns.email_creation.body')} *</label>
                    <textarea id="manualBody" rows="8"
                              placeholder="Hello {first_name},

J'ai vu que {company} ..."></textarea>
                    <p class="field-hint">${t('campaigns.email_creation.variables_hint')}</p>
                </div>

                <button class="btn btn-primary" onclick="CampaignsModule.saveManualTemplate()">
                    ${t('actions.save')}
                </button>
            </div>
        `;
    },

    /**
     * Sauvegarde le template manuel
     */
    saveManualTemplate() {
        const subject = document.getElementById('manualSubject').value.trim();
        const body = document.getElementById('manualBody').value.trim();

        if (!subject || !body) {
            alert(t('errors.required_field'));
            return;
        }

        // Generate personalized emails from template
        this.generatedEmails = this.selectedProspects.map(prospect => ({
            prospect_id: prospect.id,
            prospect,
            subject: this.personalizeEmail(subject, prospect),
            body: this.personalizeEmail(body, prospect)
        }));

        document.getElementById('step3NextBtn').style.display = 'inline-flex';

        const content = document.getElementById('emailCreationContent');
        content.innerHTML = `
            <div class="generation-success">
                <div class="success-icon">✅</div>
                <p>${this.generatedEmails.length} emails prepares</p>
            </div>
        `;
    },

    /**
     * Step 4: Preview et envoi
     */
    renderWizardStep4() {
        if (this.generatedEmails.length === 0) {
            return `
                <div class="wizard-step-content">
                    <p>Aucun email genere. Veuillez retourner a l'etape precedente.</p>
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(3)">
                        ← ${t('actions.back')}
                    </button>
                </div>
            `;
        }

        const email = this.generatedEmails[this.previewIndex];
        if (!email || email.error) {
            // Skip to next valid email
            const nextValid = this.generatedEmails.findIndex((e, i) => i > this.previewIndex && !e.error);
            if (nextValid !== -1) {
                this.previewIndex = nextValid;
                return this.renderWizardStep4();
            }
        }

        const prospect = email.prospect;
        const c = this.currentCampaign;

        return `
            <div class="wizard-step-content">
                <h3>👀 ${t('campaigns.preview.title')}</h3>

                <div class="preview-navigation">
                    <span>${t('campaigns.preview.for_prospect', { name: prospect.first_name, company: prospect.company || prospect.email })}</span>
                    <div class="preview-nav-buttons">
                        <button class="btn btn-small" onclick="CampaignsModule.prevPreview()" ${this.previewIndex === 0 ? 'disabled' : ''}>
                            ← ${t('campaigns.preview.previous')}
                        </button>
                        <span>${this.previewIndex + 1} / ${this.generatedEmails.length}</span>
                        <button class="btn btn-small" onclick="CampaignsModule.nextPreview()" ${this.previewIndex >= this.generatedEmails.length - 1 ? 'disabled' : ''}>
                            ${t('campaigns.preview.next')} →
                        </button>
                    </div>
                </div>

                <div class="email-preview">
                    <div class="email-preview-header">
                        <div class="preview-field">
                            <span class="preview-label">De:</span>
                            <span>${c.sender_name} &lt;${c.sender_email}&gt;</span>
                        </div>
                        <div class="preview-field">
                            <span class="preview-label">A:</span>
                            <span>${prospect.first_name} ${prospect.last_name || ''} &lt;${prospect.email}&gt;</span>
                        </div>
                        <div class="preview-field">
                            <span class="preview-label">Objet:</span>
                            <span>${email.subject}</span>
                        </div>
                    </div>
                    <div class="email-preview-body">
                        ${email.body.replace(/\n/g, '<br>')}
                    </div>
                </div>

                <div class="preview-actions">
                    <button class="btn btn-small btn-secondary" onclick="CampaignsModule.regenerateCurrentEmail()">
                        🔄 ${t('actions.regenerate')}
                    </button>
                </div>

                <div class="campaign-summary">
                    <p>📊 ${t('campaigns.preview.ready', { count: this.generatedEmails.filter(e => !e.error).length })}</p>
                </div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(3)">
                        ← ${t('actions.back')}
                    </button>
                    <button class="btn btn-primary btn-send" onclick="CampaignsModule.confirmSend()">
                        🚀 ${t('campaigns.actions.send_now')}
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Preview precedent
     */
    prevPreview() {
        if (this.previewIndex > 0) {
            this.previewIndex--;
            document.getElementById('wizardContent').innerHTML = this.renderWizardStep4();
        }
    },

    /**
     * Preview suivant
     */
    nextPreview() {
        if (this.previewIndex < this.generatedEmails.length - 1) {
            this.previewIndex++;
            document.getElementById('wizardContent').innerHTML = this.renderWizardStep4();
        }
    },

    /**
     * Regenere l'email actuel
     */
    async regenerateCurrentEmail() {
        const email = this.generatedEmails[this.previewIndex];
        if (!email) return;

        const content = document.getElementById('wizardContent');
        content.innerHTML = `
            <div class="generating-state">
                <div class="spinner"></div>
                <p>${t('ai.generating')}</p>
            </div>
        `;

        try {
            const result = await this.generateEmail({
                prospect: email.prospect,
                campaign: this.currentCampaign
            });

            this.generatedEmails[this.previewIndex] = {
                ...email,
                subject: result.subject_lines[0],
                subject_options: result.subject_lines,
                body: result.body,
                preview_text: result.preview_text,
                error: null
            };

            content.innerHTML = this.renderWizardStep4();

        } catch (error) {
            console.error('Regeneration error:', error);
            alert(t('status.error'));
            content.innerHTML = this.renderWizardStep4();
        }
    },

    /**
     * Confirme l'envoi de la campagne
     */
    async confirmSend() {
        const validEmails = this.generatedEmails.filter(e => !e.error);

        if (!confirm(`Envoyer ${validEmails.length} emails maintenant ?`)) {
            return;
        }

        const content = document.getElementById('wizardContent');
        content.innerHTML = `
            <div class="sending-state">
                <div class="spinner"></div>
                <p>${t('status.sending')}</p>
                <p class="sending-progress" id="sendingProgress">0 / ${validEmails.length}</p>
            </div>
        `;

        try {
            // Save emails to database
            await this.saveCampaignEmails(this.currentCampaign.id, validEmails);

            // Send campaign
            const result = await this.sendCampaign(this.currentCampaign.id);

            content.innerHTML = `
                <div class="send-success">
                    <div class="success-icon">🚀</div>
                    <h3>${t('status.sent')}</h3>
                    <p>${result.sent || validEmails.length} emails envoyes</p>
                    <button class="btn btn-primary" onclick="CampaignsModule.closeWizard(); CampaignsModule.loadCampaigns(); CampaignsModule.renderCampaignsList();">
                        ${t('actions.close')}
                    </button>
                </div>
            `;

        } catch (error) {
            console.error('Send error:', error);
            content.innerHTML = `
                <div class="send-error">
                    <div class="error-icon">❌</div>
                    <p>${t('errors.send_failed')}</p>
                    <p class="error-detail">${error.message}</p>
                    <button class="btn btn-secondary" onclick="CampaignsModule.closeWizard()">
                        ${t('actions.close')}
                    </button>
                </div>
            `;
        }
    },

    /**
     * Confirme la suppression d'une campagne
     */
    async confirmDelete(id) {
        if (!confirm('Supprimer cette campagne ?')) return;

        try {
            await this.deleteCampaign(id);
            this.renderCampaignsList();
        } catch (error) {
            console.error('Delete error:', error);
            alert(t('status.error'));
        }
    }
};

// Exposer globalement
window.CampaignsModule = CampaignsModule;

// CSS du module
const campaignsStyles = document.createElement('style');
campaignsStyles.textContent = `
/* ==========================================
   CAMPAIGNS MODULE STYLES
   ========================================== */

.campaigns-page {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.campaigns-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 25px;
    flex-wrap: wrap;
    gap: 15px;
}

.campaigns-title-section h2 {
    margin: 0 0 5px;
    color: #333;
    font-size: 1.8em;
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
    border-radius: 15px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    transition: transform 0.2s, box-shadow 0.2s;
}

.campaign-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
}

.campaign-info {
    flex: 1;
}

.campaign-name {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 5px;
}

.campaign-name strong {
    font-size: 1.1em;
    color: #333;
}

.campaign-status {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.75em;
    font-weight: 600;
}

.campaign-status.status-draft { background: #e0e0e0; color: #666; }
.campaign-status.status-sending { background: #fff3e0; color: #e65100; }
.campaign-status.status-sent { background: #e8f5e9; color: #2e7d32; }
.campaign-status.status-paused { background: #ffebee; color: #c62828; }

.campaign-meta {
    font-size: 0.9em;
    color: #666;
    display: flex;
    gap: 10px;
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
    font-size: 1.5em;
    font-weight: 700;
    color: #667eea;
}

.campaign-stats .stat-label {
    font-size: 0.8em;
    color: #888;
}

.campaign-actions {
    display: flex;
    gap: 8px;
}

/* Wizard Modal */
.campaign-wizard-modal {
    max-width: 700px;
    width: 95%;
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
}

.wizard-step {
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0.5;
    transition: opacity 0.3s;
}

.wizard-step.active,
.wizard-step.completed {
    opacity: 1;
}

.step-number {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: #e0e0e0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.9em;
}

.wizard-step.active .step-number {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.wizard-step.completed .step-number {
    background: #38ef7d;
    color: white;
}

.wizard-step.completed .step-number::after {
    content: "✓";
}

.step-label {
    font-size: 0.85em;
    color: #666;
}

.wizard-content {
    flex: 1;
    overflow-y: auto;
    padding: 25px 30px;
}

.wizard-step-content h3 {
    margin: 0 0 25px;
    color: #333;
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
    flex-direction: column;
    gap: 10px;
    margin-bottom: 25px;
}

.radio-card {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 15px 20px;
    background: #f8f9fa;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
}

.radio-card:hover {
    border-color: #667eea;
    background: #f8f9ff;
}

.radio-card input:checked + .radio-content {
    color: #667eea;
}

.radio-card input {
    width: 18px;
    height: 18px;
}

.radio-content {
    display: flex;
    justify-content: space-between;
    flex: 1;
}

.selected-prospects-preview {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 15px;
}

.selected-prospects-preview h4 {
    margin: 0 0 10px;
    font-size: 0.95em;
    color: #333;
}

.prospects-mini-list {
    max-height: 150px;
    overflow-y: auto;
}

.prospect-mini {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    font-size: 0.9em;
}

.prospect-mini strong {
    color: #333;
}

.prospect-mini span {
    color: #888;
}

/* Email Creation */
.email-creation-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-bottom: 25px;
}

.email-option-card {
    padding: 25px;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 15px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
}

.email-option-card:hover {
    border-color: #667eea;
    transform: translateY(-3px);
    box-shadow: 0 5px 20px rgba(102,126,234,0.2);
}

.option-icon {
    font-size: 2.5em;
    margin-bottom: 10px;
}

.email-option-card strong {
    display: block;
    margin-bottom: 5px;
    color: #333;
}

.email-option-card p {
    font-size: 0.85em;
    color: #666;
    margin: 0;
}

.generating-state,
.generation-success,
.generation-error,
.sending-state,
.send-success,
.send-error {
    text-align: center;
    padding: 40px 20px;
}

.generating-progress,
.sending-progress {
    color: #888;
    font-size: 0.9em;
}

/* Email Preview */
.preview-navigation {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #e0e0e0;
}

.preview-nav-buttons {
    display: flex;
    align-items: center;
    gap: 10px;
}

.email-preview {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 15px;
}

.email-preview-header {
    background: #f8f9fa;
    padding: 15px 20px;
    border-bottom: 1px solid #e0e0e0;
}

.preview-field {
    display: flex;
    gap: 10px;
    margin-bottom: 8px;
    font-size: 0.9em;
}

.preview-field:last-child {
    margin-bottom: 0;
}

.preview-label {
    font-weight: 600;
    color: #666;
    min-width: 50px;
}

.email-preview-body {
    padding: 20px;
    line-height: 1.7;
    color: #333;
}

.preview-actions {
    text-align: center;
    margin-bottom: 20px;
}

.campaign-summary {
    background: #e8f5e9;
    padding: 15px 20px;
    border-radius: 10px;
    text-align: center;
    color: #2e7d32;
    font-weight: 500;
}

.btn-send {
    background: linear-gradient(135deg, #11998e, #38ef7d) !important;
}

/* Form Options */
.form-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 15px;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 0.95em;
}

.checkbox-label input {
    width: 18px;
    height: 18px;
}

/* Manual Email Form */
.manual-email-form {
    margin-top: 20px;
}

/* Responsive */
@media (max-width: 768px) {
    .campaign-card {
        flex-direction: column;
        align-items: flex-start;
    }

    .campaign-stats {
        width: 100%;
        justify-content: space-around;
        padding-top: 15px;
        border-top: 1px solid #f0f0f0;
    }

    .wizard-steps {
        flex-wrap: wrap;
        gap: 10px;
    }

    .step-label {
        display: none;
    }

    .email-creation-options {
        grid-template-columns: 1fr;
    }
}
`;
document.head.appendChild(campaignsStyles);
