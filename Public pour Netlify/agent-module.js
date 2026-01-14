// =====================================================
// AGENT AUTOPILOT - Module Frontend
// SOS Storytelling
// =====================================================

window.AgentAutopilot = (function() {
    'use strict';

    // ==================== STATE ====================
    let config = null;
    let isRunning = false;
    let currentUserId = null;

    // Fonction helper pour obtenir Supabase
    function db() {
        return window.supabaseApp;
    }

    // ==================== INIT ====================
    async function init() {
        if (!window.supabaseApp) {
            console.error('Supabase non disponible - attendre le chargement de l\'app');
            return;
        }

        // Utiliser window.currentUser si disponible (défini par l'app principale)
        if (window.currentUser && window.currentUser.id) {
            currentUserId = window.currentUser.id;
        } else {
            // Fallback: essayer de récupérer via getSession
            const { data: { session } } = await db().auth.getSession();
            if (session && session.user) {
                currentUserId = session.user.id;
            } else {
                console.error('Utilisateur non connecté');
                return;
            }
        }

        console.log('Agent Autopilot init - userId:', currentUserId);
        await loadConfig();
    }

    // ==================== CONFIG ====================
    async function loadConfig() {
        const { data, error } = await db()
            .from('agent_config')
            .select('*')
            .eq('user_id', currentUserId)
            .single();

        if (data) {
            config = data;
            isRunning = data.is_active;
        } else {
            // Créer config par défaut
            const { data: newConfig } = await db()
                .from('agent_config')
                .insert({
                    user_id: currentUserId,
                    goal: '',
                    goal_count: 10,
                    max_emails_per_day: 50,
                    min_delay_between_emails: 30,
                    working_hours_start: 9,
                    working_hours_end: 18,
                    working_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
                    tone: 'friendly',
                    language: 'fr',
                    is_active: false
                })
                .select()
                .single();
            config = newConfig;
        }
    }

    async function saveConfig(updates) {
        const { data, error } = await db()
            .from('agent_config')
            .update(updates)
            .eq('user_id', currentUserId)
            .select()
            .single();

        if (data) {
            config = data;
        }
        return { data, error };
    }

    // ==================== DASHBOARD ====================
    function renderDashboard() {
        const container = document.getElementById('agent-dashboard');
        if (!container) return;

        const stats = config || {};
        const goalProgress = stats.goal_count > 0
            ? Math.round((stats.goal_current || 0) / stats.goal_count * 100)
            : 0;

        container.innerHTML = `
            <div class="agent-dashboard">
                <!-- Header avec statut -->
                <div class="agent-header">
                    <div class="agent-status ${isRunning ? 'running' : 'stopped'}">
                        <span class="status-dot"></span>
                        <span class="status-text">${isRunning ? 'Agent Actif' : 'Agent en Pause'}</span>
                    </div>
                    <button class="btn-agent-toggle ${isRunning ? 'stop' : 'start'}" onclick="AgentAutopilot.toggleAgent()">
                        ${isRunning ? '⏸️ Mettre en Pause' : '▶️ Activer l\'Agent'}
                    </button>
                </div>

                <!-- Stats rapides -->
                <div class="agent-stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">🎯</div>
                        <div class="stat-value">${stats.goal_current || 0}/${stats.goal_count || 10}</div>
                        <div class="stat-label">Objectif RDV</div>
                        <div class="stat-progress">
                            <div class="progress-bar" style="width: ${goalProgress}%"></div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📧</div>
                        <div class="stat-value">${stats.total_emails_sent || 0}</div>
                        <div class="stat-label">Emails envoyés</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">👀</div>
                        <div class="stat-value">${stats.total_opens || 0}</div>
                        <div class="stat-label">Ouvertures</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">💬</div>
                        <div class="stat-value">${stats.total_replies || 0}</div>
                        <div class="stat-label">Réponses</div>
                    </div>
                </div>

                <!-- Ajouter des Leads -->
                <div class="agent-section import-section">
                    <h3>📥 Ajouter des Leads</h3>
                    <div class="import-tabs">
                        <button class="import-tab active" onclick="AgentAutopilot.switchImportTab('manual')">✏️ Ajout manuel</button>
                        <button class="import-tab" onclick="AgentAutopilot.switchImportTab('csv')">📄 Import CSV</button>
                    </div>

                    <!-- Ajout manuel -->
                    <div id="manual-add-tab" class="import-tab-content active">
                        <div class="manual-add-form">
                            <div class="form-row">
                                <input type="email" id="prospect-email" placeholder="Email *" required>
                                <input type="text" id="prospect-name" placeholder="Nom complet">
                            </div>
                            <div class="form-row">
                                <input type="text" id="prospect-company" placeholder="Entreprise">
                                <input type="text" id="prospect-position" placeholder="Poste">
                            </div>
                            <button class="btn-add-prospect" onclick="AgentAutopilot.addProspectManually()">
                                ➕ Ajouter ce prospect
                            </button>
                            <div id="manual-add-status"></div>
                        </div>
                    </div>

                    <!-- Import CSV -->
                    <div id="csv-import-tab" class="import-tab-content">
                        <div class="import-area">
                            <input type="file" id="csvFileInput" accept=".csv" style="display:none" onchange="AgentAutopilot.handleCSVImport(event)">
                            <button class="btn-import" onclick="document.getElementById('csvFileInput').click()">
                                📄 Importer un fichier CSV
                            </button>
                            <p class="import-hint">Format : email, nom, entreprise, poste (séparateur: virgule ou point-virgule)</p>
                            <div id="import-status"></div>
                        </div>
                    </div>
                </div>

                <!-- Emails à valider -->
                <div class="agent-section pending-emails-section">
                    <div class="section-header-row">
                        <h3>📧 Emails à valider <span id="pending-count" class="pending-badge" style="display:none;">0</span></h3>
                        <button id="approve-all-btn" class="btn-approve-all" style="display:none;" onclick="AgentAutopilot.approveAllEmails()">
                            ✅ Tout approuver
                        </button>
                    </div>
                    <p class="section-description">Les emails préparés par l'IA sont listés ici. Validez-les avant envoi.</p>
                    <div id="pending-emails-list" class="pending-emails-list">
                        <p class="loading">Chargement...</p>
                    </div>
                </div>

                <!-- Prospects chauds -->
                <div class="agent-section">
                    <h3>🔥 Prospects Chauds</h3>
                    <div id="hot-prospects-list" class="hot-prospects-list">
                        <p class="loading">Chargement...</p>
                    </div>
                </div>

                <!-- Actions récentes -->
                <div class="agent-section">
                    <h3>📋 Actions Récentes</h3>
                    <div id="recent-actions-list" class="actions-list">
                        <p class="loading">Chargement...</p>
                    </div>
                </div>
            </div>
        `;

        // Charger les données dynamiques
        loadHotProspects();
        loadRecentActions();
        loadPendingEmails(); // Charger les emails en attente de validation
    }

    async function loadHotProspects() {
        const container = document.getElementById('hot-prospects-list');
        if (!container) return;

        const { data: prospects } = await db()
            .from('prospects')
            .select('*')
            .eq('user_id', currentUserId)
            .eq('agent_status', 'hot')
            .order('updated_at', { ascending: false })
            .limit(5);

        if (!prospects || prospects.length === 0) {
            container.innerHTML = '<p class="empty">Aucun prospect chaud pour le moment</p>';
            return;
        }

        container.innerHTML = prospects.map(p => `
            <div class="hot-prospect-card">
                <div class="prospect-info">
                    <strong>${p.name || p.email}</strong>
                    <span class="prospect-company">${p.company || ''}</span>
                </div>
                <div class="prospect-signals">
                    ${p.last_opened_at ? '<span class="signal">👀 Ouvert</span>' : ''}
                    ${p.last_clicked_at ? '<span class="signal">🖱️ Cliqué</span>' : ''}
                    ${p.replied_at ? '<span class="signal hot">💬 Répondu</span>' : ''}
                </div>
                <div class="prospect-actions">
                    <button class="btn-small" onclick="AgentAutopilot.viewProspect('${p.id}')">Voir</button>
                </div>
            </div>
        `).join('');
    }

    async function loadRecentActions() {
        const container = document.getElementById('recent-actions-list');
        if (!container) return;

        const { data: actions } = await db()
            .from('agent_actions')
            .select('*')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (!actions || actions.length === 0) {
            container.innerHTML = '<p class="empty">Aucune action récente</p>';
            return;
        }

        const actionIcons = {
            'email_sent': '📤',
            'email_opened': '👀',
            'reply_received': '💬',
            'meeting_booked': '📅',
            'stopped': '⏹️'
        };

        container.innerHTML = actions.map(a => {
            const time = new Date(a.created_at).toLocaleString('fr-FR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });
            const prospectInfo = a.action_data?.email || a.action_data?.subject || 'Action';
            return `
                <div class="action-item">
                    <span class="action-icon">${actionIcons[a.action_type] || '📌'}</span>
                    <div class="action-details">
                        <span class="action-type">${formatActionType(a.action_type)}</span>
                        <span class="action-prospect">${prospectInfo}</span>
                    </div>
                    <span class="action-time">${time}</span>
                </div>
            `;
        }).join('');
    }

    function formatActionType(type) {
        const types = {
            'email_sent': 'Email envoyé',
            'email_opened': 'Email ouvert',
            'reply_received': 'Réponse reçue',
            'meeting_booked': 'RDV pris',
            'stopped': 'Séquence arrêtée'
        };
        return types[type] || type;
    }

    // ==================== CONFIGURATION ====================
    function renderConfig() {
        const container = document.getElementById('agent-config');
        if (!container) return;

        const c = config || {};
        const workingDays = c.working_days || ['mon', 'tue', 'wed', 'thu', 'fri'];

        container.innerHTML = `
            <div class="agent-config">
                <h3>⚙️ Configuration de l'Agent</h3>

                <!-- Objectif -->
                <div class="config-section">
                    <h4>🎯 Objectif</h4>
                    <div class="config-row">
                        <label>Description de l'objectif</label>
                        <input type="text" id="agent-goal" value="${c.goal || ''}"
                            placeholder="Ex: 10 RDV avec des agences marketing">
                    </div>
                    <div class="config-row-inline">
                        <div>
                            <label>Nombre de RDV cible</label>
                            <input type="number" id="agent-goal-count" value="${c.goal_count || 10}" min="1" max="100">
                        </div>
                        <div>
                            <label>Date limite</label>
                            <input type="date" id="agent-goal-deadline" value="${c.goal_deadline || ''}">
                        </div>
                    </div>
                </div>

                <!-- Contraintes -->
                <div class="config-section">
                    <h4>📏 Contraintes</h4>
                    <div class="config-row">
                        <label>Mode warm-up <span class="hint-inline">(recommandé pour nouveaux domaines)</span></label>
                        <div class="warmup-toggle">
                            <label class="toggle-switch">
                                <input type="checkbox" id="agent-warmup-mode" ${c.warmup_mode ? 'checked' : ''}>
                                <span class="toggle-slider"></span>
                            </label>
                            <span class="toggle-label">${c.warmup_mode ? 'Actif - Augmentation progressive automatique' : 'Désactivé'}</span>
                        </div>
                        <p class="warmup-hint">Le warm-up commence à 10 emails/jour et augmente de 5 chaque jour jusqu'à atteindre votre limite.</p>
                    </div>
                    <div class="config-row-inline">
                        <div>
                            <label>Max emails/jour</label>
                            <input type="number" id="agent-max-emails" value="${c.max_emails_per_day || 50}" min="1" max="200">
                        </div>
                        <div>
                            <label>Délai min entre emails (sec)</label>
                            <input type="number" id="agent-delay" value="${c.min_delay_between_emails || 30}" min="10" max="300">
                        </div>
                    </div>
                    <div class="config-row-inline">
                        <div>
                            <label>Heures de travail</label>
                            <div class="time-range">
                                <input type="number" id="agent-hours-start" value="${c.working_hours_start || 9}" min="0" max="23">
                                <span>h à</span>
                                <input type="number" id="agent-hours-end" value="${c.working_hours_end || 18}" min="0" max="23">
                                <span>h</span>
                            </div>
                        </div>
                    </div>
                    <div class="config-row">
                        <label>Jours de travail</label>
                        <div class="working-days">
                            ${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => `
                                <label class="day-checkbox">
                                    <input type="checkbox" value="${day}"
                                        ${workingDays.includes(day) ? 'checked' : ''}>
                                    <span>${getDayLabel(day)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Expéditeur -->
                <div class="config-section">
                    <h4>📧 Email Expéditeur</h4>
                    <div class="config-row-inline">
                        <div>
                            <label>Nom affiché</label>
                            <input type="text" id="agent-sender-name" value="${c.sender_name || ''}"
                                placeholder="Jean Dupont">
                        </div>
                        <div>
                            <label>Email expéditeur</label>
                            <input type="email" id="agent-sender-email" value="${c.sender_email || ''}"
                                placeholder="jean@example.com">
                        </div>
                    </div>
                    <div class="config-row">
                        <label>Nom de l'entreprise <span class="hint-inline">(obligatoire RGPD)</span></label>
                        <input type="text" id="agent-company-name" value="${c.company_name || ''}"
                            placeholder="Ma Société SAS">
                    </div>
                </div>

                <!-- Personnalité -->
                <div class="config-section">
                    <h4>🎭 Personnalité</h4>
                    <div class="config-row-inline">
                        <div>
                            <label>Ton des emails</label>
                            <select id="agent-tone">
                                <option value="friendly" ${c.tone === 'friendly' ? 'selected' : ''}>Chaleureux</option>
                                <option value="professional" ${c.tone === 'professional' ? 'selected' : ''}>Professionnel</option>
                                <option value="casual" ${c.tone === 'casual' ? 'selected' : ''}>Casual</option>
                            </select>
                        </div>
                        <div>
                            <label>Langue</label>
                            <select id="agent-language">
                                <option value="fr" ${c.language === 'fr' ? 'selected' : ''}>Français</option>
                                <option value="en" ${c.language === 'en' ? 'selected' : ''}>English</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="config-actions">
                    <button class="btn-primary" onclick="AgentAutopilot.saveConfigFromForm()">
                        💾 Enregistrer la Configuration
                    </button>
                </div>
            </div>
        `;
    }

    function getDayLabel(day) {
        const days = {
            'mon': 'Lun', 'tue': 'Mar', 'wed': 'Mer',
            'thu': 'Jeu', 'fri': 'Ven', 'sat': 'Sam', 'sun': 'Dim'
        };
        return days[day] || day;
    }

    async function saveConfigFromForm() {
        const workingDaysCheckboxes = document.querySelectorAll('.working-days input:checked');
        const workingDays = Array.from(workingDaysCheckboxes).map(cb => cb.value);

        const updates = {
            goal: document.getElementById('agent-goal')?.value || '',
            goal_count: parseInt(document.getElementById('agent-goal-count')?.value) || 10,
            goal_deadline: document.getElementById('agent-goal-deadline')?.value || null,
            max_emails_per_day: parseInt(document.getElementById('agent-max-emails')?.value) || 50,
            min_delay_between_emails: parseInt(document.getElementById('agent-delay')?.value) || 30,
            working_hours_start: parseInt(document.getElementById('agent-hours-start')?.value) || 9,
            working_hours_end: parseInt(document.getElementById('agent-hours-end')?.value) || 18,
            working_days: workingDays,
            sender_name: document.getElementById('agent-sender-name')?.value || '',
            sender_email: document.getElementById('agent-sender-email')?.value || '',
            company_name: document.getElementById('agent-company-name')?.value || '',
            tone: document.getElementById('agent-tone')?.value || 'friendly',
            language: document.getElementById('agent-language')?.value || 'fr',
            warmup_mode: document.getElementById('agent-warmup-mode')?.checked || false
        };

        const { error } = await saveConfig(updates);

        if (error) {
            showToast('❌ Erreur lors de la sauvegarde', 'error');
        } else {
            showToast('✅ Configuration enregistrée !');
        }
    }

    // ==================== TEMPLATES ====================
    function renderTemplates() {
        const container = document.getElementById('agent-templates');
        if (!container) return;

        container.innerHTML = `
            <div class="agent-templates">
                <div class="templates-header">
                    <h3>📝 Séquence d'Emails</h3>
                    <button class="btn-secondary" onclick="AgentAutopilot.addTemplate()">
                        + Ajouter un Email
                    </button>
                </div>
                <div id="templates-list" class="templates-list">
                    <p class="loading">Chargement...</p>
                </div>
            </div>
        `;

        loadTemplates();
    }

    async function loadTemplates() {
        const container = document.getElementById('templates-list');
        if (!container) return;

        const { data: templates } = await db()
            .from('agent_templates')
            .select('*')
            .eq('user_id', currentUserId)
            .order('position', { ascending: true });

        if (!templates || templates.length === 0) {
            container.innerHTML = `
                <div class="empty-templates">
                    <p>Aucun template configuré</p>
                    <button class="btn-primary" onclick="AgentAutopilot.createDefaultTemplates()">
                        🚀 Créer les Templates par Défaut
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = templates.map((t, i) => `
            <div class="template-card" data-id="${t.id}">
                <div class="template-header">
                    <span class="template-position">${t.position}</span>
                    <input type="text" class="template-name" value="${t.name}"
                        onchange="AgentAutopilot.updateTemplate('${t.id}', 'name', this.value)">
                    <span class="template-delay">${t.delay_days > 0 ? `J+${t.delay_days}` : 'J0'}</span>
                    <button class="btn-icon" onclick="AgentAutopilot.deleteTemplate('${t.id}')">🗑️</button>
                </div>
                <div class="template-content">
                    <div class="template-field">
                        <label>Objet</label>
                        <input type="text" value="${escapeHtml(t.subject)}"
                            onchange="AgentAutopilot.updateTemplate('${t.id}', 'subject', this.value)">
                    </div>
                    <div class="template-field">
                        <label>Corps</label>
                        <textarea rows="4"
                            onchange="AgentAutopilot.updateTemplate('${t.id}', 'body', this.value)">${escapeHtml(t.body)}</textarea>
                    </div>
                    <div class="template-options">
                        <div>
                            <label>Délai (jours)</label>
                            <input type="number" value="${t.delay_days}" min="0" max="30"
                                onchange="AgentAutopilot.updateTemplate('${t.id}', 'delay_days', parseInt(this.value))">
                        </div>
                        <div>
                            <label>Condition</label>
                            <select onchange="AgentAutopilot.updateTemplate('${t.id}', 'send_condition', this.value)">
                                <option value="always" ${t.send_condition === 'always' ? 'selected' : ''}>Toujours</option>
                                <option value="no_reply" ${t.send_condition === 'no_reply' ? 'selected' : ''}>Si pas de réponse</option>
                                <option value="opened_no_reply" ${t.send_condition === 'opened_no_reply' ? 'selected' : ''}>Si ouvert sans réponse</option>
                                <option value="clicked" ${t.send_condition === 'clicked' ? 'selected' : ''}>Si cliqué</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async function createDefaultTemplates() {
        // S'assurer que l'utilisateur est initialisé
        if (!currentUserId) {
            await init();
        }
        if (!currentUserId) {
            showToast('❌ Erreur: utilisateur non connecté', 'error');
            return;
        }

        const profile = window.UserProfile?.get() || {};
        const voiceProfile = profile.voiceProfile || {};

        const defaultTemplates = [
            {
                name: 'Premier Contact',
                subject: 'Question rapide pour {{prénom}}',
                body: `Bonjour {{prénom}},

Je suis tombé sur {{entreprise}} et j'ai une question rapide.

[Votre pitch personnalisé]

Auriez-vous 15 min à m'accorder pour en discuter ?

{{signature}}`,
                position: 1,
                delay_days: 0,
                send_condition: 'always'
            },
            {
                name: 'Relance J+3',
                subject: 'Re: Question rapide pour {{prénom}}',
                body: `Bonjour {{prénom}},

Je me permets de revenir vers vous.

[Valeur ajoutée / cas client]

Qu'en pensez-vous ?

{{signature}}`,
                position: 2,
                delay_days: 3,
                send_condition: 'no_reply'
            },
            {
                name: 'Relance J+7',
                subject: 'Dernière tentative {{prénom}}',
                body: `Bonjour {{prénom}},

Je comprends que vous êtes occupé(e).

Si [votre sujet] n'est pas une priorité en ce moment, dites-le moi et je ne vous embêterai plus.

Sinon, 15 min cette semaine ?

{{signature}}`,
                position: 3,
                delay_days: 7,
                send_condition: 'no_reply'
            },
            {
                name: 'Prospect Chaud',
                subject: 'Suite à votre intérêt {{prénom}}',
                body: `Bonjour {{prénom}},

J'ai vu que vous aviez consulté mon email plusieurs fois.

Avez-vous des questions ? Je suis disponible pour un appel de 15 min quand ça vous arrange.

{{signature}}`,
                position: 4,
                delay_days: 0,
                send_condition: 'opened_no_reply'
            }
        ];

        for (const template of defaultTemplates) {
            await db()
                .from('agent_templates')
                .insert({
                    user_id: currentUserId,
                    ...template
                });
        }

        loadTemplates();
        showToast('✅ Templates par défaut créés !');
    }

    async function addTemplate() {
        const { data: existing } = await db()
            .from('agent_templates')
            .select('position')
            .eq('user_id', currentUserId)
            .order('position', { ascending: false })
            .limit(1);

        const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 1;

        await db()
            .from('agent_templates')
            .insert({
                user_id: currentUserId,
                name: `Email ${nextPosition}`,
                subject: 'Nouvel email',
                body: 'Contenu de l\'email...',
                position: nextPosition,
                delay_days: 3,
                send_condition: 'no_reply'
            });

        loadTemplates();
    }

    async function updateTemplate(id, field, value) {
        await db()
            .from('agent_templates')
            .update({ [field]: value })
            .eq('id', id);
    }

    async function deleteTemplate(id) {
        if (!confirm('Supprimer ce template ?')) return;

        await db()
            .from('agent_templates')
            .delete()
            .eq('id', id);

        loadTemplates();
    }

    // ==================== LOGS ====================
    function renderLogs() {
        const container = document.getElementById('agent-logs');
        if (!container) return;

        container.innerHTML = `
            <div class="agent-logs">
                <div class="logs-header">
                    <h3>📊 Logs de l'Agent</h3>
                    <select id="log-filter" onchange="AgentAutopilot.filterLogs(this.value)">
                        <option value="all">Tous</option>
                        <option value="decision">Décisions</option>
                        <option value="action">Actions</option>
                        <option value="error">Erreurs</option>
                    </select>
                </div>
                <div id="logs-list" class="logs-list">
                    <p class="loading">Chargement...</p>
                </div>
            </div>
        `;

        loadLogs();
    }

    async function loadLogs(filter = 'all') {
        const container = document.getElementById('logs-list');
        if (!container) return;

        let query = supabase
            .from('agent_logs')
            .select('*')
            .eq('user_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (filter !== 'all') {
            query = query.eq('log_type', filter);
        }

        const { data: logs } = await query;

        if (!logs || logs.length === 0) {
            container.innerHTML = '<p class="empty">Aucun log disponible</p>';
            return;
        }

        const typeIcons = {
            'info': 'ℹ️',
            'decision': '🤔',
            'action': '⚡',
            'error': '❌'
        };

        container.innerHTML = logs.map(log => {
            const time = new Date(log.created_at).toLocaleString('fr-FR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
            return `
                <div class="log-entry log-${log.log_type}">
                    <span class="log-icon">${typeIcons[log.log_type] || '📌'}</span>
                    <span class="log-time">${time}</span>
                    <span class="log-message">${escapeHtml(log.message)}</span>
                    ${log.data ? `<pre class="log-data">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
                </div>
            `;
        }).join('');
    }

    function filterLogs(filter) {
        loadLogs(filter);
    }

    // ==================== NOTIFICATIONS ====================
    async function loadNotifications() {
        const { data: notifications } = await db()
            .from('agent_notifications')
            .select('*')
            .eq('user_id', currentUserId)
            .eq('read', false)
            .order('created_at', { ascending: false })
            .limit(10);

        return notifications || [];
    }

    async function markNotificationRead(id) {
        await db()
            .from('agent_notifications')
            .update({ read: true })
            .eq('id', id);
    }

    // ==================== IMPORT TABS ====================
    function switchImportTab(tab, e) {
        // Update tab buttons
        document.querySelectorAll('.import-tabs .import-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        if (e && e.target) e.target.classList.add('active');

        // Update tab content
        document.querySelectorAll('.import-tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const manualTab = document.getElementById('manual-add-tab');
        const csvTab = document.getElementById('csv-import-tab');

        if (tab === 'manual' && manualTab) {
            manualTab.classList.add('active');
        } else if (csvTab) {
            csvTab.classList.add('active');
        }
    }

    // ==================== MANUAL ADD ====================
    async function addProspectManually() {
        // S'assurer que l'utilisateur est initialisé
        if (!currentUserId) {
            await init();
        }
        if (!currentUserId) {
            showToast('❌ Erreur: utilisateur non connecté', 'error');
            return;
        }

        const email = document.getElementById('prospect-email').value.trim();
        const name = document.getElementById('prospect-name').value.trim();
        const company = document.getElementById('prospect-company').value.trim();
        const position = document.getElementById('prospect-position').value.trim();
        const statusDiv = document.getElementById('manual-add-status');

        // Validation
        if (!email || !isValidEmail(email)) {
            statusDiv.innerHTML = '<p class="error">❌ Email invalide</p>';
            return;
        }

        statusDiv.innerHTML = '<p class="importing">⏳ Ajout en cours...</p>';

        try {
            // Vérifier si l'email existe déjà (sans .single() pour éviter 406)
            const { data: existingList } = await db()
                .from('prospects')
                .select('id')
                .eq('user_id', currentUserId)
                .eq('email', email);

            if (existingList && existingList.length > 0) {
                statusDiv.innerHTML = '<p class="error">❌ Ce prospect existe déjà</p>';
                return;
            }

            // Insérer le nouveau prospect avec first_name et last_name
            let firstName = null;
            let lastName = null;
            if (name) {
                const nameParts = name.split(' ');
                firstName = nameParts[0] || null;
                lastName = nameParts.slice(1).join(' ') || null;
            }

            const insertData = {
                user_id: currentUserId,
                email: email,
                first_name: firstName,
                last_name: lastName,
                company: company || null
            };

            const { error } = await db()
                .from('prospects')
                .insert(insertData);

            if (error) {
                statusDiv.innerHTML = '<p class="error">❌ Erreur: ' + error.message + '</p>';
                return;
            }

            statusDiv.innerHTML = '<p class="success">✅ Prospect ajouté !</p>';

            // Vider le formulaire
            document.getElementById('prospect-email').value = '';
            document.getElementById('prospect-name').value = '';
            document.getElementById('prospect-company').value = '';
            document.getElementById('prospect-position').value = '';

            // Effacer le message après 3 secondes
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 3000);

        } catch (error) {
            console.error('Erreur ajout manuel:', error);
            statusDiv.innerHTML = '<p class="error">❌ Erreur lors de l\'ajout</p>';
        }
    }

    // ==================== CSV IMPORT ====================
    async function handleCSVImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        // S'assurer que l'utilisateur est initialisé
        if (!currentUserId) {
            await init();
        }
        if (!currentUserId) {
            showToast('❌ Erreur: utilisateur non connecté', 'error');
            return;
        }

        const statusDiv = document.getElementById('import-status');
        statusDiv.innerHTML = '<p class="importing">⏳ Import en cours...</p>';

        try {
            const text = await file.text();
            console.log('CSV brut (100 premiers caractères):', text.substring(0, 100));

            const prospects = parseCSV(text);
            console.log('Prospects parsés:', prospects.length, prospects.slice(0, 3));

            if (prospects.length === 0) {
                statusDiv.innerHTML = '<p class="error">❌ Aucun prospect valide trouvé. Vérifiez que votre CSV a une colonne "email" ou "mail".</p>';
                return;
            }

            // Insérer les prospects dans Supabase
            let imported = 0;
            let duplicates = 0;

            for (const prospect of prospects) {
                // Vérifier si l'email existe déjà (utiliser maybeSingle au lieu de single)
                const { data: existingList } = await db()
                    .from('prospects')
                    .select('id')
                    .eq('user_id', currentUserId)
                    .eq('email', prospect.email);

                if (existingList && existingList.length > 0) {
                    duplicates++;
                    continue;
                }

                // Insérer le nouveau prospect avec first_name et last_name
                const insertData = {
                    user_id: currentUserId,
                    email: prospect.email,
                    first_name: prospect.first_name || null,
                    last_name: prospect.last_name || null,
                    company: prospect.company || null
                };

                const { error } = await db()
                    .from('prospects')
                    .insert(insertData);

                if (error) {
                    console.error('Erreur insert prospect:', error, 'Data:', insertData);
                } else {
                    imported++;
                }
            }

            if (imported === 0 && duplicates === 0) {
                statusDiv.innerHTML = `<p class="error">❌ Aucun email valide trouvé dans le fichier. Vérifiez que votre CSV contient une colonne "email".</p>`;
            } else if (imported === 0 && duplicates > 0) {
                statusDiv.innerHTML = `<p class="warning" style="color:#f59e0b;">⚠️ ${duplicates} prospect(s) déjà existant(s), aucun nouveau importé</p>`;
            } else {
                statusDiv.innerHTML = `<p class="success">✅ ${imported} prospect(s) importé(s)${duplicates > 0 ? ` (${duplicates} doublon(s) ignoré(s))` : ''}</p>`;
            }

            // Rafraîchir le dashboard
            setTimeout(() => {
                renderDashboard();
            }, 2000);

        } catch (error) {
            console.error('Erreur import CSV:', error);
            statusDiv.innerHTML = '<p class="error">❌ Erreur lors de l\'import du fichier</p>';
        }

        // Reset l'input file
        event.target.value = '';
    }

    function parseCSV(text) {
        // Supprimer le BOM (Byte Order Mark) s'il existe
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1);
        }
        // Supprimer aussi les BOM UTF-8 encodés autrement
        text = text.replace(/^\uFEFF/, '').replace(/^\xEF\xBB\xBF/, '');

        const lines = text.trim().split(/\r?\n/).filter(line => line.trim());
        console.log('Nombre de lignes (après nettoyage):', lines.length);
        console.log('Première ligne brute:', JSON.stringify(lines[0]));
        if (lines.length < 2) return []; // Au moins header + 1 ligne

        // Détecter le séparateur (virgule ou point-virgule)
        const separator = lines[0].includes(';') ? ';' : ',';
        console.log('Séparateur détecté:', separator);

        // Parser le header - nettoyer tous les caractères invisibles
        const headers = lines[0].toLowerCase().split(separator).map(h =>
            h.trim().replace(/"/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
        );
        console.log('Headers trouvés:', headers);
        console.log('Headers en JSON:', JSON.stringify(headers));

        // Trouver les index des colonnes
        const emailIndex = headers.findIndex(h => h.includes('email') || h.includes('mail'));

        // Pour le nom, chercher aussi "first name", "last name", "firstname", "lastname"
        const firstNameIndex = headers.findIndex(h =>
            h.includes('first') || h.includes('prénom') || h.includes('prenom')
        );
        const lastNameIndex = headers.findIndex(h =>
            (h.includes('last') && h.includes('name')) || h === 'nom' || h === 'lastname'
        );
        const fullNameIndex = headers.findIndex(h =>
            h === 'name' || h === 'nom complet' || h === 'fullname' || h === 'full name'
        );

        const companyIndex = headers.findIndex(h =>
            h.includes('entreprise') || h.includes('company') || h.includes('société') || h.includes('societe')
        );
        const positionIndex = headers.findIndex(h =>
            h.includes('poste') || h.includes('position') || h.includes('titre') || h.includes('title') ||
            h.includes('fonction') || h.includes('job')
        );

        console.log('Index colonnes - email:', emailIndex, 'firstName:', firstNameIndex, 'lastName:', lastNameIndex, 'fullName:', fullNameIndex, 'company:', companyIndex, 'position:', positionIndex);

        if (emailIndex === -1) {
            console.error('Colonne email non trouvée dans:', headers);
            return [];
        }

        const prospects = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i], separator);
            console.log(`Ligne ${i}:`, values);

            let email = values[emailIndex]?.trim().replace(/"/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');

            // Valider l'email
            if (!email) {
                console.log(`Ligne ${i}: email vide`);
                continue;
            }

            if (!isValidEmail(email)) {
                console.log(`Ligne ${i}: email invalide: "${email}"`);
                continue;
            }

            // Récupérer first_name et last_name directement
            let firstName = firstNameIndex !== -1 ? values[firstNameIndex]?.trim().replace(/"/g, '') : null;
            let lastName = lastNameIndex !== -1 ? values[lastNameIndex]?.trim().replace(/"/g, '') : null;

            // Si on a un nom complet, le séparer
            if (fullNameIndex !== -1 && values[fullNameIndex]) {
                const fullName = values[fullNameIndex]?.trim().replace(/"/g, '');
                const nameParts = fullName.split(' ');
                firstName = firstName || nameParts[0] || null;
                lastName = lastName || nameParts.slice(1).join(' ') || null;
            }

            prospects.push({
                email: email,
                first_name: firstName || null,
                last_name: lastName || null,
                company: companyIndex !== -1 ? values[companyIndex]?.trim().replace(/"/g, '') : null
            });
        }

        return prospects;
    }

    function parseCSVLine(line, separator) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === separator && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // ==================== AGENT CONTROL ====================
    async function toggleAgent() {
        isRunning = !isRunning;

        const { error } = await saveConfig({ is_active: isRunning });

        if (error) {
            showToast('❌ Erreur lors du changement de statut', 'error');
            isRunning = !isRunning; // Revert
            return;
        }

        if (isRunning) {
            showToast('🚀 Agent Autopilot activé !');
            // Log l'activation
            await logAgentAction('info', 'Agent activé par l\'utilisateur');
        } else {
            showToast('⏸️ Agent Autopilot en pause');
            await logAgentAction('info', 'Agent mis en pause par l\'utilisateur');
        }

        renderDashboard();
    }

    async function logAgentAction(type, message, data = null) {
        await db()
            .from('agent_logs')
            .insert({
                user_id: currentUserId,
                run_id: crypto.randomUUID(),
                log_type: type,
                message: message,
                data: data
            });
    }

    // ==================== MODAL PRINCIPAL ====================
    function openAutopilotModal() {
        // Supprimer modal existant si présent
        const existing = document.getElementById('autopilot-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'autopilot-modal';
        modal.innerHTML = `
            <div class="modal-content autopilot-modal">
                <div class="modal-header">
                    <h2>🤖 Agent Autopilot</h2>
                    <button class="modal-close" onclick="AgentAutopilot.closeModal()">&times;</button>
                </div>
                <div class="autopilot-tabs">
                    <button class="tab-btn active" data-tab="dashboard" onclick="AgentAutopilot.switchTab('dashboard')">
                        📊 Dashboard
                    </button>
                    <button class="tab-btn" data-tab="config" onclick="AgentAutopilot.switchTab('config')">
                        ⚙️ Configuration
                    </button>
                    <button class="tab-btn" data-tab="templates" onclick="AgentAutopilot.switchTab('templates')">
                        📝 Templates
                    </button>
                    <button class="tab-btn" data-tab="logs" onclick="AgentAutopilot.switchTab('logs')">
                        📋 Logs
                    </button>
                </div>
                <div class="autopilot-content">
                    <div id="agent-dashboard" class="tab-content active"></div>
                    <div id="agent-config" class="tab-content"></div>
                    <div id="agent-templates" class="tab-content"></div>
                    <div id="agent-logs" class="tab-content"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Fermer en cliquant à l'extérieur
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        // Initialiser et afficher le dashboard
        init().then(() => {
            renderDashboard();
        });
    }

    function closeModal() {
        const modal = document.getElementById('autopilot-modal');
        if (modal) modal.remove();
        document.body.style.overflow = '';
    }

    function switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.autopilot-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Update tab content
        document.querySelectorAll('.autopilot-content .tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const tabElement = document.getElementById(`agent-${tab}`);
        if (tabElement) tabElement.classList.add('active');

        // Render the tab content
        switch (tab) {
            case 'dashboard':
                renderDashboard();
                break;
            case 'config':
                renderConfig();
                break;
            case 'templates':
                renderTemplates();
                break;
            case 'logs':
                renderLogs();
                break;
        }
    }

    function viewProspect(prospectId) {
        // Fermer le modal et naviguer vers le prospect
        closeModal();
        // Si une fonction de navigation existe
        if (window.viewProspectDetails) {
            window.viewProspectDetails(prospectId);
        }
    }

    // ==================== PENDING EMAILS (VALIDATION HUMAINE) ====================
    let pendingEmails = [];
    const WORKER_URL = 'https://sos-autopilot-agent.sandra-devonssay-s-account.workers.dev';

    async function loadPendingEmails() {
        const container = document.getElementById('pending-emails-list');
        const badge = document.getElementById('pending-count');
        const approveAllBtn = document.getElementById('approve-all-btn');
        if (!container) return;

        try {
            const { data, error } = await db()
                .from('email_queue')
                .select('*')
                .eq('user_id', currentUserId)
                .eq('status', 'pending_approval')
                .order('created_at', { ascending: false });

            if (error) throw error;

            pendingEmails = data || [];

            // Mettre à jour le badge et le bouton "Tout approuver"
            if (badge) {
                if (pendingEmails.length > 0) {
                    badge.textContent = pendingEmails.length;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }

            if (approveAllBtn) {
                approveAllBtn.style.display = pendingEmails.length > 1 ? 'inline-block' : 'none';
            }

            if (pendingEmails.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>✅ Aucun email en attente de validation</p>
                        <p class="hint">Quand l'agent préparera des emails, ils apparaîtront ici pour validation.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = pendingEmails.map(email => {
                // Parser les warnings anti-spam si présents
                let spamWarnings = [];
                try {
                    if (email.spam_warnings) {
                        spamWarnings = JSON.parse(email.spam_warnings);
                    }
                } catch (e) {}

                const hasSpamRisk = email.spam_score >= 30 || spamWarnings.length > 0;

                return `
                <div class="pending-email-card ${hasSpamRisk ? 'spam-warning' : ''}" data-id="${email.id}">
                    ${hasSpamRisk ? `
                        <div class="spam-alert">
                            <span class="spam-icon">⚠️</span>
                            <span>Risque spam (score: ${email.spam_score || 0})</span>
                            ${spamWarnings.length > 0 ? `
                                <ul class="spam-warnings-list">
                                    ${spamWarnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    ` : ''}
                    <div class="email-header">
                        <div class="recipient-info">
                            <strong>${escapeHtml(email.prospect_name || 'Prospect')}</strong>
                            <span class="email-address">${escapeHtml(email.prospect_email)}</span>
                        </div>
                        <div class="email-date">${new Date(email.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div class="email-subject">
                        <strong>Objet:</strong> ${escapeHtml(email.subject)}
                    </div>
                    <div class="email-preview">
                        ${escapeHtml(email.body).substring(0, 200)}...
                    </div>
                    <div class="email-actions">
                        <button class="btn-preview" onclick="AgentAutopilot.previewEmail('${email.id}')">
                            👁️ Voir
                        </button>
                        <button class="btn-approve" onclick="AgentAutopilot.approveEmail('${email.id}')">
                            ✅ Envoyer
                        </button>
                        <button class="btn-reject" onclick="AgentAutopilot.rejectEmail('${email.id}')">
                            ❌ Rejeter
                        </button>
                    </div>
                </div>
            `}).join('');

        } catch (error) {
            console.error('Erreur chargement emails en attente:', error);
            container.innerHTML = '<p class="error">Erreur de chargement</p>';
        }
    }

    function previewEmail(emailId) {
        const email = pendingEmails.find(e => e.id === emailId);
        if (!email) return;

        const modal = document.createElement('div');
        modal.className = 'email-preview-modal';
        modal.innerHTML = `
            <div class="email-preview-content">
                <button class="close-btn" onclick="this.closest('.email-preview-modal').remove()">×</button>
                <h3>📧 Aperçu de l'email</h3>
                <div class="email-full-preview">
                    <div class="preview-field">
                        <label>À:</label>
                        <span>${escapeHtml(email.prospect_name || '')} &lt;${escapeHtml(email.prospect_email)}&gt;</span>
                    </div>
                    <div class="preview-field">
                        <label>De:</label>
                        <span>${escapeHtml(email.sender_name || '')} &lt;${escapeHtml(email.sender_email)}&gt;</span>
                    </div>
                    <div class="preview-field">
                        <label>Objet:</label>
                        <span>${escapeHtml(email.subject)}</span>
                    </div>
                    <div class="preview-body">
                        ${escapeHtml(email.body).replace(/\n/g, '<br>')}
                    </div>
                </div>
                <div class="preview-actions">
                    <button class="btn-secondary" onclick="this.closest('.email-preview-modal').remove()">Fermer</button>
                    <button class="btn-reject" onclick="AgentAutopilot.rejectEmail('${email.id}'); this.closest('.email-preview-modal').remove();">
                        ❌ Rejeter
                    </button>
                    <button class="btn-approve" onclick="AgentAutopilot.approveEmail('${email.id}'); this.closest('.email-preview-modal').remove();">
                        ✅ Envoyer maintenant
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async function approveEmail(emailId) {
        if (!confirm('Envoyer cet email maintenant ?')) return;

        try {
            showToast('📤 Envoi en cours...');

            // Appeler le worker pour envoyer
            const response = await fetch(`${WORKER_URL}/send-approved`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email_id: emailId,
                    user_id: currentUserId
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast('✅ Email envoyé avec succès !');
                loadPendingEmails(); // Rafraîchir la liste
            } else {
                throw new Error(result.error || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('Erreur envoi email:', error);
            showToast('❌ Erreur: ' + error.message, 'error');
        }
    }

    async function rejectEmail(emailId) {
        if (!confirm('Rejeter cet email ? Il ne sera pas envoyé.')) return;

        try {
            // Mettre à jour directement dans Supabase
            const { error } = await db()
                .from('email_queue')
                .update({
                    status: 'rejected',
                    rejected_at: new Date().toISOString()
                })
                .eq('id', emailId)
                .eq('user_id', currentUserId);

            if (error) throw error;

            showToast('🗑️ Email rejeté');
            loadPendingEmails(); // Rafraîchir la liste
        } catch (error) {
            console.error('Erreur rejet email:', error);
            showToast('❌ Erreur: ' + error.message, 'error');
        }
    }

    async function approveAllEmails() {
        if (!confirm(`Envoyer les ${pendingEmails.length} emails en attente ?`)) return;

        showToast(`📤 Envoi de ${pendingEmails.length} emails...`);

        let sent = 0;
        let errors = 0;

        for (const email of pendingEmails) {
            try {
                const response = await fetch(`${WORKER_URL}/send-approved`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email_id: email.id,
                        user_id: currentUserId
                    })
                });
                const result = await response.json();
                if (result.success) {
                    sent++;
                } else {
                    errors++;
                }
            } catch (e) {
                errors++;
            }
        }

        showToast(`✅ ${sent} email(s) envoyé(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`);
        loadPendingEmails();
    }

    // ==================== UTILS ====================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(message, type = 'success') {
        if (window.showToast) {
            window.showToast(message);
        } else {
            alert(message);
        }
    }

    // ==================== PUBLIC API ====================
    return {
        init,
        openAutopilotModal,
        closeModal,
        switchTab,
        toggleAgent,
        saveConfigFromForm,
        createDefaultTemplates,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        filterLogs,
        viewProspect,
        loadNotifications,
        markNotificationRead,
        handleCSVImport,
        switchImportTab,
        addProspectManually,
        // Validation emails
        loadPendingEmails,
        previewEmail,
        approveEmail,
        rejectEmail,
        approveAllEmails
    };
})();
