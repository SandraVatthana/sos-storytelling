// =====================================================
// GOALS & MISSIONS MODULE
// Objectifs + Missions quotidiennes (Pareto)
// SOS Storytelling 2026
// =====================================================

const GoalsMissionsModule = (function() {
    'use strict';

    // ==========================================
    // CONFIGURATION
    // ==========================================

    const MISSION_TEMPLATES = {
        content: [
            { id: 'post_daily', title: 'Publier ton post du jour', time: 20, priority: 1 },
            { id: 'engage_comments', title: 'Répondre à 5 commentaires', time: 10, priority: 2 },
            { id: 'ideas_note', title: 'Noter 3 idées de contenu', time: 5, priority: 3 },
            { id: 'content_repurpose', title: 'Recycler un ancien contenu', time: 15, priority: 3 }
        ],
        prospection: [
            { id: 'dm_send', title: 'Envoyer 3 messages privés', time: 15, priority: 1 },
            { id: 'comment_strategic', title: 'Commenter 5 posts stratégiques', time: 10, priority: 2 },
            { id: 'connect_new', title: 'Ajouter 5 nouvelles connexions', time: 10, priority: 3 }
        ],
        optimization: [
            { id: 'check_stats', title: 'Checker tes stats', time: 5, priority: 2 },
            { id: 'analyze_post', title: 'Analyser un post (capture)', time: 5, priority: 3 },
            { id: 'profile_update', title: 'Optimiser ta bio', time: 10, priority: 3 }
        ]
    };

    const GOAL_LABELS = {
        followers: 'Abonnés',
        leads: 'Leads',
        clients: 'Clients',
        posts: 'Posts publiés'
    };

    // ==========================================
    // STATE
    // ==========================================

    let state = {
        profile: null,
        missions: [],
        completedToday: [],
        streak: 0
    };

    // ==========================================
    // INITIALIZATION
    // ==========================================

    async function init() {
        await loadProfile();
        await loadCompletedMissions();
        calculateStreak();

        if (state.profile?.goal_type) {
            renderGoalWidget();
        }

        generateDailyMissions();
        renderMissions();
    }

    async function loadProfile() {
        try {
            // Charger depuis localStorage d'abord
            const localProfile = localStorage.getItem('sos_user_goals');
            if (localProfile) {
                state.profile = JSON.parse(localProfile);
            }

            // Puis sync avec Supabase si connecté
            if (window.supabaseClient) {
                const { data: session } = await window.supabaseClient.auth.getSession();
                if (session?.session?.user?.id) {
                    const { data, error } = await window.supabaseClient
                        .from('user_tone_clone')
                        .select('sector, daily_time_minutes, goal_type, goal_target, goal_timeframe_days, goal_start_date, goal_current_progress')
                        .eq('user_id', session.session.user.id)
                        .single();

                    if (!error && data) {
                        state.profile = { ...state.profile, ...data };
                        localStorage.setItem('sos_user_goals', JSON.stringify(state.profile));
                    }
                }
            }
        } catch (error) {
            console.error('Erreur chargement profil goals:', error);
        }
    }

    async function loadCompletedMissions() {
        try {
            const today = new Date().toISOString().split('T')[0];

            // localStorage d'abord
            const stored = localStorage.getItem('sos_missions_completed');
            if (stored) {
                const data = JSON.parse(stored);
                state.completedToday = data[today] || [];
            }

            // Sync Supabase
            if (window.supabaseClient) {
                const { data: session } = await window.supabaseClient.auth.getSession();
                if (session?.session?.user?.id) {
                    const { data, error } = await window.supabaseClient
                        .from('daily_missions_completed')
                        .select('mission_id')
                        .eq('user_id', session.session.user.id)
                        .eq('completed_date', today);

                    if (!error && data) {
                        state.completedToday = data.map(d => d.mission_id);
                        // Mettre à jour localStorage
                        const stored = JSON.parse(localStorage.getItem('sos_missions_completed') || '{}');
                        stored[today] = state.completedToday;
                        localStorage.setItem('sos_missions_completed', JSON.stringify(stored));
                    }
                }
            }
        } catch (error) {
            console.error('Erreur chargement missions:', error);
        }
    }

    function calculateStreak() {
        try {
            const stored = JSON.parse(localStorage.getItem('sos_missions_completed') || '{}');
            const dates = Object.keys(stored).sort().reverse();

            let streak = 0;
            const today = new Date();

            for (let i = 0; i < dates.length; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(checkDate.getDate() - i);
                const dateStr = checkDate.toISOString().split('T')[0];

                if (stored[dateStr] && stored[dateStr].length > 0) {
                    streak++;
                } else if (i > 0) {
                    break;
                }
            }

            state.streak = streak;
        } catch (error) {
            state.streak = 0;
        }
    }

    // ==========================================
    // GOAL TRACKING
    // ==========================================

    function renderGoalWidget() {
        const container = document.getElementById('goalTrackingWidget');
        if (!container || !state.profile?.goal_type) return;

        const { goal_type, goal_target, goal_current_progress, goal_start_date, goal_timeframe_days } = state.profile;

        const current = goal_current_progress || 0;
        const target = goal_target || 100;
        const progress = Math.min(Math.round((current / target) * 100), 100);
        const daysRemaining = calculateDaysRemaining();
        const label = GOAL_LABELS[goal_type] || goal_type;

        container.innerHTML = `
            <div class="gm-goal-header">
                <span class="gm-goal-label">${label}</span>
                <span class="gm-goal-value">
                    <span class="gm-current">${current}</span> / <span class="gm-target">${target}</span>
                </span>
            </div>
            <div class="gm-progress-bar">
                <div class="gm-progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="gm-goal-footer">
                <span class="gm-percent">${progress}%</span>
                <span class="gm-countdown">${daysRemaining} jours restants</span>
            </div>
            <button class="gm-update-btn" onclick="GoalsMissionsModule.showUpdateModal()">
                Mettre à jour ma progression
            </button>
        `;

        container.style.display = 'block';
    }

    function calculateDaysRemaining() {
        if (!state.profile?.goal_start_date || !state.profile?.goal_timeframe_days) {
            return state.profile?.goal_timeframe_days || 90;
        }

        const startDate = new Date(state.profile.goal_start_date);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + state.profile.goal_timeframe_days);

        const today = new Date();
        const remaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

        return Math.max(0, remaining);
    }

    function showUpdateModal() {
        const current = state.profile?.goal_current_progress || 0;
        const label = GOAL_LABELS[state.profile?.goal_type] || 'Progression';

        const modal = document.createElement('div');
        modal.className = 'gm-modal-overlay';
        modal.id = 'gmUpdateModal';
        modal.innerHTML = `
            <div class="gm-modal" onclick="event.stopPropagation()">
                <h3>Mettre à jour ta progression</h3>
                <div class="gm-form-group">
                    <label>${label} actuels</label>
                    <input type="number" id="gmProgressInput" value="${current}" min="0">
                </div>
                <div class="gm-modal-actions">
                    <button class="gm-btn-cancel" onclick="GoalsMissionsModule.closeUpdateModal()">Annuler</button>
                    <button class="gm-btn-save" onclick="GoalsMissionsModule.saveProgress()">Enregistrer</button>
                </div>
            </div>
        `;
        modal.onclick = closeUpdateModal;
        document.body.appendChild(modal);

        requestAnimationFrame(() => modal.classList.add('active'));
    }

    function closeUpdateModal() {
        const modal = document.getElementById('gmUpdateModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    }

    async function saveProgress() {
        const input = document.getElementById('gmProgressInput');
        const newValue = parseInt(input.value) || 0;

        state.profile.goal_current_progress = newValue;
        localStorage.setItem('sos_user_goals', JSON.stringify(state.profile));

        // Sync Supabase
        if (window.supabaseClient) {
            try {
                const { data: session } = await window.supabaseClient.auth.getSession();
                if (session?.session?.user?.id) {
                    await window.supabaseClient
                        .from('user_tone_clone')
                        .update({ goal_current_progress: newValue })
                        .eq('user_id', session.session.user.id);
                }
            } catch (error) {
                console.error('Erreur sync progression:', error);
            }
        }

        closeUpdateModal();
        renderGoalWidget();

        if (typeof window.showToast === 'function') {
            window.showToast('Progression mise à jour !', 'success');
        }
    }

    // ==========================================
    // DAILY MISSIONS
    // ==========================================

    function generateDailyMissions() {
        const availableTime = state.profile?.daily_time_minutes || 30;
        const goalType = state.profile?.goal_type || 'followers';

        // Déterminer l'ordre des phases selon l'objectif
        let phaseOrder;
        if (goalType === 'leads' || goalType === 'clients') {
            phaseOrder = ['prospection', 'content', 'optimization'];
        } else {
            phaseOrder = ['content', 'prospection', 'optimization'];
        }

        const missions = [];
        let totalTime = 0;
        const maxMissions = 3;

        for (const phase of phaseOrder) {
            const templates = MISSION_TEMPLATES[phase];

            for (const template of templates) {
                if (missions.length >= maxMissions) break;
                if (totalTime + template.time > availableTime) continue;
                if (state.completedToday.includes(template.id)) continue;

                missions.push({
                    ...template,
                    completed: false,
                    phase
                });
                totalTime += template.time;
            }

            if (missions.length >= maxMissions) break;
        }

        // Trier par priorité
        state.missions = missions.sort((a, b) => a.priority - b.priority);
    }

    function renderMissions() {
        const container = document.getElementById('dailyMissionsList');
        if (!container) return;

        const section = document.getElementById('dailyMissionsSection');
        if (section) {
            section.style.display = 'block';
        }

        // Update streak display
        const streakEl = document.getElementById('missionsStreak');
        if (streakEl && state.streak > 0) {
            streakEl.innerHTML = `Série: ${state.streak}j 🔥`;
            streakEl.style.display = 'inline';
        }

        if (state.missions.length === 0 && state.completedToday.length > 0) {
            container.innerHTML = `
                <div class="gm-mission-done">
                    <span class="gm-done-icon">🎉</span>
                    <span>Bravo ! Toutes tes missions sont terminées !</span>
                </div>
            `;
            return;
        }

        if (state.missions.length === 0) {
            container.innerHTML = `
                <div class="gm-mission-empty">
                    <span>Configure ton profil pour recevoir des missions personnalisées.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = state.missions.map((mission, index) => `
            <div class="gm-mission-item ${mission.completed ? 'completed' : ''}" onclick="GoalsMissionsModule.toggleMission('${mission.id}')">
                <div class="gm-mission-checkbox">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
                <div class="gm-mission-content">
                    <span class="gm-mission-title">${mission.title}</span>
                    <span class="gm-mission-time">${mission.time} min</span>
                </div>
            </div>
        `).join('');
    }

    async function toggleMission(missionId) {
        const mission = state.missions.find(m => m.id === missionId);
        if (!mission) return;

        mission.completed = !mission.completed;

        if (mission.completed) {
            state.completedToday.push(missionId);
            await saveMissionCompleted(missionId);
        } else {
            state.completedToday = state.completedToday.filter(id => id !== missionId);
            await removeMissionCompleted(missionId);
        }

        // Mettre à jour localStorage
        const today = new Date().toISOString().split('T')[0];
        const stored = JSON.parse(localStorage.getItem('sos_missions_completed') || '{}');
        stored[today] = state.completedToday;
        localStorage.setItem('sos_missions_completed', JSON.stringify(stored));

        renderMissions();
        calculateStreak();
    }

    async function saveMissionCompleted(missionId) {
        if (!window.supabaseClient) return;

        try {
            const { data: session } = await window.supabaseClient.auth.getSession();
            if (session?.session?.user?.id) {
                const today = new Date().toISOString().split('T')[0];
                await window.supabaseClient
                    .from('daily_missions_completed')
                    .insert({
                        user_id: session.session.user.id,
                        mission_id: missionId,
                        completed_date: today
                    });
            }
        } catch (error) {
            console.error('Erreur save mission:', error);
        }
    }

    async function removeMissionCompleted(missionId) {
        if (!window.supabaseClient) return;

        try {
            const { data: session } = await window.supabaseClient.auth.getSession();
            if (session?.session?.user?.id) {
                const today = new Date().toISOString().split('T')[0];
                await window.supabaseClient
                    .from('daily_missions_completed')
                    .delete()
                    .eq('user_id', session.session.user.id)
                    .eq('mission_id', missionId)
                    .eq('completed_date', today);
            }
        } catch (error) {
            console.error('Erreur remove mission:', error);
        }
    }

    // ==========================================
    // PROFILE SAVE (from onboarding)
    // ==========================================

    async function saveGoalsProfile(data) {
        state.profile = {
            ...state.profile,
            sector: data.sector,
            daily_time_minutes: data.dailyTimeMinutes,
            goal_type: data.goalType,
            goal_target: data.goalTarget,
            goal_timeframe_days: data.goalTimeframeDays,
            goal_start_date: new Date().toISOString(),
            goal_current_progress: 0
        };

        localStorage.setItem('sos_user_goals', JSON.stringify(state.profile));

        // Sync Supabase
        if (window.supabaseClient) {
            try {
                const { data: session } = await window.supabaseClient.auth.getSession();
                if (session?.session?.user?.id) {
                    await window.supabaseClient
                        .from('user_tone_clone')
                        .update({
                            sector: state.profile.sector,
                            daily_time_minutes: state.profile.daily_time_minutes,
                            goal_type: state.profile.goal_type,
                            goal_target: state.profile.goal_target,
                            goal_timeframe_days: state.profile.goal_timeframe_days,
                            goal_start_date: state.profile.goal_start_date,
                            goal_current_progress: 0
                        })
                        .eq('user_id', session.session.user.id);
                }
            } catch (error) {
                console.error('Erreur save goals profile:', error);
            }
        }

        // Re-render
        renderGoalWidget();
        generateDailyMissions();
        renderMissions();
    }

    // ==========================================
    // HUB MODE TOGGLE
    // ==========================================

    function isHubEnabled() {
        return localStorage.getItem('sos_hub_mode_enabled') === 'true';
    }

    function enableHubMode() {
        localStorage.setItem('sos_hub_mode_enabled', 'true');

        // Masquer le CTA
        const hubCta = document.getElementById('hubActivationCta');
        if (hubCta) hubCta.style.display = 'none';

        // Initialiser et afficher les widgets
        init();

        // Mettre à jour le toggle dans les settings si présent
        const toggle = document.getElementById('hubModeToggle');
        if (toggle) toggle.checked = true;

        if (typeof window.showToast === 'function') {
            window.showToast('Mode HUB activé ! 🚀', 'success');
        }
    }

    function disableHubMode() {
        localStorage.setItem('sos_hub_mode_enabled', 'false');

        // Masquer les widgets
        const goalWidget = document.getElementById('goalTrackingWidget');
        const missionsSection = document.getElementById('dailyMissionsSection');
        if (goalWidget) goalWidget.style.display = 'none';
        if (missionsSection) missionsSection.style.display = 'none';

        // Afficher le CTA
        const hubCta = document.getElementById('hubActivationCta');
        if (hubCta) hubCta.style.display = 'block';

        // Mettre à jour le toggle
        const toggle = document.getElementById('hubModeToggle');
        if (toggle) toggle.checked = false;

        if (typeof window.showToast === 'function') {
            window.showToast('Mode HUB désactivé', 'info');
        }
    }

    function toggleHubMode() {
        if (isHubEnabled()) {
            disableHubMode();
        } else {
            enableHubMode();
        }
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,
        renderGoalWidget,
        renderMissions,
        toggleMission,
        showUpdateModal,
        closeUpdateModal,
        saveProgress,
        saveGoalsProfile,
        getState: () => state,
        // Hub mode
        isHubEnabled,
        enableHubMode,
        disableHubMode,
        toggleHubMode
    };

})();

// Export global
window.GoalsMissionsModule = GoalsMissionsModule;

// Auto-init quand le DOM est prêt (seulement si HUB activé)
document.addEventListener('DOMContentLoaded', () => {
    // Délai pour laisser le temps à Supabase de s'initialiser
    setTimeout(() => {
        const hubEnabled = localStorage.getItem('sos_hub_mode_enabled') === 'true';

        // Mettre à jour le toggle dans les paramètres
        const toggle = document.getElementById('hubModeToggle');
        if (toggle) toggle.checked = hubEnabled;

        if (hubEnabled && (document.getElementById('goalTrackingWidget') || document.getElementById('dailyMissionsSection'))) {
            GoalsMissionsModule.init();

            // Masquer le CTA si HUB activé
            const hubCta = document.getElementById('hubActivationCta');
            if (hubCta) hubCta.style.display = 'none';
        } else {
            // Masquer les widgets si HUB désactivé
            const goalWidget = document.getElementById('goalTrackingWidget');
            const missionsSection = document.getElementById('dailyMissionsSection');
            if (goalWidget) goalWidget.style.display = 'none';
            if (missionsSection) missionsSection.style.display = 'none';

            // Afficher le CTA pour activer le HUB
            const hubCta = document.getElementById('hubActivationCta');
            if (hubCta) hubCta.style.display = 'block';
        }
    }, 1000);
});
