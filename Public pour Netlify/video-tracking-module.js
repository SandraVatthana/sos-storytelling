/**
 * VIDEO TRACKING MODULE
 * Gestion des liens vidéo trackables pour le CRM
 */

const VideoTrackingModule = (function() {
    'use strict';

    // ==================== CONFIG ====================
    const BASE_URL = window.location.origin;
    const PLAYER_PATH = '/video-player.html';

    // ==================== HELPERS ====================
    function getSupabase() {
        return window.supabaseApp || window.supabase;
    }

    async function getCurrentUser() {
        const supabase = getSupabase();
        if (!supabase) return null;
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }

    // ==================== VIDEO LINKS CRUD ====================

    /**
     * Créer un nouveau lien vidéo trackable
     */
    async function createVideoLink(videoData) {
        const supabase = getSupabase();
        const user = await getCurrentUser();
        if (!supabase || !user) {
            console.error('[VideoTracking] Non connecté');
            return null;
        }

        const { data, error } = await supabase
            .from('video_links')
            .insert({
                user_id: user.id,
                title: videoData.title,
                video_url: videoData.videoUrl,
                thumbnail_url: videoData.thumbnailUrl || null,
                notify_threshold: videoData.notifyThreshold || 50
            })
            .select()
            .single();

        if (error) {
            console.error('[VideoTracking] Erreur création:', error);
            return null;
        }

        return data;
    }

    /**
     * Récupérer tous les liens vidéo de l'utilisateur
     */
    async function getVideoLinks() {
        const supabase = getSupabase();
        const user = await getCurrentUser();
        if (!supabase || !user) return [];

        const { data, error } = await supabase
            .from('video_links')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[VideoTracking] Erreur récupération:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Supprimer un lien vidéo
     */
    async function deleteVideoLink(videoId) {
        const supabase = getSupabase();
        if (!supabase) return false;

        const { error } = await supabase
            .from('video_links')
            .delete()
            .eq('id', videoId);

        return !error;
    }

    // ==================== TRACKABLE LINKS ====================

    /**
     * Générer un lien trackable pour un prospect
     */
    function generateTrackableLink(videoId, prospect) {
        const leadId = prospect?.id || `lead_${Date.now()}`;
        const params = new URLSearchParams({
            v: videoId,
            lead_id: leadId
        });

        if (prospect?.email) params.set('email', prospect.email);
        if (prospect?.name) params.set('name', prospect.name);

        return `${BASE_URL}${PLAYER_PATH}?${params.toString()}`;
    }

    /**
     * Générer plusieurs liens pour une liste de prospects
     */
    function generateBulkLinks(videoId, prospects) {
        return prospects.map(prospect => ({
            prospect,
            link: generateTrackableLink(videoId, prospect)
        }));
    }

    // ==================== ANALYTICS ====================

    /**
     * Récupérer les vues d'une vidéo
     */
    async function getVideoViews(videoId) {
        const supabase = getSupabase();
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('video_views')
            .select(`
                *,
                prospect:hub_prospects(id, name, email, company)
            `)
            .eq('video_id', videoId)
            .order('percent_watched', { ascending: false });

        if (error) {
            console.error('[VideoTracking] Erreur vues:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Récupérer les stats agrégées d'une vidéo
     */
    async function getVideoStats(videoId) {
        const views = await getVideoViews(videoId);

        const stats = {
            totalViews: views.length,
            uniqueViewers: new Set(views.map(v => v.lead_id)).size,
            averagePercent: 0,
            completedViews: 0,
            over50Percent: 0,
            viewsByPercent: {
                '0-25': 0,
                '26-50': 0,
                '51-75': 0,
                '76-100': 0
            }
        };

        if (views.length > 0) {
            const totalPercent = views.reduce((sum, v) => sum + (v.percent_watched || 0), 0);
            stats.averagePercent = Math.round(totalPercent / views.length);
            stats.completedViews = views.filter(v => v.percent_watched >= 95).length;
            stats.over50Percent = views.filter(v => v.percent_watched >= 50).length;

            views.forEach(v => {
                const p = v.percent_watched || 0;
                if (p <= 25) stats.viewsByPercent['0-25']++;
                else if (p <= 50) stats.viewsByPercent['26-50']++;
                else if (p <= 75) stats.viewsByPercent['51-75']++;
                else stats.viewsByPercent['76-100']++;
            });
        }

        return stats;
    }

    /**
     * Récupérer les "hot leads" (prospects qui ont regardé > 50%)
     */
    async function getHotLeads(videoId = null) {
        const supabase = getSupabase();
        const user = await getCurrentUser();
        if (!supabase || !user) return [];

        let query = supabase
            .from('video_views')
            .select(`
                *,
                video:video_links!inner(id, title, user_id),
                prospect:hub_prospects(id, name, email, company, phone)
            `)
            .eq('video.user_id', user.id)
            .gte('percent_watched', 50)
            .order('percent_watched', { ascending: false });

        if (videoId) {
            query = query.eq('video_id', videoId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[VideoTracking] Erreur hot leads:', error);
            return [];
        }

        return data || [];
    }

    // ==================== NOTIFICATIONS ====================

    /**
     * Récupérer les notifications non lues
     */
    async function getUnreadNotifications() {
        const supabase = getSupabase();
        const user = await getCurrentUser();
        if (!supabase || !user) return [];

        const { data, error } = await supabase
            .from('video_notifications')
            .select(`
                *,
                video_view:video_views(
                    viewer_name,
                    viewer_email,
                    percent_watched,
                    video:video_links(title)
                )
            `)
            .eq('user_id', user.id)
            .eq('read', false)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[VideoTracking] Erreur notifications:', error);
            return [];
        }

        return data || [];
    }

    /**
     * Marquer une notification comme lue
     */
    async function markNotificationRead(notificationId) {
        const supabase = getSupabase();
        if (!supabase) return false;

        const { error } = await supabase
            .from('video_notifications')
            .update({ read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId);

        return !error;
    }

    /**
     * Marquer toutes les notifications comme lues
     */
    async function markAllNotificationsRead() {
        const supabase = getSupabase();
        const user = await getCurrentUser();
        if (!supabase || !user) return false;

        const { error } = await supabase
            .from('video_notifications')
            .update({ read: true, read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('read', false);

        return !error;
    }

    // ==================== UI HELPERS ====================

    /**
     * Afficher le modal de création de lien vidéo
     */
    function showCreateVideoModal(onSuccess) {
        const modalHTML = `
            <div class="modal-overlay video-modal-overlay" onclick="VideoTrackingModule.closeModal(event)">
                <div class="modal-content video-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h2>🎬 Créer un lien vidéo trackable</h2>
                        <button class="modal-close" onclick="VideoTrackingModule.closeModal()">&times;</button>
                    </div>

                    <div class="modal-body">
                        <div class="form-group">
                            <label>Titre de la vidéo *</label>
                            <input type="text" id="videoTitle" placeholder="Ex: Présentation de mon offre" required>
                        </div>

                        <div class="form-group">
                            <label>URL de la vidéo *</label>
                            <input type="url" id="videoUrl" placeholder="https://youtube.com/watch?v=... ou https://loom.com/..." required>
                            <small>Supporte: YouTube, Vimeo, Loom, ou lien direct MP4</small>
                        </div>

                        <div class="form-group">
                            <label>Seuil de notification (%)</label>
                            <input type="number" id="notifyThreshold" value="50" min="10" max="100" step="10">
                            <small>Tu seras notifié quand un prospect dépasse ce % de visionnage</small>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="VideoTrackingModule.closeModal()">Annuler</button>
                        <button class="btn btn-primary" onclick="VideoTrackingModule.submitCreateVideo()">
                            Créer le lien
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        window._videoModalCallback = onSuccess;
    }

    /**
     * Soumettre la création de vidéo
     */
    async function submitCreateVideo() {
        const title = document.getElementById('videoTitle').value.trim();
        const videoUrl = document.getElementById('videoUrl').value.trim();
        const notifyThreshold = parseInt(document.getElementById('notifyThreshold').value) || 50;

        if (!title || !videoUrl) {
            alert('Remplis le titre et l\'URL de la vidéo');
            return;
        }

        const video = await createVideoLink({
            title,
            videoUrl,
            notifyThreshold
        });

        if (video) {
            closeModal();
            if (window._videoModalCallback) {
                window._videoModalCallback(video);
            }
            if (typeof showToast === 'function') {
                showToast('Lien vidéo créé !');
            }
        } else {
            alert('Erreur lors de la création du lien');
        }
    }

    /**
     * Afficher le modal avec le lien à copier
     */
    function showLinkModal(videoId, prospect) {
        const link = generateTrackableLink(videoId, prospect);
        const prospectName = prospect?.name || prospect?.email || 'ce prospect';

        const modalHTML = `
            <div class="modal-overlay video-modal-overlay" onclick="VideoTrackingModule.closeModal(event)">
                <div class="modal-content video-modal" onclick="event.stopPropagation()" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>🔗 Lien trackable</h2>
                        <button class="modal-close" onclick="VideoTrackingModule.closeModal()">&times;</button>
                    </div>

                    <div class="modal-body">
                        <p style="margin-bottom: 15px;">Lien personnalisé pour <strong>${prospectName}</strong> :</p>

                        <div style="position: relative;">
                            <input type="text" id="trackableLink" value="${link}" readonly
                                style="width: 100%; padding: 12px; padding-right: 80px; border: 2px solid #667eea; border-radius: 8px; font-size: 0.85em;">
                            <button onclick="VideoTrackingModule.copyLink()"
                                style="position: absolute; right: 5px; top: 50%; transform: translateY(-50%); padding: 8px 15px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">
                                Copier
                            </button>
                        </div>

                        <p style="margin-top: 15px; font-size: 0.85em; color: #888;">
                            Tu seras notifié quand ce prospect regarde la vidéo.
                        </p>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="VideoTrackingModule.closeModal()">Fermer</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    function copyLink() {
        const input = document.getElementById('trackableLink');
        if (input) {
            input.select();
            navigator.clipboard.writeText(input.value);
            if (typeof showToast === 'function') {
                showToast('Lien copié !');
            }
        }
    }

    function closeModal(event) {
        if (event && event.target !== event.currentTarget) return;
        const modal = document.querySelector('.video-modal-overlay');
        if (modal) modal.remove();
    }

    /**
     * Formater le pourcentage avec couleur
     */
    function formatPercent(percent) {
        let color = '#888';
        if (percent >= 75) color = '#10b981';
        else if (percent >= 50) color = '#f59e0b';
        else if (percent >= 25) color = '#6366f1';

        return `<span style="color: ${color}; font-weight: 600;">${percent}%</span>`;
    }

    // ==================== CSS ====================
    function injectStyles() {
        if (document.getElementById('video-tracking-styles')) return;

        const styles = `
            .video-modal {
                max-width: 550px;
            }
            .video-modal .form-group {
                margin-bottom: 20px;
            }
            .video-modal label {
                display: block;
                font-weight: 600;
                margin-bottom: 8px;
                color: #333;
            }
            .video-modal input {
                width: 100%;
                padding: 12px 15px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                font-size: 1em;
                font-family: inherit;
            }
            .video-modal input:focus {
                outline: none;
                border-color: #667eea;
            }
            .video-modal small {
                display: block;
                margin-top: 5px;
                color: #888;
                font-size: 0.85em;
            }
            .video-stats-card {
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 15px;
            }
            .video-stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 15px;
                margin-top: 15px;
            }
            .video-stat-item {
                text-align: center;
            }
            .video-stat-value {
                font-size: 1.5em;
                font-weight: 700;
            }
            .video-stat-label {
                font-size: 0.8em;
                opacity: 0.9;
            }
            .hot-lead-badge {
                display: inline-block;
                padding: 3px 8px;
                background: #fef3c7;
                color: #d97706;
                border-radius: 12px;
                font-size: 0.75em;
                font-weight: 600;
            }
        `;

        const styleEl = document.createElement('style');
        styleEl.id = 'video-tracking-styles';
        styleEl.textContent = styles;
        document.head.appendChild(styleEl);
    }

    // Init styles
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectStyles);
    } else {
        injectStyles();
    }

    // ==================== PUBLIC API ====================
    return {
        // CRUD
        createVideoLink,
        getVideoLinks,
        deleteVideoLink,

        // Links
        generateTrackableLink,
        generateBulkLinks,

        // Analytics
        getVideoViews,
        getVideoStats,
        getHotLeads,

        // Notifications
        getUnreadNotifications,
        markNotificationRead,
        markAllNotificationsRead,

        // UI
        showCreateVideoModal,
        submitCreateVideo,
        showLinkModal,
        copyLink,
        closeModal,
        formatPercent
    };
})();

// Export global
window.VideoTrackingModule = VideoTrackingModule;
