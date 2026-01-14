// =====================================================
// MISSIONS MULTI-AGENTS - Module Frontend
// SOS Storytelling - Autopilot Multi-Agents
// =====================================================

window.MissionsModule = (function() {
    'use strict';

    // ==================== CONFIG ====================
    const WORKER_URL = 'https://sos-missions-agent.sandra-devonssay.workers.dev';

    // ==================== STATE ====================
    let currentUserId = null;
    let currentOrgId = null;
    let missions = [];
    let templates = [];
    let currentMission = null;
    let pollingInterval = null;

    // ==================== INIT ====================
    async function init() {
        if (window.currentUser && window.currentUser.id) {
            currentUserId = window.currentUser.id;
            currentOrgId = window.currentUser.organization_id;
        } else if (window.supabaseApp) {
            const { data: { session } } = await window.supabaseApp.auth.getSession();
            if (session?.user) {
                currentUserId = session.user.id;
            }
        }

        if (!currentUserId) {
            console.error('Utilisateur non connecté');
            return;
        }

        console.log('Missions module init - userId:', currentUserId);
        await loadTemplates();
    }

    // ==================== TEMPLATES PAR DÉFAUT ====================
    function getDefaultTemplates() {
        return [
            { id: 'email-sequence', name: 'Séquence emails', icon: '📧', category: 'emails', suggested_command: 'Crée une séquence de 5 emails sur [SUJET]' },
            { id: 'newsletter', name: 'Newsletter', icon: '📰', category: 'emails', suggested_command: 'Rédige une newsletter sur [SUJET]' },
            { id: 'prospection-dm', name: 'Messages de prospection', icon: '💬', category: 'prospection', suggested_command: 'Crée 10 messages de prospection personnalisés' },
            { id: 'contenu-mensuel', name: 'Contenu mensuel', icon: '📅', category: 'content', suggested_command: 'Prépare mon contenu pour 1 mois' },
            { id: 'relance-prospects', name: 'Relance prospects', icon: '🔄', category: 'followup', suggested_command: 'Prépare des relances pour mes prospects inactifs' },
            { id: 'analyse-concurrence', name: 'Analyse concurrence', icon: '🔍', category: 'analysis', suggested_command: 'Analyse les contenus de [CONCURRENT]' }
        ];
    }

    // ==================== TEMPLATES ====================
    async function loadTemplates() {
        try {
            const response = await fetch(`${WORKER_URL}/missions/templates`);
            if (!response.ok) {
                console.warn('Templates API indisponible, utilisation des templates par défaut');
                templates = getDefaultTemplates();
                return;
            }
            const data = await response.json();
            if (data.success) {
                // Dédupliquer les templates par nom normalisé
                const seen = new Set();

                // Templates à exclure complètement
                const excludeNames = ['calendrier mensuel', 'calendrier'];

                templates = data.templates.filter(t => {
                    // Normaliser le nom : minuscules, sans accents, normaliser verbes
                    let normalized = t.name
                        .toLowerCase()
                        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlever accents
                        .replace(/\s+/g, ' ')
                        .trim()
                        // Normaliser les variations de verbes
                        .replace(/relancer/g, 'relance')
                        .replace(/analyser/g, 'analyse')
                        .replace(/prospecter/g, 'prospection');

                    // Exclure certains templates
                    if (excludeNames.some(ex => normalized.includes(ex))) return false;

                    if (seen.has(normalized)) return false;
                    seen.add(normalized);
                    return true;
                });

                // FORCER le template "contenu mensuel" à toujours avoir 1 mois fixe
                templates = templates.map(t => {
                    if (t.name.toLowerCase().includes('contenu mensuel')) {
                        return {
                            ...t,
                            suggested_command: 'Prépare mon contenu pour 1 mois'
                        };
                    }
                    return t;
                });
            }
        } catch (e) {
            console.error('Erreur chargement templates:', e);
            templates = getDefaultTemplates();
        }
    }

    // ==================== MODAL PRINCIPAL ====================
    function openMissionsModal() {
        const existing = document.getElementById('missions-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'missions-modal';
        modal.innerHTML = `
            <div class="modal-content missions-modal">
                <div class="modal-header">
                    <h2>🚀 Missions Autopilot</h2>
                    <button class="modal-close" onclick="MissionsModule.closeModal()">&times;</button>
                </div>
                <div class="missions-tabs">
                    <button class="tab-btn active" data-tab="new" onclick="MissionsModule.switchTab('new')">
                        ✨ Nouvelle Mission
                    </button>
                    <button class="tab-btn" data-tab="agent" onclick="MissionsModule.switchTab('agent')">
                        🤖 Agent Email
                    </button>
                    <button class="tab-btn" data-tab="active" onclick="MissionsModule.switchTab('active')">
                        🔄 En cours
                    </button>
                    <button class="tab-btn" data-tab="history" onclick="MissionsModule.switchTab('history')">
                        📋 Historique
                    </button>
                </div>
                <div class="missions-content">
                    <div id="tab-new" class="tab-content active"></div>
                    <div id="tab-agent" class="tab-content"></div>
                    <div id="tab-active" class="tab-content"></div>
                    <div id="tab-history" class="tab-content"></div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        init().then(() => renderNewMissionTab());
    }

    function closeModal() {
        const modal = document.getElementById('missions-modal');
        if (modal) modal.remove();
        document.body.style.overflow = '';
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    function switchTab(tab) {
        document.querySelectorAll('.missions-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.missions-content .tab-content').forEach(content => {
            content.classList.remove('active');
        });
        const tabElement = document.getElementById(`tab-${tab}`);
        if (tabElement) {
            tabElement.classList.add('active');
        }

        switch (tab) {
            case 'new': renderNewMissionTab(); break;
            case 'agent': renderAgentTab(); break;
            case 'active': renderActiveMissionsTab(); break;
            case 'history': renderHistoryTab(); break;
        }
    }

    // ==================== TAB: AGENT EMAIL ====================
    function renderAgentTab() {
        const container = document.getElementById('tab-agent');
        if (!container) return;

        // Utiliser Agent Autopilot s'il est disponible
        if (typeof AgentAutopilot !== 'undefined') {
            container.innerHTML = `
                <div class="agent-embed">
                    <div class="agent-embed-header">
                        <p class="agent-embed-desc">Gérez l'envoi automatique d'emails et suivez vos prospects chauds.</p>
                    </div>
                    <div class="agent-embed-actions">
                        <button class="btn-agent-open" onclick="MissionsModule.closeModal(); AgentAutopilot.openAutopilotModal();">
                            🤖 Ouvrir l'Agent Email complet
                        </button>
                    </div>
                    <div class="agent-quick-stats" id="agent-quick-stats">
                        <p class="loading">Chargement des stats...</p>
                    </div>
                </div>
            `;
            // Charger les stats rapides
            loadAgentQuickStats();
        } else {
            container.innerHTML = `
                <div class="agent-embed">
                    <p class="empty">Module Agent Email non disponible.</p>
                </div>
            `;
        }
    }

    async function loadAgentQuickStats() {
        const container = document.getElementById('agent-quick-stats');
        if (!container) return;

        try {
            // Récupérer quelques stats basiques depuis Supabase
            const db = window.supabaseApp;
            if (!db) {
                container.innerHTML = '<p class="empty">Base de données non connectée</p>';
                return;
            }

            const { data: config } = await db
                .from('agent_config')
                .select('*')
                .eq('user_id', currentUserId)
                .single();

            const { count: prospectsCount } = await db
                .from('prospects')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUserId);

            const { count: hotCount } = await db
                .from('prospects')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', currentUserId)
                .eq('agent_status', 'hot');

            container.innerHTML = `
                <div class="quick-stats-grid">
                    <div class="quick-stat">
                        <span class="quick-stat-icon">📧</span>
                        <span class="quick-stat-value">${config?.total_emails_sent || 0}</span>
                        <span class="quick-stat-label">Emails envoyés</span>
                    </div>
                    <div class="quick-stat">
                        <span class="quick-stat-icon">👥</span>
                        <span class="quick-stat-value">${prospectsCount || 0}</span>
                        <span class="quick-stat-label">Prospects</span>
                    </div>
                    <div class="quick-stat">
                        <span class="quick-stat-icon">🔥</span>
                        <span class="quick-stat-value">${hotCount || 0}</span>
                        <span class="quick-stat-label">Chauds</span>
                    </div>
                    <div class="quick-stat">
                        <span class="quick-stat-icon">${config?.is_active ? '✅' : '⏸️'}</span>
                        <span class="quick-stat-value">${config?.is_active ? 'Actif' : 'Pause'}</span>
                        <span class="quick-stat-label">Agent</span>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error('Erreur chargement stats agent:', e);
            container.innerHTML = '<p class="empty">Erreur de chargement</p>';
        }
    }

    // ==================== TAB: NOUVELLE MISSION ====================
    function renderNewMissionTab() {
        const container = document.getElementById('tab-new');
        if (!container) return;

        // Grouper les templates par catégorie
        const categories = {
            'emails': { label: '📧 Emails', templates: [] },
            'prospection': { label: '🎯 Prospection', templates: [] },
            'content': { label: '📅 Contenu', templates: [] },
            'followup': { label: '🔄 Relances', templates: [] },
            'transformation': { label: '📄 Transformation', templates: [] },
            'analysis': { label: '🔍 Analyse', templates: [] }
        };

        templates.forEach(t => {
            if (categories[t.category]) {
                categories[t.category].templates.push(t);
            }
        });

        container.innerHTML = `
            <div class="new-mission-screen">
                <div class="mission-input-section">
                    <h3>Qu'est-ce que tu veux accomplir ?</h3>
                    <div class="mission-input-wrapper">
                        <textarea id="mission-command"
                            placeholder="Ex: Crée une séquence de 5 emails sur le GEO, mardi 9h, sur 5 semaines"
                            rows="3"></textarea>
                        <button class="btn-launch-mission" onclick="MissionsModule.launchMission()">
                            🚀 Lancer la mission
                        </button>
                    </div>
                </div>

                <div class="mission-templates-section">
                    <h4>💡 Idées de missions</h4>
                    <div class="templates-categories">
                        ${Object.entries(categories).map(([key, cat]) => `
                            <div class="template-category">
                                <h5>${cat.label}</h5>
                                <div class="template-cards">
                                    ${cat.templates.map(t => `
                                        <div class="template-card" onclick="MissionsModule.selectTemplate('${t.id}')">
                                            <span class="template-icon">${t.icon}</span>
                                            <span class="template-name">${t.name}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function selectTemplate(templateId) {
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        const textarea = document.getElementById('mission-command');
        if (textarea) {
            textarea.value = template.suggested_command;
            textarea.focus();
        }
    }

    async function launchMission() {
        const command = document.getElementById('mission-command')?.value?.trim();
        if (!command) {
            showToast('Décris ta mission !', 'error');
            return;
        }

        // Forcer 1 mois pour les commandes "contenu mensuel" (empêcher les abus)
        let finalCommand = command;
        if (command.toLowerCase().includes('contenu mensuel') || command.toLowerCase().includes('calendrier mensuel') || command.toLowerCase().includes('contenu pour')) {
            // Remplacer tout nombre de mois ou placeholder {month} par "1 mois"
            finalCommand = command
                .replace(/\{month\}/gi, '1 mois')
                .replace(/(\d+)\s*mois/gi, '1 mois');
        }

        showToast('🚀 Lancement de la mission...');

        try {
            // Créer la mission
            const createResponse = await fetch(`${WORKER_URL}/missions/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: finalCommand,
                    user_id: currentUserId,
                    organization_id: currentOrgId
                })
            });

            const createResult = await createResponse.json();

            if (!createResult.success) {
                throw new Error(createResult.error || 'Erreur création mission');
            }

            currentMission = createResult;

            // Lancer l'exécution (asynchrone côté worker)
            fetch(`${WORKER_URL}/missions/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mission_id: createResult.mission_id,
                    user_id: currentUserId
                })
            });

            // Afficher l'écran de progression
            showMissionProgress(createResult.mission_id);

        } catch (error) {
            console.error('Erreur lancement mission:', error);
            showToast('❌ ' + error.message, 'error');
        }
    }

    // ==================== ÉCRAN DE PROGRESSION ====================
    function showMissionProgress(missionId) {
        const container = document.querySelector('.missions-content');
        if (!container) return;

        container.innerHTML = `
            <div class="mission-progress-screen">
                <div class="progress-header">
                    <div class="progress-icon">🔄</div>
                    <h3>Mission en cours</h3>
                    <p class="mission-command" id="progress-command">Chargement...</p>
                </div>

                <div class="progress-bar-container">
                    <div class="progress-bar" id="progress-bar" style="width: 0%"></div>
                    <span class="progress-percent" id="progress-percent">0%</span>
                </div>

                <div class="progress-steps" id="progress-steps">
                    <p class="loading">Initialisation...</p>
                </div>

                <div class="progress-thinking" id="progress-thinking">
                    <span class="thinking-icon">💭</span>
                    <span class="thinking-text">L'agent prépare ta mission...</span>
                </div>

                <div class="progress-actions">
                    <button class="btn-secondary" onclick="MissionsModule.cancelMission('${missionId}')">
                        Annuler la mission
                    </button>
                </div>
            </div>
        `;

        // Démarrer le polling
        startPolling(missionId);
    }

    function startPolling(missionId) {
        if (pollingInterval) clearInterval(pollingInterval);

        const poll = async () => {
            try {
                const response = await fetch(`${WORKER_URL}/missions/${missionId}/status`);
                const data = await response.json();

                if (data.success) {
                    updateProgressUI(data);

                    // Si mission terminée ou en échec, arrêter le polling
                    if (['ready_for_review', 'completed', 'failed', 'cancelled'].includes(data.mission.status)) {
                        clearInterval(pollingInterval);
                        pollingInterval = null;

                        if (data.mission.status === 'ready_for_review') {
                            showMissionReview(data);
                        } else if (data.mission.status === 'failed') {
                            showToast('❌ Mission échouée: ' + (data.mission.error_message || 'Erreur inconnue'), 'error');
                        }
                    }
                }
            } catch (e) {
                console.error('Polling error:', e);
            }
        };

        poll(); // Premier appel immédiat
        pollingInterval = setInterval(poll, 2000); // Puis toutes les 2 secondes
    }

    function updateProgressUI(data) {
        const { mission, tasks } = data;

        // Command
        const commandEl = document.getElementById('progress-command');
        if (commandEl) commandEl.textContent = `"${mission.command}"`;

        // Progress bar
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = document.getElementById('progress-percent');
        if (progressBar) progressBar.style.width = `${mission.progress_percent}%`;
        if (progressPercent) progressPercent.textContent = `${mission.progress_percent}%`;

        // Steps
        const stepsContainer = document.getElementById('progress-steps');
        if (stepsContainer && tasks) {
            const agentLabels = {
                'scout': '🔍 Recherche',
                'writer': '✍️ Rédaction',
                'scheduler': '📅 Planification',
                'guardian': '🛡️ Vérification',
                'analyst': '📊 Analyse'
            };

            stepsContainer.innerHTML = tasks.map(task => {
                const statusIcon = {
                    'pending': '⏳',
                    'running': '🔄',
                    'completed': '✅',
                    'failed': '❌',
                    'skipped': '⏭️'
                }[task.status] || '⏳';

                const duration = task.duration_ms ? `${(task.duration_ms / 1000).toFixed(1)}s` : '';

                return `
                    <div class="progress-step ${task.status}">
                        <span class="step-status">${statusIcon}</span>
                        <span class="step-label">${agentLabels[task.agent] || task.agent}: ${formatTaskType(task.task_type)}</span>
                        <span class="step-duration">${duration}</span>
                    </div>
                `;
            }).join('');
        }

        // Thinking message
        const thinkingEl = document.getElementById('progress-thinking');
        if (thinkingEl && mission.current_step) {
            const thinkingMessages = {
                'research_topic': 'L\'agent recherche les meilleures pratiques...',
                'draft_sequence': 'L\'agent rédige ta séquence d\'emails...',
                'plan_sending': 'L\'agent calcule les dates d\'envoi optimales...',
                'verify_all': 'L\'agent vérifie la qualité et la conformité...',
                'generate_summary': 'L\'agent prépare le récapitulatif...'
            };

            const taskType = mission.current_step.split(': ')[1];
            thinkingEl.querySelector('.thinking-text').textContent =
                thinkingMessages[taskType] || `Agent en cours: ${mission.current_step}`;
        }
    }

    function formatTaskType(taskType) {
        const labels = {
            'research_topic': 'Recherche du sujet',
            'draft_sequence': 'Rédaction de la séquence',
            'plan_sending': 'Planification des envois',
            'verify_all': 'Vérification qualité',
            'generate_summary': 'Génération du récap',
            'search_prospects': 'Recherche de prospects',
            'filter_blacklist': 'Filtrage blacklist',
            'personalize_messages': 'Personnalisation des messages',
            'plan_outreach': 'Planification de la prospection'
        };
        return labels[taskType] || taskType;
    }

    // ==================== ÉCRAN DE VALIDATION ====================
    function showMissionReview(data) {
        const { mission, outputs } = data;
        const summary = mission.summary || {};

        const container = document.querySelector('.missions-content');
        if (!container) return;

        container.innerHTML = `
            <div class="mission-review-screen">
                <div class="review-header">
                    <div class="review-icon">✅</div>
                    <h3>${summary.title || 'Mission prête !'}</h3>
                </div>

                <div class="review-overview">
                    <div class="overview-card">
                        <span class="overview-label">Type</span>
                        <span class="overview-value">${summary.overview?.type || mission.mission_type}</span>
                    </div>
                    <div class="overview-card">
                        <span class="overview-label">Éléments</span>
                        <span class="overview-value">${summary.overview?.count || outputs?.length || 0}</span>
                    </div>
                    ${summary.overview?.start_date ? `
                        <div class="overview-card">
                            <span class="overview-label">Début</span>
                            <span class="overview-value">${new Date(summary.overview.start_date).toLocaleDateString('fr-FR')}</span>
                        </div>
                    ` : ''}
                </div>

                <div class="review-section">
                    <h4>📋 Aperçu</h4>
                    <div class="review-items">
                        ${renderOutputsList(outputs)}
                    </div>
                </div>

                ${summary.verification_status ? `
                    <div class="review-section verification-section">
                        <h4>🛡️ Vérification</h4>
                        <div class="verification-score">
                            <div class="score-bar">
                                <div class="score-fill" style="width: ${summary.verification_status.overall_score}%"></div>
                            </div>
                            <span class="score-value">${summary.verification_status.overall_score}/100</span>
                        </div>
                        <div class="verification-details">
                            ${summary.verification_status.warnings_count > 0 ? `
                                <span class="verification-warning">⚠️ ${summary.verification_status.warnings_count} avertissement(s)</span>
                            ` : ''}
                            ${summary.verification_status.errors_count === 0 ? `
                                <span class="verification-ok">✅ Prêt pour envoi</span>
                            ` : `
                                <span class="verification-error">❌ ${summary.verification_status.errors_count} erreur(s)</span>
                            `}
                        </div>
                    </div>
                ` : ''}

                ${summary.estimated_impact ? `
                    <div class="review-section impact-section">
                        <h4>📊 Impact estimé</h4>
                        <div class="impact-items">
                            ${Object.entries(summary.estimated_impact).map(([key, value]) => `
                                <div class="impact-item">
                                    <span class="impact-value">${value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <div class="review-actions">
                    <button class="btn-secondary" onclick="MissionsModule.cancelMission('${mission.id}')">
                        ❌ Annuler
                    </button>
                    <button class="btn-secondary" onclick="MissionsModule.editMission('${mission.id}')">
                        ✏️ Modifier
                    </button>
                    <button class="btn-primary" onclick="MissionsModule.approveMission('${mission.id}')">
                        ✅ Tout valider et lancer
                    </button>
                </div>
            </div>
        `;
    }

    function renderOutputsList(outputs) {
        if (!outputs || outputs.length === 0) {
            return '<p class="empty">Aucun élément généré</p>';
        }

        return outputs.map(output => {
            const content = output.content;
            const verification = output.verification_results;

            if (output.output_type === 'email') {
                return `
                    <div class="output-card email-card">
                        <div class="output-header">
                            <span class="output-position">${content.position || output.sequence_position || '?'}</span>
                            <span class="output-date">${content.scheduled_at ? new Date(content.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Non programmé'}</span>
                            <div class="output-actions">
                                <button class="btn-icon" onclick="MissionsModule.previewOutput('${output.id}')" title="Voir">👁️</button>
                                <button class="btn-icon" onclick="MissionsModule.editOutput('${output.id}')" title="Modifier">✏️</button>
                            </div>
                        </div>
                        <div class="output-subject">${escapeHtml(content.subject)}</div>
                        <div class="output-preview">${escapeHtml(content.body?.substring(0, 100))}...</div>
                        ${verification?.warnings?.length ? `
                            <div class="output-warnings">
                                ${verification.warnings.map(w => `<span class="warning-badge">⚠️ ${w}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            if (output.output_type === 'dm') {
                return `
                    <div class="output-card dm-card">
                        <div class="output-header">
                            <span class="output-prospect">${content.prospect_name || 'Prospect'}</span>
                            <div class="output-actions">
                                <button class="btn-icon" onclick="MissionsModule.previewOutput('${output.id}')" title="Voir">👁️</button>
                            </div>
                        </div>
                        <div class="output-preview">${escapeHtml(content.message?.substring(0, 80))}...</div>
                    </div>
                `;
            }

            if (output.output_type === 'post') {
                return `
                    <div class="output-card post-card">
                        <div class="output-header">
                            <span class="output-type">${content.type || 'Post'}</span>
                            <span class="output-week">Semaine ${content.week || '?'}</span>
                        </div>
                        <div class="output-hook">"${escapeHtml(content.hook)}"</div>
                    </div>
                `;
            }

            return `
                <div class="output-card generic-card">
                    <div class="output-type">${output.output_type}</div>
                    <div class="output-preview">${JSON.stringify(content).substring(0, 100)}...</div>
                </div>
            `;
        }).join('');
    }

    // ==================== ACTIONS ====================
    async function approveMission(missionId) {
        if (!confirm('Valider et lancer cette mission ?')) return;

        showToast('✅ Validation en cours...');

        try {
            const response = await fetch(`${WORKER_URL}/missions/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mission_id: missionId,
                    user_id: currentUserId
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast('🎉 Mission validée et programmée !');
                closeModal();
            } else {
                throw new Error(result.error || 'Erreur validation');
            }
        } catch (error) {
            console.error('Erreur approbation:', error);
            showToast('❌ ' + error.message, 'error');
        }
    }

    async function cancelMission(missionId) {
        if (!confirm('Annuler cette mission ?')) return;

        try {
            const response = await fetch(`${WORKER_URL}/missions/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mission_id: missionId,
                    user_id: currentUserId
                })
            });

            const result = await response.json();

            if (result.success) {
                showToast('Mission annulée');
                if (pollingInterval) {
                    clearInterval(pollingInterval);
                    pollingInterval = null;
                }
                switchTab('new');
            }
        } catch (error) {
            console.error('Erreur annulation:', error);
            showToast('❌ ' + error.message, 'error');
        }
    }

    function previewOutput(outputId) {
        // TODO: Modal de prévisualisation détaillée
        showToast('Prévisualisation bientôt disponible');
    }

    function editOutput(outputId) {
        // TODO: Modal d'édition d'output
        showToast('Édition bientôt disponible');
    }

    function editMission(missionId) {
        // TODO: Retour à l'édition
        showToast('Édition bientôt disponible');
    }

    // ==================== TAB: MISSIONS EN COURS ====================
    async function renderActiveMissionsTab() {
        const container = document.getElementById('tab-active');
        if (!container) return;

        container.innerHTML = '<p class="loading">Chargement...</p>';

        try {
            const { data: activeMissions } = await window.supabaseApp
                .from('missions')
                .select('*')
                .eq('user_id', currentUserId)
                .in('status', ['pending', 'processing', 'ready_for_review'])
                .order('created_at', { ascending: false });

            if (!activeMissions || activeMissions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>Aucune mission en cours</p>
                        <button class="btn-primary" onclick="MissionsModule.switchTab('new')">
                            🚀 Créer une mission
                        </button>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="missions-list">
                    ${activeMissions.map(m => `
                        <div class="mission-card ${m.status}" onclick="MissionsModule.openMission('${m.id}')">
                            <div class="mission-status">
                                ${getStatusBadge(m.status)}
                            </div>
                            <div class="mission-info">
                                <div class="mission-command">"${escapeHtml(m.command?.substring(0, 60))}..."</div>
                                <div class="mission-meta">
                                    <span>${m.mission_type}</span>
                                    <span>${new Date(m.created_at).toLocaleString('fr-FR')}</span>
                                </div>
                            </div>
                            <div class="mission-progress">
                                <div class="progress-mini">
                                    <div class="progress-mini-bar" style="width: ${m.progress_percent}%"></div>
                                </div>
                                <span>${m.progress_percent}%</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            container.innerHTML = '<p class="error">Erreur de chargement</p>';
        }
    }

    async function openMission(missionId) {
        const response = await fetch(`${WORKER_URL}/missions/${missionId}/status`);
        const data = await response.json();

        if (data.success) {
            if (data.mission.status === 'ready_for_review') {
                showMissionReview(data);
            } else if (['pending', 'processing'].includes(data.mission.status)) {
                showMissionProgress(missionId);
            }
        }
    }

    // ==================== TAB: HISTORIQUE ====================
    async function renderHistoryTab() {
        const container = document.getElementById('tab-history');
        if (!container) return;

        container.innerHTML = '<p class="loading">Chargement...</p>';

        try {
            const { data: historyMissions } = await window.supabaseApp
                .from('missions')
                .select('*')
                .eq('user_id', currentUserId)
                .in('status', ['completed', 'approved', 'failed', 'cancelled'])
                .order('created_at', { ascending: false })
                .limit(20);

            if (!historyMissions || historyMissions.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>Aucune mission dans l'historique</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="missions-list history-list">
                    ${historyMissions.map(m => `
                        <div class="mission-card ${m.status}">
                            <div class="mission-status">
                                ${getStatusBadge(m.status)}
                            </div>
                            <div class="mission-info">
                                <div class="mission-command">"${escapeHtml(m.command?.substring(0, 60))}..."</div>
                                <div class="mission-meta">
                                    <span>${m.mission_type}</span>
                                    <span>${new Date(m.created_at).toLocaleString('fr-FR')}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            container.innerHTML = '<p class="error">Erreur de chargement</p>';
        }
    }

    function getStatusBadge(status) {
        const badges = {
            'pending': '<span class="status-badge pending">⏳ En attente</span>',
            'processing': '<span class="status-badge processing">🔄 En cours</span>',
            'ready_for_review': '<span class="status-badge review">✅ À valider</span>',
            'approved': '<span class="status-badge approved">✓ Approuvée</span>',
            'executing': '<span class="status-badge executing">🚀 En exécution</span>',
            'completed': '<span class="status-badge completed">✓ Terminée</span>',
            'failed': '<span class="status-badge failed">❌ Échec</span>',
            'cancelled': '<span class="status-badge cancelled">⏹️ Annulée</span>'
        };
        return badges[status] || status;
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
        openMissionsModal,
        closeModal,
        switchTab,
        selectTemplate,
        launchMission,
        approveMission,
        cancelMission,
        previewOutput,
        editOutput,
        editMission,
        openMission
    };
})();
