/**
 * SOS Storytelling - Collaboration Module
 * Gère les workspaces, membres d'équipe, commentaires et notifications
 * Version: 1.0.0
 */

const CollaborationModule = (function() {
    'use strict';

    // ============ STATE ============
    let currentWorkspace = null;
    let workspaces = [];
    let notifications = [];
    let unreadCount = 0;
    let notificationPollingInterval = null;

    // ============ CONFIG ============
    const API_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL)
        ? CONFIG.API_URL
        : 'https://sos-storytelling-api.sandra-devonssay.workers.dev';

    // ============ HELPERS ============
    async function apiCall(endpoint, options = {}) {
        const token = localStorage.getItem('sb-access-token') || sessionStorage.getItem('sb-access-token');

        const defaultHeaders = {
            'Content-Type': 'application/json'
        };

        if (token) {
            defaultHeaders['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers: {
                ...defaultHeaders,
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
            throw new Error(error.error || `Erreur ${response.status}`);
        }

        return response.json();
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `collab-toast collab-toast-${type}`;
        toast.innerHTML = `
            <span class="collab-toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
            <span class="collab-toast-message">${message}</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ============ WORKSPACE MANAGEMENT ============
    async function loadWorkspaces() {
        try {
            const data = await apiCall('/api/workspaces');
            workspaces = data.workspaces || [];

            // Charger le workspace actif depuis localStorage ou prendre le premier
            const savedWorkspaceId = localStorage.getItem('collab_current_workspace');
            if (savedWorkspaceId) {
                currentWorkspace = workspaces.find(w => w.id === savedWorkspaceId);
            }
            if (!currentWorkspace && workspaces.length > 0) {
                currentWorkspace = workspaces[0];
            }

            updateWorkspaceSwitcher();
            return workspaces;
        } catch (error) {
            console.error('Erreur chargement workspaces:', error);
            return [];
        }
    }

    function updateWorkspaceSwitcher() {
        const switcher = document.getElementById('workspaceSwitcher');
        if (!switcher) return;

        const container = switcher.querySelector('.workspace-current');
        const dropdown = switcher.querySelector('.workspace-dropdown-list');

        if (!currentWorkspace) {
            container.innerHTML = `<span class="workspace-name">Aucun espace</span>`;
            dropdown.innerHTML = `<div class="workspace-dropdown-empty">Aucun espace de travail</div>`;
            return;
        }

        // Afficher le workspace actuel
        container.innerHTML = `
            <span class="workspace-logo">${currentWorkspace.logo_url ? `<img src="${currentWorkspace.logo_url}" alt="">` : '🏢'}</span>
            <span class="workspace-name">${currentWorkspace.name}</span>
            <span class="workspace-role-badge ${currentWorkspace.role}">${currentWorkspace.role === 'admin' ? 'Admin' : 'Membre'}</span>
            <span class="workspace-arrow">▼</span>
        `;

        // Dropdown avec tous les workspaces
        dropdown.innerHTML = workspaces.map(ws => `
            <div class="workspace-dropdown-item ${ws.id === currentWorkspace.id ? 'active' : ''}"
                 onclick="CollaborationModule.switchWorkspace('${ws.id}')">
                <span class="workspace-logo">${ws.logo_url ? `<img src="${ws.logo_url}" alt="">` : '🏢'}</span>
                <div class="workspace-dropdown-item-info">
                    <span class="workspace-dropdown-item-name">${ws.name}</span>
                    <span class="workspace-dropdown-item-role">${ws.role === 'admin' ? 'Administrateur' : 'Membre'}</span>
                </div>
                ${ws.id === currentWorkspace.id ? '<span class="workspace-check">✓</span>' : ''}
            </div>
        `).join('') + `
            <div class="workspace-dropdown-divider"></div>
            <div class="workspace-dropdown-item workspace-dropdown-action" onclick="CollaborationModule.showCreateWorkspaceModal()">
                <span class="workspace-logo">➕</span>
                <span class="workspace-dropdown-item-name">Créer un espace</span>
            </div>
        `;
    }

    function switchWorkspace(workspaceId) {
        currentWorkspace = workspaces.find(w => w.id === workspaceId);
        if (currentWorkspace) {
            localStorage.setItem('collab_current_workspace', workspaceId);
            updateWorkspaceSwitcher();
            closeWorkspaceDropdown();
            showToast(`Espace "${currentWorkspace.name}" sélectionné`, 'success');

            // Rafraîchir les données liées au workspace
            loadNotifications();

            // Dispatch event pour que les autres modules puissent réagir
            window.dispatchEvent(new CustomEvent('workspaceChanged', { detail: currentWorkspace }));
        }
    }

    function toggleWorkspaceDropdown() {
        const dropdown = document.querySelector('.workspace-dropdown');
        dropdown?.classList.toggle('show');
    }

    function closeWorkspaceDropdown() {
        const dropdown = document.querySelector('.workspace-dropdown');
        dropdown?.classList.remove('show');
    }

    async function createWorkspace(name) {
        try {
            const data = await apiCall('/api/workspaces', {
                method: 'POST',
                body: JSON.stringify({ name })
            });

            showToast('Espace de travail créé !', 'success');
            await loadWorkspaces();
            switchWorkspace(data.workspace.id);
            return data.workspace;
        } catch (error) {
            showToast(error.message, 'error');
            throw error;
        }
    }

    // ============ TEAM MANAGEMENT ============
    async function loadTeamMembers() {
        if (!currentWorkspace) return [];

        try {
            const data = await apiCall(`/api/workspaces/${currentWorkspace.id}/members`);
            return data.members || [];
        } catch (error) {
            console.error('Erreur chargement membres:', error);
            return [];
        }
    }

    async function loadPendingInvitations() {
        try {
            const data = await apiCall('/api/invitations/pending');
            return data.invitations || [];
        } catch (error) {
            console.error('Erreur chargement invitations:', error);
            return [];
        }
    }

    async function inviteMember(email, role = 'member', assignedClients = null) {
        if (!currentWorkspace) {
            showToast('Aucun espace de travail sélectionné', 'error');
            return;
        }

        try {
            await apiCall('/api/invitations', {
                method: 'POST',
                body: JSON.stringify({
                    workspace_id: currentWorkspace.id,
                    email,
                    role,
                    assigned_clients: assignedClients
                })
            });

            showToast(`Invitation envoyée à ${email}`, 'success');
            refreshTeamModal();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function updateMember(memberId, updates) {
        if (!currentWorkspace) return;

        try {
            await apiCall(`/api/workspaces/${currentWorkspace.id}/members/${memberId}`, {
                method: 'PUT',
                body: JSON.stringify(updates)
            });

            showToast('Membre mis à jour', 'success');
            refreshTeamModal();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function removeMember(memberId) {
        if (!currentWorkspace) return;

        if (!confirm('Êtes-vous sûr de vouloir retirer ce membre ?')) return;

        try {
            await apiCall(`/api/workspaces/${currentWorkspace.id}/members/${memberId}`, {
                method: 'DELETE'
            });

            showToast('Membre retiré', 'success');
            refreshTeamModal();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function revokeInvitation(invitationId) {
        try {
            await apiCall(`/api/invitations/${invitationId}/revoke`, {
                method: 'POST'
            });

            showToast('Invitation révoquée', 'success');
            refreshTeamModal();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    // ============ TEAM MODAL ============
    function showTeamModal() {
        if (!currentWorkspace) {
            showToast('Sélectionne d\'abord un espace de travail', 'error');
            return;
        }

        const existingModal = document.getElementById('teamModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'teamModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal collab-modal">
                <div class="modal-header">
                    <h2>👥 Équipe - ${currentWorkspace.name}</h2>
                    <button class="modal-close" onclick="CollaborationModule.closeTeamModal()">&times;</button>
                </div>
                <div class="modal-content" id="teamModalContent">
                    <div class="collab-loading">Chargement...</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);

        refreshTeamModal();
    }

    async function refreshTeamModal() {
        const content = document.getElementById('teamModalContent');
        if (!content) return;

        const [members, invitations] = await Promise.all([
            loadTeamMembers(),
            loadPendingInvitations()
        ]);

        const isAdmin = currentWorkspace.role === 'admin';

        content.innerHTML = `
            ${isAdmin ? `
            <!-- Invite Form -->
            <div class="team-invite-section">
                <h3>➕ Inviter un membre</h3>
                <div class="team-invite-form">
                    <input type="email" id="inviteEmail" placeholder="Email du collaborateur" class="collab-input">
                    <select id="inviteRole" class="collab-select">
                        <option value="member">Membre</option>
                        <option value="admin">Administrateur</option>
                    </select>
                    <button class="collab-btn collab-btn-primary" onclick="CollaborationModule.handleInvite()">
                        Envoyer l'invitation
                    </button>
                </div>
            </div>
            ` : ''}

            <!-- Pending Invitations -->
            ${invitations.length > 0 ? `
            <div class="team-section">
                <h3>📧 Invitations en attente (${invitations.length})</h3>
                <div class="team-list">
                    ${invitations.map(inv => `
                        <div class="team-member-card invitation">
                            <div class="team-member-info">
                                <span class="team-member-avatar">📧</span>
                                <div class="team-member-details">
                                    <span class="team-member-name">${inv.email}</span>
                                    <span class="team-member-role">${inv.role === 'admin' ? 'Administrateur' : 'Membre'} • Expire le ${new Date(inv.expires_at).toLocaleDateString('fr-FR')}</span>
                                </div>
                            </div>
                            ${isAdmin ? `
                            <button class="collab-btn collab-btn-danger-small" onclick="CollaborationModule.revokeInvitation('${inv.id}')">
                                Révoquer
                            </button>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Members List -->
            <div class="team-section">
                <h3>👥 Membres (${members.length})</h3>
                <div class="team-list">
                    ${members.map(member => `
                        <div class="team-member-card">
                            <div class="team-member-info">
                                <span class="team-member-avatar">${member.users?.name?.charAt(0).toUpperCase() || '👤'}</span>
                                <div class="team-member-details">
                                    <span class="team-member-name">${member.users?.name || member.users?.email || 'Utilisateur'}</span>
                                    <span class="team-member-email">${member.users?.email || ''}</span>
                                    <span class="team-member-role-badge ${member.role}">${member.role === 'admin' ? 'Admin' : 'Membre'}</span>
                                </div>
                            </div>
                            <div class="team-member-meta">
                                <span class="team-member-joined">Depuis ${new Date(member.joined_at).toLocaleDateString('fr-FR')}</span>
                            </div>
                            ${isAdmin && member.user_id !== currentWorkspace.owner_id ? `
                            <div class="team-member-actions">
                                <select class="collab-select-small" onchange="CollaborationModule.updateMember('${member.id}', { role: this.value })">
                                    <option value="member" ${member.role === 'member' ? 'selected' : ''}>Membre</option>
                                    <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
                                </select>
                                <button class="collab-btn collab-btn-danger-small" onclick="CollaborationModule.removeMember('${member.id}')">
                                    Retirer
                                </button>
                            </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Workspace Info -->
            <div class="team-section team-info">
                <h3>ℹ️ Limites de l'espace</h3>
                <div class="team-limits">
                    <div class="team-limit-item">
                        <span class="team-limit-label">Membres</span>
                        <span class="team-limit-value">${members.length} / ${currentWorkspace.max_members || '∞'}</span>
                    </div>
                    <div class="team-limit-item">
                        <span class="team-limit-label">Clients</span>
                        <span class="team-limit-value">- / ${currentWorkspace.max_clients || '∞'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function handleInvite() {
        const email = document.getElementById('inviteEmail')?.value;
        const role = document.getElementById('inviteRole')?.value;

        if (!email) {
            showToast('Entrez une adresse email', 'error');
            return;
        }

        inviteMember(email, role);
        document.getElementById('inviteEmail').value = '';
    }

    function closeTeamModal() {
        const modal = document.getElementById('teamModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }

    // ============ CREATE WORKSPACE MODAL ============
    function showCreateWorkspaceModal() {
        closeWorkspaceDropdown();

        const existingModal = document.getElementById('createWorkspaceModal');
        if (existingModal) existingModal.remove();

        const modal = document.createElement('div');
        modal.id = 'createWorkspaceModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal collab-modal collab-modal-small">
                <div class="modal-header">
                    <h2>➕ Créer un espace de travail</h2>
                    <button class="modal-close" onclick="CollaborationModule.closeCreateWorkspaceModal()">&times;</button>
                </div>
                <div class="modal-content">
                    <div class="form-group">
                        <label>Nom de l'espace</label>
                        <input type="text" id="newWorkspaceName" class="collab-input" placeholder="Ex: Mon Agence">
                    </div>
                    <button class="collab-btn collab-btn-primary collab-btn-full" onclick="CollaborationModule.handleCreateWorkspace()">
                        Créer l'espace
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('show'), 10);
        document.getElementById('newWorkspaceName')?.focus();
    }

    function handleCreateWorkspace() {
        const name = document.getElementById('newWorkspaceName')?.value;
        if (!name) {
            showToast('Entrez un nom pour l\'espace', 'error');
            return;
        }

        createWorkspace(name);
        closeCreateWorkspaceModal();
    }

    function closeCreateWorkspaceModal() {
        const modal = document.getElementById('createWorkspaceModal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }

    // ============ NOTIFICATIONS ============
    async function loadNotifications() {
        try {
            const data = await apiCall('/api/notifications');
            notifications = data.notifications || [];
            updateNotificationUI();
            return notifications;
        } catch (error) {
            console.error('Erreur chargement notifications:', error);
            return [];
        }
    }

    async function loadUnreadCount() {
        try {
            const data = await apiCall('/api/notifications/unread-count');
            unreadCount = data.count || 0;
            updateNotificationBadge();
            return unreadCount;
        } catch (error) {
            console.error('Erreur compteur notifications:', error);
            return 0;
        }
    }

    function updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    }

    function updateNotificationUI() {
        const list = document.getElementById('notificationList');
        if (!list) return;

        if (notifications.length === 0) {
            list.innerHTML = `
                <div class="notification-empty">
                    <span class="notification-empty-icon">🔔</span>
                    <span>Aucune notification</span>
                </div>
            `;
            return;
        }

        list.innerHTML = notifications.slice(0, 10).map(notif => `
            <div class="notification-item ${notif.is_read ? 'read' : 'unread'}"
                 onclick="CollaborationModule.handleNotificationClick('${notif.id}', '${notif.action_url || ''}')">
                <span class="notification-icon">${getNotificationIcon(notif.type)}</span>
                <div class="notification-content">
                    <span class="notification-title">${notif.title}</span>
                    ${notif.body ? `<span class="notification-body">${notif.body}</span>` : ''}
                    <span class="notification-time">${formatTimeAgo(notif.created_at)}</span>
                </div>
                ${!notif.is_read ? '<span class="notification-unread-dot"></span>' : ''}
            </div>
        `).join('');
    }

    function getNotificationIcon(type) {
        const icons = {
            'invitation_received': '📧',
            'invitation_accepted': '✅',
            'member_joined': '👋',
            'member_left': '👋',
            'member_removed': '❌',
            'content_created': '📝',
            'content_updated': '✏️',
            'comment_added': '💬',
            'comment_reply': '↩️',
            'comment_resolved': '✓',
            'comment_mention': '@',
            'client_assigned': '📋',
            'role_changed': '🔑'
        };
        return icons[type] || '🔔';
    }

    function formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'À l\'instant';
        if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
        if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
        return date.toLocaleDateString('fr-FR');
    }

    function toggleNotificationDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        const isOpen = dropdown?.classList.contains('show');

        closeWorkspaceDropdown();

        if (dropdown) {
            dropdown.classList.toggle('show');
            if (!isOpen) {
                loadNotifications();
            }
        }
    }

    function closeNotificationDropdown() {
        const dropdown = document.getElementById('notificationDropdown');
        dropdown?.classList.remove('show');
    }

    async function handleNotificationClick(notifId, actionUrl) {
        // Marquer comme lu
        try {
            await apiCall('/api/notifications/mark-read', {
                method: 'POST',
                body: JSON.stringify({ notification_ids: [notifId] })
            });

            await loadUnreadCount();

            // Mettre à jour l'UI
            const item = document.querySelector(`.notification-item[onclick*="${notifId}"]`);
            if (item) {
                item.classList.remove('unread');
                item.classList.add('read');
                item.querySelector('.notification-unread-dot')?.remove();
            }
        } catch (error) {
            console.error('Erreur marquage notification:', error);
        }

        // Naviguer si URL
        if (actionUrl) {
            closeNotificationDropdown();
            // Gérer la navigation selon l'URL
            if (actionUrl.startsWith('#')) {
                // Navigation interne
                window.location.hash = actionUrl;
            } else if (actionUrl.startsWith('/')) {
                window.location.href = actionUrl;
            }
        }
    }

    async function markAllNotificationsRead() {
        try {
            await apiCall('/api/notifications/mark-all-read', {
                method: 'POST'
            });

            unreadCount = 0;
            updateNotificationBadge();

            // Mettre à jour toutes les notifications dans l'UI
            document.querySelectorAll('.notification-item.unread').forEach(item => {
                item.classList.remove('unread');
                item.classList.add('read');
                item.querySelector('.notification-unread-dot')?.remove();
            });

            showToast('Toutes les notifications marquées comme lues', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    function startNotificationPolling(intervalMs = 60000) {
        if (notificationPollingInterval) {
            clearInterval(notificationPollingInterval);
        }

        loadUnreadCount();
        notificationPollingInterval = setInterval(loadUnreadCount, intervalMs);
    }

    function stopNotificationPolling() {
        if (notificationPollingInterval) {
            clearInterval(notificationPollingInterval);
            notificationPollingInterval = null;
        }
    }

    // ============ COMMENTS ============
    async function loadComments(contentType, contentId) {
        if (!currentWorkspace) return [];

        try {
            const data = await apiCall(`/api/comments?workspace_id=${currentWorkspace.id}&content_type=${contentType}&content_id=${contentId}`);
            return data.comments || [];
        } catch (error) {
            console.error('Erreur chargement commentaires:', error);
            return [];
        }
    }

    async function addComment(contentType, contentId, body, parentId = null) {
        if (!currentWorkspace) {
            showToast('Aucun espace de travail sélectionné', 'error');
            return;
        }

        try {
            const data = await apiCall('/api/comments', {
                method: 'POST',
                body: JSON.stringify({
                    workspace_id: currentWorkspace.id,
                    content_type: contentType,
                    content_id: contentId,
                    body,
                    parent_id: parentId
                })
            });

            showToast('Commentaire ajouté', 'success');
            return data.comment;
        } catch (error) {
            showToast(error.message, 'error');
            throw error;
        }
    }

    async function resolveComment(commentId) {
        try {
            await apiCall(`/api/comments/${commentId}/resolve`, {
                method: 'POST'
            });
            showToast('Commentaire résolu', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async function deleteComment(commentId) {
        if (!confirm('Supprimer ce commentaire ?')) return;

        try {
            await apiCall(`/api/comments/${commentId}`, {
                method: 'DELETE'
            });
            showToast('Commentaire supprimé', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    // ============ COMMENTS PANEL ============
    function showCommentsPanel(contentType, contentId, contentTitle = '') {
        if (!currentWorkspace) {
            showToast('Sélectionne d\'abord un espace de travail', 'error');
            return;
        }

        const existingPanel = document.getElementById('commentsPanel');
        if (existingPanel) existingPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'commentsPanel';
        panel.className = 'comments-panel';
        panel.dataset.contentType = contentType;
        panel.dataset.contentId = contentId;
        panel.innerHTML = `
            <div class="comments-panel-header">
                <div class="comments-panel-title">
                    <span>💬 Commentaires</span>
                    ${contentTitle ? `<span class="comments-panel-subtitle">${contentTitle}</span>` : ''}
                </div>
                <button class="comments-panel-close" onclick="CollaborationModule.closeCommentsPanel()">&times;</button>
            </div>
            <div class="comments-panel-content" id="commentsPanelContent">
                <div class="collab-loading">Chargement...</div>
            </div>
            <div class="comments-panel-input">
                <textarea id="newCommentInput" class="collab-textarea" placeholder="Ajouter un commentaire..."></textarea>
                <button class="collab-btn collab-btn-primary" onclick="CollaborationModule.handleAddComment()">
                    Envoyer
                </button>
            </div>
        `;

        document.body.appendChild(panel);
        setTimeout(() => panel.classList.add('show'), 10);

        refreshCommentsPanel();
    }

    async function refreshCommentsPanel() {
        const panel = document.getElementById('commentsPanel');
        const content = document.getElementById('commentsPanelContent');
        if (!panel || !content) return;

        const contentType = panel.dataset.contentType;
        const contentId = panel.dataset.contentId;

        const comments = await loadComments(contentType, contentId);

        if (comments.length === 0) {
            content.innerHTML = `
                <div class="comments-empty">
                    <span class="comments-empty-icon">💬</span>
                    <span>Aucun commentaire</span>
                    <span class="comments-empty-hint">Sois le premier à commenter !</span>
                </div>
            `;
            return;
        }

        // Organiser les commentaires (parents et réponses)
        const rootComments = comments.filter(c => !c.parent_id);
        const replies = comments.filter(c => c.parent_id);

        content.innerHTML = rootComments.map(comment => `
            <div class="comment-item ${comment.status === 'resolved' ? 'resolved' : ''}" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <span class="comment-avatar">${comment.users?.name?.charAt(0).toUpperCase() || '👤'}</span>
                    <div class="comment-meta">
                        <span class="comment-author">${comment.users?.name || 'Utilisateur'}</span>
                        <span class="comment-time">${formatTimeAgo(comment.created_at)}</span>
                    </div>
                    ${comment.status === 'resolved' ? '<span class="comment-resolved-badge">✓ Résolu</span>' : ''}
                </div>
                <div class="comment-body">${escapeHtml(comment.body)}</div>
                <div class="comment-actions">
                    <button class="comment-action-btn" onclick="CollaborationModule.showReplyInput('${comment.id}')">↩️ Répondre</button>
                    ${comment.status !== 'resolved' ? `<button class="comment-action-btn" onclick="CollaborationModule.resolveComment('${comment.id}'); CollaborationModule.refreshCommentsPanel();">✓ Résoudre</button>` : ''}
                    <button class="comment-action-btn comment-action-delete" onclick="CollaborationModule.deleteComment('${comment.id}'); CollaborationModule.refreshCommentsPanel();">🗑️</button>
                </div>

                <!-- Réponses -->
                ${replies.filter(r => r.parent_id === comment.id).map(reply => `
                    <div class="comment-reply">
                        <div class="comment-header">
                            <span class="comment-avatar small">${reply.users?.name?.charAt(0).toUpperCase() || '👤'}</span>
                            <div class="comment-meta">
                                <span class="comment-author">${reply.users?.name || 'Utilisateur'}</span>
                                <span class="comment-time">${formatTimeAgo(reply.created_at)}</span>
                            </div>
                        </div>
                        <div class="comment-body">${escapeHtml(reply.body)}</div>
                    </div>
                `).join('')}

                <!-- Reply input (hidden by default) -->
                <div class="comment-reply-input" id="replyInput_${comment.id}" style="display: none;">
                    <textarea class="collab-textarea small" placeholder="Répondre..."></textarea>
                    <div class="comment-reply-actions">
                        <button class="collab-btn collab-btn-small" onclick="CollaborationModule.handleReply('${comment.id}')">Envoyer</button>
                        <button class="collab-btn collab-btn-small collab-btn-secondary" onclick="CollaborationModule.hideReplyInput('${comment.id}')">Annuler</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function showReplyInput(commentId) {
        const input = document.getElementById(`replyInput_${commentId}`);
        if (input) {
            input.style.display = 'block';
            input.querySelector('textarea')?.focus();
        }
    }

    function hideReplyInput(commentId) {
        const input = document.getElementById(`replyInput_${commentId}`);
        if (input) {
            input.style.display = 'none';
            input.querySelector('textarea').value = '';
        }
    }

    async function handleAddComment() {
        const panel = document.getElementById('commentsPanel');
        const input = document.getElementById('newCommentInput');
        if (!panel || !input || !input.value.trim()) return;

        const contentType = panel.dataset.contentType;
        const contentId = panel.dataset.contentId;

        await addComment(contentType, contentId, input.value.trim());
        input.value = '';
        await refreshCommentsPanel();
    }

    async function handleReply(parentId) {
        const panel = document.getElementById('commentsPanel');
        const replyContainer = document.getElementById(`replyInput_${parentId}`);
        const textarea = replyContainer?.querySelector('textarea');

        if (!panel || !textarea || !textarea.value.trim()) return;

        const contentType = panel.dataset.contentType;
        const contentId = panel.dataset.contentId;

        await addComment(contentType, contentId, textarea.value.trim(), parentId);
        hideReplyInput(parentId);
        await refreshCommentsPanel();
    }

    function closeCommentsPanel() {
        const panel = document.getElementById('commentsPanel');
        if (panel) {
            panel.classList.remove('show');
            setTimeout(() => panel.remove(), 300);
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============ INITIALIZATION ============
    async function init() {
        // Vérifier si l'utilisateur a un plan agence
        const userPlan = localStorage.getItem('user_plan') || 'solo';
        const isAgencyPlan = ['agency_starter', 'agency_scale', 'enterprise'].includes(userPlan);

        if (!isAgencyPlan) {
            // Cacher les éléments de collaboration pour les plans solo
            document.getElementById('workspaceSwitcher')?.classList.add('hidden');
            document.getElementById('notificationBtn')?.classList.add('hidden');
            return;
        }

        // Charger les workspaces
        await loadWorkspaces();

        // Démarrer le polling des notifications
        startNotificationPolling();

        // Écouter les clics extérieurs pour fermer les dropdowns
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.workspace-dropdown') && !e.target.closest('.workspace-current')) {
                closeWorkspaceDropdown();
            }
            if (!e.target.closest('#notificationDropdown') && !e.target.closest('#notificationBtn')) {
                closeNotificationDropdown();
            }
        });

        console.log('CollaborationModule initialisé');
    }

    // ============ PUBLIC API ============
    return {
        init,

        // Workspace
        loadWorkspaces,
        switchWorkspace,
        createWorkspace,
        toggleWorkspaceDropdown,
        closeWorkspaceDropdown,
        showCreateWorkspaceModal,
        handleCreateWorkspace,
        closeCreateWorkspaceModal,
        getCurrentWorkspace: () => currentWorkspace,

        // Team
        showTeamModal,
        closeTeamModal,
        handleInvite,
        inviteMember,
        updateMember,
        removeMember,
        revokeInvitation,

        // Notifications
        loadNotifications,
        loadUnreadCount,
        toggleNotificationDropdown,
        closeNotificationDropdown,
        handleNotificationClick,
        markAllNotificationsRead,
        startNotificationPolling,
        stopNotificationPolling,

        // Comments
        loadComments,
        addComment,
        resolveComment,
        deleteComment,
        showCommentsPanel,
        closeCommentsPanel,
        refreshCommentsPanel,
        handleAddComment,
        showReplyInput,
        hideReplyInput,
        handleReply
    };
})();

// Auto-init quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
    // Attendre un peu pour que Supabase soit initialisé
    setTimeout(() => CollaborationModule.init(), 500);
});
