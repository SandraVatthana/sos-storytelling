// ===========================================
// campaigns-module-v2.js - Module Campagnes Email avec Sequences
// SOS Storytelling - J+0, J+3, J+7 automatises
// ===========================================

const CampaignsModule = {
    // State
    campaigns: [],
    currentCampaign: null,
    selectedProspects: [],
    selectedProspectIds: new Set(), // IDs des prospects sélectionnés individuellement
    currentFilter: 'all', // Filtre actif: all, new, sales_navigator, imported
    sequenceEmails: [], // [{position, delay_days, subject_template, body_template}]
    generatedPreviews: [],
    previewIndex: 0,

    // API URL
    API_URL: 'https://sos-storytelling-api.sandra-devonssay.workers.dev',

    // Base URL pour les liens de désinscription
    UNSUBSCRIBE_BASE_URL: 'https://sosstorytelling.fr/unsubscribe.html',

    // ==========================================
    // GESTION DES DÉSINSCRIPTIONS
    // ==========================================

    /**
     * Génère le lien de désinscription pour un prospect
     */
    generateUnsubscribeLink(prospectEmail, campaignId = null, prospectId = null) {
        const userId = this.getCurrentUserId();
        if (!userId || !prospectEmail) return '';

        const params = new URLSearchParams({
            email: prospectEmail,
            uid: userId
        });

        if (campaignId) params.set('cid', campaignId);
        if (prospectId) params.set('pid', prospectId);

        return `${this.UNSUBSCRIBE_BASE_URL}?${params.toString()}`;
    },

    /**
     * Génère le footer de désinscription HTML
     */
    generateUnsubscribeFooter(prospectEmail, campaignId = null, prospectId = null) {
        const unsubscribeLink = this.generateUnsubscribeLink(prospectEmail, campaignId, prospectId);
        if (!unsubscribeLink) return '';

        return `

---
Si tu ne souhaites plus recevoir mes emails, tu peux te désinscrire ici : ${unsubscribeLink}`;
    },

    /**
     * Ajoute le footer de désinscription à un email
     */
    addUnsubscribeToEmail(emailBody, prospectEmail, campaignId = null, prospectId = null) {
        const footer = this.generateUnsubscribeFooter(prospectEmail, campaignId, prospectId);
        return emailBody + footer;
    },

    /**
     * Vérifie si un email est désinscrit
     */
    async isEmailUnsubscribed(email) {
        const supabase = window.supabase;
        if (!supabase) return false;

        try {
            const userId = this.getCurrentUserId();
            if (!userId) return false;

            const { data, error } = await supabase
                .from('email_unsubscribes')
                .select('id')
                .eq('user_id', userId)
                .ilike('email', email)
                .single();

            return !!data;
        } catch (e) {
            return false;
        }
    },

    /**
     * Filtre les prospects désinscrits d'une liste
     */
    async filterUnsubscribedProspects(prospects) {
        const supabase = window.supabase;
        if (!supabase || !prospects.length) return prospects;

        try {
            const userId = this.getCurrentUserId();
            if (!userId) return prospects;

            // Récupérer tous les emails désinscrits
            const { data: unsubscribed } = await supabase
                .from('email_unsubscribes')
                .select('email')
                .eq('user_id', userId);

            if (!unsubscribed || !unsubscribed.length) return prospects;

            const unsubscribedEmails = new Set(unsubscribed.map(u => u.email.toLowerCase()));

            // Filtrer les prospects
            const filtered = prospects.filter(p => !unsubscribedEmails.has(p.email?.toLowerCase()));

            const removedCount = prospects.length - filtered.length;
            if (removedCount > 0) {
                console.log(`[Campaigns] ${removedCount} prospect(s) désinscrit(s) exclu(s)`);
            }

            return filtered;
        } catch (e) {
            console.error('[Campaigns] Erreur filtre désinscrits:', e);
            return prospects;
        }
    },

    /**
     * Récupère l'ID de l'utilisateur courant (depuis le cache)
     */
    getCurrentUserId() {
        return this._cachedUserId || null;
    },

    /**
     * Récupère les stats de désinscription
     */
    async getUnsubscribeStats() {
        const supabase = window.supabase;
        if (!supabase) return { total: 0, last7Days: 0, last30Days: 0 };

        try {
            const userId = this.getCurrentUserId();
            if (!userId) return { total: 0, last7Days: 0, last30Days: 0 };

            const { data } = await supabase
                .from('email_unsubscribes')
                .select('unsubscribed_at')
                .eq('user_id', userId);

            if (!data) return { total: 0, last7Days: 0, last30Days: 0 };

            const now = new Date();
            const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

            return {
                total: data.length,
                last7Days: data.filter(d => new Date(d.unsubscribed_at) > sevenDaysAgo).length,
                last30Days: data.filter(d => new Date(d.unsubscribed_at) > thirtyDaysAgo).length
            };
        } catch (e) {
            return { total: 0, last7Days: 0, last30Days: 0 };
        }
    },

    // Templates de séquences pré-construits
    SEQUENCE_TEMPLATES: {
        intro: {
            id: 'intro',
            name: '🤝 Prise de contact',
            description: 'Idéal pour un premier contact avec un prospect froid',
            emails: [
                {
                    position: 1,
                    delay_days: 0,
                    subject_template: 'Une idée pour {company}',
                    body_template: `Bonjour {first_name},

Je me permets de vous contacter car j'ai remarqué {company} dans mon secteur.

[Décris brièvement ta proposition de valeur ici]

Seriez-vous disponible pour un court échange de 15 minutes cette semaine ?

Bien cordialement`,
                    send_condition: 'always'
                },
                {
                    position: 2,
                    delay_days: 3,
                    subject_template: 'Re: Une idée pour {company}',
                    body_template: `Bonjour {first_name},

Je me permets de revenir vers vous concernant mon précédent message.

Je comprends que vous êtes probablement débordé(e), mais je pense vraiment que cette discussion pourrait vous être utile.

Seriez-vous disponible 15 minutes cette semaine ?`,
                    send_condition: 'no_reply'
                },
                {
                    position: 3,
                    delay_days: 7,
                    subject_template: 'Dernier essai - {company}',
                    body_template: `Bonjour {first_name},

Je ne veux pas être insistant, c'est mon dernier message.

Si ce n'est pas le bon moment, pas de souci - je comprendrai parfaitement.

Sinon, je reste disponible si vous souhaitez en discuter.

Bonne continuation !`,
                    send_condition: 'no_reply'
                }
            ]
        },
        value: {
            id: 'value',
            name: '💡 Proposition de valeur',
            description: 'Mettez en avant les bénéfices pour le prospect',
            emails: [
                {
                    position: 1,
                    delay_days: 0,
                    subject_template: '{first_name}, [X résultats] pour {company} ?',
                    body_template: `Bonjour {first_name},

Je travaille avec des entreprises comme {company} pour [décrire le bénéfice principal].

Récemment, j'ai aidé un client à [résultat concret et chiffré].

Voici comment : [1-2 phrases sur la méthode]

Est-ce un sujet qui vous intéresse pour {company} ?`,
                    send_condition: 'always'
                },
                {
                    position: 2,
                    delay_days: 4,
                    subject_template: 'Re: [Cas client] qui pourrait vous inspirer',
                    body_template: `Bonjour {first_name},

Suite à mon précédent message, voici un exemple concret :

📊 [Nom client] avait le même défi que {company}
✅ Résultat : [chiffre/résultat obtenu]
⏱️ En seulement [durée]

Souhaitez-vous que je vous montre comment nous avons fait ?

15 minutes suffisent pour voir si c'est applicable à votre cas.`,
                    send_condition: 'no_reply'
                },
                {
                    position: 3,
                    delay_days: 7,
                    subject_template: 'Question rapide pour vous',
                    body_template: `{first_name},

Je comprends que vous êtes occupé(e).

Une simple question : est-ce que [problème que vous résolvez] est un sujet d'actualité pour {company} ?

Si oui → je vous propose un échange de 10 min
Si non → pas de souci, je ne vous dérangerai plus

Qu'en pensez-vous ?`,
                    send_condition: 'no_reply'
                }
            ]
        },
        case_study: {
            id: 'case_study',
            name: '📊 Étude de cas',
            description: 'Partagez des résultats concrets pour convaincre',
            emails: [
                {
                    position: 1,
                    delay_days: 0,
                    subject_template: 'Comment [client] a obtenu [résultat]',
                    body_template: `Bonjour {first_name},

Je voulais partager avec vous une étude de cas qui pourrait vous intéresser.

📌 Le défi : [décrire le problème initial]
💡 La solution : [votre approche]
📈 Le résultat : [chiffres concrets]

Je me suis dit que {company} pourrait bénéficier d'une approche similaire.

Avez-vous 15 minutes pour en discuter ?`,
                    send_condition: 'always'
                },
                {
                    position: 2,
                    delay_days: 5,
                    subject_template: 'Re: Les 3 étapes clés du succès de [client]',
                    body_template: `{first_name},

Suite à mon précédent email, voici les 3 étapes qui ont fait la différence :

1️⃣ [Étape 1 - courte description]
2️⃣ [Étape 2 - courte description]
3️⃣ [Étape 3 - courte description]

Ces étapes sont applicables à {company}.

Voulez-vous que je vous montre comment ?`,
                    send_condition: 'no_reply'
                },
                {
                    position: 3,
                    delay_days: 10,
                    subject_template: 'Dernière chance - Ressource gratuite',
                    body_template: `{first_name},

C'est mon dernier message sur ce sujet.

J'ai préparé [une ressource/un guide] qui récapitule notre méthodologie.

Souhaitez-vous que je vous l'envoie ? C'est gratuit et sans engagement.

Si ce n'est pas le bon moment, je comprendrai.`,
                    send_condition: 'no_reply'
                }
            ]
        },
        meeting: {
            id: 'meeting',
            name: '📅 Prise de RDV direct',
            description: 'Allez droit au but pour décrocher un appel',
            emails: [
                {
                    position: 1,
                    delay_days: 0,
                    subject_template: 'Appel de 15 min - {company}',
                    body_template: `Bonjour {first_name},

Je suis [Votre nom], [votre titre/spécialité].

Je travaille avec des [type de clients] pour [bénéfice principal].

J'aimerais vous présenter [votre offre] en 15 minutes chrono.

📅 Êtes-vous disponible cette semaine ?

[Lien Calendly ou créneaux proposés]`,
                    send_condition: 'always'
                },
                {
                    position: 2,
                    delay_days: 2,
                    subject_template: 'Re: Créneaux disponibles cette semaine',
                    body_template: `{first_name},

Je me permets de revenir vers vous.

Voici mes disponibilités :
• [Jour 1] : [heure]
• [Jour 2] : [heure]
• [Jour 3] : [heure]

Lequel vous conviendrait le mieux ?`,
                    send_condition: 'no_reply'
                },
                {
                    position: 3,
                    delay_days: 5,
                    subject_template: 'Dernière tentative 🙂',
                    body_template: `{first_name},

Je ne veux pas être insistant.

Si ce n'est pas le bon moment, dites-le-moi simplement et je ne vous dérangerai plus.

Sinon, mon calendrier est ouvert : [lien Calendly]

Bonne journée !`,
                    send_condition: 'no_reply'
                }
            ]
        }
    },

    /**
     * Initialise le module
     */
    async init() {
        // Cacher l'ID utilisateur pour les fonctions sync
        await this.cacheUserId();
        await this.loadCampaigns();
    },

    /**
     * Cache l'ID utilisateur courant
     */
    async cacheUserId() {
        try {
            if (window.supabase?.auth) {
                const { data: { user } } = await window.supabase.auth.getUser();
                this._cachedUserId = user?.id || null;
            }
        } catch (e) {
            this._cachedUserId = null;
        }
    },

    /**
     * Charge les campagnes depuis Supabase
     */
    async loadCampaigns() {
        if (!window.supabase?.auth) return;

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
        if (!window.supabase?.auth) return null;
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
                    <h2>📧 ${t('campaigns.title')}</h2>
                    <p>${t('campaigns.subtitle')}</p>
                </div>
                <div class="campaigns-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.showUnsubscribeList()" style="margin-right: 10px;">
                        📭 Désinscriptions
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.openNewCampaignWizard()">
                        <span class="btn-icon">+</span> ${t('campaigns.new_campaign')}
                    </button>
                </div>
            </div>

            <!-- Widget désinscriptions -->
            <div id="unsubscribeWidget" class="unsubscribe-widget" style="display: none; background: linear-gradient(135deg, #fef2f2, #fee2e2); border: 1px solid #fecaca; border-radius: 12px; padding: 15px 20px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.5em;">📭</span>
                        <div>
                            <strong style="color: #991b1b;">Désinscriptions</strong>
                            <p style="margin: 0; font-size: 0.85em; color: #b91c1c;" id="unsubscribeCount">Chargement...</p>
                        </div>
                    </div>
                    <button onclick="CampaignsModule.showUnsubscribeList()" style="background: white; border: 1px solid #fecaca; padding: 8px 15px; border-radius: 8px; cursor: pointer; font-size: 0.85em; color: #991b1b;">
                        Voir la liste
                    </button>
                </div>
            </div>

            <div class="campaigns-list" id="campaignsList"></div>
        `;

        // Charger les stats de désinscription
        this.loadUnsubscribeWidget();

        return container;
    },

    /**
     * Charge et affiche le widget de désinscriptions
     */
    async loadUnsubscribeWidget() {
        const stats = await this.getUnsubscribeStats();

        const widget = document.getElementById('unsubscribeWidget');
        const countEl = document.getElementById('unsubscribeCount');

        if (widget && countEl) {
            if (stats.total > 0) {
                widget.style.display = 'block';
                countEl.textContent = `${stats.total} email(s) désinscrit(s) • ${stats.last30Days} ce mois`;
            } else {
                widget.style.display = 'none';
            }
        }
    },

    /**
     * Affiche la liste des désinscriptions
     */
    async showUnsubscribeList() {
        const supabase = window.supabase;
        if (!supabase) return;

        try {
            await this.cacheUserId();
            const userId = this.getCurrentUserId();
            if (!userId) {
                alert('Connectez-vous pour voir les désinscriptions');
                return;
            }

            const { data: unsubscribes, error } = await supabase
                .from('email_unsubscribes')
                .select('*')
                .eq('user_id', userId)
                .order('unsubscribed_at', { ascending: false });

            if (error) throw error;

            // Créer le modal
            const modalHTML = `
                <div class="modal-overlay" onclick="CampaignsModule.closeUnsubscribeModal(event)">
                    <div class="modal-content" onclick="event.stopPropagation()" style="max-width: 700px; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column;">
                        <div class="modal-header" style="border-bottom: 1px solid #e5e7eb; padding-bottom: 15px;">
                            <h2 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                                <span>📭</span> Emails désinscrits
                            </h2>
                            <button onclick="CampaignsModule.closeUnsubscribeModal()" style="background: none; border: none; font-size: 1.5em; cursor: pointer; color: #666;">&times;</button>
                        </div>

                        <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px 0;">
                            ${unsubscribes.length === 0 ? `
                                <div style="text-align: center; padding: 40px; color: #888;">
                                    <div style="font-size: 3em; margin-bottom: 15px;">🎉</div>
                                    <p>Aucune désinscription pour le moment !</p>
                                    <p style="font-size: 0.85em;">C'est bon signe, tes emails sont appréciés.</p>
                                </div>
                            ` : `
                                <div style="margin-bottom: 15px; padding: 15px; background: #f8fafc; border-radius: 10px;">
                                    <strong>${unsubscribes.length}</strong> personne(s) se sont désinscrites de tes emails.
                                    <p style="margin: 5px 0 0; font-size: 0.85em; color: #666;">Ces adresses ne recevront plus aucun email de ta part.</p>
                                </div>

                                <div style="display: flex; flex-direction: column; gap: 10px;">
                                    ${unsubscribes.map(u => `
                                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; background: white; border: 1px solid #e5e7eb; border-radius: 10px;">
                                            <div>
                                                <strong style="color: #1f2937;">${u.email}</strong>
                                                <p style="margin: 3px 0 0; font-size: 0.8em; color: #888;">
                                                    ${new Date(u.unsubscribed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    ${u.reason ? ` • ${u.reason}` : ''}
                                                </p>
                                            </div>
                                            <button onclick="CampaignsModule.removeUnsubscribe('${u.id}', '${u.email}')" style="background: #fef2f2; border: 1px solid #fecaca; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8em; color: #991b1b;" title="Retirer de la liste (la personne pourra à nouveau recevoir des emails)">
                                                Retirer
                                            </button>
                                        </div>
                                    `).join('')}
                                </div>
                            `}
                        </div>

                        <div class="modal-footer" style="border-top: 1px solid #e5e7eb; padding-top: 15px;">
                            <p style="margin: 0; font-size: 0.8em; color: #888;">
                                💡 Les personnes désinscrits sont automatiquement exclues de tes campagnes.
                            </p>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

        } catch (error) {
            console.error('Erreur chargement désinscriptions:', error);
            alert('Erreur lors du chargement des désinscriptions');
        }
    },

    /**
     * Ferme le modal de désinscriptions
     */
    closeUnsubscribeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
    },

    /**
     * Retire un email de la liste des désinscriptions
     */
    async removeUnsubscribe(id, email) {
        if (!confirm(`Retirer ${email} de la liste des désinscriptions ?\n\nCette personne pourra à nouveau recevoir tes emails.`)) {
            return;
        }

        try {
            const supabase = window.supabase;
            const { error } = await supabase
                .from('email_unsubscribes')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Rafraîchir la liste
            this.closeUnsubscribeModal();
            this.showUnsubscribeList();
            this.loadUnsubscribeWidget();

        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
        }
    },

    renderCampaignsList() {
        const container = document.getElementById('campaignsList');
        if (!container) return;

        if (this.campaigns.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📧</div>
                    <p>${t('campaigns.empty')}</p>
                    <button class="btn btn-primary" onclick="CampaignsModule.openNewCampaignWizard()">
                        ${t('campaigns.new_campaign')}
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
                    ${this.getCampaignActions(c)}
                </div>
            </div>
        `).join('');
    },

    getStatusLabel(status) {
        const labels = {
            draft: t('campaigns.status.draft'),
            scheduled: t('campaigns.status.scheduled'),
            sending: t('campaigns.status.sending'),
            paused: t('campaigns.status.paused'),
            sent: t('campaigns.status.sent'),
            completed: t('campaigns.status.sent')
        };
        return labels[status] || status;
    },

    getCampaignActions(campaign) {
        switch (campaign.status) {
            case 'draft':
                return `
                    <button class="btn btn-primary btn-small" onclick="CampaignsModule.openEditWizard('${campaign.id}')">
                        ${t('actions.edit')}
                    </button>
                    <button class="btn btn-small btn-danger" onclick="CampaignsModule.confirmDelete('${campaign.id}')">
                        ${t('actions.delete')}
                    </button>
                `;
            case 'sending':
                return `
                    <button class="btn btn-small" onclick="CampaignsModule.viewCampaignDetails('${campaign.id}')">
                        ${t('view_details')}
                    </button>
                    <button class="btn btn-small btn-warning" onclick="CampaignsModule.pauseCampaign('${campaign.id}')">
                        ${t('campaigns.actions.pause')}
                    </button>
                `;
            case 'paused':
                return `
                    <button class="btn btn-small btn-primary" onclick="CampaignsModule.resumeCampaign('${campaign.id}')">
                        ${t('campaigns.actions.resume')}
                    </button>
                    <button class="btn btn-small" onclick="CampaignsModule.viewCampaignDetails('${campaign.id}')">
                        ${t('view_details')}
                    </button>
                `;
            default:
                return `
                    <button class="btn btn-small" onclick="CampaignsModule.viewCampaignDetails('${campaign.id}')">
                        ${t('view_details')}
                    </button>
                `;
        }
    },

    // ==========================================
    // HELPER - Récupérer les infos du sender sélectionné
    // ==========================================

    getSelectedSenderInfo() {
        // Récupérer le premier sender sélectionné
        if (this.selectedSenders && this.selectedSenders.length > 0 && typeof SenderEmailsModule !== 'undefined') {
            const senders = SenderEmailsModule.getSenders();
            const firstSender = senders.find(s => s.id === this.selectedSenders[0]);
            if (firstSender) {
                return {
                    email: firstSender.email,
                    name: firstSender.display_name || firstSender.email.split('@')[0]
                };
            }
        }
        // Fallback
        return {
            email: 'vous@votredomaine.com',
            name: 'Moi'
        };
    },

    // ==========================================
    // WIZARD - NOUVELLE CAMPAGNE
    // ==========================================

    openNewCampaignWizard() {
        this.currentCampaign = null;
        this.selectedProspects = [];
        this.outreachConfig = null;
        this.selectedSenders = null; // Multi-adresses selection
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
        // Reset des sélections prospects
        this.selectedProspectIds = new Set();
        this.currentFilter = 'all';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'campaignWizard';
        modal.innerHTML = `
            <div class="modal campaign-wizard-modal" style="max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto;">
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
        document.body.style.overflow = 'hidden';
    },

    renderWizardSteps() {
        const steps = [
            { num: 1, label: 'Campagne' },
            { num: 2, label: 'Prospects' },
            { num: 3, label: 'Config' },
            { num: 4, label: 'Emails' },
            { num: 5, label: 'Lancement' }
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
            case 3: return this.renderStep3_Config();
            case 4: return this.renderStep4_Emails();
            case 5: return this.renderStep5_Launch();
            default: return '';
        }
    },

    updateWizard() {
        document.getElementById('wizardSteps').innerHTML = this.renderWizardSteps();
        document.getElementById('wizardContent').innerHTML = this.renderCurrentStep();

        // Charger les sender chips si on est à l'étape 3
        if (this.currentStep === 3) {
            setTimeout(() => this.loadSenderChips(), 100);
        }
    },

    closeWizard() {
        const modal = document.getElementById('campaignWizard');
        if (modal) modal.remove();
        document.body.style.overflow = '';
        this.currentCampaign = null;
        this.sequenceEmails = [];
        this.selectedProspects = [];
        this.selectedSenders = null; // Reset sender selection
    },

    async handleWizardImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const importZone = document.getElementById('wizardImportZone');
        if (importZone) {
            importZone.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading-spinner"></div><p>Import en cours...</p></div>';
        }

        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(line => line.trim());

            if (lines.length < 2) {
                throw new Error('Le fichier CSV semble vide');
            }

            // Parse CSV - détecter le séparateur
            const firstLine = lines[0];
            const separator = firstLine.includes(';') ? ';' : ',';

            const headers = firstLine.split(separator).map(h => h.trim().toLowerCase().replace(/"/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
            console.log('=== IMPORT CSV DEBUG ===');
            console.log('Séparateur:', separator);
            console.log('Headers détectés:', headers);
            console.log('Nombre de lignes:', lines.length);

            const prospects = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
                if (values.length < 2 || !values.some(v => v)) continue;

                const prospect = {};
                headers.forEach((header, idx) => {
                    const value = values[idx] || '';
                    // Matching amélioré pour Pharow et autres formats CSV
                    // IMPORTANT: Les conditions spécifiques doivent être AVANT les génériques

                    // Email
                    if (header.includes('mail') || header === 'e-mail' || header === 'courriel') {
                        prospect.email = value;
                    }
                    // Prénom
                    else if (header.includes('prenom') || header.includes('first') || header === 'firstname' || header === 'given') {
                        prospect.first_name = value;
                    }
                    // Entreprise - AVANT le test 'nom' car 'nom commercial', 'nom legal' sont des entreprises
                    else if (header === 'nom commercial' || header === 'nom legal' || header.includes('nom de la page linkedin') ||
                             header.includes('entreprise') || header.includes('company') || header.includes('societe') ||
                             header.includes('organisation') || header === 'raison sociale') {
                        if (!prospect.company) prospect.company = value; // Ne pas écraser si déjà défini
                    }
                    // Nom de famille - seulement si c'est exactement 'nom' ou des variantes de last name
                    else if (header === 'nom' || header === 'lastname' || header === 'family' || header === 'surname' || header === 'last name' || header === 'last_name') {
                        prospect.last_name = value;
                    }
                    // Poste / Fonction
                    else if (header === 'poste occupe' || header.includes('poste') || header.includes('title') ||
                             header.includes('fonction') || header.includes('job') || header.includes('role') || header.includes('position')) {
                        prospect.job_title = value;
                    }
                    // LinkedIn - seulement les colonnes URL, pas les IDs
                    else if (header.includes('url linkedin') || header === 'linkedin' || header === 'linkedin_url' || header === 'linkedin url') {
                        prospect.linkedin_url = value;
                    }
                    // Téléphone
                    else if (header.includes('tel portable') || header.includes('tel standard') || header.includes('phone') ||
                             header.includes('telephone') || header.includes('mobile') || header.includes('portable')) {
                        if (!prospect.phone) prospect.phone = value;
                    }
                });

                // Si pas de mapping trouvé, essayer position par défaut (email en premier ou second)
                if (!prospect.email && values[0] && values[0].includes('@')) {
                    prospect.email = values[0];
                    prospect.first_name = prospect.first_name || values[1] || 'Contact';
                } else if (!prospect.email && values[1] && values[1].includes('@')) {
                    prospect.email = values[1];
                    prospect.first_name = prospect.first_name || values[0] || 'Contact';
                }

                if (prospect.email && prospect.email.includes('@')) {
                    prospect.first_name = prospect.first_name || 'Contact';
                    prospect.status = 'new';
                    prospects.push(prospect);
                    if (prospects.length === 1) {
                        console.log('Premier prospect:', prospect);
                    }
                } else if (i === 1) {
                    console.log('Première ligne non valide:', { values, prospect });
                }
            }

            console.log('Prospects parsés:', prospects.length);

            if (prospects.length === 0) {
                throw new Error('Aucun prospect valide trouvé. Colonnes détectées: ' + headers.join(', ') + '. Assurez-vous d\'avoir une colonne email.');
            }

            // Sauvegarder les prospects
            if (typeof ProspectsModule !== 'undefined') {
                // Essayer d'abord de sauvegarder dans Supabase
                try {
                    if (window.supabase?.auth && typeof ProspectsModule.importProspects === 'function') {
                        const { data: { user } } = await window.supabase.auth.getUser();
                        if (user) {
                            console.log('Import Supabase:', prospects.length, 'prospects');
                            await ProspectsModule.importProspects(prospects, 'csv_wizard');
                            // Les prospects sont maintenant dans ProspectsModule.prospects via loadProspects()
                        } else {
                            throw new Error('Non connecté');
                        }
                    } else {
                        throw new Error('Supabase non disponible');
                    }
                } catch (e) {
                    // Fallback mode local
                    console.log('Import local (fallback):', prospects.length, 'prospects -', e.message);
                    const prospectsWithIds = prospects.map((p, i) => ({
                        ...p,
                        id: 'local_' + Date.now() + '_' + i,
                        source: 'csv_wizard',
                        status: 'new'
                    }));
                    ProspectsModule.prospects = [...(ProspectsModule.prospects || []), ...prospectsWithIds];
                }
            }

            // Rafraîchir le wizard
            if (importZone) {
                importZone.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #4caf50;">
                        <div style="font-size: 2em;">✅</div>
                        <p><strong>${prospects.length} prospects importés !</strong></p>
                        <button class="btn btn-primary" onclick="CampaignsModule.updateWizard()">Continuer</button>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Import error:', error);
            if (importZone) {
                importZone.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #f44336;">
                        <div style="font-size: 2em;">❌</div>
                        <p><strong>Erreur:</strong> ${error.message}</p>
                        <button class="btn btn-secondary" onclick="CampaignsModule.updateWizard()">Réessayer</button>
                    </div>
                `;
            }
        }
    },

    async handleWizardImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const importZone = document.getElementById('wizardImportZone');
        if (importZone) {
            importZone.innerHTML = '<div style="text-align: center; padding: 20px;"><div class="loading-spinner"></div><p>Import en cours...</p></div>';
        }

        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(line => line.trim());

            if (lines.length < 2) {
                throw new Error('Le fichier CSV semble vide');
            }

            // Parse CSV - détecter le séparateur
            const firstLine = lines[0];
            const separator = firstLine.includes(';') ? ';' : ',';

            const headers = firstLine.split(separator).map(h => h.trim().toLowerCase().replace(/"/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
            console.log('=== IMPORT CSV DEBUG ===');
            console.log('Séparateur:', separator);
            console.log('Headers détectés:', headers);
            console.log('Nombre de lignes:', lines.length);

            const prospects = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(separator).map(v => v.trim().replace(/"/g, ''));
                if (values.length < 2 || !values.some(v => v)) continue;

                const prospect = {};
                headers.forEach((header, idx) => {
                    const value = values[idx] || '';
                    // Matching amélioré pour Pharow et autres formats CSV
                    // IMPORTANT: Les conditions spécifiques doivent être AVANT les génériques

                    // Email
                    if (header.includes('mail') || header === 'e-mail' || header === 'courriel') {
                        prospect.email = value;
                    }
                    // Prénom
                    else if (header.includes('prenom') || header.includes('first') || header === 'firstname' || header === 'given') {
                        prospect.first_name = value;
                    }
                    // Entreprise - AVANT le test 'nom' car 'nom commercial', 'nom legal' sont des entreprises
                    else if (header === 'nom commercial' || header === 'nom legal' || header.includes('nom de la page linkedin') ||
                             header.includes('entreprise') || header.includes('company') || header.includes('societe') ||
                             header.includes('organisation') || header === 'raison sociale') {
                        if (!prospect.company) prospect.company = value; // Ne pas écraser si déjà défini
                    }
                    // Nom de famille - seulement si c'est exactement 'nom' ou des variantes de last name
                    else if (header === 'nom' || header === 'lastname' || header === 'family' || header === 'surname' || header === 'last name' || header === 'last_name') {
                        prospect.last_name = value;
                    }
                    // Poste / Fonction
                    else if (header === 'poste occupe' || header.includes('poste') || header.includes('title') ||
                             header.includes('fonction') || header.includes('job') || header.includes('role') || header.includes('position')) {
                        prospect.job_title = value;
                    }
                    // LinkedIn - seulement les colonnes URL, pas les IDs
                    else if (header.includes('url linkedin') || header === 'linkedin' || header === 'linkedin_url' || header === 'linkedin url') {
                        prospect.linkedin_url = value;
                    }
                    // Téléphone
                    else if (header.includes('tel portable') || header.includes('tel standard') || header.includes('phone') ||
                             header.includes('telephone') || header.includes('mobile') || header.includes('portable')) {
                        if (!prospect.phone) prospect.phone = value;
                    }
                });

                // Si pas de mapping trouvé, essayer position par défaut (email en premier ou second)
                if (!prospect.email && values[0] && values[0].includes('@')) {
                    prospect.email = values[0];
                    prospect.first_name = prospect.first_name || values[1] || 'Contact';
                } else if (!prospect.email && values[1] && values[1].includes('@')) {
                    prospect.email = values[1];
                    prospect.first_name = prospect.first_name || values[0] || 'Contact';
                }

                if (prospect.email && prospect.email.includes('@')) {
                    prospect.first_name = prospect.first_name || 'Contact';
                    prospect.status = 'new';
                    prospects.push(prospect);
                    if (prospects.length === 1) {
                        console.log('Premier prospect:', prospect);
                    }
                } else if (i === 1) {
                    console.log('Première ligne non valide:', { values, prospect });
                }
            }

            console.log('Prospects parsés:', prospects.length);

            if (prospects.length === 0) {
                throw new Error('Aucun prospect valide trouvé. Colonnes détectées: ' + headers.join(', ') + '. Assurez-vous d\'avoir une colonne email.');
            }

            // Sauvegarder les prospects
            if (typeof ProspectsModule !== 'undefined') {
                // Essayer d'abord de sauvegarder dans Supabase
                try {
                    if (window.supabase?.auth && typeof ProspectsModule.importProspects === 'function') {
                        const { data: { user } } = await window.supabase.auth.getUser();
                        if (user) {
                            console.log('Import Supabase:', prospects.length, 'prospects');
                            await ProspectsModule.importProspects(prospects, 'csv_wizard');
                            // Les prospects sont maintenant dans ProspectsModule.prospects via loadProspects()
                        } else {
                            throw new Error('Non connecté');
                        }
                    } else {
                        throw new Error('Supabase non disponible');
                    }
                } catch (e) {
                    // Fallback mode local
                    console.log('Import local (fallback):', prospects.length, 'prospects -', e.message);
                    const prospectsWithIds = prospects.map((p, i) => ({
                        ...p,
                        id: 'local_' + Date.now() + '_' + i,
                        source: 'csv_wizard',
                        status: 'new'
                    }));
                    ProspectsModule.prospects = [...(ProspectsModule.prospects || []), ...prospectsWithIds];
                }
            }

            // Rafraîchir le wizard
            if (importZone) {
                importZone.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #4caf50;">
                        <div style="font-size: 2em;">✅</div>
                        <p><strong>${prospects.length} prospects importés !</strong></p>
                        <button class="btn btn-primary" onclick="CampaignsModule.updateWizard()">Continuer</button>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Import error:', error);
            if (importZone) {
                importZone.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #f44336;">
                        <div style="font-size: 2em;">❌</div>
                        <p><strong>Erreur:</strong> ${error.message}</p>
                        <button class="btn btn-secondary" onclick="CampaignsModule.updateWizard()">Réessayer</button>
                    </div>
                `;
            }
        }
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

                <div class="form-group">
                    <label>Langue des emails</label>
                    <select id="campaignLanguage">
                        <option value="fr" ${(c.language || window.I18N?.getLanguage() || 'fr') === 'fr' ? 'selected' : ''}>Francais</option>
                        <option value="en" ${(c.language || window.I18N?.getLanguage() || 'fr') === 'en' ? 'selected' : ''}>English</option>
                    </select>
                </div>

                <div class="info-hint" style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border: 1px solid rgba(102, 126, 234, 0.2); border-radius: 10px; padding: 12px 15px; margin-top: 15px;">
                    <span style="font-size: 1.1em;">💡</span>
                    <span style="font-size: 0.9em; color: #555;">Tu configureras tes adresses d'envoi à l'étape 3 (multi-adresses avec rotation automatique).</span>
                </div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.backToEmailChoice()">
                        ← Retour
                    </button>
                    <button class="btn btn-cancel" onclick="CampaignsModule.closeWizard()">
                        ✕ Annuler
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveStep1()">
                        Continuer →
                    </button>
                </div>
            </div>
        `;
    },

    backToEmailChoice() {
        this.closeWizard();
        closeCampaignsModal();
        if (typeof showEmailChoiceModal === 'function') {
            showEmailChoiceModal();
        }
    },

    async saveStep1() {
        const name = document.getElementById('campaignName')?.value?.trim() || '';
        const goal = document.getElementById('campaignGoal')?.value?.trim() || '';
        const language = document.getElementById('campaignLanguage')?.value || 'fr';

        // Validation détaillée
        const missing = [];
        if (!name) missing.push('Nom de la campagne');
        if (!goal) missing.push('Objectif');

        if (missing.length > 0) {
            alert('Champs manquants : ' + missing.join(', '));
            return;
        }

        const campaignData = {
            name,
            goal,
            language
        };

        try {
            const token = await this.getAuthToken();

            if (this.currentCampaign?.id) {
                // Update
                const response = await fetch(`${this.API_URL}/api/campaigns/${this.currentCampaign.id}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(campaignData)
                });
                if (response.ok) {
                    const data = await response.json();
                    this.currentCampaign = data.campaign;
                } else {
                    console.warn('API Update failed, using local mode');
                    this.currentCampaign = { ...this.currentCampaign, ...campaignData };
                }
            } else {
                // Create
                const response = await fetch(`${this.API_URL}/api/campaigns`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(campaignData)
                });
                if (response.ok) {
                    const data = await response.json();
                    this.currentCampaign = data.campaign;
                } else {
                    console.warn('API Create failed, using local mode');
                    this.currentCampaign = { id: 'local_' + Date.now(), ...campaignData, status: 'draft' };
                }
            }
        } catch (error) {
            console.warn('API non disponible, mode local:', error.message);
            // Mode local - créer une campagne locale
            this.currentCampaign = { id: 'local_' + Date.now(), ...campaignData, status: 'draft' };
        }

        console.log('Campagne:', this.currentCampaign);
        this.currentStep = 2;
        this.updateWizard();
    },

    // ==========================================
    // STEP 2: SELECTION PROSPECTS
    // ==========================================

    renderStep2() {
        const prospects = ProspectsModule?.prospects || [];
        const stats = ProspectsModule?.getStats() || { total: 0, new: 0 };

        // Compter par source
        const salesNavProspects = prospects.filter(p => p.source === 'linkedin_extension' || p.source === 'linkedin_sales_navigator');
        const importedProspects = prospects.filter(p => p.source === 'csv_import' || p.source === 'manual' || (!p.source));
        const newProspects = prospects.filter(p => p.status === 'new');

        // Filtrer selon le filtre actif
        const getFilteredProspects = () => {
            switch(this.currentFilter) {
                case 'new': return newProspects;
                case 'sales_navigator': return salesNavProspects;
                case 'imported': return importedProspects;
                default: return prospects;
            }
        };
        const filteredProspects = getFilteredProspects();

        // Initialiser la sélection si vide
        if (this.selectedProspectIds.size === 0 && prospects.length > 0) {
            prospects.forEach(p => this.selectedProspectIds.add(p.id));
        }

        const selectedCount = this.selectedProspectIds.size;
        const allFilteredSelected = filteredProspects.every(p => this.selectedProspectIds.has(p.id));

        return `
            <div class="wizard-step-content">
                <h3>👥 Sélectionner les prospects</h3>

                <!-- Filtres en chips -->
                <div class="prospect-filter-chips">
                    <button class="filter-chip ${this.currentFilter === 'all' ? 'active' : ''}" onclick="CampaignsModule.setFilter('all')">
                        📋 Tous <span class="chip-count">${prospects.length}</span>
                    </button>
                    <button class="filter-chip ${this.currentFilter === 'new' ? 'active' : ''}" onclick="CampaignsModule.setFilter('new')">
                        ✨ Nouveaux <span class="chip-count">${newProspects.length}</span>
                    </button>
                </div>

                <!-- Barre de sélection -->
                <div class="prospect-selection-bar">
                    <div class="selection-info">
                        <input type="checkbox" id="selectAllProspects" ${allFilteredSelected ? 'checked' : ''} onchange="CampaignsModule.toggleSelectAll(this.checked)">
                        <label for="selectAllProspects">
                            <strong>${selectedCount}</strong> prospect${selectedCount > 1 ? 's' : ''} sélectionné${selectedCount > 1 ? 's' : ''}
                        </label>
                    </div>
                    <div class="selection-actions">
                        <button class="btn-link" onclick="CampaignsModule.selectAllFiltered()">Tout sélectionner</button>
                        <button class="btn-link" onclick="CampaignsModule.deselectAllFiltered()">Tout désélectionner</button>
                    </div>
                </div>

                ${prospects.length === 0 ? `
                    <div class="warning-box">
                        <p>⚠️ Aucun prospect importé.</p>
                    </div>
                ` : `
                    <!-- Liste scrollable avec checkboxes -->
                    <div class="prospects-checkbox-list">
                        ${filteredProspects.map(p => `
                            <label class="prospect-checkbox-item ${this.selectedProspectIds.has(p.id) ? 'selected' : ''}">
                                <input type="checkbox"
                                       data-id="${p.id}"
                                       ${this.selectedProspectIds.has(p.id) ? 'checked' : ''}
                                       onchange="CampaignsModule.toggleProspect('${p.id}', this.checked)">
                                <div class="prospect-info">
                                    <div class="prospect-name">${p.first_name} ${p.last_name || ''}</div>
                                    <div class="prospect-details">
                                        ${p.job_title ? `<span>${p.job_title}</span>` : ''}
                                        ${p.company ? `<span>@ ${p.company}</span>` : ''}
                                    </div>
                                    <div class="prospect-email">${p.email || '(pas d\'email)'}</div>
                                </div>
                                <div class="prospect-badges">
                                    ${p.status === 'new' ? '<span class="badge badge-new">Nouveau</span>' : ''}
                                    ${(p.source === 'linkedin_extension' || p.source === 'linkedin_sales_navigator') ? '<span class="badge badge-linkedin">💼 SN</span>' : ''}
                                    ${(p.source === 'csv_import') ? '<span class="badge badge-csv">📥</span>' : ''}
                                </div>
                            </label>
                        `).join('')}
                        ${filteredProspects.length === 0 ? '<div class="no-prospects-message">Aucun prospect dans cette catégorie</div>' : ''}
                    </div>
                `}

                <div class="prospect-actions-grid">
                    <div class="prospect-action-card" onclick="document.getElementById('wizardCsvInput').click()">
                        <div class="action-icon">📥</div>
                        <div class="action-title">Importer CSV</div>
                        <div class="action-desc">Importer depuis un fichier</div>
                        <input type="file" id="wizardCsvInput" accept=".csv" style="display: none;" onchange="CampaignsModule.handleWizardImport(event)">
                    </div>
                    <div class="prospect-action-card" onclick="CampaignsModule.showAddProspectForm()">
                        <div class="action-icon">➕</div>
                        <div class="action-title">Ajouter manuellement</div>
                        <div class="action-desc">Entrer un prospect</div>
                    </div>
                </div>

                <div id="addProspectForm" class="add-prospect-form" style="display: none;">
                    <h4>➕ Ajouter un prospect</h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Prénom *</label>
                            <input type="text" id="manualFirstName" placeholder="Marie">
                        </div>
                        <div class="form-group">
                            <label>Nom</label>
                            <input type="text" id="manualLastName" placeholder="Dupont">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Email *</label>
                        <input type="email" id="manualEmail" placeholder="marie@exemple.com">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Entreprise</label>
                            <input type="text" id="manualCompany" placeholder="Agence X">
                        </div>
                        <div class="form-group">
                            <label>Poste</label>
                            <input type="text" id="manualJobTitle" placeholder="CEO">
                        </div>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-secondary" onclick="CampaignsModule.hideAddProspectForm()">Annuler</button>
                        <button class="btn btn-primary" onclick="CampaignsModule.addManualProspect()">Ajouter</button>
                    </div>
                </div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(1)">
                        ← Retour
                    </button>
                    <button class="btn btn-cancel" onclick="CampaignsModule.closeWizard()">
                        ✕ Annuler
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveStep2()" ${selectedCount === 0 ? 'disabled' : ''}>
                        Continuer avec ${selectedCount} prospect${selectedCount > 1 ? 's' : ''} →
                    </button>
                </div>
            </div>
        `;
    },

    // Méthodes de gestion des filtres et sélection
    setFilter(filter) {
        this.currentFilter = filter;
        this.updateWizard();
    },

    toggleProspect(id, checked) {
        if (checked) {
            this.selectedProspectIds.add(id);
        } else {
            this.selectedProspectIds.delete(id);
        }
        this.updateWizard();
    },

    toggleSelectAll(checked) {
        const prospects = ProspectsModule?.prospects || [];
        const filteredProspects = this.getFilteredProspectsList();

        filteredProspects.forEach(p => {
            if (checked) {
                this.selectedProspectIds.add(p.id);
            } else {
                this.selectedProspectIds.delete(p.id);
            }
        });
        this.updateWizard();
    },

    selectAllFiltered() {
        const filteredProspects = this.getFilteredProspectsList();
        filteredProspects.forEach(p => this.selectedProspectIds.add(p.id));
        this.updateWizard();
    },

    deselectAllFiltered() {
        const filteredProspects = this.getFilteredProspectsList();
        filteredProspects.forEach(p => this.selectedProspectIds.delete(p.id));
        this.updateWizard();
    },

    getFilteredProspectsList() {
        const prospects = ProspectsModule?.prospects || [];
        switch(this.currentFilter) {
            case 'new': return prospects.filter(p => p.status === 'new');
            case 'sales_navigator': return prospects.filter(p => p.source === 'linkedin_extension' || p.source === 'linkedin_sales_navigator');
            case 'imported': return prospects.filter(p => p.source === 'csv_import' || p.source === 'manual' || (!p.source));
            default: return prospects;
        }
    },

    async saveStep2() {
        try {
            const allProspects = ProspectsModule?.prospects || [];

            // Filtrer selon les IDs sélectionnés
            const prospects = allProspects.filter(p => this.selectedProspectIds.has(p.id));

            console.log('saveStep2 - selected prospects:', prospects.length);

            if (prospects.length === 0) {
                alert('Aucun prospect sélectionné. Veuillez sélectionner au moins un prospect.');
                return;
            }

            // Filtrer les prospects désinscrits
            const filteredProspects = await this.filterUnsubscribedProspects(prospects);

            if (filteredProspects.length === 0) {
                alert('Tous les prospects sélectionnés se sont désinscrits de vos emails. Sélectionnez d\'autres prospects.');
                return;
            }

            if (filteredProspects.length < prospects.length) {
                const removedCount = prospects.length - filteredProspects.length;
                alert(`${removedCount} prospect(s) désinscrit(s) ont été retirés de la sélection.`);
            }

            this.selectedProspects = filteredProspects;

            // Mettre a jour la campagne si elle existe
            if (this.currentCampaign?.id) {
                try {
                    const token = await this.getAuthToken();
                    const response = await fetch(`${this.API_URL}/api/campaigns/${this.currentCampaign.id}`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            total_prospects: prospects.length,
                            prospect_ids: Array.from(this.selectedProspectIds)
                        })
                    });

                    if (!response.ok) {
                        console.warn('API non disponible, mode local activé');
                    }
                } catch (apiError) {
                    console.warn('Mode hors-ligne:', apiError.message);
                }
            } else {
                // Mode local sans API
                this.currentCampaign = this.currentCampaign || {};
                this.currentCampaign.total_prospects = prospects.length;
                console.log('Mode local - campagne:', this.currentCampaign);
            }

            this.currentStep = 3;
            this.updateWizard();
        } catch (error) {
            console.error('Erreur saveStep2:', error);
            alert('Une erreur est survenue. Vérifiez la console pour plus de détails.');
        }
    },

    goToStep(step) {
        this.currentStep = step;
        this.updateWizard();
    },

    // ==========================================
    // STEP 3: MES DONNÉES CLÉS (CONFIG OUTREACH)
    // ==========================================

    renderStep3_Config() {
        const config = this.outreachConfig || {};
        // Récupérer "Ma Voix" depuis le profil utilisateur
        const userProfile = this.getUserVoiceProfile();
        const hasVoice = userProfile && userProfile.voiceProfile;
        // Utiliser le style global comme défaut si pas de config locale
        const defaultFormalStyle = userProfile?.formalStyle || 'tu';
        const currentFormalStyle = config.formal_style || defaultFormalStyle;

        return `
            <div class="wizard-step-content">
                <h3>⚙️ Mes données clés</h3>
                <p class="step-description">Ces infos seront intégrées intelligemment dans tes emails par l'IA.</p>

                ${hasVoice ? `
                <div class="voice-integration-box">
                    <label class="voice-checkbox">
                        <input type="checkbox" id="useMyVoice" ${config.use_my_voice !== false ? 'checked' : ''}>
                        <span class="checkbox-label">
                            <strong>🎤 Utiliser "Ma Voix"</strong>
                            <small>L'IA reprendra ton style d'écriture personnel</small>
                        </span>
                    </label>
                    <button type="button" class="btn-edit-voice" onclick="CampaignsModule.openVoiceFromWizard()">
                        ✏️ Modifier
                    </button>
                </div>
                ` : `
                <div class="voice-integration-box no-voice clickable" onclick="CampaignsModule.openVoiceFromWizard()">
                    <span class="no-voice-icon">🎤</span>
                    <span class="no-voice-text">Configure "Ma Voix" pour que l'IA écrive comme toi</span>
                    <span class="configure-btn">Configurer →</span>
                </div>
                `}

                <div class="form-group">
                    <label>🎯 Mon offre * <span class="label-hint">(ce que tu proposes)</span></label>
                    <textarea id="userOffer" rows="3" placeholder="Ex: J'aide les agences à créer du contenu 3x plus vite grâce à l'IA, sans perdre leur style.">${config.user_offer || ''}</textarea>
                </div>

                <div class="form-group">
                    <label>📰 Mon actualité <span class="label-hint">(optionnel)</span></label>
                    <input type="text" id="userNews" placeholder="Ex: Je viens de lancer SOS Storytelling" value="${config.user_news || ''}">
                </div>

                <div class="form-group">
                    <label>⭐ Ma preuve sociale <span class="label-hint">(optionnel)</span></label>
                    <input type="text" id="userSocialProof" placeholder="Ex: Déjà 40 bêta-testeurs, dont 3 agences" value="${config.user_social_proof || ''}">
                </div>

                <div class="form-group">
                    <label>📞 Mon CTA * <span class="label-hint">(ce que tu veux qu'ils fassent)</span></label>
                    <input type="text" id="userCta" placeholder="Ex: 15 min pour te montrer comment ça marche" value="${config.user_cta || ''}">
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>👋 Style d'adresse</label>
                        <div class="style-toggle">
                            <label class="style-option ${currentFormalStyle === 'tu' ? 'active' : ''}" onclick="CampaignsModule.selectStyle('tu')">
                                <input type="radio" name="formalStyle" value="tu" ${currentFormalStyle === 'tu' ? 'checked' : ''}>
                                <span>Tu</span>
                            </label>
                            <label class="style-option ${currentFormalStyle === 'vous' ? 'active' : ''}" onclick="CampaignsModule.selectStyle('vous')">
                                <input type="radio" name="formalStyle" value="vous" ${currentFormalStyle === 'vous' ? 'checked' : ''}>
                                <span>Vous</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>🎨 Ton du message</label>
                        <div class="tone-toggle">
                            <label class="tone-option ${(config.tone || 'pro') === 'pro' ? 'active' : ''}" onclick="CampaignsModule.selectTone('pro')">
                                <input type="radio" name="toneSetting" value="pro" ${(config.tone || 'pro') === 'pro' ? 'checked' : ''}>
                                <span>Pro</span>
                            </label>
                            <label class="tone-option ${config.tone === 'expert' ? 'active' : ''}" onclick="CampaignsModule.selectTone('expert')">
                                <input type="radio" name="toneSetting" value="expert" ${config.tone === 'expert' ? 'checked' : ''}>
                                <span>Expert</span>
                            </label>
                            <label class="tone-option ${config.tone === 'chaleureux' ? 'active' : ''}" onclick="CampaignsModule.selectTone('chaleureux')">
                                <input type="radio" name="toneSetting" value="chaleureux" ${config.tone === 'chaleureux' ? 'checked' : ''}>
                                <span>Chaleureux</span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Section Multi-Adresses Email (Best Practice 2026) -->
                <div class="sender-selection-section" id="senderSelectionSection">
                    <div class="sender-selection-header">
                        <h4>📧 Adresses d'envoi</h4>
                        <span class="sender-selection-badge">20 emails/jour/adresse</span>
                    </div>
                    <div class="sender-info-box" style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1)); border: 1px solid rgba(102, 126, 234, 0.3); border-radius: 12px; padding: 14px 16px; margin-bottom: 15px;">
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 1.2em;">💡</span>
                            <div style="font-size: 0.9em; color: #333; line-height: 1.5;">
                                <strong style="color: #1a1a2e;">Conseil :</strong> Crée plusieurs adresses email chez ton fournisseur (ex: sandra@, contact@, hello@) pour augmenter ta capacité d'envoi. Limite recommandée : <strong style="color: #333;">20 emails/jour/adresse</strong> pour une délivrabilité optimale.
                            </div>
                        </div>
                    </div>
                    <div id="senderQuotaAlert" style="display: none; background: linear-gradient(135deg, rgba(245, 87, 108, 0.15), rgba(240, 147, 251, 0.1)); border: 1px solid rgba(245, 87, 108, 0.4); border-radius: 12px; padding: 14px 16px; margin-bottom: 15px;">
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 1.2em;">⚠️</span>
                            <div style="font-size: 0.9em; color: rgba(255,255,255,0.9); line-height: 1.5;">
                                <strong style="color: #f5576c;">Quota atteint !</strong> Toutes tes adresses ont atteint leur limite quotidienne. Ajoute de nouvelles adresses ou attends demain pour continuer à envoyer.
                            </div>
                        </div>
                    </div>
                    <div id="senderChipsContainer">
                        <!-- Chargé dynamiquement -->
                        <div style="text-align: center; padding: 15px; color: #888;">
                            <small>Chargement des adresses...</small>
                        </div>
                    </div>
                    <div class="sender-mini-stats" id="senderMiniStats" style="display: none;">
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="miniStatCapacity">0</span>
                            <span class="mini-stat-label">Capacité totale</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="miniStatRemaining">0</span>
                            <span class="mini-stat-label">Disponibles</span>
                        </div>
                        <div class="mini-stat">
                            <span class="mini-stat-value" id="miniStatSelected">0</span>
                            <span class="mini-stat-label">Sélectionnées</span>
                        </div>
                    </div>
                    <div style="margin-top: 10px; text-align: right;">
                        <button type="button" class="btn-link" onclick="CampaignsModule.openSenderManager()" style="color: #667eea; font-size: 0.85em; cursor: pointer; background: none; border: none; text-decoration: underline;">
                            + Gérer mes adresses
                        </button>
                    </div>
                </div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(2)">
                        ← Retour
                    </button>
                    <button class="btn btn-cancel" onclick="CampaignsModule.closeWizard()">
                        ✕ Annuler
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveStep3_Config()">
                        Continuer →
                    </button>
                </div>
            </div>
        `;
    },

    // Charger les adresses sender pour la sélection
    async loadSenderChips() {
        const container = document.getElementById('senderChipsContainer');
        const statsContainer = document.getElementById('senderMiniStats');
        if (!container) return;

        try {
            // Initialiser le module si pas fait
            if (typeof SenderEmailsModule !== 'undefined') {
                await SenderEmailsModule.init();
                const senders = SenderEmailsModule.getSenders();
                const stats = SenderEmailsModule.getStatsData();

                if (senders.length === 0) {
                    container.innerHTML = `
                        <div class="empty-senders-inline">
                            <p>Aucune adresse email configurée</p>
                            <button class="btn btn-primary btn-small" onclick="CampaignsModule.openSenderManager()">
                                + Ajouter une adresse
                            </button>
                        </div>
                    `;
                    return;
                }

                // Générer les chips
                const chips = senders.map(sender => {
                    const effectiveLimit = sender.warmup_enabled ? sender.warmup_current_limit : sender.daily_limit;
                    const remaining = Math.max(0, effectiveLimit - (sender.emails_sent_today || 0));
                    const atLimit = remaining === 0;
                    const isSelected = this.selectedSenders?.includes(sender.id) || (!this.selectedSenders && sender.is_active);

                    return `
                        <button type="button"
                                class="sender-chip ${isSelected ? 'selected' : ''} ${atLimit ? 'disabled' : ''}"
                                onclick="CampaignsModule.toggleSenderChip('${sender.id}')"
                                ${atLimit ? 'disabled' : ''}>
                            <span class="chip-email">${sender.email}</span>
                            <span class="chip-remaining">${remaining} restants</span>
                        </button>
                    `;
                }).join('');

                container.innerHTML = `<div class="sender-chips">${chips}</div>`;

                // Vérifier si toutes les adresses ont atteint leur quota
                const quotaAlert = document.getElementById('senderQuotaAlert');
                const allAtLimit = senders.every(sender => {
                    const effectiveLimit = sender.warmup_enabled ? sender.warmup_current_limit : sender.daily_limit;
                    return (sender.emails_sent_today || 0) >= effectiveLimit;
                });
                if (quotaAlert) {
                    quotaAlert.style.display = allAtLimit && senders.length > 0 ? 'block' : 'none';
                }

                // Afficher les mini stats
                if (statsContainer) {
                    statsContainer.style.display = 'flex';
                    document.getElementById('miniStatCapacity').textContent = stats.total_available_today || 0;
                    document.getElementById('miniStatRemaining').textContent = stats.total_remaining_today || 0;
                    const selectedCount = this.selectedSenders?.length || senders.filter(s => s.is_active).length;
                    document.getElementById('miniStatSelected').textContent = selectedCount;
                }

                // Initialiser selectedSenders si pas fait
                if (!this.selectedSenders) {
                    this.selectedSenders = senders.filter(s => s.is_active && !((s.warmup_enabled ? s.warmup_current_limit : s.daily_limit) - (s.emails_sent_today || 0) <= 0)).map(s => s.id);
                }
            }
        } catch (error) {
            console.error('Erreur chargement senders:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 15px; color: #888;">
                    <small>Erreur de chargement des adresses</small>
                </div>
            `;
        }
    },

    toggleSenderChip(senderId) {
        if (!this.selectedSenders) this.selectedSenders = [];

        const index = this.selectedSenders.indexOf(senderId);
        if (index > -1) {
            this.selectedSenders.splice(index, 1);
        } else {
            this.selectedSenders.push(senderId);
        }

        // Mettre à jour l'UI
        const chip = document.querySelector(`.sender-chip[onclick*="${senderId}"]`);
        if (chip) {
            chip.classList.toggle('selected');
        }

        // Mettre à jour le compteur
        const selectedCountEl = document.getElementById('miniStatSelected');
        if (selectedCountEl) {
            selectedCountEl.textContent = this.selectedSenders.length;
        }
    },

    openSenderManager() {
        // Créer une modal pour gérer les adresses
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'senderManagerModal';
        modal.innerHTML = `
            <div class="modal sender-manager-modal" style="max-width: 700px; width: 95%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
                    <h2 style="margin: 0;">📧 Gérer mes adresses d'envoi</h2>
                    <button class="modal-close" onclick="CampaignsModule.closeSenderManager()" style="color: white; font-size: 1.5em; background: none; border: none; cursor: pointer;">&times;</button>
                </div>
                <div id="senderManagerContent" style="padding: 20px;">
                    <!-- Rendu par SenderEmailsModule -->
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Rendre le panneau
        if (typeof SenderEmailsModule !== 'undefined') {
            SenderEmailsModule.renderSendersPanel('senderManagerContent');
        }
    },

    closeSenderManager() {
        const modal = document.getElementById('senderManagerModal');
        if (modal) modal.remove();
        // Recharger les chips
        this.loadSenderChips();
    },

    saveStep3_Config() {
        const userOffer = document.getElementById('userOffer')?.value?.trim();
        const userCta = document.getElementById('userCta')?.value?.trim();

        if (!userOffer || !userCta) {
            alert('Les champs "Mon offre" et "Mon CTA" sont obligatoires.');
            return;
        }

        // Vérifier qu'au moins une adresse est sélectionnée
        if (!this.selectedSenders || this.selectedSenders.length === 0) {
            alert('Sélectionnez au moins une adresse email d\'envoi.');
            return;
        }

        this.outreachConfig = {
            user_offer: userOffer,
            user_news: document.getElementById('userNews')?.value?.trim() || '',
            user_social_proof: document.getElementById('userSocialProof')?.value?.trim() || '',
            user_cta: userCta,
            formal_style: document.querySelector('input[name="formalStyle"]:checked')?.value || 'tu',
            tone: document.querySelector('input[name="toneSetting"]:checked')?.value || 'pro',
            use_my_voice: document.getElementById('useMyVoice')?.checked !== false,
            sender_email_ids: this.selectedSenders // Multi-adresses sélectionnées
        };

        console.log('Config outreach:', this.outreachConfig);
        this.currentStep = 4;
        this.updateWizard();
    },

    selectStyle(style) {
        // Mettre à jour le radio
        document.querySelector(`input[name="formalStyle"][value="${style}"]`).checked = true;
        // Mettre à jour les classes visuelles
        document.querySelectorAll('.style-option').forEach(el => el.classList.remove('active'));
        document.querySelector(`input[name="formalStyle"][value="${style}"]`).closest('.style-option').classList.add('active');
    },

    selectTone(tone) {
        // Mettre à jour le radio
        document.querySelector(`input[name="toneSetting"][value="${tone}"]`).checked = true;
        // Mettre à jour les classes visuelles
        document.querySelectorAll('.tone-option').forEach(el => el.classList.remove('active'));
        document.querySelector(`input[name="toneSetting"][value="${tone}"]`).closest('.tone-option').classList.add('active');
    },

    getUserVoiceProfile() {
        // Récupérer le profil utilisateur depuis localStorage
        try {
            const saved = localStorage.getItem('voyageCreatifUserProfile');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading user profile:', e);
        }
        return null;
    },

    openVoiceFromWizard() {
        // Sauvegarder l'état actuel du wizard
        const wizardState = {
            step: this.currentStep,
            campaign: this.currentCampaign,
            prospects: this.selectedProspects,
            config: this.outreachConfig,
            emails: this.sequenceEmails
        };

        // Fermer le wizard temporairement
        this.closeWizard();

        // Ouvrir "Ma Voix" avec callback pour revenir au wizard
        if (typeof showVoiceModalWithCallback === 'function') {
            showVoiceModalWithCallback(() => {
                // Restaurer l'état et rouvrir le wizard
                this.currentStep = wizardState.step;
                this.currentCampaign = wizardState.campaign;
                this.selectedProspects = wizardState.prospects;
                this.outreachConfig = wizardState.config;
                this.sequenceEmails = wizardState.emails;
                this.openWizardModal();
            });
        } else {
            // Fallback si la fonction n'est pas disponible
            alert('Veuillez configurer "Ma Voix" dans Paramètres, puis relancez le wizard.');
        }
    },

    showAddProspectForm() {
        document.getElementById('addProspectForm').style.display = 'block';
    },

    hideAddProspectForm() {
        document.getElementById('addProspectForm').style.display = 'none';
        // Reset form
        document.getElementById('manualFirstName').value = '';
        document.getElementById('manualLastName').value = '';
        document.getElementById('manualEmail').value = '';
        document.getElementById('manualCompany').value = '';
        document.getElementById('manualJobTitle').value = '';
    },

    addManualProspect() {
        const firstName = document.getElementById('manualFirstName').value.trim();
        const lastName = document.getElementById('manualLastName').value.trim();
        const email = document.getElementById('manualEmail').value.trim();
        const company = document.getElementById('manualCompany').value.trim();
        const jobTitle = document.getElementById('manualJobTitle').value.trim();

        if (!firstName || !email) {
            alert('Le prénom et l\'email sont obligatoires.');
            return;
        }

        if (!email.includes('@')) {
            alert('Veuillez entrer un email valide.');
            return;
        }

        const prospect = {
            id: 'local_' + Date.now(),
            first_name: firstName,
            last_name: lastName,
            email: email,
            company: company,
            job_title: jobTitle,
            status: 'new',
            source: 'manual'
        };

        // Ajouter au ProspectsModule
        if (typeof ProspectsModule !== 'undefined') {
            ProspectsModule.prospects = [...(ProspectsModule.prospects || []), prospect];
        }

        console.log('Prospect ajouté:', prospect);
        this.hideAddProspectForm();
        this.updateWizard();
    },

    // ==========================================
    // STEP 4: SEQUENCE D'EMAILS
    // ==========================================

    renderStep4_Emails() {
        return `
            <div class="wizard-step-content">
                <h3>📝 Créer la séquence d'emails</h3>
                <p class="step-description">Utilisez un template ou créez votre séquence personnalisée.</p>

                <div class="template-selector">
                    <h4>📋 Choisir un template de séquence</h4>
                    <div class="template-cards">
                        ${Object.values(this.SEQUENCE_TEMPLATES).map(template => `
                            <div class="template-card" onclick="CampaignsModule.applyTemplate('${template.id}')">
                                <div class="template-name">${template.name}</div>
                                <div class="template-desc">${template.description}</div>
                                <div class="template-meta">${template.emails.length} emails</div>
                            </div>
                        `).join('')}
                        <div class="template-card template-custom" onclick="CampaignsModule.startFromScratch()">
                            <div class="template-name">✍️ Personnalisé</div>
                            <div class="template-desc">Créez votre propre séquence</div>
                            <div class="template-meta">De zéro</div>
                        </div>
                    </div>
                </div>

                <div class="sequence-emails" id="sequenceEmails">
                    ${this.sequenceEmails.map((email, index) => this.renderSequenceEmail(email, index)).join('')}
                </div>

                ${this.sequenceEmails.length < 5 ? `
                    <button class="btn btn-secondary btn-add-email" onclick="CampaignsModule.addSequenceEmail()">
                        + Ajouter un email de relance
                    </button>
                ` : ''}

                <div class="sequence-tips">
                    <p>💡 <strong>Conseil :</strong> 3 emails max dans une séquence, au-delà ça devient du spam.</p>
                    <p>💡 Les relances ne sont envoyées que si le prospect n'a pas répondu.</p>
                </div>

                <!-- Section Enrichissement Intelligent -->
                <div class="enrichment-generation-box" style="background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 2px solid #38bdf8; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; color: #0284c7;">🔍 Enrichissement Intelligent (Optionnel)</h4>
                    <p style="color: #64748b; font-size: 0.9em; margin-bottom: 15px;">
                        Recherche des infos récentes sur chaque prospect (LinkedIn, actualités entreprise) pour personnaliser les emails.
                    </p>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn btn-secondary" onclick="CampaignsModule.showEnrichmentPanel()" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none;">
                            🔍 Enrichir les prospects
                        </button>
                        <span style="color: #94a3b8; font-size: 0.85em; display: flex; align-items: center;">
                            ${this.getEnrichmentStats()}
                        </span>
                    </div>
                </div>

                <div class="ai-generation-box">
                    <h4>🤖 Génération IA</h4>
                    <p>L'IA va générer une séquence personnalisée basée sur tes données clés et chaque prospect.</p>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="CampaignsModule.generateSequenceWithAI()">
                            ✨ Générer les emails avec l'IA
                        </button>
                        <button class="btn btn-secondary" onclick="CampaignsModule.generateSmartEmails()" style="background: linear-gradient(135deg, #11998e, #38ef7d); color: white; border: none;">
                            ✨ Générer avec enrichissement
                        </button>
                    </div>
                    <p style="font-size: 0.8em; color: #888; margin-top: 10px;">
                        💡 "Générer avec enrichissement" utilise les données trouvées sur chaque prospect pour un email hyper-personnalisé.
                    </p>
                </div>

                <div class="wizard-actions">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(3)">
                        ← Retour
                    </button>
                    <button class="btn btn-cancel" onclick="CampaignsModule.closeWizard()">
                        ✕ Annuler
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveStep4_Emails()">
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
                    <textarea class="email-body" rows="6" id="emailBody_${index}"
                              placeholder="Hello {first_name},

${isFirst ? 'Votre premier message de contact...' : 'Votre message de relance...'}"
                              onchange="CampaignsModule.updateEmailBody(${index}, this.value)">${email.body_template || ''}</textarea>
                    <p class="field-hint">Variables : {first_name}, {last_name}, {company}, {job_title}</p>

                    <div class="spintax-actions">
                        <button class="btn btn-spintax" onclick="CampaignsModule.generateSpintax(${index})" title="Generer des variations pour eviter le spam">
                            🎰 Generer Spintax
                        </button>
                        <span class="spintax-info">Cree des variations automatiques pour une meilleure delivrabilite</span>
                    </div>
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

    /**
     * Applique un template de séquence pré-défini
     */
    applyTemplate(templateId) {
        const template = this.SEQUENCE_TEMPLATES[templateId];
        if (!template) {
            console.error('Template non trouvé:', templateId);
            return;
        }

        // Copier les emails du template
        this.sequenceEmails = template.emails.map(email => ({
            ...email,
            subject_template: email.subject_template,
            body_template: email.body_template
        }));

        // Mettre à jour l'affichage
        document.getElementById('sequenceEmails').innerHTML =
            this.sequenceEmails.map((email, index) => this.renderSequenceEmail(email, index)).join('');

        // Notification
        if (typeof showToast === 'function') {
            showToast(`Template "${template.name}" appliqué !`, 'success');
        }
    },

    /**
     * Commence une séquence vierge
     */
    startFromScratch() {
        this.sequenceEmails = [
            { position: 1, delay_days: 0, subject_template: '', body_template: '', send_condition: 'always' }
        ];

        document.getElementById('sequenceEmails').innerHTML =
            this.sequenceEmails.map((email, index) => this.renderSequenceEmail(email, index)).join('');

        if (typeof showToast === 'function') {
            showToast('Séquence vierge créée', 'info');
        }
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

    /**
     * Genere une version spintax de l'email pour eviter les filtres spam
     */
    async generateSpintax(index) {
        const emailBody = this.sequenceEmails[index]?.body_template;

        if (!emailBody || emailBody.trim().length < 20) {
            alert('Ecris d\'abord le contenu de ton email avant de generer le spintax.');
            return;
        }

        const btn = document.querySelector(`[onclick="CampaignsModule.generateSpintax(${index})"]`);
        const originalText = btn?.innerHTML;
        if (btn) {
            btn.innerHTML = '⏳ Generation...';
            btn.disabled = true;
        }

        try {
            const response = await fetch(`${this.API_URL}/api/spintax`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: emailBody,
                    variations: 3,
                    language: window.I18N?.getLanguage() || 'fr'
                })
            });

            const data = await response.json();

            if (data.success && data.spintax) {
                // Afficher le modal avec le resultat
                this.showSpintaxResultModal(index, emailBody, data.spintax, data.combinations);
            } else {
                alert('Erreur lors de la generation du spintax. Reessaie.');
            }
        } catch (error) {
            console.error('Spintax error:', error);
            alert('Erreur de connexion. Verifie ta connexion internet.');
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }

        // Essayer de générer avec l'IA
        if (window.callAI && voiceProfile?.voiceProfile) {
            try {
                const emails = await this.generateWithRealAI(config, style, tone, voiceProfile);
                if (emails && emails.length > 0) {
                    this.sequenceEmails = emails;
                    console.log('Séquence générée par IA:', this.sequenceEmails);
                    this.updateWizard();
                    return;
                }
            } catch (error) {
                console.error('Erreur génération IA, fallback templates:', error);
            }
        }

        // Fallback sur les templates si pas d'IA ou erreur
        this.sequenceEmails = this.buildEmailSequence(config, style, tone, voiceProfile);
        console.log('Séquence générée (templates):', { style, tone, useMyVoice });
        this.updateWizard();
    },

    /**
     * Affiche le modal avec le resultat spintax
     */
    showSpintaxResultModal(index, original, spintax, combinations) {
        const existingModal = document.getElementById('spintaxResultModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'spintaxResultModal';
        modal.className = 'modal-overlay active';
        modal.innerHTML = `
            <div class="modal" style="max-width: 700px; width: 95%;">
                <div class="modal-header">
                    <h2>🎰 Spintax genere</h2>
                    <button class="modal-close" onclick="document.getElementById('spintaxResultModal').remove()">&times;</button>
                </div>
                <div class="modal-content">
                    <div class="spintax-result-info">
                        <div class="spintax-stat">
                            <span class="stat-number">${combinations.toLocaleString()}</span>
                            <span class="stat-label">combinaisons possibles</span>
                        </div>
                        <p class="spintax-tip">💡 Chaque destinataire recevra une version unique de ton email !</p>
                    </div>

                    <div class="spintax-preview">
                        <label>Version Spintax :</label>
                        <textarea id="spintaxOutput" rows="10" readonly style="font-family: monospace; font-size: 0.85em; background: #f5f5f5;">${spintax}</textarea>
                    </div>

                    <div class="spintax-actions-modal">
                        <button class="btn btn-secondary" onclick="CampaignsModule.copySpintax()">
                            📋 Copier
                        </button>
                        <button class="btn btn-primary" onclick="CampaignsModule.applySpintax(${index})">
                            ✅ Utiliser ce spintax
                        </button>
                    </div>

                    <div class="spintax-example">
                        <label>Exemple de rendu (1 version aleatoire) :</label>
                        <div class="example-render" id="spintaxExampleRender">
                            ${this.spinText(spintax)}
                        </div>
                        <button class="btn btn-small btn-secondary" onclick="CampaignsModule.refreshSpintaxExample('${spintax.replace(/'/g, "\\'")}')">
                            🔄 Voir une autre version
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Stocker le spintax temporairement
        this.tempSpintax = spintax;

        document.body.appendChild(modal);
    },

    /**
     * Copie le spintax dans le presse-papier
     */
    copySpintax() {
        const textarea = document.getElementById('spintaxOutput');
        if (textarea) {
            navigator.clipboard.writeText(textarea.value);
            alert('Spintax copie !');
        }
    },

    /**
     * Applique le spintax a l'email
     */
    applySpintax(index) {
        if (this.tempSpintax) {
            this.sequenceEmails[index].body_template = this.tempSpintax;

            // Mettre a jour le textarea
            const textarea = document.getElementById(`emailBody_${index}`);
            if (textarea) {
                textarea.value = this.tempSpintax;
            }

            document.getElementById('spintaxResultModal')?.remove();
            alert('Spintax applique ! Ton email utilisera maintenant des variations automatiques.');
        }
    },

    /**
     * Rafraichit l'exemple de rendu spintax
     */
    refreshSpintaxExample(spintax) {
        const render = document.getElementById('spintaxExampleRender');
        if (render && spintax) {
            render.innerHTML = this.spinText(spintax.replace(/\\'/g, "'"));
        }
    },

    /**
     * Deroule un spintax en une version aleatoire
     */
    spinText(spintaxText) {
        return spintaxText.replace(/\{([^{}]+)\}/g, (match, options) => {
            const choices = options.split('|');
            return choices[Math.floor(Math.random() * choices.length)];
        });
    },

    async generateSequenceWithAI() {
        const content = document.getElementById('wizardContent');

        content.innerHTML = `
            <div class="generating-state">
                <div class="spinner"></div>
                <p>🎤 L'IA génère tes emails personnalisés...</p>
                <p style="font-size: 0.85em; color: #888; margin-top: 10px;">Cela peut prendre quelques secondes</p>
            </div>
        `;

        const config = this.outreachConfig || {};
        const style = config.formal_style === 'vous' ? 'vous' : 'tu';
        const tone = config.tone || 'pro';
        const useMyVoice = config.use_my_voice !== false;

        // Récupérer "Ma Voix" si activé
        let voiceProfile = null;
        if (useMyVoice) {
            voiceProfile = this.getUserVoiceProfile();
        }

        // Essayer de générer avec l'IA
        if (window.callAI && voiceProfile?.voiceProfile) {
            try {
                const emails = await this.generateWithRealAI(config, style, tone, voiceProfile);
                if (emails && emails.length > 0) {
                    this.sequenceEmails = emails;
                    console.log('Séquence générée par IA:', this.sequenceEmails);
                    this.updateWizard();
                    return;
                }
            } catch (error) {
                console.error('Erreur génération IA, fallback templates:', error);
            }
        }

        // Fallback sur les templates si pas d'IA ou erreur
        this.sequenceEmails = this.buildEmailSequence(config, style, tone, voiceProfile);
        console.log('Séquence générée (templates):', { style, tone, useMyVoice });
        this.updateWizard();
    },

    async generateWithRealAI(config, style, tone, voiceProfile) {
        const vp = voiceProfile.voiceProfile;
        const senderInfo = this.getSelectedSenderInfo();
        const senderName = senderInfo.name || voiceProfile.nom || 'Moi';

        const toneDescriptions = {
            pro: 'professionnel et direct',
            expert: 'expert et autoritaire, montrant ton expertise',
            chaleureux: 'chaleureux et humain, créant une vraie connexion'
        };

        const prompt = `Tu es un expert en cold emailing. Génère une séquence de 3 emails de prospection.

INFORMATIONS ESSENTIELLES :
- Mon offre : ${config.user_offer}
- Mon actualité : ${config.user_news || 'Aucune'}
- Ma preuve sociale : ${config.user_social_proof || 'Aucune'}
- Mon CTA : ${config.user_cta}
- Style d'adresse : ${style === 'vous' ? 'Vouvoiement' : 'Tutoiement'}
- Ton souhaité : ${toneDescriptions[tone] || toneDescriptions.pro}
- Mon prénom : ${senderName}

MA VOIX (TRÈS IMPORTANT - reproduis ce style) :
- Ton général : ${vp.ton || 'Non défini'}
- Longueur des phrases : ${vp.longueurPhrases || 'Variable'}
- Expressions favorites : ${vp.expressions || 'Aucune en particulier'}
- Style de ponctuation : ${vp.ponctuation || 'Standard'}
- Style narratif : ${vp.styleNarratif || 'Direct'}
${voiceProfile.messageUnique ? `- Ce qui me rend unique : ${voiceProfile.messageUnique}` : ''}
${voiceProfile.domaine ? `- Mon domaine : ${voiceProfile.domaine}` : ''}

RÈGLES ABSOLUES :
1. Utilise {first_name} pour le prénom du prospect
2. Email 1 (J+0) : Premier contact, présentation de l'offre
3. Email 2 (J+3) : Relance douce, rappel de valeur
4. Email 3 (J+7) : Dernière relance, sans pression
5. Max 150 mots par email
6. Reproduis VRAIMENT mon style d'écriture (expressions, ponctuation, ton)
7. Pas de langage corporate ou générique
8. GRAMMAIRE PARFAITE : vérifie les accords, conjugaisons, majuscules (ex: "J'offre" pas "j'offre" en début de phrase)
9. Évite les répétitions et les phrases maladroites
10. Intègre naturellement mes infos (offre, actu, preuve sociale, CTA) sans les copier-coller mot pour mot

⚠️ RÈGLE CRITIQUE - TUTOIEMENT/VOUVOIEMENT :
- Style demandé : ${style === 'vous' ? 'VOUVOIEMENT UNIQUEMENT (vous, votre, vos)' : 'TUTOIEMENT UNIQUEMENT (tu, ton, ta, tes)'}
- Tu dois utiliser EXCLUSIVEMENT ce style dans TOUS les emails, du début à la fin
- Ne mélange JAMAIS tu/vous dans le même email
- Vérifie chaque phrase pour t'assurer du bon style

Réponds UNIQUEMENT avec ce JSON (sans markdown, sans explication) :
{
  "emails": [
    {
      "subject": "Objet email 1",
      "body": "Corps email 1"
    },
    {
      "subject": "Objet email 2",
      "body": "Corps email 2"
    },
    {
      "subject": "Objet email 3",
      "body": "Corps email 3"
    }
  ]
}`;

        const response = await window.callAI(prompt);

        // Parser le JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Format invalide');

        const data = JSON.parse(jsonMatch[0]);

        if (!data.emails || data.emails.length < 3) {
            throw new Error('Emails manquants');
        }

        // Convertir au format attendu
        return data.emails.map((email, index) => ({
            position: index + 1,
            delay_days: index === 0 ? 0 : (index === 1 ? 3 : 7),
            subject_template: email.subject,
            body_template: email.body,
            send_condition: index === 0 ? 'always' : 'no_reply'
        }));
    },

    buildEmailSequence(config, style, tone, voiceProfile) {
        const senderInfo = this.getSelectedSenderInfo();
        const senderName = senderInfo.name || voiceProfile?.nom || 'Moi';

        // Définir les variations selon le ton
        const toneVariants = {
            pro: {
                greeting: style === 'vous' ? 'Bonjour' : 'Bonjour',
                closing: style === 'vous' ? 'Bien cordialement' : 'Cordialement',
                intro: style === 'vous' ? 'Je me permets de vous contacter.' : 'Je me permets de te contacter.',
                followup: style === 'vous' ? 'Je me permets de revenir vers vous' : 'Je me permets de revenir vers toi',
                lastChance: style === 'vous' ? 'Je ne souhaite pas vous importuner davantage.' : 'Je ne veux pas t\'importuner davantage.',
                ctaIntro: style === 'vous' ? 'Auriez-vous' : 'Aurais-tu',
                ctaSuffix: style === 'vous' ? 'à m\'accorder pour' : 'à m\'accorder pour',
                question: style === 'vous' ? 'Avez-vous eu l\'occasion' : 'As-tu eu l\'occasion'
            },
            expert: {
                greeting: style === 'vous' ? 'Bonjour' : 'Bonjour',
                closing: style === 'vous' ? 'À votre disposition' : 'À ta disposition',
                intro: style === 'vous' ? 'Suite à mon analyse de votre activité.' : 'Suite à mon analyse de ton activité.',
                followup: style === 'vous' ? 'Je reviens vers vous concernant' : 'Je reviens vers toi concernant',
                lastChance: style === 'vous' ? 'Je comprends que votre temps est précieux.' : 'Je comprends que ton temps est précieux.',
                ctaIntro: style === 'vous' ? 'Auriez-vous' : 'Aurais-tu',
                ctaSuffix: style === 'vous' ? 'à m\'accorder pour' : 'à m\'accorder pour',
                question: style === 'vous' ? 'Avez-vous eu le temps d\'examiner' : 'As-tu eu le temps d\'examiner'
            },
            chaleureux: {
                greeting: style === 'vous' ? 'Bonjour' : 'Salut',
                closing: style === 'vous' ? 'Au plaisir d\'échanger' : 'À très vite',
                intro: style === 'vous' ? 'J\'espère que vous allez bien !' : 'J\'espère que tu vas bien !',
                followup: style === 'vous' ? 'Je voulais reprendre contact avec vous' : 'Je voulais reprendre contact avec toi',
                lastChance: style === 'vous' ? 'Je ne vais pas vous embêter plus longtemps !' : 'Je ne vais pas t\'embêter plus longtemps !',
                ctaIntro: style === 'vous' ? 'Ça vous dirait,' : 'Ça te dirait,',
                ctaSuffix: 'pour',
                question: style === 'vous' ? 'Avez-vous pu jeter un œil' : 'As-tu pu jeter un œil'
            }
        };

        const t = toneVariants[tone] || toneVariants.pro;
        const stylePron = style === 'vous' ? 'votre' : 'ton';

        // Intégrer "Ma Voix" si disponible (profil analysé par IA)
        let voiceSignature = '';
        let voiceOpener = '';
        let voiceExpressions = '';

        if (voiceProfile && voiceProfile.voiceProfile) {
            const vp = voiceProfile.voiceProfile;

            // Ajouter une expression caractéristique si disponible
            if (vp.expressions) {
                voiceExpressions = `\n\n${vp.expressions.split(',')[0]?.trim() || ''}`;
            }

            // Adapter selon le domaine du profil utilisateur
            if (voiceProfile.domaine) {
                voiceOpener = `En tant que ${voiceProfile.domaine}, `;
            }

            // Ajouter le message unique si présent
            if (voiceProfile.messageUnique) {
                voiceSignature = `\n\nPS: ${voiceProfile.messageUnique}`;
            }

            console.log('Ma Voix intégrée:', { ton: vp.ton, expressions: vp.expressions });
        } else if (voiceProfile) {
            // Fallback sur le profil basique
            if (voiceProfile.messageUnique) {
                voiceSignature = `\n\nPS: ${voiceProfile.messageUnique}`;
            }
            if (voiceProfile.domaine) {
                voiceOpener = `En tant que ${voiceProfile.domaine}, `;
            }
        }

        return [
            {
                position: 1,
                delay_days: 0,
                subject_template: tone === 'expert'
                    ? `Une opportunité pour ${stylePron} activité`
                    : tone === 'chaleureux'
                        ? `Une idée qui pourrait ${style === 'vous' ? 'vous' : 'te'} plaire`
                        : `Une idée pour ${stylePron} contenu`,
                body_template: `${t.greeting} {first_name},

${t.intro}

${voiceOpener}${config.user_offer || "J'aide les professionnels à créer du contenu plus efficacement."}

${config.user_news ? config.user_news + '\n\n' : ''}${config.user_social_proof ? config.user_social_proof + '\n\n' : ''}${t.ctaIntro} ${config.user_cta || '15 min'}${t.ctaSuffix ? ' ' + t.ctaSuffix : ''} en discuter ?

${t.closing},
${senderName}${voiceSignature}`,
                send_condition: 'always'
            },
            {
                position: 2,
                delay_days: 3,
                subject_template: `Re: ${tone === 'expert' ? 'Une opportunité' : 'Une idée'} pour ${stylePron} ${tone === 'expert' ? 'activité' : 'contenu'}`,
                body_template: `${t.greeting} {first_name},

${t.followup} mon précédent message.

${t.question} d'y jeter un œil ?

Je reste ${style === 'vous' ? 'à votre disposition' : 'dispo'} si ${style === 'vous' ? 'vous avez' : 'tu as'} des questions.

${t.closing},
${senderName}`,
                send_condition: 'no_reply'
            },
            {
                position: 3,
                delay_days: 7,
                subject_template: tone === 'chaleureux' ? `Un dernier petit mot` : `Dernière relance`,
                body_template: `${t.greeting} {first_name},

${t.lastChance}

Si ${style === 'vous' ? 'le' : 'ton'} timing n'est pas le bon, pas de souci.
${style === 'vous' ? 'Mais si cela vous intéresse' : 'Mais si ça t\'intéresse'}, je reste ${style === 'vous' ? 'disponible' : 'dispo'}.

${tone === 'chaleureux' ? 'Bonne continuation !' : 'Bonne continuation,'}
${senderName}`,
                send_condition: 'no_reply'
            }
        ];
    },

    async saveStep4_Emails() {
        // Valider qu'au moins le premier email est rempli
        const firstEmail = this.sequenceEmails[0];
        if (!firstEmail.subject_template || !firstEmail.body_template) {
            alert('Veuillez remplir au moins le premier email de la séquence');
            return;
        }

        try {
            // Sauvegarder si API disponible
            if (this.currentCampaign?.id && !this.currentCampaign.id.startsWith('local_')) {
                const token = await this.getAuthToken();
                await fetch(`${this.API_URL}/api/campaigns/${this.currentCampaign.id}/sequence`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ emails: this.sequenceEmails })
                });
            }

            // Générer les previews avec footer de désinscription
            const campaignId = this.currentCampaign?.id || null;
            this.generatedPreviews = this.selectedProspects.slice(0, 5).map(prospect => ({
                prospect,
                emails: this.sequenceEmails.map(seq => {
                    const baseBody = this.personalizeTemplate(seq.body_template, prospect);
                    const bodyWithUnsubscribe = this.addUnsubscribeToEmail(baseBody, prospect.email, campaignId, prospect.id);
                    return {
                        subject: this.personalizeTemplate(seq.subject_template, prospect),
                        body: bodyWithUnsubscribe,
                        delay_days: seq.delay_days
                    };
                })
            }));

            this.currentStep = 5;
            this.updateWizard();

        } catch (error) {
            console.error('Error saving sequence:', error);
            // Continuer même en cas d'erreur API
            this.currentStep = 5;
            this.updateWizard();
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
    // STEP 5: PREVIEW & LANCEMENT
    // ==========================================

    renderStep5_Launch() {
        const preview = this.generatedPreviews[this.previewIndex];
        if (!preview) {
            return `
                <div class="wizard-step-content">
                    <p>Aucun aperçu disponible. Générez d'abord les emails.</p>
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(4)">← Retour</button>
                </div>
            `;
        }

        const prospect = preview.prospect;
        const c = this.currentCampaign;
        const senderInfo = this.getSelectedSenderInfo();

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
                                    <span class="label">De:</span> ${senderInfo.name} &lt;${senderInfo.email}&gt;
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
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(4)">
                        ← Retour
                    </button>
                    <button class="btn btn-cancel" onclick="CampaignsModule.closeWizard()">
                        ✕ Annuler
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

        // Mode local - simuler le lancement
        if (this.currentCampaign?.id?.startsWith('local_') || !window.supabase?.auth) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            content.innerHTML = `
                <div class="launch-success">
                    <div class="success-icon">🚀</div>
                    <h3>Campagne prête !</h3>
                    <p><strong>${this.selectedProspects.length}</strong> prospects × <strong>${this.sequenceEmails.length}</strong> email(s)</p>
                    <div class="demo-notice" style="background: #fff3cd; padding: 15px; border-radius: 10px; margin: 20px 0;">
                        <p style="margin: 0; color: #856404;">⚠️ <strong>Mode démo</strong> - Pour envoyer réellement les emails, connectez-vous à votre compte.</p>
                    </div>
                    <div class="preview-emails" style="text-align: left; margin-top: 20px;">
                        <h4>📧 Aperçu du premier email :</h4>
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; font-family: monospace; font-size: 0.9em;">
                            <p><strong>Objet:</strong> ${this.sequenceEmails[0]?.subject_template || 'N/A'}</p>
                            <hr style="border: none; border-top: 1px solid #ddd; margin: 10px 0;">
                            <p style="white-space: pre-wrap;">${this.sequenceEmails[0]?.body_template?.replace(/{first_name}/g, this.selectedProspects[0]?.first_name || 'Marie') || 'N/A'}</p>
                        </div>
                    </div>
                    <button class="btn btn-primary" style="margin-top: 20px;" onclick="CampaignsModule.closeWizard();">
                        Fermer
                    </button>
                </div>
            `;
            return;
        }

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
                        <h3>Campagne lancée !</h3>
                        <p>${data.prospects_count} prospects vont recevoir ${data.sequence_emails} email(s)</p>
                        ${scheduled_at ? `<p>Premier envoi prévu : ${new Date(data.first_send_at).toLocaleString()}</p>` : ''}
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
                        Réessayer
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
    },

    // ==========================================
    // ENRICHMENT INTEGRATION
    // ==========================================

    /**
     * Obtenir les stats d'enrichissement des prospects sélectionnés
     */
    getEnrichmentStats() {
        const prospects = this.selectedProspects || [];
        if (prospects.length === 0) return 'Sélectionnez des prospects';

        const enriched = prospects.filter(p => p.enrichment_status === 'enriched').length;
        const pending = prospects.filter(p => !p.enrichment_status || p.enrichment_status === 'pending').length;
        const noData = prospects.filter(p => p.enrichment_status === 'no_data').length;

        if (enriched === prospects.length) {
            return `✅ ${enriched}/${prospects.length} enrichis`;
        } else if (pending > 0) {
            return `⏳ ${pending} à enrichir · ${enriched} enrichis`;
        } else {
            return `${enriched} enrichis · ${noData} sans données`;
        }
    },

    /**
     * Afficher le panel d'enrichissement
     */
    showEnrichmentPanel() {
        if (typeof EnrichmentModule === 'undefined') {
            alert('Module d\'enrichissement non disponible');
            return;
        }

        const prospects = this.selectedProspects || [];
        if (prospects.length === 0) {
            alert('Sélectionnez d\'abord des prospects');
            return;
        }

        // Initialiser le module d'enrichissement avec la campagne courante
        const campaignContext = {
            product_description: this.outreachConfig?.user_offer || '',
            value_proposition: this.outreachConfig?.user_social_proof || '',
            target_persona: '',
            pain_points: [],
            email_tone: this.outreachConfig?.tone || 'pro'
        };

        EnrichmentModule.init(campaignContext, prospects);

        // Créer le modal d'enrichissement
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'enrichmentPanelModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center;">
                    <h2 style="margin: 0; font-size: 1.2em;">🔍 Enrichissement des Prospects</h2>
                    <button onclick="CampaignsModule.closeEnrichmentPanel()" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer;">&times;</button>
                </div>
                <div class="modal-body" style="padding: 25px;">
                    ${EnrichmentModule.renderBatchPanel(prospects, campaignContext)}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    /**
     * Fermer le panel d'enrichissement
     */
    closeEnrichmentPanel() {
        const modal = document.getElementById('enrichmentPanelModal');
        if (modal) {
            modal.remove();
            // Rafraîchir les stats
            this.updateWizard();
        }
    },

    /**
     * Générer des emails intelligents avec enrichissement
     */
    async generateSmartEmails() {
        if (typeof EnrichmentModule === 'undefined') {
            alert('Module d\'enrichissement non disponible');
            return;
        }

        const prospects = this.selectedProspects || [];
        if (prospects.length === 0) {
            alert('Sélectionnez d\'abord des prospects');
            return;
        }

        // Vérifier si les prospects sont enrichis
        const notEnriched = prospects.filter(p => !p.enrichment_status || p.enrichment_status === 'pending');

        if (notEnriched.length > 0) {
            const confirm = window.confirm(
                `${notEnriched.length} prospect(s) ne sont pas encore enrichis.\n\n` +
                `Voulez-vous les enrichir maintenant avant de générer les emails ?`
            );

            if (confirm) {
                this.showEnrichmentPanel();
                return;
            }
        }

        const content = document.getElementById('wizardContent');
        content.innerHTML = `
            <div class="generating-state">
                <div class="spinner"></div>
                <p>🎤 Génération des emails personnalisés en cours...</p>
                <p style="font-size: 0.85em; color: #888; margin-top: 10px;">
                    Utilisation des données d'enrichissement pour chaque prospect
                </p>
                <div id="smartEmailProgress" style="margin-top: 20px; text-align: center;">
                    <span class="progress-text">0 / ${prospects.length}</span>
                </div>
            </div>
        `;

        // Générer les emails pour chaque prospect
        const generatedEmails = [];
        const campaignContext = {
            product_description: this.outreachConfig?.user_offer || '',
            value_proposition: this.outreachConfig?.user_social_proof || '',
            target_persona: '',
            pain_points: [],
            email_tone: this.outreachConfig?.tone || 'pro'
        };

        for (let i = 0; i < prospects.length; i++) {
            const prospect = prospects[i];

            try {
                const email = await EnrichmentModule.generateEmailForProspect(prospect, campaignContext);
                generatedEmails.push({
                    prospect,
                    email,
                    personalization_level: email.personalization_level || 'none'
                });
            } catch (error) {
                console.error('Erreur génération email pour', prospect.email, error);
                generatedEmails.push({
                    prospect,
                    email: null,
                    error: error.message
                });
            }

            // Mettre à jour la progression
            const progressEl = document.getElementById('smartEmailProgress');
            if (progressEl) {
                progressEl.innerHTML = `<span class="progress-text">${i + 1} / ${prospects.length}</span>`;
            }
        }

        // Afficher les résultats
        this.showSmartEmailResults(generatedEmails);
    },

    /**
     * Afficher les résultats de génération d'emails intelligents
     */
    showSmartEmailResults(generatedEmails) {
        const successful = generatedEmails.filter(e => e.email && !e.error);
        const failed = generatedEmails.filter(e => e.error);

        const highPersonalization = successful.filter(e => e.personalization_level === 'high').length;
        const mediumPersonalization = successful.filter(e => e.personalization_level === 'medium').length;

        const content = document.getElementById('wizardContent');
        content.innerHTML = `
            <div class="smart-email-results" style="padding: 20px;">
                <h3 style="margin-bottom: 20px;">✨ Emails générés avec succès</h3>

                <div class="results-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 25px;">
                    <div style="background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 10px; padding: 15px; text-align: center;">
                        <div style="font-size: 2em; font-weight: 700; color: #388e3c;">${successful.length}</div>
                        <div style="font-size: 0.8em; color: #666;">Emails générés</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #e3f2fd, #bbdefb); border-radius: 10px; padding: 15px; text-align: center;">
                        <div style="font-size: 2em; font-weight: 700; color: #1976d2;">${highPersonalization}</div>
                        <div style="font-size: 0.8em; color: #666;">Haute perso</div>
                    </div>
                    <div style="background: linear-gradient(135deg, #fff8e1, #ffecb3); border-radius: 10px; padding: 15px; text-align: center;">
                        <div style="font-size: 2em; font-weight: 700; color: #f57c00;">${mediumPersonalization}</div>
                        <div style="font-size: 0.8em; color: #666;">Moyenne perso</div>
                    </div>
                    ${failed.length > 0 ? `
                        <div style="background: linear-gradient(135deg, #ffebee, #ffcdd2); border-radius: 10px; padding: 15px; text-align: center;">
                            <div style="font-size: 2em; font-weight: 700; color: #c62828;">${failed.length}</div>
                            <div style="font-size: 0.8em; color: #666;">Erreurs</div>
                        </div>
                    ` : ''}
                </div>

                <div class="emails-preview-list" style="max-height: 400px; overflow-y: auto; border: 1px solid #e8ecff; border-radius: 10px;">
                    ${successful.map((item, index) => `
                        <div class="email-preview-item" style="padding: 15px; border-bottom: 1px solid #f0f0f0; ${index === successful.length - 1 ? 'border-bottom: none;' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <div>
                                    <strong>${item.prospect.first_name || ''} ${item.prospect.last_name || ''}</strong>
                                    <span style="color: #888; font-size: 0.85em; margin-left: 8px;">${item.prospect.company || ''}</span>
                                </div>
                                <span style="font-size: 0.75em; padding: 3px 8px; border-radius: 10px; background: ${
                                    item.personalization_level === 'high' ? '#e8f5e9; color: #388e3c' :
                                    item.personalization_level === 'medium' ? '#fff8e1; color: #f57c00' :
                                    '#f5f5f5; color: #666'
                                };">
                                    ${item.personalization_level === 'high' ? '🎯 Haute' :
                                      item.personalization_level === 'medium' ? '👍 Moyenne' :
                                      '📝 Standard'}
                                </span>
                            </div>
                            <div style="background: #fafbff; border-radius: 8px; padding: 12px;">
                                <div style="font-weight: 500; color: #333; margin-bottom: 5px;">📧 ${item.email.subject}</div>
                                <div style="font-size: 0.85em; color: #666; white-space: pre-line; max-height: 100px; overflow: hidden;">
                                    ${item.email.body.substring(0, 200)}...
                                </div>
                            </div>
                            <button onclick="CampaignsModule.editSmartEmail(${index})" style="margin-top: 10px; background: #f5f7ff; border: 1px solid #e8ecff; padding: 6px 12px; border-radius: 6px; font-size: 0.8em; cursor: pointer;">
                                ✏️ Modifier
                            </button>
                        </div>
                    `).join('')}
                </div>

                <div class="wizard-actions" style="margin-top: 25px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="CampaignsModule.goToStep(4)">
                        ← Retour
                    </button>
                    <button class="btn btn-primary" onclick="CampaignsModule.saveSmartEmails()" style="background: linear-gradient(135deg, #11998e, #38ef7d);">
                        ✅ Valider et continuer
                    </button>
                </div>
            </div>
        `;

        // Stocker les emails générés
        this.smartGeneratedEmails = generatedEmails;
    },

    /**
     * Éditer un email généré
     */
    editSmartEmail(index) {
        const item = this.smartGeneratedEmails[index];
        if (!item || !item.email) return;

        if (typeof EnrichmentModule !== 'undefined') {
            EnrichmentModule.renderEmailValidationModal({
                prospect: item.prospect,
                subject: item.email.subject,
                body: item.email.body,
                personalization_used: item.email.personalization_used,
                analysis: { confidence_score: item.email.confidence_score }
            });
        }
    },

    /**
     * Sauvegarder les emails intelligents et continuer
     */
    async saveSmartEmails() {
        // Utiliser le premier email comme template pour la séquence
        const successful = (this.smartGeneratedEmails || []).filter(e => e.email);

        if (successful.length > 0) {
            // Créer une séquence à partir des emails générés
            this.sequenceEmails = [{
                position: 1,
                delay_days: 0,
                subject_template: successful[0].email.subject,
                body_template: successful[0].email.body,
                send_condition: 'always'
            }];

            // Ajouter les relances standard
            if (this.sequenceEmails.length < 3) {
                this.sequenceEmails.push({
                    position: 2,
                    delay_days: 3,
                    subject_template: 'Re: ' + successful[0].email.subject,
                    body_template: `Bonjour {first_name},

Je me permets de revenir vers vous concernant mon précédent message.

${successful[0].email.personalization_used ? `Je reste convaincu(e) que ce sujet est pertinent pour vous.` : ''}

Seriez-vous disponible pour un bref échange ?`,
                    send_condition: 'no_reply'
                });
            }
        }

        // Continuer vers l'étape 5
        this.goToStep(5);
    },

    /**
     * Ajouter un email approuvé (appelé depuis EnrichmentModule)
     */
    async addApprovedEmail(prospectId, email) {
        // Stocker l'email approuvé pour ce prospect
        if (!this.approvedEmails) {
            this.approvedEmails = {};
        }
        this.approvedEmails[prospectId] = email;

        console.log('Email approuvé pour prospect:', prospectId, email);
    },

    /**
     * Charger les prospects (pour le module d'enrichissement)
     */
    async loadProspects() {
        // Retourner les prospects sélectionnés ou tous les prospects du ProspectsModule
        if (this.selectedProspects && this.selectedProspects.length > 0) {
            return this.selectedProspects;
        }

        if (typeof ProspectsModule !== 'undefined' && ProspectsModule.prospects) {
            return ProspectsModule.prospects;
        }

        return [];
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
    gap: 10px;
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
}

.wizard-actions .btn-cancel {
    background: transparent;
    color: #999;
    border: 1px solid #ddd;
    font-size: 0.9em;
}

.wizard-actions .btn-cancel:hover {
    background: #f5f5f5;
    color: #666;
    border-color: #ccc;
}

/* Form Layout */
.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
}

@media (max-width: 600px) {
    .form-row {
        grid-template-columns: 1fr;
    }
}

/* Config Step Styles */
.label-hint {
    font-weight: 400;
    color: #888;
    font-size: 0.85em;
}

.style-toggle {
    display: flex;
    gap: 10px;
}

.style-option {
    flex: 1;
    padding: 15px 20px;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.style-option:hover {
    border-color: #667eea;
    background: #f8f9ff;
}

.style-option.active,
.style-option:has(input:checked) {
    border-color: #667eea;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.style-option input {
    display: none;
}

.style-option span {
    font-weight: 600;
    font-size: 1.1em;
}

/* Tone Toggle */
.tone-toggle {
    display: flex;
    gap: 8px;
}

.tone-option {
    flex: 1;
    padding: 12px 10px;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
    font-size: 0.9em;
}

.tone-option:hover {
    border-color: #667eea;
    background: #f8f9ff;
}

.tone-option.active,
.tone-option:has(input:checked) {
    border-color: #667eea;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.tone-option input {
    display: none;
}

.tone-option span {
    font-weight: 600;
}

/* Voice Integration Box */
.voice-integration-box {
    background: linear-gradient(135deg, #f0f4ff, #f8f0ff);
    border: 2px solid #667eea;
    border-radius: 12px;
    padding: 15px 20px;
    margin-bottom: 20px;
}

.voice-integration-box.no-voice {
    background: #f8f9fa;
    border-color: #ddd;
    border-style: dashed;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #888;
}

.voice-integration-box .no-voice-icon {
    font-size: 1.5em;
    opacity: 0.5;
}

.voice-integration-box .no-voice-text {
    font-size: 0.9em;
}

.voice-checkbox {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
}

.voice-checkbox input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin-top: 2px;
    accent-color: #667eea;
}

.voice-checkbox .checkbox-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.voice-checkbox .checkbox-label strong {
    color: #333;
}

.voice-checkbox .checkbox-label small {
    color: #666;
    font-size: 0.85em;
}

.voice-integration-box.clickable {
    cursor: pointer;
    transition: all 0.2s;
}

.voice-integration-box.clickable:hover {
    border-color: #667eea;
    background: #f0f4ff;
    transform: translateY(-1px);
}

.voice-integration-box .configure-btn {
    margin-left: auto;
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: 600;
    white-space: nowrap;
}

.voice-integration-box:not(.no-voice) {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.btn-edit-voice {
    background: transparent;
    border: 1px solid #667eea;
    color: #667eea;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85em;
    transition: all 0.2s;
}

.btn-edit-voice:hover {
    background: #667eea;
    color: white;
}

/* Prospect Actions Grid */
.prospect-actions-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-bottom: 25px;
}

.prospect-action-card {
    background: white;
    border: 2px dashed #e0e0e0;
    border-radius: 12px;
    padding: 25px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
}

.prospect-action-card:hover {
    border-color: #667eea;
    background: #f8f9ff;
    transform: translateY(-2px);
}

.prospect-action-card .action-icon {
    font-size: 2em;
    margin-bottom: 10px;
}

.prospect-action-card .action-title {
    font-weight: 600;
    color: #333;
}

.prospect-action-card .action-desc {
    font-size: 0.85em;
    color: #888;
    margin-top: 5px;
}

/* Add Prospect Form */
.add-prospect-form {
    background: #f8f9ff;
    border: 2px solid #667eea;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 20px;
}

.add-prospect-form h4 {
    margin: 0 0 15px;
    color: #333;
    display: flex;
    align-items: center;
    gap: 8px;
}

.add-prospect-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 15px;
}

.add-prospect-fields input {
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 0.95em;
}

.add-prospect-fields input:focus {
    border-color: #667eea;
    outline: none;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.add-prospect-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

@media (max-width: 500px) {
    .prospect-actions-grid {
        grid-template-columns: 1fr;
    }
    .add-prospect-fields {
        grid-template-columns: 1fr;
    }
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

.radio-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
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

/* NEW: Filter Chips */
.prospect-filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
}

.filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 25px;
    cursor: pointer;
    font-size: 0.9em;
    transition: all 0.2s;
}

.filter-chip:hover:not(:disabled) {
    border-color: #667eea;
}

.filter-chip.active {
    background: linear-gradient(135deg, #667eea, #764ba2);
    border-color: transparent;
    color: white;
}

.filter-chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.filter-chip .chip-count {
    background: rgba(0,0,0,0.1);
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.85em;
}

.filter-chip.active .chip-count {
    background: rgba(255,255,255,0.25);
}

/* Selection Bar */
.prospect-selection-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 15px;
    background: #f8f9fa;
    border-radius: 10px;
    margin-bottom: 15px;
}

.selection-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.selection-info input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
}

.selection-info label {
    cursor: pointer;
    color: #333;
}

.selection-actions {
    display: flex;
    gap: 15px;
}

.btn-link {
    background: none;
    border: none;
    color: #667eea;
    cursor: pointer;
    font-size: 0.9em;
    padding: 0;
}

.btn-link:hover {
    text-decoration: underline;
}

/* Checkbox List */
.prospects-checkbox-list {
    max-height: 350px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    margin-bottom: 20px;
}

.prospect-checkbox-item {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 12px 15px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: background 0.15s;
}

.prospect-checkbox-item:last-child {
    border-bottom: none;
}

.prospect-checkbox-item:hover {
    background: #f8f9fa;
}

.prospect-checkbox-item.selected {
    background: #f0f4ff;
}

.prospect-checkbox-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    flex-shrink: 0;
}

.prospect-info {
    flex: 1;
    min-width: 0;
}

.prospect-name {
    font-weight: 600;
    color: #333;
    margin-bottom: 2px;
}

.prospect-details {
    font-size: 0.85em;
    color: #666;
    display: flex;
    gap: 5px;
}

.prospect-email {
    font-size: 0.8em;
    color: #888;
    margin-top: 2px;
}

.prospect-badges {
    display: flex;
    gap: 5px;
    flex-shrink: 0;
}

.badge {
    padding: 3px 8px;
    border-radius: 10px;
    font-size: 0.75em;
    font-weight: 500;
}

.badge-new {
    background: #e8f5e9;
    color: #2e7d32;
}

.badge-linkedin {
    background: #e3f2fd;
    color: #0077B5;
}

.badge-csv {
    background: #fff3e0;
    color: #e65100;
}

.no-prospects-message {
    padding: 40px;
    text-align: center;
    color: #888;
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

.wizard-import-zone {
    margin-top: 15px;
}

.wizard-import-zone .import-dropzone {
    border: 3px dashed #667eea;
    border-radius: 15px;
    padding: 30px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s;
    background: #f8f9ff;
}

.wizard-import-zone .import-dropzone:hover {
    background: #eef1ff;
    border-color: #5a6fd6;
}

.wizard-import-zone .dropzone-icon {
    font-size: 2.5em;
    margin-bottom: 10px;
}

.wizard-import-zone .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e0e0e0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 15px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
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

/* Spintax Feature */
.spintax-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #e0e0e0;
}

.btn-spintax {
    background: linear-gradient(135deg, #ff6b6b, #ee5a24);
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.85em;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
}

.btn-spintax:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(238, 90, 36, 0.3);
}

.btn-spintax:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

.spintax-info {
    font-size: 0.75em;
    color: #888;
    font-style: italic;
}

.spintax-result-info {
    background: linear-gradient(135deg, #f0fff4, #e8f5e9);
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    margin-bottom: 20px;
    border: 2px solid #c8e6c9;
}

.spintax-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 10px;
}

.spintax-stat .stat-number {
    font-size: 2.5em;
    font-weight: 800;
    color: #2e7d32;
}

.spintax-stat .stat-label {
    font-size: 0.9em;
    color: #666;
}

.spintax-tip {
    margin: 0;
    color: #2e7d32;
    font-size: 0.9em;
}

.spintax-preview {
    margin-bottom: 20px;
}

.spintax-preview label {
    display: block;
    font-weight: 600;
    margin-bottom: 8px;
    color: #333;
}

.spintax-preview textarea {
    width: 100%;
    padding: 15px;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
}

.spintax-actions-modal {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin-bottom: 20px;
}

.spintax-example {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 12px;
}

.spintax-example label {
    display: block;
    font-weight: 600;
    margin-bottom: 10px;
    color: #333;
    font-size: 0.9em;
}

.example-render {
    background: white;
    padding: 15px;
    border-radius: 10px;
    border: 1px solid #e0e0e0;
    margin-bottom: 10px;
    line-height: 1.6;
    white-space: pre-wrap;
    font-size: 0.9em;
}

.btn-small {
    padding: 6px 12px;
    font-size: 0.8em;
}

/* Template Selector Styles */
.template-selector {
    margin-bottom: 25px;
    padding: 20px;
    background: linear-gradient(135deg, #f8f9ff, #f0f4ff);
    border-radius: 15px;
}

.template-selector h4 {
    margin: 0 0 15px;
    color: #333;
    font-size: 1em;
}

.template-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
}

.template-card {
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    padding: 15px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
}

.template-card:hover {
    border-color: #667eea;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.15);
    transform: translateY(-2px);
}

.template-card.template-custom {
    border-style: dashed;
    background: #fafafa;
}

.template-name {
    font-weight: 700;
    font-size: 0.95em;
    margin-bottom: 5px;
    color: #333;
}

.template-desc {
    font-size: 0.75em;
    color: #666;
    margin-bottom: 8px;
    line-height: 1.3;
}

.template-meta {
    font-size: 0.7em;
    color: #999;
    background: #f0f0f0;
    padding: 3px 8px;
    border-radius: 10px;
    display: inline-block;
}

@media (max-width: 600px) {
    .template-cards {
        grid-template-columns: repeat(2, 1fr);
    }
}
`;
document.head.appendChild(sequenceStyles);
