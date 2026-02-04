/**
 * HUB Teams Module
 * Gestion des équipes, membres et invitations
 */

const HubTeams = {
    // État
    teams: [],
    currentTeam: null,
    members: [],

    // ============================================
    // INITIALISATION
    // ============================================

    async init() {
        console.log('HubTeams: Initializing...');

        // Charger les équipes de l'utilisateur
        await this.loadTeams();

        console.log('HubTeams: Initialized');
    },

    // ============================================
    // CHARGEMENT DES ÉQUIPES
    // ============================================

    async loadTeams() {
        const { data: { user } } = await hubSupabase.auth.getUser();
        if (!user) return;

        // Équipes dont l'utilisateur est propriétaire
        const { data: ownedTeams } = await hubSupabase
            .from('hub_teams')
            .select('*')
            .eq('owner_id', user.id);

        // Équipes dont l'utilisateur est membre
        const { data: memberships } = await hubSupabase
            .from('hub_team_members')
            .select('team_id, role, hub_teams(*)')
            .eq('user_id', user.id)
            .eq('invitation_status', 'accepted');

        this.teams = [];

        // Ajouter les équipes propriétaires
        if (ownedTeams) {
            ownedTeams.forEach(team => {
                if (!this.teams.find(t => t.id === team.id)) {
                    this.teams.push({ ...team, role: 'owner' });
                }
            });
        }

        // Ajouter les équipes où l'utilisateur est membre
        if (memberships) {
            memberships.forEach(m => {
                if (m.hub_teams && !this.teams.find(t => t.id === m.hub_teams.id)) {
                    this.teams.push({ ...m.hub_teams, role: m.role });
                }
            });
        }

        return this.teams;
    },

    async loadTeamMembers(teamId) {
        const { data, error } = await hubSupabase
            .from('hub_team_members')
            .select(`
                *,
                user:user_id (
                    id,
                    email,
                    raw_user_meta_data
                )
            `)
            .eq('team_id', teamId);

        if (error) {
            console.error('Error loading members:', error);
            return [];
        }

        this.members = data || [];
        return this.members;
    },

    // ============================================
    // GESTION DES ÉQUIPES
    // ============================================

    showCreateTeamModal() {
        const modal = document.getElementById('teamModal');
        const title = document.getElementById('teamModalTitle');
        const form = document.getElementById('teamForm');

        title.textContent = 'Créer une équipe';
        this.currentTeam = null;

        form.innerHTML = `
            <div class="hub-form-group">
                <label class="hub-form-label">Nom de l'équipe *</label>
                <input type="text" class="hub-input" id="teamName" placeholder="Ex: Équipe commerciale" required>
            </div>

            <div class="hub-form-group">
                <label class="hub-form-label">Canaux activés</label>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label class="hub-checkbox">
                        <input type="checkbox" id="channelEmail" checked>
                        <span>📧 Email</span>
                    </label>
                    <label class="hub-checkbox">
                        <input type="checkbox" id="channelDM" checked>
                        <span>💬 DM</span>
                    </label>
                    <label class="hub-checkbox">
                        <input type="checkbox" id="channelCall" checked>
                        <span>📞 Appel</span>
                    </label>
                </div>
            </div>
        `;

        HubCRM.openModal('teamModal');
    },

    showEditTeamModal(team) {
        const modal = document.getElementById('teamModal');
        const title = document.getElementById('teamModalTitle');
        const form = document.getElementById('teamForm');

        title.textContent = 'Modifier l\'équipe';
        this.currentTeam = team;

        const channels = team.channels_enabled || { email: true, dm: true, call: true };

        form.innerHTML = `
            <div class="hub-form-group">
                <label class="hub-form-label">Nom de l'équipe *</label>
                <input type="text" class="hub-input" id="teamName" value="${team.name}" required>
            </div>

            <div class="hub-form-group">
                <label class="hub-form-label">Canaux activés</label>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label class="hub-checkbox">
                        <input type="checkbox" id="channelEmail" ${channels.email ? 'checked' : ''}>
                        <span>📧 Email</span>
                    </label>
                    <label class="hub-checkbox">
                        <input type="checkbox" id="channelDM" ${channels.dm ? 'checked' : ''}>
                        <span>💬 DM</span>
                    </label>
                    <label class="hub-checkbox">
                        <input type="checkbox" id="channelCall" ${channels.call ? 'checked' : ''}>
                        <span>📞 Appel</span>
                    </label>
                </div>
            </div>
        `;

        HubCRM.openModal('teamModal');
    },

    async saveTeam() {
        const name = document.getElementById('teamName')?.value.trim();
        if (!name) {
            HubCRM.showToast('Le nom de l\'équipe est requis', 'error');
            return;
        }

        const channels_enabled = {
            email: document.getElementById('channelEmail')?.checked ?? true,
            dm: document.getElementById('channelDM')?.checked ?? true,
            call: document.getElementById('channelCall')?.checked ?? true
        };

        try {
            if (this.currentTeam) {
                // Update
                const { error } = await hubSupabase
                    .from('hub_teams')
                    .update({ name, channels_enabled })
                    .eq('id', this.currentTeam.id);

                if (error) throw error;

                HubCRM.showToast('Équipe mise à jour', 'success');
            } else {
                // Create
                const { data: { user } } = await hubSupabase.auth.getUser();

                const { data: team, error } = await hubSupabase
                    .from('hub_teams')
                    .insert({
                        name,
                        owner_id: user.id,
                        channels_enabled
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Ajouter le créateur comme membre owner
                await hubSupabase
                    .from('hub_team_members')
                    .insert({
                        team_id: team.id,
                        user_id: user.id,
                        role: 'owner',
                        invitation_status: 'accepted',
                        joined_at: new Date().toISOString()
                    });

                HubCRM.showToast('Équipe créée', 'success');

                // Basculer sur cette équipe
                await this.switchToTeam(team);
            }

            HubCRM.closeModal('teamModal');
            await this.loadTeams();
            this.renderTeamsPanel();

        } catch (error) {
            console.error('Error saving team:', error);
            HubCRM.showToast('Erreur lors de la sauvegarde', 'error');
        }
    },

    async deleteTeam(teamId) {
        if (!confirm('Supprimer cette équipe ? Tous les prospects seront perdus.')) return;

        try {
            const { error } = await hubSupabase
                .from('hub_teams')
                .delete()
                .eq('id', teamId);

            if (error) throw error;

            // Si c'était l'équipe active, repasser en solo
            if (HubCRM.currentTeam?.id === teamId) {
                await HubCRM.switchToSoloMode();
            }

            HubCRM.showToast('Équipe supprimée', 'success');
            await this.loadTeams();
            this.renderTeamsPanel();

        } catch (error) {
            console.error('Error deleting team:', error);
            HubCRM.showToast('Erreur lors de la suppression', 'error');
        }
    },

    async switchToTeam(team) {
        const { data: { user } } = await hubSupabase.auth.getUser();

        try {
            await hubSupabase
                .from('hub_user_settings')
                .update({
                    work_mode: 'team',
                    default_team_id: team.id
                })
                .eq('user_id', user.id);

            HubCRM.isTeamMode = true;
            HubCRM.currentTeam = team;
            HubCRM.updateModeUI();
            HubCRM.renderFilters();
            await HubCRM.loadProspects();

            HubCRM.showToast(`Équipe "${team.name}" activée`, 'success');

        } catch (error) {
            console.error('Error switching team:', error);
            HubCRM.showToast('Erreur lors du changement d\'équipe', 'error');
        }
    },

    // ============================================
    // GESTION DES MEMBRES
    // ============================================

    showInviteMemberModal(teamId) {
        const modal = document.getElementById('inviteModal');
        const form = document.getElementById('inviteForm');

        this.inviteTeamId = teamId;

        form.innerHTML = `
            <div class="hub-form-group">
                <label class="hub-form-label">Email du membre *</label>
                <input type="email" class="hub-input" id="inviteEmail" placeholder="membre@email.com" required>
            </div>

            <div class="hub-form-group">
                <label class="hub-form-label">Rôle</label>
                <select class="hub-input" id="inviteRole">
                    <option value="member">Membre - Peut voir et modifier les prospects assignés</option>
                    <option value="admin">Admin - Peut gérer les membres et tous les prospects</option>
                </select>
            </div>

            <p class="hub-form-hint">
                Une invitation sera envoyée par email. Si la personne n'a pas de compte, elle pourra en créer un.
            </p>
        `;

        HubCRM.openModal('inviteModal');
    },

    async sendInvitation() {
        const email = document.getElementById('inviteEmail')?.value.trim();
        const role = document.getElementById('inviteRole')?.value || 'member';

        if (!email || !HubUtils.isValidEmail(email)) {
            HubCRM.showToast('Email invalide', 'error');
            return;
        }

        try {
            // Vérifier si déjà membre
            const { data: existing } = await hubSupabase
                .from('hub_team_members')
                .select('id')
                .eq('team_id', this.inviteTeamId)
                .eq('invited_email', email)
                .single();

            if (existing) {
                HubCRM.showToast('Cette personne est déjà invitée', 'error');
                return;
            }

            // Créer l'invitation
            const { error } = await hubSupabase
                .from('hub_team_members')
                .insert({
                    team_id: this.inviteTeamId,
                    invited_email: email,
                    role: role,
                    invitation_status: 'pending'
                });

            if (error) throw error;

            // TODO: Envoyer email d'invitation via Cloudflare Worker

            HubCRM.closeModal('inviteModal');
            HubCRM.showToast('Invitation envoyée', 'success');
            await this.loadTeamMembers(this.inviteTeamId);
            this.renderMembersList();

        } catch (error) {
            console.error('Error sending invitation:', error);
            HubCRM.showToast('Erreur lors de l\'envoi', 'error');
        }
    },

    async updateMemberRole(memberId, newRole) {
        try {
            const { error } = await hubSupabase
                .from('hub_team_members')
                .update({ role: newRole })
                .eq('id', memberId);

            if (error) throw error;

            HubCRM.showToast('Rôle mis à jour', 'success');
            await this.loadTeamMembers(HubCRM.currentTeam?.id);
            this.renderMembersList();

        } catch (error) {
            console.error('Error updating role:', error);
            HubCRM.showToast('Erreur lors de la mise à jour', 'error');
        }
    },

    async removeMember(memberId) {
        if (!confirm('Retirer ce membre de l\'équipe ?')) return;

        try {
            const { error } = await hubSupabase
                .from('hub_team_members')
                .delete()
                .eq('id', memberId);

            if (error) throw error;

            HubCRM.showToast('Membre retiré', 'success');
            await this.loadTeamMembers(HubCRM.currentTeam?.id);
            this.renderMembersList();

        } catch (error) {
            console.error('Error removing member:', error);
            HubCRM.showToast('Erreur lors du retrait', 'error');
        }
    },

    async cancelInvitation(memberId) {
        try {
            const { error } = await hubSupabase
                .from('hub_team_members')
                .delete()
                .eq('id', memberId);

            if (error) throw error;

            HubCRM.showToast('Invitation annulée', 'success');
            await this.loadTeamMembers(HubCRM.currentTeam?.id);
            this.renderMembersList();

        } catch (error) {
            console.error('Error canceling invitation:', error);
        }
    },

    // ============================================
    // ACCEPTER / REFUSER INVITATION
    // ============================================

    async checkPendingInvitations() {
        const { data: { user } } = await hubSupabase.auth.getUser();
        if (!user || !user.email) return [];

        const { data } = await hubSupabase
            .from('hub_team_members')
            .select(`
                *,
                hub_teams (*)
            `)
            .eq('invited_email', user.email)
            .eq('invitation_status', 'pending');

        return data || [];
    },

    async acceptInvitation(invitationId) {
        const { data: { user } } = await hubSupabase.auth.getUser();

        try {
            const { error } = await hubSupabase
                .from('hub_team_members')
                .update({
                    user_id: user.id,
                    invitation_status: 'accepted',
                    joined_at: new Date().toISOString()
                })
                .eq('id', invitationId);

            if (error) throw error;

            HubCRM.showToast('Invitation acceptée', 'success');
            await this.loadTeams();

        } catch (error) {
            console.error('Error accepting invitation:', error);
            HubCRM.showToast('Erreur', 'error');
        }
    },

    async rejectInvitation(invitationId) {
        try {
            const { error } = await hubSupabase
                .from('hub_team_members')
                .update({ invitation_status: 'rejected' })
                .eq('id', invitationId);

            if (error) throw error;

            HubCRM.showToast('Invitation refusée', 'info');

        } catch (error) {
            console.error('Error rejecting invitation:', error);
        }
    },

    // ============================================
    // ASSIGNATION DES PROSPECTS
    // ============================================

    async assignProspect(prospectId, userId) {
        try {
            const { error } = await hubSupabase
                .from('hub_prospects')
                .update({ assigned_to: userId || null })
                .eq('id', prospectId);

            if (error) throw error;

            // Log activity
            const member = this.members.find(m => m.user_id === userId);
            const memberName = member?.user?.email || 'Non assigné';

            await HubCRM.logActivity(prospectId, 'prospect_assigned', null,
                `Assigné à ${memberName}`);

            HubCRM.showToast('Prospect assigné', 'success');
            await HubCRM.loadProspects();

        } catch (error) {
            console.error('Error assigning prospect:', error);
            HubCRM.showToast('Erreur lors de l\'assignation', 'error');
        }
    },

    async bulkAssign(prospectIds, userId) {
        try {
            const { error } = await hubSupabase
                .from('hub_prospects')
                .update({ assigned_to: userId || null })
                .in('id', prospectIds);

            if (error) throw error;

            HubCRM.showToast(`${prospectIds.length} prospects assignés`, 'success');
            await HubCRM.loadProspects();

        } catch (error) {
            console.error('Error bulk assigning:', error);
            HubCRM.showToast('Erreur lors de l\'assignation', 'error');
        }
    },

    // ============================================
    // RENDU UI
    // ============================================

    renderTeamsPanel() {
        const container = document.getElementById('teamsPanel');
        if (!container) return;

        container.innerHTML = `
            <div class="hub-detail-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 class="hub-detail-section-title" style="margin: 0;">👥 Mes équipes</h3>
                    <button class="hub-btn hub-btn-primary hub-btn-sm" onclick="HubTeams.showCreateTeamModal()">
                        + Créer
                    </button>
                </div>

                ${this.teams.length === 0 ? `
                    <p style="color: var(--hub-text-muted); text-align: center; padding: 20px;">
                        Aucune équipe. Crée-en une pour collaborer !
                    </p>
                ` : this.teams.map(team => `
                    <div class="hub-team-card ${HubCRM.currentTeam?.id === team.id ? 'active' : ''}" style="${HubCRM.currentTeam?.id === team.id ? 'border-color: var(--hub-primary);' : ''}">
                        <div class="hub-team-info">
                            <div class="hub-team-avatar">${team.name.charAt(0).toUpperCase()}</div>
                            <div>
                                <div class="hub-team-name">${team.name}</div>
                                <div class="hub-team-role">${HUB_CONFIG.TEAM_ROLES[team.role]?.label || team.role}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            ${HubCRM.currentTeam?.id !== team.id ? `
                                <button class="hub-btn hub-btn-secondary hub-btn-sm" onclick="HubTeams.switchToTeam(${JSON.stringify(team).replace(/"/g, '&quot;')})">
                                    Activer
                                </button>
                            ` : `
                                <span class="hub-badge hub-badge-converted">Active</span>
                            `}
                            ${team.role === 'owner' ? `
                                <button class="hub-btn hub-btn-ghost hub-btn-icon hub-btn-sm" onclick="HubTeams.showEditTeamModal(${JSON.stringify(team).replace(/"/g, '&quot;')})">
                                    ✏️
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>

            ${HubCRM.currentTeam && HubCRM.isTeamMode ? `
                <div class="hub-detail-section" style="margin-top: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 class="hub-detail-section-title" style="margin: 0;">Membres de ${HubCRM.currentTeam.name}</h3>
                        <button class="hub-btn hub-btn-secondary hub-btn-sm" onclick="HubTeams.showInviteMemberModal('${HubCRM.currentTeam.id}')">
                            + Inviter
                        </button>
                    </div>
                    <div id="membersList">
                        <div class="hub-loading" style="margin: 20px auto;"></div>
                    </div>
                </div>
            ` : ''}
        `;

        // Charger les membres si équipe active
        if (HubCRM.currentTeam && HubCRM.isTeamMode) {
            this.loadTeamMembers(HubCRM.currentTeam.id).then(() => {
                this.renderMembersList();
            });
        }
    },

    renderMembersList() {
        const container = document.getElementById('membersList');
        if (!container) return;

        if (this.members.length === 0) {
            container.innerHTML = '<p style="color: var(--hub-text-muted);">Aucun membre</p>';
            return;
        }

        container.innerHTML = `
            <div class="hub-member-list">
                ${this.members.map(member => {
                    const email = member.user?.email || member.invited_email;
                    const isPending = member.invitation_status === 'pending';
                    const isOwner = member.role === 'owner';

                    return `
                        <div class="hub-member-card">
                            <div class="hub-team-info">
                                <div class="hub-team-avatar" style="width: 36px; height: 36px; font-size: 0.875rem;">
                                    ${email?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div>
                                    <div style="font-weight: 500;">${email}</div>
                                    <div style="font-size: 0.8125rem; color: var(--hub-text-muted);">
                                        ${HUB_CONFIG.TEAM_ROLES[member.role]?.label || member.role}
                                    </div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${isPending ? `
                                    <span class="hub-member-status pending">En attente</span>
                                    <button class="hub-btn hub-btn-ghost hub-btn-sm" onclick="HubTeams.cancelInvitation('${member.id}')">
                                        ✕
                                    </button>
                                ` : ''}
                                ${!isPending && !isOwner ? `
                                    <select class="hub-input" style="width: auto; padding: 4px 8px; font-size: 0.8125rem;"
                                        onchange="HubTeams.updateMemberRole('${member.id}', this.value)">
                                        <option value="member" ${member.role === 'member' ? 'selected' : ''}>Membre</option>
                                        <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                    <button class="hub-btn hub-btn-ghost hub-btn-icon hub-btn-sm" onclick="HubTeams.removeMember('${member.id}')" title="Retirer">
                                        🗑️
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    renderAssignmentDropdown(prospectId, currentAssignment) {
        if (!HubCRM.isTeamMode) return '';

        const options = this.members
            .filter(m => m.invitation_status === 'accepted')
            .map(m => {
                const email = m.user?.email || m.invited_email;
                const selected = m.user_id === currentAssignment ? 'selected' : '';
                return `<option value="${m.user_id}" ${selected}>${email}</option>`;
            })
            .join('');

        return `
            <select class="hub-input" style="width: auto; min-width: 150px;"
                onchange="HubTeams.assignProspect('${prospectId}', this.value)">
                <option value="">Non assigné</option>
                ${options}
            </select>
        `;
    }
};

// Export global
window.HubTeams = HubTeams;
