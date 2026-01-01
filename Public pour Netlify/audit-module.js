// =====================================================
// AUDIT DE COMPTE RÉSEAUX SOCIAUX - Module Frontend
// SOS Storytelling
// =====================================================

window.AuditModule = (function() {
    'use strict';

    // ==================== CONFIG ====================
    const WORKER_URL = 'https://sos-audit-agent.sandra-devonssay.workers.dev';

    // ==================== STATE ====================
    let currentUserId = null;
    let currentAudit = null;
    let pollingInterval = null;

    // ==================== INIT ====================
    async function init() {
        try {
            if (window.currentUser && window.currentUser.id) {
                currentUserId = window.currentUser.id;
            } else if (window.supabaseApp && window.supabaseApp.auth) {
                const { data } = await window.supabaseApp.auth.getSession();
                if (data?.session?.user) {
                    currentUserId = data.session.user.id;
                }
            }
            console.log('Audit module init - userId:', currentUserId);
        } catch (error) {
            console.error('Erreur init audit:', error);
        }
    }

    // ==================== MODAL PRINCIPAL ====================
    function openAuditModal() {
        const existing = document.getElementById('audit-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'audit-modal-overlay active';
        modal.id = 'audit-modal';
        modal.innerHTML = `
            <div class="audit-modal-content">
                <button class="audit-modal-close" onclick="AuditModule.closeModal()">&times;</button>
                <div id="audit-container">
                    ${renderAuditForm()}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        init();

        // Auto-detect platform on URL input
        const urlInput = document.getElementById('audit-url-input');
        if (urlInput) {
            urlInput.addEventListener('input', handleUrlInput);
        }
    }

    function closeModal() {
        const modal = document.getElementById('audit-modal');
        if (modal) modal.remove();
        document.body.style.overflow = '';
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    // ==================== FORM ====================
    function renderAuditForm() {
        return `
            <div class="audit-form-container">
                <div class="audit-icon">🔍</div>
                <h2>Audit de ton compte</h2>
                <p class="audit-subtitle">
                    Découvre ce qui marche, ce qui manque, et obtiens ta stratégie personnalisée
                </p>

                <form onsubmit="AuditModule.startAudit(event)">
                    <div class="audit-input-group">
                        <label>Colle le lien de ton profil</label>
                        <input
                            type="url"
                            id="audit-url-input"
                            placeholder="https://instagram.com/ton.compte"
                            required
                        />
                    </div>

                    <div class="audit-platform-selector">
                        <span class="audit-platform-badge active" data-platform="instagram" onclick="AuditModule.selectPlatform('instagram')">
                            📸 Instagram
                        </span>
                        <span class="audit-platform-badge" data-platform="tiktok" onclick="AuditModule.selectPlatform('tiktok')">
                            🎵 TikTok
                        </span>
                        <span class="audit-platform-badge" data-platform="linkedin" onclick="AuditModule.selectPlatform('linkedin')">
                            💼 LinkedIn
                        </span>
                    </div>

                    <input type="hidden" id="audit-platform" value="instagram" />

                    <div id="audit-error" class="audit-error-message" style="display: none;"></div>

                    <button type="submit" class="audit-submit-btn" id="audit-submit-btn">
                        🔍 Analyser mon compte
                    </button>
                </form>

                <p class="audit-note">
                    ⏱️ L'analyse prend environ 30 secondes
                </p>
            </div>
        `;
    }

    function handleUrlInput(e) {
        const url = e.target.value;
        let platform = 'instagram';

        if (url.includes('instagram.com')) {
            platform = 'instagram';
        } else if (url.includes('tiktok.com')) {
            platform = 'tiktok';
        } else if (url.includes('linkedin.com')) {
            platform = 'linkedin';
        }

        selectPlatform(platform);
    }

    function selectPlatform(platform) {
        document.querySelectorAll('.audit-platform-badge').forEach(badge => {
            badge.classList.toggle('active', badge.dataset.platform === platform);
        });
        document.getElementById('audit-platform').value = platform;
    }

    // ==================== START AUDIT ====================
    async function startAudit(event) {
        event.preventDefault();

        const url = document.getElementById('audit-url-input').value.trim();
        const platform = document.getElementById('audit-platform').value;
        const submitBtn = document.getElementById('audit-submit-btn');
        const errorDiv = document.getElementById('audit-error');

        if (!url) {
            showError('Entre l\'URL de ton profil');
            return;
        }

        if (!currentUserId) {
            showError('Tu dois être connectée pour faire un audit');
            return;
        }

        // Disable button and show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="audit-spinner"></span> Analyse en cours...';
        errorDiv.style.display = 'none';

        try {
            const response = await fetch(`${WORKER_URL}/audits/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profile_url: url,
                    platform: platform,
                    user_id: currentUserId
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Erreur lors de la création de l\'audit');
            }

            currentAudit = data;

            // Show progress screen
            showProgressScreen(data.audit_id);

        } catch (error) {
            console.error('Erreur audit:', error);
            showError(error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🔍 Analyser mon compte';
        }
    }

    function showError(message) {
        const errorDiv = document.getElementById('audit-error');
        if (errorDiv) {
            errorDiv.textContent = '⚠️ ' + message;
            errorDiv.style.display = 'block';
        }
    }

    // ==================== PROGRESS SCREEN ====================
    function showProgressScreen(auditId) {
        const container = document.getElementById('audit-container');
        container.innerHTML = `
            <div class="audit-progress-container">
                <dotlottie-wc
                    src="https://lottie.host/eeab1c36-2031-4942-bf72-95b983b64077/hNKxxXfdmq.lottie"
                    style="width: 180px; height: 180px; margin: 0 auto; display: block;"
                    autoplay
                    loop>
                </dotlottie-wc>
                <h2>Merci de patienter</h2>
                <p style="color: #666; font-size: 0.9em; margin-top: 5px;">L'analyse peut prendre une à deux minutes</p>

                <div class="audit-progress-steps">
                    <div class="audit-step active" id="step-scraping">
                        <span class="step-icon">📡</span>
                        <span class="step-text">Récupération du profil</span>
                    </div>
                    <div class="audit-step" id="step-analyzing">
                        <span class="step-icon">🧠</span>
                        <span class="step-text">Analyse par l'IA</span>
                    </div>
                    <div class="audit-step" id="step-generating">
                        <span class="step-icon">✨</span>
                        <span class="step-text">Génération des recommandations</span>
                    </div>
                </div>

                <p class="audit-wait-text" id="audit-wait-text">
                    L'agent analyse ton profil...
                </p>
            </div>
        `;

        // Start polling
        startPolling(auditId);
    }

    function startPolling(auditId) {
        if (pollingInterval) clearInterval(pollingInterval);

        const startTime = Date.now();
        const maxDuration = 180000; // 3 minutes max

        const poll = async () => {
            // Timeout après 3 minutes
            if (Date.now() - startTime > maxDuration) {
                clearInterval(pollingInterval);
                pollingInterval = null;
                showTimeoutError();
                return;
            }

            try {
                const response = await fetch(`${WORKER_URL}/audits/${auditId}`);
                const data = await response.json();

                if (data.success) {
                    updateProgressUI(data.audit);

                    if (data.audit.status === 'completed') {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                        showResultScreen(data.audit);
                    } else if (data.audit.status === 'failed') {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                        showError(data.audit.error_message || 'Erreur lors de l\'analyse');
                    }
                }
            } catch (e) {
                console.error('Polling error:', e);
            }
        };

        poll();
        pollingInterval = setInterval(poll, 3000); // Poll toutes les 3 secondes
    }

    function showTimeoutError() {
        const container = document.getElementById('audit-container');
        if (!container) return;

        container.innerHTML = `
            <div class="audit-error-container" style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">⏱️</div>
                <h2 style="color: #e74c3c; margin-bottom: 15px;">Analyse trop longue</h2>
                <p style="color: #666; margin-bottom: 20px;">
                    L'analyse prend plus de temps que prévu.<br>
                    Cela peut être dû à une surcharge temporaire.
                </p>
                <button onclick="AuditModule.closeModal()" style="padding: 12px 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1em;">
                    Fermer et réessayer plus tard
                </button>
            </div>
        `;
    }

    function updateProgressUI(audit) {
        const stepScraping = document.getElementById('step-scraping');
        const stepAnalyzing = document.getElementById('step-analyzing');
        const stepGenerating = document.getElementById('step-generating');
        const waitText = document.getElementById('audit-wait-text');
        const status = audit.status;

        // Gestion des étapes
        if (status === 'scraping') {
            stepScraping?.classList.add('active');
            if (waitText) waitText.textContent = 'Récupération des données du profil...';
        } else if (status === 'analyzing') {
            stepScraping?.classList.remove('active');
            stepScraping?.classList.add('completed');
            stepAnalyzing?.classList.add('active');
            if (waitText) waitText.textContent = 'L\'IA analyse ton contenu...';
        } else if (status === 'completed') {
            stepScraping?.classList.remove('active');
            stepScraping?.classList.add('completed');
            stepAnalyzing?.classList.remove('active');
            stepAnalyzing?.classList.add('completed');
            stepGenerating?.classList.remove('active');
            stepGenerating?.classList.add('completed');
            if (waitText) waitText.textContent = 'Terminé !';
        }
    }

    // ==================== RESULT SCREEN ====================
    function showResultScreen(audit) {
        try {
            const result = audit.audit_result || {};
            const diagnostic = result.diagnostic || {};
            const strategy = result.strategy || {};
            const container = document.getElementById('audit-container');

            if (!container) return;

            // Score (peut être dans diagnostic.score ou result.score)
            const score = diagnostic.score || result.score || 0;

            // Helper pour garantir un tableau
            const ensureArray = (val) => Array.isArray(val) ? val : [];

            // Points positifs (diagnostic.strengths ou result.positives)
            const positives = ensureArray(diagnostic.strengths || result.positives);

            // Améliorations (diagnostic.improvements peut être un tableau d'objets)
            let improvements = [];
            const rawImprovements = diagnostic.improvements || result.improvements;
            if (Array.isArray(rawImprovements)) {
                improvements = rawImprovements.map(item =>
                    typeof item === 'string' ? item : `${item?.issue || ''}: ${item?.recommendation || ''}`
                );
            }

            // Quick wins
            const quickWins = ensureArray(diagnostic.quick_wins);

            // Stratégie semaines
            const weeks = ensureArray(strategy.weeks || result.strategy?.schedule);

            // Content pillars
            const contentPillars = ensureArray(strategy.content_pillars);

            // Posts générés (depuis audit.posts ou result.suggested_posts)
            const posts = ensureArray(audit.posts || result.suggested_posts);

        container.innerHTML = `
            <div class="audit-result-container">
                <!-- Score -->
                <div class="audit-score-card">
                    <div class="audit-score-circle">
                        <span class="audit-score-number">${score}</span>
                        <span class="audit-score-max">/100</span>
                    </div>
                    <p class="audit-score-label">${getScoreLabel(score)}</p>
                </div>

                <!-- Ce qui va bien -->
                <div class="audit-section positive">
                    <h3>🟢 Ce qui va bien</h3>
                    <ul>
                        ${positives.length > 0
                            ? positives.map(item => `<li>${escapeHtml(item)}</li>`).join('')
                            : '<li>Analyse en cours de traitement...</li>'}
                    </ul>
                </div>

                <!-- À améliorer -->
                <div class="audit-section improvements">
                    <h3>🟠 À améliorer</h3>
                    <ul>
                        ${improvements.length > 0
                            ? improvements.map(item => `<li>${escapeHtml(item)}</li>`).join('')
                            : '<li>Aucune amélioration majeure détectée</li>'}
                    </ul>
                </div>

                ${quickWins.length > 0 ? `
                    <div class="audit-section quick-wins">
                        <h3>⚡ Actions rapides</h3>
                        <ul>
                            ${quickWins.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <!-- Stratégie -->
                <div class="audit-section strategy">
                    <h3>🎯 Ta stratégie sur 4 semaines</h3>
                    <p class="strategy-summary">${escapeHtml(strategy.positioning || result.strategy?.summary || '')}</p>

                    ${contentPillars.length > 0 ? `
                        <div class="strategy-pillars">
                            <strong>Piliers de contenu:</strong>
                            ${contentPillars.map(p => `<span class="pillar-tag">${escapeHtml(p)}</span>`).join('')}
                        </div>
                    ` : ''}

                    <div class="audit-schedule-grid">
                        ${weeks.map(week => `
                            <div class="audit-schedule-day">
                                <span class="day-name">Semaine ${week.week || ''}</span>
                                <span class="day-type">${escapeHtml(week.theme || week.type || '')}</span>
                                <p class="day-description">${escapeHtml(
                                    Array.isArray(week.objectives) ? week.objectives.join(', ') :
                                    (typeof week.objectives === 'string' ? week.objectives : (week.description || ''))
                                )}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Posts générés -->
                ${posts.length > 0 ? `
                    <div class="audit-section posts">
                        <h3>💡 Posts prêts à utiliser</h3>
                        <div class="audit-posts-list">
                            ${posts.slice(0, 4).map((post, i) => `
                                <div class="audit-post-card">
                                    <div class="audit-post-header">
                                        <span class="audit-post-type">${escapeHtml(post.post_type || post.type || '')}</span>
                                        <span class="audit-post-day">Semaine ${post.week_number || post.week || ''}</span>
                                    </div>
                                    <p class="audit-post-hook">"${escapeHtml(post.hook || '')}"</p>
                                    <div class="audit-post-actions">
                                        <button class="btn-audit-secondary" onclick="AuditModule.previewPost(${i})">👁️ Voir</button>
                                        <button class="btn-audit-primary" onclick="AuditModule.usePost(${i})">📝 Utiliser</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        ${posts.length > 4 ? `<p style="text-align: center; color: #666; margin-top: 10px;">+ ${posts.length - 4} autres posts disponibles</p>` : ''}
                    </div>
                ` : ''}

                <!-- CTA principal -->
                <div class="audit-cta">
                    <button class="btn-audit-generate-all" onclick="AuditModule.generateMonthlyContent('${audit.id}')">
                        🚀 Générer tout mon contenu du mois
                    </button>
                    <p class="audit-cta-note">
                        L'IA va créer 12 posts basés sur ta stratégie personnalisée
                    </p>
                </div>

                <button class="btn-audit-close" onclick="AuditModule.closeModal()">
                    Fermer
                </button>
            </div>
        `;

        // Store result for later use
        currentAudit = audit;

        } catch (error) {
            console.error('Error in showResultScreen:', error);
            const container = document.getElementById('audit-container');
            if (container) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <h2>✅ Audit terminé !</h2>
                        <p>Les résultats ont été enregistrés.</p>
                        <button onclick="AuditModule.closeModal()" style="padding: 12px 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer;">
                            Fermer
                        </button>
                    </div>
                `;
            }
        }
    }

    function getScoreLabel(score) {
        if (score >= 80) return 'Excellent ! Ton profil est très bien optimisé';
        if (score >= 60) return 'Bien ! Quelques ajustements te feront décoller';
        if (score >= 40) return 'Moyen - Il y a du potentiel à exploiter';
        return 'À améliorer - On va transformer ton profil';
    }

    // ==================== POST ACTIONS ====================
    function previewPost(index) {
        // Chercher dans posts (de la DB) ou suggested_posts (du résultat)
        const posts = currentAudit?.posts || currentAudit?.audit_result?.suggested_posts || [];
        const post = posts[index];
        if (!post) return;

        const modal = document.createElement('div');
        modal.className = 'audit-preview-overlay';
        modal.id = 'audit-preview-modal';
        modal.innerHTML = `
            <div class="audit-preview-content">
                <button class="audit-modal-close" onclick="document.getElementById('audit-preview-modal').remove()">&times;</button>
                <div class="audit-preview-header">
                    <span class="audit-post-type">${escapeHtml(post.type)}</span>
                    <span>${escapeHtml(post.suggested_day || '')} - Semaine ${post.suggested_week || 1}</span>
                </div>
                <div class="audit-preview-body">
                    <p class="audit-preview-hook">${escapeHtml(post.hook)}</p>
                    <div class="audit-preview-content-text">${escapeHtml(post.content).replace(/\\n/g, '<br>')}</div>
                    ${post.cta ? `<p class="audit-preview-cta"><strong>CTA:</strong> ${escapeHtml(post.cta)}</p>` : ''}
                    ${post.hashtags?.length ? `<p class="audit-preview-hashtags">${post.hashtags.map(h => '#' + h).join(' ')}</p>` : ''}
                </div>
                <div class="audit-preview-actions">
                    <button class="btn-audit-secondary" onclick="AuditModule.copyPost(${index})">📋 Copier</button>
                    <button class="btn-audit-primary" onclick="AuditModule.usePost(${index})">📝 Utiliser dans l'éditeur</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    function copyPost(index) {
        const post = currentAudit?.audit_result?.suggested_posts?.[index];
        if (!post) return;

        const text = `${post.hook}\n\n${post.content.replace(/\\n/g, '\n')}\n\n${post.cta || ''}\n\n${post.hashtags?.map(h => '#' + h).join(' ') || ''}`;

        navigator.clipboard.writeText(text).then(() => {
            showToast('Post copié !');
        }).catch(err => {
            console.error('Erreur copie:', err);
        });
    }

    function usePost(index) {
        const post = currentAudit?.audit_result?.suggested_posts?.[index];
        if (!post) return;

        // Close modals
        document.getElementById('audit-preview-modal')?.remove();
        closeModal();

        // Open post editor with content
        if (typeof showQuickPost === 'function') {
            showQuickPost();
            setTimeout(() => {
                const textarea = document.getElementById('post-textarea') || document.querySelector('textarea[name="content"]');
                if (textarea) {
                    textarea.value = `${post.hook}\n\n${post.content.replace(/\\n/g, '\n')}\n\n${post.cta || ''}`;
                    textarea.dispatchEvent(new Event('input'));
                }
            }, 500);
        }
    }

    function generateMonthlyContent(auditId) {
        // Launch a mission based on the audit
        if (typeof MissionsModule !== 'undefined' && MissionsModule.openMissionsModal) {
            closeModal();
            MissionsModule.openMissionsModal();

            setTimeout(() => {
                const textarea = document.getElementById('mission-command');
                if (textarea) {
                    textarea.value = `Génère 12 posts pour le mois basés sur mon audit de compte (audit_id: ${auditId})`;
                    textarea.focus();
                }
            }, 500);
        } else {
            showToast('Module Missions non disponible');
        }
    }

    // ==================== UTILS ====================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showToast(message) {
        if (window.showToast) {
            window.showToast(message);
        } else {
            alert(message);
        }
    }

    // ==================== MES AUDITS ====================
    async function showMyAudits() {
        if (!currentUserId) {
            await init();
        }

        if (!currentUserId) {
            showToast('Tu dois être connectée pour voir tes audits');
            return;
        }

        // Create modal
        const existing = document.getElementById('my-audits-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'audit-modal-overlay active';
        modal.id = 'my-audits-modal';
        modal.innerHTML = `
            <div class="audit-modal-content" style="max-width: 700px;">
                <button class="audit-modal-close" onclick="document.getElementById('my-audits-modal').remove(); document.body.style.overflow = '';">&times;</button>
                <div id="my-audits-container">
                    <div style="text-align: center; padding: 40px;">
                        <div class="audit-spinner"></div>
                        <p>Chargement de tes audits...</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                document.body.style.overflow = '';
            }
        });

        // Fetch audits
        try {
            const response = await fetch(`${WORKER_URL}/audits/user/${currentUserId}`);
            const data = await response.json();

            if (data.success && data.audits) {
                renderMyAudits(data.audits);
            } else {
                document.getElementById('my-audits-container').innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">📊</div>
                        <h2>Aucun audit</h2>
                        <p style="color: #666;">Tu n'as pas encore fait d'audit de compte.</p>
                        <button onclick="document.getElementById('my-audits-modal').remove(); document.body.style.overflow = ''; AuditModule.openAuditModal();"
                                style="margin-top: 20px; padding: 12px 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer;">
                            Faire mon premier audit
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching audits:', error);
            document.getElementById('my-audits-container').innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #e74c3c;">Erreur lors du chargement des audits</p>
                </div>
            `;
        }
    }

    function renderMyAudits(audits) {
        const container = document.getElementById('my-audits-container');

        const platformIcons = {
            instagram: '📸',
            tiktok: '🎵',
            linkedin: '💼'
        };

        const statusLabels = {
            completed: { label: 'Terminé', color: '#22c55e' },
            analyzing: { label: 'En cours...', color: '#f59e0b' },
            scraping: { label: 'En cours...', color: '#f59e0b' },
            failed: { label: 'Échoué', color: '#ef4444' }
        };

        container.innerHTML = `
            <div class="my-audits-header" style="text-align: center; margin-bottom: 30px;">
                <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
                <h2 style="margin: 0;">Mes Audits</h2>
                <p style="color: #666; margin-top: 5px;">${audits.length} audit${audits.length > 1 ? 's' : ''} réalisé${audits.length > 1 ? 's' : ''}</p>
            </div>

            <div class="audits-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${audits.map(audit => {
                    const status = statusLabels[audit.status] || { label: audit.status, color: '#888' };
                    const date = new Date(audit.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    });

                    return `
                        <div class="audit-item" style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #f8f9fa; border-radius: 12px; cursor: pointer; transition: all 0.2s;"
                             onclick="AuditModule.viewAuditDetails('${audit.id}')"
                             onmouseover="this.style.background='#e9ecef'; this.style.transform='translateX(4px)'"
                             onmouseout="this.style.background='#f8f9fa'; this.style.transform='none'">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 24px;">${platformIcons[audit.platform] || '📱'}</span>
                                <div>
                                    <div style="font-weight: 600;">@${escapeHtml(audit.profile_username)}</div>
                                    <div style="font-size: 0.85em; color: #666;">${date}</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 16px;">
                                ${audit.score !== null ? `
                                    <div style="text-align: center;">
                                        <div style="font-size: 1.4em; font-weight: bold; color: ${audit.score >= 60 ? '#22c55e' : audit.score >= 40 ? '#f59e0b' : '#ef4444'};">${audit.score}</div>
                                        <div style="font-size: 0.7em; color: #888;">/100</div>
                                    </div>
                                ` : ''}
                                <span style="padding: 4px 10px; background: ${status.color}20; color: ${status.color}; border-radius: 20px; font-size: 0.8em; font-weight: 500;">
                                    ${status.label}
                                </span>
                                <span style="color: #888;">→</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="text-align: center; margin-top: 24px;">
                <button onclick="document.getElementById('my-audits-modal').remove(); document.body.style.overflow = ''; AuditModule.openAuditModal();"
                        style="padding: 12px 24px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1em;">
                    + Nouvel audit
                </button>
            </div>
        `;
    }

    async function viewAuditDetails(auditId) {
        // Close my audits modal
        const myAuditsModal = document.getElementById('my-audits-modal');
        if (myAuditsModal) myAuditsModal.remove();

        // Open audit modal with loading
        openAuditModal();

        const container = document.getElementById('audit-container');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="audit-spinner"></div>
                <p>Chargement de l'audit...</p>
            </div>
        `;

        // Fetch full audit details
        try {
            const response = await fetch(`${WORKER_URL}/audits/${auditId}`);
            const data = await response.json();

            if (data.success && data.audit) {
                if (data.audit.status === 'completed') {
                    showResultScreen(data.audit);
                } else if (data.audit.status === 'failed') {
                    container.innerHTML = `
                        <div style="text-align: center; padding: 40px;">
                            <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                            <h2>Audit échoué</h2>
                            <p style="color: #666;">${data.audit.error_message || 'Une erreur est survenue'}</p>
                            <button onclick="AuditModule.closeModal()" style="margin-top: 20px; padding: 12px 24px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                                Fermer
                            </button>
                        </div>
                    `;
                } else {
                    // Still in progress
                    showProgressScreen(auditId);
                }
            } else {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p style="color: #e74c3c;">Audit non trouvé</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching audit details:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <p style="color: #e74c3c;">Erreur lors du chargement</p>
                </div>
            `;
        }
    }

    // ==================== PUBLIC API ====================
    return {
        init,
        openAuditModal,
        closeModal,
        selectPlatform,
        startAudit,
        previewPost,
        copyPost,
        usePost,
        generateMonthlyContent,
        showMyAudits,
        viewAuditDetails
    };
})();
