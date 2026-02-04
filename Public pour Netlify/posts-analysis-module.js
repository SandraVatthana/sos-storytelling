// =====================================================
// POSTS ANALYSIS MODULE - Version Screenshot + Insights IA
// Tableau de bord des performances avec capture d'écran
// SOS Storytelling 2026
// =====================================================

const PostsAnalysisModule = (function() {
    'use strict';

    // Configuration API
    const ANALYZE_POST_URL = 'https://analyze-post.sandra-devonssay.workers.dev';
    const INSIGHTS_URL = 'https://posts-insights.sandra-devonssay.workers.dev';

    // State
    let posts = [];
    let isAnalyzing = false;
    let isGeneratingInsights = false;
    let currentImage = null;
    let sortBy = 'date_desc'; // date_desc, date_asc, engagement_desc, engagement_asc
    let filterPlatform = 'all';
    let aiInsights = null;

    // ==========================================
    // MODAL MANAGEMENT
    // ==========================================

    function openModal() {
        let overlay = document.getElementById('postsAnalysisOverlay');
        if (overlay) {
            overlay.classList.add('active');
            init();
            return;
        }

        overlay = document.createElement('div');
        overlay.id = 'postsAnalysisOverlay';
        overlay.className = 'pa-modal-overlay';
        overlay.innerHTML = `
            <div class="pa-modal" onclick="event.stopPropagation()">
                <div id="postsAnalysisContainer"></div>
            </div>
        `;
        overlay.onclick = closeModal;
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        init();
    }

    function closeModal() {
        const overlay = document.getElementById('postsAnalysisOverlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    // ==========================================
    // INITIALISATION
    // ==========================================

    async function init() {
        await loadPosts();
        await loadSavedInsights();
        render();
    }

    // ==========================================
    // DATA LOADING
    // ==========================================

    async function loadPosts() {
        try {
            const { data: session } = await window.supabaseClient.auth.getSession();
            if (!session?.session?.user?.id) return;

            const { data, error } = await window.supabaseClient
                .from('posts_analyzed')
                .select('*')
                .eq('user_id', session.session.user.id)
                .order('published_at', { ascending: false });

            if (error) throw error;
            posts = data || [];
        } catch (error) {
            console.error('Erreur chargement posts:', error);
            posts = [];
        }
    }

    async function loadSavedInsights() {
        try {
            const saved = localStorage.getItem('pa_ai_insights');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Vérifier si les insights ont moins de 7 jours
                if (parsed.generated_at && (Date.now() - new Date(parsed.generated_at).getTime()) < 7 * 24 * 60 * 60 * 1000) {
                    aiInsights = parsed;
                }
            }
        } catch (e) {
            console.error('Erreur chargement insights:', e);
        }
    }

    // ==========================================
    // SORTING & FILTERING
    // ==========================================

    function setSortBy(value) {
        sortBy = value;
        render();
    }

    function setFilterPlatform(value) {
        filterPlatform = value;
        render();
    }

    function getFilteredAndSortedPosts() {
        let filtered = [...posts];

        // Filter by platform
        if (filterPlatform !== 'all') {
            filtered = filtered.filter(p => p.platform === filterPlatform);
        }

        // Sort
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'date_asc':
                    return new Date(a.published_at || 0) - new Date(b.published_at || 0);
                case 'date_desc':
                    return new Date(b.published_at || 0) - new Date(a.published_at || 0);
                case 'engagement_asc':
                    return (a.engagement_rate || 0) - (b.engagement_rate || 0);
                case 'engagement_desc':
                    return (b.engagement_rate || 0) - (a.engagement_rate || 0);
                case 'views_desc':
                    return (b.views || 0) - (a.views || 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }

    // ==========================================
    // SCREENSHOT HANDLING
    // ==========================================

    function handleScreenshotUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Fichier image requis', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            currentImage = e.target.result;
            renderUploadPreview();
        };
        reader.readAsDataURL(file);
    }

    function handlePaste(event) {
        const overlay = document.getElementById('postsAnalysisOverlay');
        if (!overlay || !overlay.classList.contains('active')) return;

        const items = event.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (e) => {
                    currentImage = e.target.result;
                    renderUploadPreview();
                };
                reader.readAsDataURL(file);
                break;
            }
        }
    }

    function removeScreenshot() {
        currentImage = null;
        render();
    }

    function renderUploadPreview() {
        const previewArea = document.getElementById('paUploadArea');
        if (!previewArea) return;

        previewArea.innerHTML = `
            <div class="pa-preview">
                <img src="${currentImage}" alt="Capture d'écran" class="pa-preview-image">
                <button class="pa-preview-remove" onclick="PostsAnalysisModule.removeScreenshot()">✕</button>
            </div>
            <button class="pa-analyze-btn" onclick="PostsAnalysisModule.analyzeScreenshot()" ${isAnalyzing ? 'disabled' : ''}>
                ${isAnalyzing ? '<span class="pa-spinner"></span> Analyse en cours...' : '🔍 Analyser cette capture'}
            </button>
        `;
    }

    // ==========================================
    // ANALYSIS
    // ==========================================

    async function analyzeScreenshot() {
        if (!currentImage) {
            showToast('Ajoute une capture d\'écran', 'error');
            return;
        }

        isAnalyzing = true;
        renderUploadPreview();

        try {
            const { data: session } = await window.supabaseClient.auth.getSession();
            if (!session?.session?.user?.id) {
                throw new Error('Session expirée');
            }

            const response = await fetch(ANALYZE_POST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: currentImage,
                    platform: null
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Erreur analyse');
            }

            const extractedData = result.data;
            const stats = extractedData.stats;
            const totalEngagement = (stats.likes || 0) + (stats.comments || 0) + (stats.reposts || 0);
            const engagementRate = stats.views > 0 ? ((totalEngagement / stats.views) * 100) : null;

            const { error: insertError } = await window.supabaseClient
                .from('posts_analyzed')
                .insert({
                    user_id: session.session.user.id,
                    content: extractedData.content,
                    platform: extractedData.platform,
                    published_at: extractedData.date || new Date().toISOString(),
                    views: stats.views,
                    likes: stats.likes,
                    comments: stats.comments,
                    reposts: stats.reposts,
                    clicks: stats.clicks,
                    engagement_rate: engagementRate,
                    has_image: extractedData.has_image,
                    has_video: extractedData.has_video,
                    format: extractedData.has_carousel ? 'carousel' : (extractedData.has_video ? 'video' : 'post'),
                    word_count: extractedData.content ? extractedData.content.split(/\s+/).filter(Boolean).length : 0
                });

            if (insertError) throw insertError;

            showToast('Post ajouté avec succès !', 'success');
            currentImage = null;
            await loadPosts();
            render();

        } catch (error) {
            console.error('Erreur:', error);
            showToast(error.message || 'Erreur lors de l\'analyse', 'error');
        } finally {
            isAnalyzing = false;
        }
    }

    // ==========================================
    // AI INSIGHTS
    // ==========================================

    async function generateAIInsights() {
        if (posts.length < 3) {
            showToast('Ajoute au moins 3 posts pour générer des insights', 'error');
            return;
        }

        isGeneratingInsights = true;
        render();

        try {
            const response = await fetch(INSIGHTS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    posts: posts.map(p => ({
                        content: p.content?.substring(0, 500),
                        platform: p.platform,
                        date: p.published_at,
                        views: p.views,
                        likes: p.likes,
                        comments: p.comments,
                        reposts: p.reposts,
                        engagement_rate: p.engagement_rate,
                        has_image: p.has_image,
                        has_video: p.has_video,
                        format: p.format
                    }))
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Erreur génération insights');
            }

            aiInsights = {
                ...result.insights,
                generated_at: new Date().toISOString()
            };

            // Sauvegarder en local
            localStorage.setItem('pa_ai_insights', JSON.stringify(aiInsights));

            showToast('Insights générés !', 'success');

        } catch (error) {
            console.error('Erreur insights:', error);
            showToast(error.message || 'Erreur lors de la génération', 'error');
        } finally {
            isGeneratingInsights = false;
            render();
        }
    }

    // ==========================================
    // DELETE
    // ==========================================

    async function deletePost(postId) {
        if (!confirm('Supprimer ce post de ton historique ?')) return;

        try {
            const { error } = await window.supabaseClient
                .from('posts_analyzed')
                .delete()
                .eq('id', postId);

            if (error) throw error;

            showToast('Post supprimé', 'success');
            await loadPosts();
            render();
        } catch (error) {
            console.error('Erreur suppression:', error);
            showToast('Erreur lors de la suppression', 'error');
        }
    }

    // ==========================================
    // RENDERING
    // ==========================================

    function render() {
        const container = document.getElementById('postsAnalysisContainer');
        if (!container) return;

        const stats = calculateGlobalStats();
        const filteredPosts = getFilteredAndSortedPosts();
        const platforms = [...new Set(posts.map(p => p.platform))];

        container.innerHTML = `
            <div class="posts-analysis-module">
                <!-- Header -->
                <div class="pa-header">
                    <div class="pa-title">
                        <h2>📈 Mes Posts & Performances</h2>
                        <p>Ajoute tes posts via capture d'écran, le tableau se remplit automatiquement</p>
                    </div>
                    <button class="pa-close-btn" onclick="PostsAnalysisModule.closeModal()" title="Fermer">✕</button>
                </div>

                <!-- Stats Cards -->
                ${posts.length > 0 ? renderStatsCards(stats) : ''}

                <!-- Engagement Chart -->
                ${posts.length >= 2 ? renderEngagementChart() : ''}

                <!-- Upload Zone -->
                <div class="pa-upload-section">
                    <h3>➕ Ajouter un post</h3>
                    <p class="pa-upload-hint">Fais une capture d'écran de ton post avec ses stats visibles, puis colle-la ici (Ctrl+V) ou clique pour uploader.</p>
                    <div class="pa-upload-area" id="paUploadArea" onclick="document.getElementById('paScreenshotInput').click()">
                        ${currentImage ? '' : `
                            <div class="pa-upload-placeholder">
                                <span class="pa-upload-icon">📸</span>
                                <span>Coller (Ctrl+V) ou cliquer pour uploader</span>
                            </div>
                        `}
                    </div>
                    <input type="file" id="paScreenshotInput" accept="image/*" style="display:none" onchange="PostsAnalysisModule.handleScreenshotUpload(event)">
                </div>

                <!-- AI Insights Section -->
                ${posts.length >= 3 ? renderAIInsightsSection() : ''}

                <!-- Posts Table -->
                <div class="pa-table-section">
                    <div class="pa-table-header">
                        <h3>📊 Historique des posts (${filteredPosts.length}${filterPlatform !== 'all' ? ' / ' + posts.length : ''})</h3>

                        <div class="pa-table-controls">
                            ${platforms.length > 1 ? `
                                <select class="pa-select" onchange="PostsAnalysisModule.setFilterPlatform(this.value)" value="${filterPlatform}">
                                    <option value="all" ${filterPlatform === 'all' ? 'selected' : ''}>Toutes plateformes</option>
                                    ${platforms.map(p => `<option value="${p}" ${filterPlatform === p ? 'selected' : ''}>${getPlatformLabel(p)}</option>`).join('')}
                                </select>
                            ` : ''}

                            <select class="pa-select" onchange="PostsAnalysisModule.setSortBy(this.value)">
                                <option value="date_desc" ${sortBy === 'date_desc' ? 'selected' : ''}>Plus récents</option>
                                <option value="date_asc" ${sortBy === 'date_asc' ? 'selected' : ''}>Plus anciens</option>
                                <option value="engagement_desc" ${sortBy === 'engagement_desc' ? 'selected' : ''}>Meilleur engagement</option>
                                <option value="engagement_asc" ${sortBy === 'engagement_asc' ? 'selected' : ''}>Pire engagement</option>
                                <option value="views_desc" ${sortBy === 'views_desc' ? 'selected' : ''}>Plus de vues</option>
                            </select>
                        </div>
                    </div>

                    ${filteredPosts.length > 0 ? renderPostsTable(filteredPosts) : renderEmptyState()}
                </div>
            </div>
        `;

        // Event listener pour le paste
        document.removeEventListener('paste', handlePaste);
        document.addEventListener('paste', handlePaste);

        if (currentImage) {
            renderUploadPreview();
        }
    }

    function renderStatsCards(stats) {
        return `
            <div class="pa-stats-cards">
                <div class="pa-stat-card">
                    <span class="pa-stat-value">${posts.length}</span>
                    <span class="pa-stat-label">Posts analysés</span>
                </div>
                <div class="pa-stat-card">
                    <span class="pa-stat-value">${formatNumber(stats.totalViews)}</span>
                    <span class="pa-stat-label">Vues totales</span>
                </div>
                <div class="pa-stat-card">
                    <span class="pa-stat-value">${stats.avgEngagement.toFixed(2)}%</span>
                    <span class="pa-stat-label">Engagement moyen</span>
                </div>
                <div class="pa-stat-card pa-stat-best">
                    <span class="pa-stat-value">${stats.bestEngagement.toFixed(2)}%</span>
                    <span class="pa-stat-label">Meilleur post</span>
                </div>
            </div>
        `;
    }

    function renderAIInsightsSection() {
        const hasInsights = aiInsights && aiInsights.recommendations;
        const insightsAge = aiInsights?.generated_at ?
            Math.floor((Date.now() - new Date(aiInsights.generated_at).getTime()) / (1000 * 60 * 60 * 24)) : null;

        return `
            <div class="pa-ai-insights-section">
                <div class="pa-ai-header">
                    <h3>🤖 Analyse IA de tes performances</h3>
                    <button class="pa-generate-btn" onclick="PostsAnalysisModule.generateAIInsights()" ${isGeneratingInsights ? 'disabled' : ''}>
                        ${isGeneratingInsights ? '<span class="pa-spinner"></span> Analyse...' : (hasInsights ? '🔄 Actualiser' : '✨ Générer l\'analyse')}
                    </button>
                </div>

                ${hasInsights ? `
                    <div class="pa-ai-insights-content">
                        ${insightsAge !== null ? `<p class="pa-insights-age">Générée il y a ${insightsAge === 0 ? "aujourd'hui" : insightsAge + ' jour(s)'}</p>` : ''}

                        <!-- Résumé -->
                        <div class="pa-insight-block pa-insight-summary">
                            <h4>📊 Résumé</h4>
                            <p>${aiInsights.summary || ''}</p>
                        </div>

                        <!-- Ce qui marche -->
                        ${aiInsights.what_works?.length > 0 ? `
                            <div class="pa-insight-block pa-insight-success">
                                <h4>✅ Ce qui marche pour toi</h4>
                                <ul>
                                    ${aiInsights.what_works.map(w => `<li>${w}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}

                        <!-- Ce qui marche moins -->
                        ${aiInsights.what_doesnt_work?.length > 0 ? `
                            <div class="pa-insight-block pa-insight-warning">
                                <h4>⚠️ Ce qui marche moins</h4>
                                <ul>
                                    ${aiInsights.what_doesnt_work.map(w => `<li>${w}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}

                        <!-- Recommandations -->
                        ${aiInsights.recommendations?.length > 0 ? `
                            <div class="pa-insight-block pa-insight-tips">
                                <h4>💡 Recommandations</h4>
                                <ul>
                                    ${aiInsights.recommendations.map(r => `<li>${r}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}

                        <!-- Meilleur moment -->
                        ${aiInsights.best_time ? `
                            <div class="pa-insight-block pa-insight-time">
                                <h4>⏰ Meilleur moment pour poster</h4>
                                <p>${aiInsights.best_time}</p>
                            </div>
                        ` : ''}

                        <!-- Idées de contenu -->
                        ${aiInsights.content_ideas?.length > 0 ? `
                            <div class="pa-insight-block pa-insight-ideas">
                                <h4>💭 Idées de contenu basées sur tes tops</h4>
                                <ul>
                                    ${aiInsights.content_ideas.map(i => `<li>${i}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                ` : `
                    <div class="pa-ai-placeholder">
                        <p>Clique sur "Générer l'analyse" pour obtenir des insights personnalisés basés sur tes ${posts.length} posts.</p>
                    </div>
                `}
            </div>
        `;
    }

    function renderPostsTable(filteredPosts) {
        return `
            <div class="pa-table-wrapper">
                <table class="pa-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Plateforme</th>
                            <th>Contenu</th>
                            <th>Vues</th>
                            <th>Likes</th>
                            <th>Comm.</th>
                            <th>Reposts</th>
                            <th>Engage.</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredPosts.map(post => renderTableRow(post)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderTableRow(post) {
        const date = post.published_at ? new Date(post.published_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '-';
        const platform = getPlatformEmoji(post.platform);
        const content = post.content ? (post.content.length > 60 ? post.content.substring(0, 60) + '...' : post.content) : '-';
        const engagement = post.engagement_rate ? post.engagement_rate.toFixed(2) + '%' : '-';
        const engagementClass = getEngagementClass(post.engagement_rate);

        return `
            <tr>
                <td class="pa-td-date">${date}</td>
                <td class="pa-td-platform">${platform}</td>
                <td class="pa-td-content" title="${escapeHtml(post.content || '')}">${escapeHtml(content)}</td>
                <td class="pa-td-stat">${formatNumber(post.views)}</td>
                <td class="pa-td-stat">${formatNumber(post.likes)}</td>
                <td class="pa-td-stat">${formatNumber(post.comments)}</td>
                <td class="pa-td-stat">${formatNumber(post.reposts)}</td>
                <td class="pa-td-engagement ${engagementClass}">${engagement}</td>
                <td class="pa-td-actions">
                    <button class="pa-btn-delete-small" onclick="PostsAnalysisModule.deletePost('${post.id}')" title="Supprimer">🗑️</button>
                </td>
            </tr>
        `;
    }

    function renderEmptyState() {
        return `
            <div class="pa-empty-state">
                <div class="pa-empty-icon">📊</div>
                <h3>Aucun post ${filterPlatform !== 'all' ? 'sur ' + getPlatformLabel(filterPlatform) : ''}</h3>
                <p>Fais une capture d'écran d'un de tes posts avec ses stats, colle-la ci-dessus, et le tableau se remplira automatiquement.</p>
            </div>
        `;
    }

    // ==========================================
    // STATS
    // ==========================================

    function calculateGlobalStats() {
        if (posts.length === 0) {
            return { totalViews: 0, avgEngagement: 0, bestEngagement: 0 };
        }

        const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
        const engagements = posts.filter(p => p.engagement_rate != null).map(p => p.engagement_rate);
        const avgEngagement = engagements.length > 0 ? engagements.reduce((a, b) => a + b, 0) / engagements.length : 0;
        const bestEngagement = engagements.length > 0 ? Math.max(...engagements) : 0;

        return { totalViews, avgEngagement, bestEngagement };
    }

    // ==========================================
    // CHART DATA
    // ==========================================

    function getChartData() {
        if (posts.length < 2) return null;

        // Grouper les posts par semaine sur les 30 derniers jours
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Filtrer les posts des 30 derniers jours
        const recentPosts = posts.filter(p => {
            if (!p.published_at) return false;
            const postDate = new Date(p.published_at);
            return postDate >= thirtyDaysAgo;
        });

        if (recentPosts.length < 2) {
            // Si pas assez de posts récents, prendre tous les posts
            // et les regrouper par semaine
            const sortedPosts = [...posts]
                .filter(p => p.published_at && p.engagement_rate != null)
                .sort((a, b) => new Date(a.published_at) - new Date(b.published_at));

            if (sortedPosts.length < 2) return null;

            // Grouper par intervalles (max 8 barres)
            const maxBars = 8;
            const postsPerBar = Math.ceil(sortedPosts.length / maxBars);
            const chartData = [];

            for (let i = 0; i < sortedPosts.length; i += postsPerBar) {
                const chunk = sortedPosts.slice(i, i + postsPerBar);
                const avgEngagement = chunk.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / chunk.length;
                const firstDate = new Date(chunk[0].published_at);
                const lastDate = new Date(chunk[chunk.length - 1].published_at);

                chartData.push({
                    label: firstDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                    value: avgEngagement,
                    count: chunk.length
                });
            }

            return chartData;
        }

        // Grouper par semaine
        const weeks = {};
        recentPosts.forEach(post => {
            if (!post.engagement_rate) return;
            const postDate = new Date(post.published_at);
            const weekStart = new Date(postDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];

            if (!weeks[weekKey]) {
                weeks[weekKey] = { total: 0, count: 0, date: weekStart };
            }
            weeks[weekKey].total += post.engagement_rate;
            weeks[weekKey].count++;
        });

        const chartData = Object.entries(weeks)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, data]) => ({
                label: data.date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                value: data.total / data.count,
                count: data.count
            }));

        return chartData.length >= 2 ? chartData : null;
    }

    function renderEngagementChart() {
        const chartData = getChartData();
        if (!chartData) return '';

        const maxValue = Math.max(...chartData.map(d => d.value));
        const avgValue = chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length;

        return `
            <div class="pa-chart-section">
                <div class="pa-chart-header">
                    <h3>📈 Évolution de l'engagement</h3>
                    <span class="pa-chart-avg">Moyenne: ${avgValue.toFixed(2)}%</span>
                </div>
                <div class="pa-chart-container">
                    <div class="pa-chart-bars">
                        ${chartData.map((d, i) => {
                            const height = maxValue > 0 ? (d.value / maxValue) * 100 : 0;
                            const isLast = i === chartData.length - 1;
                            const trend = i > 0 ? (d.value > chartData[i-1].value ? 'up' : (d.value < chartData[i-1].value ? 'down' : 'same')) : 'same';
                            return `
                                <div class="pa-chart-bar-wrapper">
                                    <div class="pa-chart-bar ${isLast ? 'pa-chart-bar-current' : ''}"
                                         style="height: ${Math.max(height, 5)}%"
                                         title="${d.value.toFixed(2)}% (${d.count} post${d.count > 1 ? 's' : ''})">
                                        <span class="pa-chart-value">${d.value.toFixed(1)}%</span>
                                    </div>
                                    <span class="pa-chart-label">${d.label}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="pa-chart-baseline"></div>
                </div>
                ${chartData.length >= 2 ? `
                    <div class="pa-chart-trend">
                        ${getTrendIndicator(chartData)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function getTrendIndicator(chartData) {
        if (chartData.length < 2) return '';

        const firstHalf = chartData.slice(0, Math.floor(chartData.length / 2));
        const secondHalf = chartData.slice(Math.floor(chartData.length / 2));

        const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;

        const diff = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (Math.abs(diff) < 5) {
            return '<span class="pa-trend pa-trend-stable">→ Stable</span>';
        } else if (diff > 0) {
            return `<span class="pa-trend pa-trend-up">↗ +${diff.toFixed(0)}% vs période précédente</span>`;
        } else {
            return `<span class="pa-trend pa-trend-down">↘ ${diff.toFixed(0)}% vs période précédente</span>`;
        }
    }

    // ==========================================
    // UTILITIES
    // ==========================================

    function formatNumber(num) {
        if (num == null) return '-';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
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

    function getPlatformEmoji(platform) {
        const emojis = {
            linkedin: '💼',
            instagram: '📸',
            twitter: '🐦',
            facebook: '👥',
            threads: '🧵',
            tiktok: '🎵'
        };
        return emojis[platform] || '📱';
    }

    function getPlatformLabel(platform) {
        const labels = {
            linkedin: 'LinkedIn',
            instagram: 'Instagram',
            twitter: 'X/Twitter',
            facebook: 'Facebook',
            threads: 'Threads',
            tiktok: 'TikTok'
        };
        return labels[platform] || platform;
    }

    function getEngagementClass(rate) {
        if (!rate) return '';
        if (rate >= 5) return 'pa-engagement-top';
        if (rate >= 2) return 'pa-engagement-good';
        if (rate >= 1) return 'pa-engagement-avg';
        return 'pa-engagement-low';
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        init,
        render,
        openModal,
        closeModal,
        handleScreenshotUpload,
        removeScreenshot,
        analyzeScreenshot,
        deletePost,
        setSortBy,
        setFilterPlatform,
        generateAIInsights,
        getPosts: () => posts
    };

})();

// Export global
window.PostsAnalysisModule = PostsAnalysisModule;
