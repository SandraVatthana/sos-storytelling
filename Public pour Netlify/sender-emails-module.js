// =====================================================
// SENDER EMAILS MODULE - Multi-adresses Cold Email 2026
// Best Practice: 20 emails/jour/adresse + rotation
// =====================================================

const SenderEmailsModule = (function() {
    'use strict';

    const API_URL = window.CONFIG?.API_URL || 'https://sos-storytelling-api.sandra-devonssay.workers.dev';
    let senders = [];
    let stats = {};

    // ==================== API CALLS ====================

    async function getAuthHeaders() {
        // Essayer plusieurs noms de variable pour le client Supabase
        const supabase = window.supabaseClient || window.supabaseApp || window.supabase;
        if (!supabase?.auth) {
            throw new Error('Supabase non initialisé. Veuillez rafraîchir la page.');
        }
        const session = await supabase.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) {
            throw new Error('Session expirée. Veuillez rafraîchir la page et vous reconnecter.');
        }
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async function fetchSenders() {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/sender-emails`, { headers });
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            senders = data.senders || [];
            stats = data.stats || {};
            return { senders, stats };
        } catch (error) {
            console.error('Erreur chargement adresses:', error);
            throw error;
        }
    }

    async function addSender(email, displayName, options = {}) {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/sender-emails`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    email,
                    display_name: displayName,
                    daily_limit: options.dailyLimit || 20,
                    warmup_enabled: options.warmupEnabled !== false
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            await fetchSenders();
            return data.sender;
        } catch (error) {
            console.error('Erreur ajout adresse:', error);
            throw error;
        }
    }

    async function updateSender(senderId, updates) {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/sender-emails/${senderId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(updates)
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            await fetchSenders();
            return data.sender;
        } catch (error) {
            console.error('Erreur mise à jour adresse:', error);
            throw error;
        }
    }

    async function deleteSender(senderId) {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/sender-emails/${senderId}`, {
                method: 'DELETE',
                headers
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            await fetchSenders();
            return true;
        } catch (error) {
            console.error('Erreur suppression adresse:', error);
            throw error;
        }
    }

    async function getNextAvailableSender() {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/sender-emails/next`, {
                method: 'POST',
                headers
            });

            return await response.json();
        } catch (error) {
            console.error('Erreur récupération sender:', error);
            throw error;
        }
    }

    async function checkProspect(prospectEmail, campaignId = null) {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/sender-emails/check-prospect`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ prospect_email: prospectEmail, campaign_id: campaignId })
            });

            return await response.json();
        } catch (error) {
            console.error('Erreur vérification prospect:', error);
            throw error;
        }
    }

    async function getStats() {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/sender-emails/stats`, { headers });
            return await response.json();
        } catch (error) {
            console.error('Erreur stats:', error);
            throw error;
        }
    }

    // ==================== UI RENDERING ====================

    function renderSendersPanel(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const html = `
            <div class="sender-emails-panel">
                <div class="sender-emails-header">
                    <div class="sender-emails-title">
                        <h3>📧 Adresses d'envoi</h3>
                        <span class="sender-emails-subtitle">Multi-adresses avec rotation automatique</span>
                    </div>
                    <button class="btn-add-sender" onclick="SenderEmailsModule.showAddModal()">
                        + Ajouter une adresse
                    </button>
                </div>

                <div class="sender-emails-stats" id="senderEmailsStats">
                    ${renderStatsBar()}
                </div>

                <div class="sender-emails-list" id="senderEmailsList">
                    ${renderSendersList()}
                </div>

                <div class="sender-emails-info">
                    <div class="info-card">
                        <span class="info-icon">💡</span>
                        <div class="info-text">
                            <strong>Best Practice 2026</strong>
                            <p>20 emails/jour/adresse max pour éviter le spam. Utilisez plusieurs adresses pour augmenter votre volume.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    function renderStatsBar() {
        const totalLimit = stats.total_available_today || 0;
        const totalSent = stats.total_sent_today || 0;
        const totalRemaining = stats.total_remaining_today || 0;
        const percentage = totalLimit > 0 ? Math.round((totalSent / totalLimit) * 100) : 0;

        return `
            <div class="stats-bar-container">
                <div class="stats-bar-header">
                    <span class="stats-label">Capacité d'envoi aujourd'hui</span>
                    <span class="stats-value">${totalSent} / ${totalLimit} emails</span>
                </div>
                <div class="stats-bar">
                    <div class="stats-bar-fill" style="width: ${percentage}%"></div>
                </div>
                <div class="stats-bar-footer">
                    <span class="stats-remaining">${totalRemaining} emails restants</span>
                    <span class="stats-senders">${stats.active_senders || 0} adresse(s) active(s)</span>
                </div>
            </div>
        `;
    }

    function renderSendersList() {
        if (senders.length === 0) {
            return `
                <div class="empty-senders">
                    <div class="empty-icon">📭</div>
                    <p>Aucune adresse email configurée</p>
                    <p class="empty-hint">Ajoutez votre première adresse pour commencer à envoyer des emails.</p>
                    <button class="btn-primary" onclick="SenderEmailsModule.showAddModal()">
                        + Ajouter une adresse
                    </button>
                </div>
            `;
        }

        return senders.map(sender => renderSenderCard(sender)).join('');
    }

    function renderSenderCard(sender) {
        const effectiveLimit = sender.warmup_enabled ? sender.warmup_current_limit : sender.daily_limit;
        const sentToday = sender.emails_sent_today || 0;
        const remaining = Math.max(0, effectiveLimit - sentToday);
        const percentage = effectiveLimit > 0 ? Math.round((sentToday / effectiveLimit) * 100) : 0;
        const atLimit = sentToday >= effectiveLimit;
        const healthClass = sender.health_score >= 80 ? 'health-good' : sender.health_score >= 50 ? 'health-warning' : 'health-bad';

        return `
            <div class="sender-card ${atLimit ? 'at-limit' : ''} ${!sender.is_active ? 'inactive' : ''}">
                <div class="sender-card-header">
                    <div class="sender-info">
                        <span class="sender-email">${escapeHtml(sender.email)}</span>
                        <span class="sender-name">${escapeHtml(sender.display_name || '')}</span>
                    </div>
                    <div class="sender-badges">
                        ${sender.warmup_enabled ? '<span class="badge badge-warmup">🔥 Warm-up</span>' : ''}
                        ${!sender.is_active ? '<span class="badge badge-inactive">⏸️ Inactive</span>' : ''}
                        <span class="badge ${healthClass}">❤️ ${sender.health_score}%</span>
                    </div>
                </div>

                <div class="sender-progress">
                    <div class="progress-header">
                        <span>${sentToday} / ${effectiveLimit} aujourd'hui</span>
                        <span class="remaining ${atLimit ? 'at-limit' : ''}">${remaining} restants</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${atLimit ? 'full' : ''}" style="width: ${percentage}%"></div>
                    </div>
                </div>

                <div class="sender-stats-row">
                    <div class="sender-stat">
                        <span class="stat-value">${sender.total_emails_sent || 0}</span>
                        <span class="stat-label">Total envoyés</span>
                    </div>
                    <div class="sender-stat">
                        <span class="stat-value">${sender.total_opens || 0}</span>
                        <span class="stat-label">Ouverts</span>
                    </div>
                    <div class="sender-stat">
                        <span class="stat-value">${sender.total_replies || 0}</span>
                        <span class="stat-label">Réponses</span>
                    </div>
                </div>

                <div class="sender-actions">
                    <button class="btn-icon btn-dns" onclick="SenderEmailsModule.showDNSModal('${sender.email}')" title="Vérifier DNS (SPF/DKIM/DMARC)">
                        🔧
                    </button>
                    <button class="btn-icon" onclick="SenderEmailsModule.showEditModal('${sender.id}')" title="Modifier">
                        ✏️
                    </button>
                    <button class="btn-icon" onclick="SenderEmailsModule.toggleActive('${sender.id}', ${!sender.is_active})" title="${sender.is_active ? 'Désactiver' : 'Activer'}">
                        ${sender.is_active ? '⏸️' : '▶️'}
                    </button>
                    <button class="btn-icon btn-danger" onclick="SenderEmailsModule.confirmDelete('${sender.id}')" title="Supprimer">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    // ==================== MODALS ====================

    function showAddModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'addSenderModal';
        modal.innerHTML = `
            <div class="modal-content sender-modal">
                <div class="modal-header">
                    <h2>➕ Ajouter une adresse email</h2>
                    <button class="modal-close" onclick="SenderEmailsModule.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Email *</label>
                        <input type="email" id="newSenderEmail" placeholder="contact@mondomaine.com" required>
                        <p class="form-hint">Utilisez un email professionnel avec votre propre domaine pour une meilleure délivrabilité.</p>
                    </div>
                    <div class="form-group">
                        <label>Nom d'affichage</label>
                        <input type="text" id="newSenderName" placeholder="Sandra Devonssay">
                    </div>
                    <div class="form-group">
                        <label>Limite quotidienne</label>
                        <input type="number" id="newSenderLimit" value="20" min="5" max="50">
                        <p class="form-hint">Recommandé: 20 emails/jour max pour éviter le spam.</p>
                    </div>
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" id="newSenderWarmup" checked>
                            <span>Activer le warm-up progressif</span>
                        </label>
                        <p class="form-hint">Commence à 5 emails/jour et augmente progressivement jusqu'à la limite.</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="SenderEmailsModule.closeModal()">Annuler</button>
                    <button class="btn-primary" onclick="SenderEmailsModule.submitAdd()">Ajouter</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async function submitAdd() {
        const emailInput = document.getElementById('newSenderEmail');
        const email = emailInput.value.trim();
        const displayName = document.getElementById('newSenderName').value.trim();
        const dailyLimit = parseInt(document.getElementById('newSenderLimit').value) || 20;
        const warmupEnabled = document.getElementById('newSenderWarmup').checked;

        // Supprimer l'ancien message d'erreur s'il existe
        const oldError = document.getElementById('addSenderError');
        if (oldError) oldError.remove();

        if (!email) {
            showModalError('addSenderModal', 'Email requis');
            return;
        }

        // Désactiver le bouton pendant la soumission
        const submitBtn = document.querySelector('#addSenderModal .btn-primary');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Ajout en cours...';
        }

        try {
            await addSender(email, displayName, { dailyLimit, warmupEnabled });
            closeModal();
            showToast('Adresse ajoutée !', 'success');
            refresh();
        } catch (error) {
            // Afficher l'erreur dans le modal sans fermer ni effacer les données
            showModalError('addSenderModal', error.message);

            // Réactiver le bouton
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Ajouter';
            }
        }
    }

    function showModalError(modalId, message) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const body = modal.querySelector('.modal-body');
        if (!body) return;

        // Supprimer l'ancien message d'erreur
        const oldError = document.getElementById('addSenderError');
        if (oldError) oldError.remove();

        // Créer le nouveau message d'erreur
        const errorDiv = document.createElement('div');
        errorDiv.id = 'addSenderError';
        errorDiv.style.cssText = 'background: #fee2e2; border: 1px solid #fecaca; color: #dc2626; padding: 12px 16px; border-radius: 8px; margin-bottom: 15px; font-size: 0.9em; display: flex; align-items: center; gap: 8px;';
        errorDiv.innerHTML = `<span>⚠️</span><span>${escapeHtml(message)}</span>`;

        // Insérer en haut du body
        body.insertBefore(errorDiv, body.firstChild);
    }

    function showEditModal(senderId) {
        const sender = senders.find(s => s.id === senderId);
        if (!sender) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'editSenderModal';
        modal.innerHTML = `
            <div class="modal-content sender-modal">
                <div class="modal-header">
                    <h2>✏️ Modifier l'adresse</h2>
                    <button class="modal-close" onclick="SenderEmailsModule.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" value="${escapeHtml(sender.email)}" disabled>
                    </div>
                    <div class="form-group">
                        <label>Nom d'affichage</label>
                        <input type="text" id="editSenderName" value="${escapeHtml(sender.display_name || '')}">
                    </div>
                    <div class="form-group">
                        <label>Limite quotidienne</label>
                        <input type="number" id="editSenderLimit" value="${sender.daily_limit}" min="5" max="50">
                    </div>
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" id="editSenderWarmup" ${sender.warmup_enabled ? 'checked' : ''}>
                            <span>Warm-up progressif</span>
                        </label>
                    </div>
                    <div class="form-group checkbox-group">
                        <label>
                            <input type="checkbox" id="editSenderActive" ${sender.is_active ? 'checked' : ''}>
                            <span>Adresse active</span>
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="SenderEmailsModule.closeModal()">Annuler</button>
                    <button class="btn-primary" onclick="SenderEmailsModule.submitEdit('${senderId}')">Enregistrer</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    async function submitEdit(senderId) {
        const updates = {
            display_name: document.getElementById('editSenderName').value.trim(),
            daily_limit: parseInt(document.getElementById('editSenderLimit').value) || 20,
            warmup_enabled: document.getElementById('editSenderWarmup').checked,
            is_active: document.getElementById('editSenderActive').checked
        };

        try {
            await updateSender(senderId, updates);
            closeModal();
            showToast('Adresse mise à jour !', 'success');
            refresh();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function toggleActive(senderId, active) {
        try {
            await updateSender(senderId, { is_active: active });
            showToast(active ? 'Adresse activée' : 'Adresse désactivée', 'success');
            refresh();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    function confirmDelete(senderId) {
        if (confirm('Supprimer cette adresse email ?')) {
            deleteSenderConfirmed(senderId);
        }
    }

    async function deleteSenderConfirmed(senderId) {
        try {
            await deleteSender(senderId);
            showToast('Adresse supprimée', 'success');
            refresh();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    function closeModal() {
        const modals = document.querySelectorAll('#addSenderModal, #editSenderModal, #dnsModal');
        modals.forEach(m => m.remove());
    }

    // ==================== DNS ASSISTANT ====================

    async function showDNSModal(email) {
        const domain = email.split('@')[1];
        if (!domain) {
            showToast('Email invalide', 'error');
            return;
        }

        // Créer le modal avec loading
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'dnsModal';
        modal.innerHTML = `
            <div class="modal-content dns-modal">
                <div class="modal-header">
                    <h2>🔧 Configuration DNS - ${escapeHtml(domain)}</h2>
                    <button class="modal-close" onclick="SenderEmailsModule.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="dns-loading">
                        <div class="spinner"></div>
                        <p>Vérification DNS en cours...</p>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Appeler l'API pour vérifier DNS
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`${API_URL}/api/domains/${encodeURIComponent(domain)}/check`, {
                headers
            });
            const dnsResult = await response.json();

            renderDNSResult(modal, domain, dnsResult);
        } catch (error) {
            console.error('Erreur DNS check:', error);
            renderDNSError(modal, error.message);
        }
    }

    function renderDNSResult(modal, domain, result) {
        const body = modal.querySelector('.modal-body');
        if (!body) return;

        const scoreClass = result.dns_score >= 75 ? 'score-good' : result.dns_score >= 50 ? 'score-warning' : 'score-bad';
        const statusIcon = result.dns_score >= 75 ? '✅' : result.dns_score >= 50 ? '⚠️' : '❌';

        body.innerHTML = `
            <div class="dns-result">
                <div class="dns-score-container">
                    <div class="dns-score ${scoreClass}">
                        <span class="score-number">${result.dns_score}</span>
                        <span class="score-label">/100</span>
                    </div>
                    <div class="dns-status">
                        ${statusIcon} ${result.status === 'ready' ? 'Prêt pour l\'envoi' : result.status === 'partial' ? 'Configuration partielle' : 'Configuration requise'}
                    </div>
                </div>

                <div class="dns-checks">
                    <div class="dns-check ${result.spf_valid ? 'valid' : 'invalid'}">
                        <div class="check-header">
                            <span class="check-icon">${result.spf_valid ? '✅' : '❌'}</span>
                            <span class="check-name">SPF (Sender Policy Framework)</span>
                        </div>
                        ${result.spf_valid ? `
                            <div class="check-value">${escapeHtml(result.spf_record || '')}</div>
                        ` : `
                            <div class="check-missing">
                                <p>Enregistrement SPF non trouvé</p>
                                <div class="dns-record-box">
                                    <code>${domain} IN TXT "v=spf1 include:spf.brevo.com ~all"</code>
                                    <button class="btn-copy" onclick="SenderEmailsModule.copyToClipboard('v=spf1 include:spf.brevo.com ~all')">📋 Copier</button>
                                </div>
                            </div>
                        `}
                    </div>

                    <div class="dns-check ${result.dkim_valid ? 'valid' : 'invalid'}">
                        <div class="check-header">
                            <span class="check-icon">${result.dkim_valid ? '✅' : '❌'}</span>
                            <span class="check-name">DKIM (DomainKeys)</span>
                        </div>
                        ${result.dkim_valid ? `
                            <div class="check-value">Selector: ${escapeHtml(result.dkim_selector || 'brevo')}</div>
                        ` : `
                            <div class="check-missing">
                                <p>Enregistrement DKIM non trouvé</p>
                                <p class="check-hint">Configurez DKIM dans votre compte Brevo → Senders & IPs → Manage</p>
                            </div>
                        `}
                    </div>

                    <div class="dns-check ${result.dmarc_valid ? 'valid' : 'invalid'}">
                        <div class="check-header">
                            <span class="check-icon">${result.dmarc_valid ? '✅' : '❌'}</span>
                            <span class="check-name">DMARC (Domain-based Message Authentication)</span>
                        </div>
                        ${result.dmarc_valid ? `
                            <div class="check-value">${escapeHtml(result.dmarc_record || '')}</div>
                        ` : `
                            <div class="check-missing">
                                <p>Enregistrement DMARC non trouvé</p>
                                <div class="dns-record-box">
                                    <code>_dmarc.${domain} IN TXT "v=DMARC1; p=none; rua=mailto:dmarc@${domain}"</code>
                                    <button class="btn-copy" onclick="SenderEmailsModule.copyToClipboard('v=DMARC1; p=none; rua=mailto:dmarc@${domain}')">📋 Copier</button>
                                </div>
                            </div>
                        `}
                    </div>

                    <div class="dns-check ${result.mx_valid ? 'valid' : 'invalid'}">
                        <div class="check-header">
                            <span class="check-icon">${result.mx_valid ? '✅' : '❌'}</span>
                            <span class="check-name">MX (Mail Exchange)</span>
                        </div>
                        ${result.mx_valid ? `
                            <div class="check-value">Enregistrements MX configurés</div>
                        ` : `
                            <div class="check-missing">
                                <p>Aucun enregistrement MX trouvé</p>
                                <p class="check-hint">Configurez les MX de votre hébergeur email (Gmail, Office 365, etc.)</p>
                            </div>
                        `}
                    </div>
                </div>

                ${result.recommendations && result.recommendations.length > 0 ? `
                    <div class="dns-recommendations">
                        <h4>💡 Recommandations</h4>
                        <ul>
                            ${result.recommendations.map(r => `
                                <li>
                                    <strong>${r.type.toUpperCase()}:</strong> ${escapeHtml(r.message)}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>

            <div class="modal-footer">
                <button class="btn-secondary" onclick="SenderEmailsModule.closeModal()">Fermer</button>
                <button class="btn-primary" onclick="SenderEmailsModule.showDNSModal('user@${domain}')">🔄 Revérifier</button>
            </div>
        `;
    }

    function renderDNSError(modal, errorMessage) {
        const body = modal.querySelector('.modal-body');
        if (!body) return;

        body.innerHTML = `
            <div class="dns-error">
                <div class="error-icon">⚠️</div>
                <p>Erreur lors de la vérification DNS</p>
                <p class="error-detail">${escapeHtml(errorMessage)}</p>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="SenderEmailsModule.closeModal()">Fermer</button>
            </div>
        `;
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copié dans le presse-papier !', 'success');
        }).catch(() => {
            showToast('Erreur de copie', 'error');
        });
    }

    // ==================== UTILITIES ====================

    async function refresh() {
        await fetchSenders();
        const statsContainer = document.getElementById('senderEmailsStats');
        const listContainer = document.getElementById('senderEmailsList');

        if (statsContainer) statsContainer.innerHTML = renderStatsBar();
        if (listContainer) listContainer.innerHTML = renderSendersList();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showToast(message, type = 'info') {
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }

    // ==================== PUBLIC API ====================

    return {
        init: fetchSenders,
        fetchSenders,
        addSender,
        updateSender,
        deleteSender,
        getNextAvailableSender,
        checkProspect,
        getStats,
        renderSendersPanel,
        showAddModal,
        showEditModal,
        showDNSModal,
        submitAdd,
        submitEdit,
        toggleActive,
        confirmDelete,
        closeModal,
        copyToClipboard,
        refresh,
        getSenders: () => senders,
        getStatsData: () => stats
    };

})();

// Export global
window.SenderEmailsModule = SenderEmailsModule;

// ==================== DNS ASSISTANT CSS ====================
const dnsStyles = document.createElement('style');
dnsStyles.textContent = `
/* DNS Modal */
.dns-modal {
    max-width: 600px;
    width: 90%;
}

.dns-loading {
    text-align: center;
    padding: 40px 20px;
}

.dns-loading .spinner {
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

/* DNS Score */
.dns-score-container {
    text-align: center;
    margin-bottom: 25px;
    padding: 20px;
    background: linear-gradient(135deg, #f8f9ff, #f0f4ff);
    border-radius: 15px;
}

.dns-score {
    display: inline-flex;
    align-items: baseline;
    gap: 5px;
}

.dns-score .score-number {
    font-size: 3em;
    font-weight: 700;
}

.dns-score .score-label {
    font-size: 1.2em;
    color: #666;
}

.dns-score.score-good .score-number { color: #4CAF50; }
.dns-score.score-warning .score-number { color: #ff9800; }
.dns-score.score-bad .score-number { color: #f44336; }

.dns-status {
    margin-top: 10px;
    font-size: 1.1em;
    font-weight: 600;
}

/* DNS Checks */
.dns-checks {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.dns-check {
    padding: 15px;
    border-radius: 12px;
    border: 2px solid #e0e0e0;
    background: white;
}

.dns-check.valid {
    border-color: #c8e6c9;
    background: #f1f8e9;
}

.dns-check.invalid {
    border-color: #ffcdd2;
    background: #fff8f8;
}

.check-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.check-icon {
    font-size: 1.2em;
}

.check-name {
    font-weight: 600;
    color: #333;
}

.check-value {
    font-family: monospace;
    font-size: 0.85em;
    color: #666;
    background: rgba(0,0,0,0.05);
    padding: 8px 12px;
    border-radius: 6px;
    word-break: break-all;
}

.check-missing p {
    margin: 0 0 10px;
    color: #666;
    font-size: 0.9em;
}

.check-hint {
    font-style: italic;
    color: #888 !important;
}

.dns-record-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #f5f5f5;
    padding: 10px 15px;
    border-radius: 8px;
    border: 1px dashed #ccc;
}

.dns-record-box code {
    flex: 1;
    font-size: 0.8em;
    word-break: break-all;
    color: #333;
}

.btn-copy {
    padding: 6px 12px;
    border: none;
    background: #667eea;
    color: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85em;
    white-space: nowrap;
}

.btn-copy:hover {
    background: #5a6fd6;
}

/* DNS Recommendations */
.dns-recommendations {
    margin-top: 20px;
    padding: 15px;
    background: #fff3e0;
    border-radius: 12px;
    border-left: 4px solid #ff9800;
}

.dns-recommendations h4 {
    margin: 0 0 10px;
    color: #e65100;
}

.dns-recommendations ul {
    margin: 0;
    padding-left: 20px;
}

.dns-recommendations li {
    margin: 5px 0;
    color: #555;
    font-size: 0.9em;
}

/* DNS Error */
.dns-error {
    text-align: center;
    padding: 30px;
}

.dns-error .error-icon {
    font-size: 3em;
    margin-bottom: 15px;
}

.dns-error .error-detail {
    color: #888;
    font-size: 0.9em;
}

/* DNS Button Style */
.btn-icon.btn-dns {
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
}

.btn-icon.btn-dns:hover {
    background: linear-gradient(135deg, #45a049, #3d8b40);
}
`;
document.head.appendChild(dnsStyles);
