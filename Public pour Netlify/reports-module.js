// ===========================================
// REPORTS MODULE - Rapports Business + Calendly
// SOS Storytelling - Mesure de performance
// ===========================================

const ReportsModule = {
    // State
    stats: {
        overview: {},
        campaigns: [],
        senders: [],
        calendly: []
    },
    calendlyConfig: null,
    dateRange: 'month', // week, month, quarter, year

    // API URL
    API_URL: 'https://sos-storytelling-api.sandra-devonssay.workers.dev',

    /**
     * Initialise le module
     */
    async init() {
        await this.loadAllStats();
    },

    /**
     * Charge toutes les stats
     */
    async loadAllStats() {
        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) return;

            // Charger les stats en parallele
            const [campaigns, senders, prospects, calendly] = await Promise.all([
                this.loadCampaignStats(user.id),
                this.loadSenderStats(user.id),
                this.loadProspectStats(user.id),
                this.loadCalendlyEvents(user.id)
            ]);

            this.stats = {
                overview: this.calculateOverview(campaigns, senders, prospects, calendly),
                campaigns,
                senders,
                prospects,
                calendly
            };

        } catch (error) {
            console.error('Erreur chargement stats:', error);
        }
    },

    async loadCampaignStats(userId) {
        try {
            const { data } = await window.supabaseApp
                .from('email_campaigns')
                .select('*')
                .eq('user_id', userId);
            return data || [];
        } catch (e) {
            return [];
        }
    },

    async loadSenderStats(userId) {
        try {
            const { data } = await window.supabaseApp
                .from('sender_emails')
                .select('*')
                .eq('user_id', userId);
            return data || [];
        } catch (e) {
            return [];
        }
    },

    async loadProspectStats(userId) {
        try {
            const { data } = await window.supabaseApp
                .from('prospects')
                .select('id, status, verification_status, created_at')
                .eq('user_id', userId);
            return data || [];
        } catch (e) {
            return [];
        }
    },

    async loadCalendlyEvents(userId) {
        try {
            const { data } = await window.supabaseApp
                .from('calendly_events')
                .select('*')
                .eq('user_id', userId)
                .order('event_at', { ascending: false });
            return data || [];
        } catch (e) {
            return [];
        }
    },

    calculateOverview(campaigns, senders, prospects, calendly) {
        const totalSent = campaigns.reduce((sum, c) => sum + (c.emails_sent || 0), 0);
        const totalOpened = campaigns.reduce((sum, c) => sum + (c.emails_opened || 0), 0);
        const totalReplied = campaigns.reduce((sum, c) => sum + (c.emails_replied || 0), 0);
        const totalBounced = campaigns.reduce((sum, c) => sum + (c.emails_bounced || 0), 0);

        const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
        const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;
        const bounceRate = totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0;

        const rdvBooked = calendly.length;
        const conversionRate = totalSent > 0 ? Math.round((rdvBooked / totalSent) * 100 * 10) / 10 : 0;

        return {
            totalSent,
            totalOpened,
            totalReplied,
            totalBounced,
            openRate,
            replyRate,
            bounceRate,
            rdvBooked,
            conversionRate,
            totalProspects: prospects.length,
            activeSenders: senders.filter(s => s.is_active).length,
            totalCampaigns: campaigns.length
        };
    },

    // ==========================================
    // UI - PAGE RAPPORTS
    // ==========================================

    createReportsPage() {
        const container = document.createElement('div');
        container.className = 'reports-page';
        container.innerHTML = `
            <div class="reports-header">
                <div class="reports-title-section">
                    <h2>📊 Rapports & Analytics</h2>
                    <p>Performance de vos campagnes email</p>
                </div>
                <div class="reports-actions">
                    <select id="dateRangeSelect" onchange="ReportsModule.changeDateRange(this.value)">
                        <option value="week">7 derniers jours</option>
                        <option value="month" selected>30 derniers jours</option>
                        <option value="quarter">3 derniers mois</option>
                        <option value="year">12 derniers mois</option>
                    </select>
                    <button class="btn btn-secondary" onclick="ReportsModule.exportReport()">
                        📤 Exporter
                    </button>
                </div>
            </div>

            <div class="reports-content" id="reportsContent">
                <div class="loading-spinner"></div>
                <p style="text-align: center;">Chargement des statistiques...</p>
            </div>
        `;

        // Charger les stats apres rendu
        setTimeout(() => this.renderReportsContent(), 100);

        return container;
    },

    async renderReportsContent() {
        await this.loadAllStats();

        const container = document.getElementById('reportsContent');
        if (!container) return;

        const { overview } = this.stats;

        container.innerHTML = `
            <!-- KPIs Overview -->
            <div class="kpi-grid">
                <div class="kpi-card kpi-primary">
                    <div class="kpi-icon">📧</div>
                    <div class="kpi-value">${overview.totalSent}</div>
                    <div class="kpi-label">Emails envoyes</div>
                </div>
                <div class="kpi-card ${overview.openRate >= 20 ? 'kpi-success' : overview.openRate >= 10 ? 'kpi-warning' : 'kpi-danger'}">
                    <div class="kpi-icon">👁️</div>
                    <div class="kpi-value">${overview.openRate}%</div>
                    <div class="kpi-label">Taux d'ouverture</div>
                </div>
                <div class="kpi-card ${overview.replyRate >= 5 ? 'kpi-success' : overview.replyRate >= 2 ? 'kpi-warning' : 'kpi-danger'}">
                    <div class="kpi-icon">💬</div>
                    <div class="kpi-value">${overview.replyRate}%</div>
                    <div class="kpi-label">Taux de reponse</div>
                </div>
                <div class="kpi-card kpi-highlight">
                    <div class="kpi-icon">📅</div>
                    <div class="kpi-value">${overview.rdvBooked}</div>
                    <div class="kpi-label">RDV obtenus</div>
                </div>
            </div>

            <!-- Conversion Funnel -->
            <div class="report-section">
                <h3>📈 Entonnoir de conversion</h3>
                <div class="funnel-container">
                    ${this.renderFunnel(overview)}
                </div>
            </div>

            <!-- Sender Health -->
            <div class="report-section">
                <h3>❤️ Sante des adresses email</h3>
                <div class="sender-health-grid">
                    ${this.renderSenderHealth()}
                </div>
            </div>

            <!-- Calendly Integration -->
            <div class="report-section">
                <h3>📅 Rendez-vous Calendly</h3>
                ${this.renderCalendlySection()}
            </div>

            <!-- Recommendations -->
            <div class="report-section">
                <h3>💡 Recommandations</h3>
                <div class="recommendations-list">
                    ${this.generateRecommendations()}
                </div>
            </div>
        `;
    },

    renderFunnel(overview) {
        const steps = [
            { label: 'Emails envoyes', value: overview.totalSent, color: '#667eea' },
            { label: 'Emails ouverts', value: overview.totalOpened, color: '#7c3aed' },
            { label: 'Reponses', value: overview.totalReplied, color: '#4CAF50' },
            { label: 'RDV obtenus', value: overview.rdvBooked, color: '#ff9800' }
        ];

        const maxValue = Math.max(...steps.map(s => s.value), 1);

        return steps.map(step => {
            const width = Math.max((step.value / maxValue) * 100, 5);
            return `
                <div class="funnel-step">
                    <div class="funnel-bar" style="width: ${width}%; background: ${step.color}">
                        <span class="funnel-value">${step.value}</span>
                    </div>
                    <span class="funnel-label">${step.label}</span>
                </div>
            `;
        }).join('');
    },

    renderSenderHealth() {
        const { senders } = this.stats;

        if (senders.length === 0) {
            return '<p class="empty-message">Aucune adresse email configuree</p>';
        }

        return senders.map(sender => {
            const healthClass = sender.health_score >= 80 ? 'health-good' :
                               sender.health_score >= 50 ? 'health-warning' : 'health-bad';

            return `
                <div class="sender-health-card">
                    <div class="sender-health-header">
                        <span class="sender-email">${sender.email}</span>
                        <span class="health-badge ${healthClass}">${sender.health_score}%</span>
                    </div>
                    <div class="sender-health-stats">
                        <span>📤 ${sender.total_emails_sent || 0} envoyes</span>
                        <span>👁️ ${sender.total_opens || 0} ouverts</span>
                        <span>💬 ${sender.total_replies || 0} reponses</span>
                    </div>
                    <div class="health-bar">
                        <div class="health-fill ${healthClass}" style="width: ${sender.health_score}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderCalendlySection() {
        const { calendly } = this.stats;

        if (!this.calendlyConfig) {
            return `
                <div class="calendly-setup">
                    <div class="calendly-icon">📅</div>
                    <h4>Connectez votre Calendly</h4>
                    <p>Suivez automatiquement les RDV generes par vos campagnes.</p>
                    <button class="btn btn-primary" onclick="ReportsModule.showCalendlySetupModal()">
                        🔗 Connecter Calendly
                    </button>
                </div>
            `;
        }

        if (calendly.length === 0) {
            return `
                <div class="calendly-empty">
                    <p>Aucun RDV enregistre pour cette periode.</p>
                </div>
            `;
        }

        return `
            <div class="calendly-stats">
                <div class="calendly-total">
                    <span class="calendly-count">${calendly.length}</span>
                    <span class="calendly-label">RDV obtenus</span>
                </div>
            </div>
            <div class="calendly-events">
                ${calendly.slice(0, 5).map(event => `
                    <div class="calendly-event">
                        <div class="event-date">${new Date(event.event_at).toLocaleDateString()}</div>
                        <div class="event-name">${event.invitee_name || 'Participant'}</div>
                        <div class="event-email">${event.invitee_email || ''}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    generateRecommendations() {
        const { overview, senders } = this.stats;
        const recommendations = [];

        // Taux d'ouverture
        if (overview.openRate < 15) {
            recommendations.push({
                type: 'warning',
                icon: '⚠️',
                title: 'Taux d\'ouverture faible',
                message: 'Votre taux d\'ouverture est inferieur a 15%. Testez de nouveaux objets d\'email plus accrocheurs.'
            });
        } else if (overview.openRate >= 25) {
            recommendations.push({
                type: 'success',
                icon: '✅',
                title: 'Excellent taux d\'ouverture',
                message: 'Vos objets d\'email sont performants. Continuez ainsi !'
            });
        }

        // Taux de reponse
        if (overview.replyRate < 2) {
            recommendations.push({
                type: 'warning',
                icon: '💬',
                title: 'Taux de reponse a ameliorer',
                message: 'Personnalisez davantage vos emails et ajoutez des questions ouvertes pour engager la conversation.'
            });
        }

        // Bounce rate
        if (overview.bounceRate > 3) {
            recommendations.push({
                type: 'danger',
                icon: '🚨',
                title: 'Taux de bounce eleve',
                message: 'Verifiez vos listes avec MillionVerifier pour supprimer les emails invalides.'
            });
        }

        // Senders health
        const lowHealthSenders = senders.filter(s => s.health_score < 70);
        if (lowHealthSenders.length > 0) {
            recommendations.push({
                type: 'warning',
                icon: '❤️',
                title: 'Adresses email en difficulte',
                message: `${lowHealthSenders.length} adresse(s) ont un score de sante < 70%. Reduisez leur volume d'envoi.`
            });
        }

        // RDV
        if (overview.rdvBooked === 0 && overview.totalSent > 100) {
            recommendations.push({
                type: 'info',
                icon: '📅',
                title: 'Aucun RDV enregistre',
                message: 'Connectez Calendly pour suivre vos conversions ou ajoutez un CTA clair dans vos emails.'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                type: 'success',
                icon: '🎉',
                title: 'Tout va bien !',
                message: 'Vos metriques sont dans les normes. Continuez vos efforts !'
            });
        }

        return recommendations.map(rec => `
            <div class="recommendation-card recommendation-${rec.type}">
                <span class="rec-icon">${rec.icon}</span>
                <div class="rec-content">
                    <strong>${rec.title}</strong>
                    <p>${rec.message}</p>
                </div>
            </div>
        `).join('');
    },

    // ==========================================
    // CALENDLY SETUP
    // ==========================================

    showCalendlySetupModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'calendlyModal';
        modal.innerHTML = `
            <div class="modal calendly-modal">
                <div class="modal-header">
                    <h3>📅 Configurer Calendly</h3>
                    <button class="modal-close" onclick="document.getElementById('calendlyModal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="setup-step">
                        <h4>Etape 1 : Obtenez votre cle API</h4>
                        <p>Allez sur <a href="https://calendly.com/integrations/api_webhooks" target="_blank">Calendly API</a> et generez un token personnel.</p>
                    </div>
                    <div class="setup-step">
                        <h4>Etape 2 : Entrez votre token</h4>
                        <input type="text" id="calendlyApiToken" placeholder="Votre Personal Access Token" style="width: 100%; padding: 12px;">
                    </div>
                    <div class="setup-step">
                        <h4>Etape 3 : URL Calendly (optionnel)</h4>
                        <input type="text" id="calendlyUrl" placeholder="https://calendly.com/votre-nom" style="width: 100%; padding: 12px;">
                        <p class="form-hint">Pour tracker quel lien utiliser dans vos emails.</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('calendlyModal').remove()">Annuler</button>
                    <button class="btn btn-primary" onclick="ReportsModule.saveCalendlyConfig()">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async saveCalendlyConfig() {
        const token = document.getElementById('calendlyApiToken').value.trim();
        const url = document.getElementById('calendlyUrl').value.trim();

        if (!token) {
            alert('Token API requis');
            return;
        }

        try {
            const { data: { user } } = await window.supabaseApp.auth.getUser();
            if (!user) throw new Error('Non authentifie');

            // Sauvegarder dans les settings utilisateur
            await window.supabaseApp
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    calendly_token: token,
                    calendly_url: url,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            this.calendlyConfig = { token, url };

            document.getElementById('calendlyModal').remove();

            if (typeof showToast === 'function') {
                showToast('Calendly connecte !', 'success');
            }

            this.renderReportsContent();

        } catch (error) {
            console.error('Erreur sauvegarde Calendly:', error);
            alert('Erreur: ' + error.message);
        }
    },

    // ==========================================
    // UTILITIES
    // ==========================================

    changeDateRange(range) {
        this.dateRange = range;
        this.renderReportsContent();
    },

    exportReport() {
        const { overview } = this.stats;

        const csv = [
            'Metrique,Valeur',
            `Emails envoyes,${overview.totalSent}`,
            `Emails ouverts,${overview.totalOpened}`,
            `Taux ouverture,${overview.openRate}%`,
            `Reponses,${overview.totalReplied}`,
            `Taux reponse,${overview.replyRate}%`,
            `Bounces,${overview.totalBounced}`,
            `Taux bounce,${overview.bounceRate}%`,
            `RDV obtenus,${overview.rdvBooked}`,
            `Taux conversion,${overview.conversionRate}%`
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-sos-storytelling-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Export global
window.ReportsModule = ReportsModule;

// ==================== REPORTS CSS ====================
const reportsStyles = document.createElement('style');
reportsStyles.textContent = `
.reports-page {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.reports-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
    flex-wrap: wrap;
    gap: 15px;
}

.reports-title-section h2 {
    margin: 0 0 5px;
    font-size: 1.5em;
}

.reports-title-section p {
    margin: 0;
    color: #666;
}

.reports-actions {
    display: flex;
    gap: 10px;
}

.reports-actions select {
    padding: 10px 15px;
    border: 2px solid #e0e0e0;
    border-radius: 10px;
    font-size: 0.9em;
}

/* KPI Grid */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

.kpi-card {
    background: white;
    border-radius: 15px;
    padding: 25px;
    text-align: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    border: 2px solid transparent;
}

.kpi-card.kpi-primary { border-color: #667eea; }
.kpi-card.kpi-success { border-color: #4CAF50; }
.kpi-card.kpi-warning { border-color: #ff9800; }
.kpi-card.kpi-danger { border-color: #f44336; }
.kpi-card.kpi-highlight {
    background: linear-gradient(135deg, #667eea, #764ba2);
    color: white;
}

.kpi-icon {
    font-size: 2em;
    margin-bottom: 10px;
}

.kpi-value {
    font-size: 2.5em;
    font-weight: 700;
    line-height: 1;
}

.kpi-label {
    font-size: 0.9em;
    color: #666;
    margin-top: 8px;
}

.kpi-highlight .kpi-label {
    color: rgba(255,255,255,0.8);
}

/* Report Sections */
.report-section {
    background: white;
    border-radius: 15px;
    padding: 25px;
    margin-bottom: 25px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
}

.report-section h3 {
    margin: 0 0 20px;
    font-size: 1.1em;
    color: #333;
}

/* Funnel */
.funnel-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.funnel-step {
    display: flex;
    align-items: center;
    gap: 15px;
}

.funnel-bar {
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 15px;
    min-width: 50px;
    transition: width 0.5s ease;
}

.funnel-value {
    color: white;
    font-weight: 700;
    font-size: 0.9em;
}

.funnel-label {
    font-size: 0.9em;
    color: #666;
    min-width: 120px;
}

/* Sender Health */
.sender-health-grid {
    display: grid;
    gap: 15px;
}

.sender-health-card {
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 15px;
}

.sender-health-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}

.sender-email {
    font-weight: 600;
    font-size: 0.9em;
}

.health-badge {
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: 700;
}

.health-badge.health-good { background: #e8f5e9; color: #2e7d32; }
.health-badge.health-warning { background: #fff3e0; color: #ef6c00; }
.health-badge.health-bad { background: #ffebee; color: #c62828; }

.sender-health-stats {
    display: flex;
    gap: 15px;
    font-size: 0.8em;
    color: #666;
    margin-bottom: 10px;
}

.health-bar {
    height: 6px;
    background: #e0e0e0;
    border-radius: 3px;
    overflow: hidden;
}

.health-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
}

.health-fill.health-good { background: #4CAF50; }
.health-fill.health-warning { background: #ff9800; }
.health-fill.health-bad { background: #f44336; }

/* Calendly */
.calendly-setup {
    text-align: center;
    padding: 40px 20px;
    background: #f8f9ff;
    border-radius: 12px;
}

.calendly-icon {
    font-size: 3em;
    margin-bottom: 15px;
}

.calendly-setup h4 {
    margin: 0 0 10px;
    color: #333;
}

.calendly-setup p {
    color: #666;
    margin-bottom: 20px;
}

.calendly-modal {
    max-width: 500px;
    width: 90%;
}

.setup-step {
    margin-bottom: 20px;
}

.setup-step h4 {
    margin: 0 0 10px;
    font-size: 0.95em;
    color: #333;
}

.setup-step p, .setup-step a {
    font-size: 0.9em;
    color: #666;
}

/* Recommendations */
.recommendations-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.recommendation-card {
    display: flex;
    gap: 15px;
    padding: 15px;
    border-radius: 12px;
    border-left: 4px solid;
}

.recommendation-success {
    background: #e8f5e9;
    border-color: #4CAF50;
}

.recommendation-warning {
    background: #fff3e0;
    border-color: #ff9800;
}

.recommendation-danger {
    background: #ffebee;
    border-color: #f44336;
}

.recommendation-info {
    background: #e3f2fd;
    border-color: #2196f3;
}

.rec-icon {
    font-size: 1.5em;
}

.rec-content strong {
    display: block;
    margin-bottom: 5px;
    color: #333;
}

.rec-content p {
    margin: 0;
    font-size: 0.9em;
    color: #555;
}

/* Loading */
.loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f0f0f0;
    border-top-color: #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 40px auto;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

.empty-message {
    text-align: center;
    color: #666;
    padding: 20px;
}

@media (max-width: 768px) {
    .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .reports-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .sender-health-stats {
        flex-wrap: wrap;
    }
}
`;
document.head.appendChild(reportsStyles);
