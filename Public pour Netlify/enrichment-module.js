// =====================================================
// ENRICHMENT MODULE - Enrichissement Intelligent des Prospects
// SOS Storytelling - 2026
// =====================================================

const EnrichmentModule = (function() {
    'use strict';

    // Configuration API - Workers d'enrichissement
    const ENRICHMENT_WORKERS = {
        enrich: 'https://enrich-prospect.sandra-devonssay.workers.dev',
        analyze: 'https://analyze-relevance.sandra-devonssay.workers.dev',
        generate: 'https://generate-smart-email.sandra-devonssay.workers.dev'
    };

    // Cache des enrichissements en cours
    let enrichmentQueue = [];
    let isProcessingQueue = false;

    // ==========================================
    // API CALLS
    // ==========================================

    async function getAuthHeaders() {
        const session = await window.supabaseClient?.auth.getSession();
        const token = session?.data?.session?.access_token;
        if (!token) {
            throw new Error('Session expirée. Veuillez rafraîchir la page.');
        }
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Enrichir un prospect avec Perplexity
     */
    async function enrichProspect(prospect) {
        try {
            const headers = await getAuthHeaders();

            // Mettre à jour le statut
            await updateProspectStatus(prospect.id, 'enriching');

            const response = await fetch(ENRICHMENT_WORKERS.enrich, {
                method: 'POST',
                headers,
                body: JSON.stringify({ prospect })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Erreur enrichissement');
            }

            return data;
        } catch (error) {
            console.error('Erreur enrichissement prospect:', error);
            await updateProspectStatus(prospect.id, 'error');
            throw error;
        }
    }

    /**
     * Analyser la pertinence des infos enrichies
     */
    async function analyzeRelevance(prospect, enrichmentData, campaign) {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(ENRICHMENT_WORKERS.analyze, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    enrichment_data: enrichmentData,
                    campaign_context: campaign,
                    prospect
                })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Erreur analyse');
            }

            return data.analysis;
        } catch (error) {
            console.error('Erreur analyse pertinence:', error);
            throw error;
        }
    }

    /**
     * Générer un email intelligent personnalisé
     */
    async function generateSmartEmail(prospect, relevanceAnalysis, campaign) {
        try {
            const headers = await getAuthHeaders();

            const response = await fetch(ENRICHMENT_WORKERS.generate, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    prospect,
                    analysis: relevanceAnalysis,
                    campaign_context: campaign
                })
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error || 'Erreur génération');
            }

            return data.email;
        } catch (error) {
            console.error('Erreur génération email:', error);
            throw error;
        }
    }

    /**
     * Mettre à jour le statut d'enrichissement d'un prospect
     */
    async function updateProspectStatus(prospectId, status, enrichmentData = null) {
        try {
            const updateData = {
                enrichment_status: status,
                enriched_at: status === 'enriched' ? new Date().toISOString() : null
            };

            if (enrichmentData) {
                updateData.enrichment_data = enrichmentData;
            }

            const { error } = await window.supabaseClient
                .from('prospects')
                .update(updateData)
                .eq('id', prospectId);

            if (error) throw error;
        } catch (error) {
            console.error('Erreur mise à jour statut:', error);
        }
    }

    /**
     * Sauvegarder les données d'enrichissement
     */
    async function saveEnrichmentData(prospectId, rawData, analysis) {
        try {
            const enrichmentData = {
                raw: rawData,
                analysis: analysis
            };

            await updateProspectStatus(prospectId, 'enriched', enrichmentData);

            return enrichmentData;
        } catch (error) {
            console.error('Erreur sauvegarde enrichissement:', error);
            throw error;
        }
    }

    // ==========================================
    // FLOW COMPLET ENRICHISSEMENT
    // ==========================================

    /**
     * Enrichir et analyser un prospect (flow complet)
     */
    async function enrichAndAnalyze(prospect, campaign) {
        const result = {
            success: false,
            enrichmentData: null,
            analysis: null,
            error: null
        };

        try {
            // Étape 1: Enrichissement Perplexity
            const enrichResult = await enrichProspect(prospect);

            if (!enrichResult.success || enrichResult.data?.no_data) {
                result.enrichmentData = { no_data: true, reason: enrichResult.data?.reason };
                await updateProspectStatus(prospect.id, 'no_data', result.enrichmentData);
                result.success = true;
                return result;
            }

            result.enrichmentData = enrichResult.data;

            // Étape 2: Analyse de pertinence
            const analysis = await analyzeRelevance(prospect, enrichResult.data, campaign);
            result.analysis = analysis;

            // Étape 3: Sauvegarder
            await saveEnrichmentData(prospect.id, enrichResult.data, analysis);

            result.success = true;
            return result;

        } catch (error) {
            result.error = error.message;
            await updateProspectStatus(prospect.id, 'error');
            return result;
        }
    }

    /**
     * Générer un email après enrichissement
     */
    async function generateEmailForProspect(prospect, campaign) {
        try {
            // Récupérer l'analyse existante ou en créer une générique
            let analysis = prospect.enrichment_data?.analysis;

            if (!analysis) {
                // Pas d'enrichissement, utiliser une approche générique
                analysis = {
                    personalization_level: 'none',
                    chosen_angle: `Approche générique basée sur le poste de ${prospect.position || 'professionnel'}`,
                    relevant_info: [],
                    fallback_hook: `En tant que ${prospect.position || 'professionnel'} chez ${prospect.company || 'votre entreprise'}...`
                };
            }

            const email = await generateSmartEmail(prospect, analysis, campaign);
            return email;

        } catch (error) {
            console.error('Erreur génération email:', error);
            throw error;
        }
    }

    // ==========================================
    // BATCH ENRICHISSEMENT
    // ==========================================

    /**
     * Enrichir plusieurs prospects en batch
     */
    async function batchEnrich(prospectIds, campaign, onProgress) {
        const results = {
            total: prospectIds.length,
            success: 0,
            noData: 0,
            errors: 0,
            processed: 0
        };

        // Limiter à 3 en parallèle pour éviter rate limits
        const batchSize = 3;
        const delayBetweenBatches = 2000; // 2 secondes

        for (let i = 0; i < prospectIds.length; i += batchSize) {
            const batch = prospectIds.slice(i, i + batchSize);

            await Promise.all(batch.map(async (prospectId) => {
                try {
                    // Récupérer le prospect
                    const { data: prospect, error } = await window.supabaseClient
                        .from('prospects')
                        .select('*')
                        .eq('id', prospectId)
                        .single();

                    if (error || !prospect) {
                        results.errors++;
                        results.processed++;
                        return;
                    }

                    // Enrichir
                    const result = await enrichAndAnalyze(prospect, campaign);

                    if (result.error) {
                        results.errors++;
                    } else if (result.enrichmentData?.no_data) {
                        results.noData++;
                    } else {
                        results.success++;
                    }

                } catch (error) {
                    console.error('Erreur batch enrichissement:', error);
                    results.errors++;
                }

                results.processed++;

                // Callback de progression
                if (onProgress) {
                    onProgress(results);
                }
            }));

            // Pause entre les batches
            if (i + batchSize < prospectIds.length) {
                await new Promise(r => setTimeout(r, delayBetweenBatches));
            }
        }

        return results;
    }

    // ==========================================
    // UI RENDERING
    // ==========================================

    /**
     * Rendre la carte d'enrichissement d'un prospect
     */
    function renderEnrichmentCard(prospect, campaign) {
        const enrichmentData = prospect.enrichment_data;
        const status = prospect.enrichment_status || 'pending';
        const analysis = enrichmentData?.analysis;

        const personalizationColors = {
            high: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981', label: '🎯 Forte' },
            medium: { bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)', text: '#f59e0b', label: '👍 Moyenne' },
            low: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316', label: '😐 Faible' },
            none: { bg: 'rgba(107, 114, 128, 0.1)', border: 'rgba(107, 114, 128, 0.3)', text: '#6b7280', label: '❌ Aucune' }
        };

        const level = analysis?.personalization_level || 'none';
        const colors = personalizationColors[level];

        return `
            <div class="enrichment-card" data-prospect-id="${prospect.id}" data-status="${status}">
                <!-- Header -->
                <div class="enrichment-card-header">
                    <div class="prospect-info">
                        <div class="prospect-name">${escapeHtml(prospect.first_name || '')} ${escapeHtml(prospect.last_name || '')}</div>
                        <div class="prospect-details">${escapeHtml(prospect.job_title || prospect.position || '')} · ${escapeHtml(prospect.company || '')}</div>
                    </div>

                    ${status === 'pending' ? `
                        <button class="btn-enrich" onclick="EnrichmentModule.handleEnrich('${prospect.id}')">
                            🔍 Enrichir
                        </button>
                    ` : ''}

                    ${status === 'enriching' ? `
                        <div class="enriching-badge">
                            <span class="spinner-small"></span>
                            Recherche...
                        </div>
                    ` : ''}

                    ${status === 'enriched' ? `
                        <div class="enriched-badge" style="background: ${colors.bg}; border: 1px solid ${colors.border}; color: ${colors.text};">
                            ${colors.label}
                        </div>
                    ` : ''}

                    ${status === 'no_data' ? `
                        <div class="no-data-badge">
                            😕 Pas de données
                        </div>
                    ` : ''}

                    ${status === 'error' ? `
                        <div class="error-badge">
                            ⚠️ Erreur
                        </div>
                    ` : ''}
                </div>

                <!-- Enrichment Data -->
                ${status === 'enriched' && enrichmentData?.raw ? `
                    <div class="enrichment-content">
                        <!-- Infos trouvées -->
                        <div class="enrichment-section">
                            <div class="section-title">📡 Infos récupérées</div>

                            ${enrichmentData.raw.person_info?.length > 0 ? `
                                <div class="info-group">
                                    <div class="info-label">Sur la personne :</div>
                                    ${enrichmentData.raw.person_info.map(info => `
                                        <div class="info-item person">
                                            <span class="info-dot">•</span>
                                            <span class="info-text">${escapeHtml(info.summary)}</span>
                                            <span class="info-date">(${escapeHtml(info.date)})</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}

                            ${enrichmentData.raw.company_info?.length > 0 ? `
                                <div class="info-group">
                                    <div class="info-label">Sur l'entreprise :</div>
                                    ${enrichmentData.raw.company_info.map(info => `
                                        <div class="info-item company">
                                            <span class="info-dot">•</span>
                                            <span class="info-text">${escapeHtml(info.summary)}</span>
                                            <span class="info-date">(${escapeHtml(info.date)})</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>

                        <!-- Analyse -->
                        ${analysis ? `
                            <!-- Angle choisi -->
                            ${analysis.chosen_angle ? `
                                <div class="enrichment-section angle-section">
                                    <div class="section-title">🎯 Angle choisi</div>
                                    <div class="angle-text">${escapeHtml(analysis.chosen_angle)}</div>
                                </div>
                            ` : ''}

                            <!-- Infos pertinentes -->
                            ${analysis.relevant_info?.length > 0 ? `
                                <div class="enrichment-section relevant-section">
                                    <div class="section-title">✅ Infos retenues</div>
                                    ${analysis.relevant_info.map(info => `
                                        <div class="relevant-item">
                                            <div class="relevant-info">• ${escapeHtml(info.info)}</div>
                                            <div class="relevant-usage">→ ${escapeHtml(info.how_to_use)}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}

                            <!-- Infos ignorées (collapsible) -->
                            ${analysis.ignored_info?.length > 0 ? `
                                <details class="enrichment-section ignored-section">
                                    <summary class="section-title clickable">
                                        ❌ Infos ignorées (${analysis.ignored_info.length})
                                    </summary>
                                    <div class="ignored-content">
                                        ${analysis.ignored_info.map(info => `
                                            <div class="ignored-item">
                                                • ${escapeHtml(info.info)} — <em>${escapeHtml(info.why_ignored)}</em>
                                            </div>
                                        `).join('')}
                                    </div>
                                </details>
                            ` : ''}

                            <!-- Accroche suggérée -->
                            ${analysis.hook_suggestion ? `
                                <div class="enrichment-section hook-section">
                                    <div class="section-title">💡 Accroche suggérée</div>
                                    <div class="hook-text">"${escapeHtml(analysis.hook_suggestion)}"</div>
                                </div>
                            ` : ''}
                        ` : ''}

                        <!-- Bouton générer email -->
                        <button class="btn-generate-email" onclick="EnrichmentModule.handleGenerateEmail('${prospect.id}')">
                            ✉️ Générer l'email personnalisé
                        </button>
                    </div>
                ` : ''}

                <!-- No Data State -->
                ${status === 'no_data' ? `
                    <div class="enrichment-no-data">
                        <div class="no-data-icon">😕</div>
                        <div class="no-data-text">Pas d'infos récentes trouvées</div>
                        <div class="no-data-hint">L'email sera généré avec une approche générique basée sur le poste.</div>
                        <button class="btn-generate-generic" onclick="EnrichmentModule.handleGenerateEmail('${prospect.id}')">
                            Générer quand même →
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Rendre le panel d'enrichissement batch
     */
    function renderBatchPanel(prospects, campaign) {
        const stats = {
            total: prospects.length,
            pending: prospects.filter(p => !p.enrichment_status || p.enrichment_status === 'pending').length,
            enriched: prospects.filter(p => p.enrichment_status === 'enriched').length,
            noData: prospects.filter(p => p.enrichment_status === 'no_data').length,
            errors: prospects.filter(p => p.enrichment_status === 'error').length
        };

        return `
            <div class="batch-enrichment-panel">
                <div class="batch-header">
                    <h3>🔍 Enrichissement des prospects</h3>
                    <div class="batch-stats">
                        <span class="stat">${stats.total} total</span>
                        <span class="stat pending">${stats.pending} en attente</span>
                        <span class="stat enriched">${stats.enriched} enrichis</span>
                        ${stats.noData > 0 ? `<span class="stat no-data">${stats.noData} sans données</span>` : ''}
                        ${stats.errors > 0 ? `<span class="stat error">${stats.errors} erreurs</span>` : ''}
                    </div>
                </div>

                ${stats.pending > 0 ? `
                    <div class="batch-actions">
                        <button class="btn-batch-enrich" onclick="EnrichmentModule.handleBatchEnrich()">
                            🚀 Enrichir les ${stats.pending} prospects en attente
                        </button>
                        <div class="batch-info">
                            Coût estimé : ~${(stats.pending * 0.01).toFixed(2)}€
                        </div>
                    </div>
                ` : ''}

                <div class="batch-progress" id="batchProgress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text" id="progressText">0 / ${stats.pending}</div>
                </div>

                <div class="enrichment-cards-list" id="enrichmentCardsList">
                    ${prospects.map(p => renderEnrichmentCard(p, campaign)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Rendre le modal de validation d'email
     */
    function renderEmailValidationModal(draft) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.id = 'emailValidationModal';
        modal.innerHTML = `
            <div class="modal-content email-validation-modal">
                <div class="modal-header">
                    <h2>✉️ Email généré</h2>
                    <button class="modal-close" onclick="EnrichmentModule.closeEmailModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Contexte -->
                    <div class="email-context">
                        <div class="context-label">📧 Email pour</div>
                        <div class="context-name">${escapeHtml(draft.prospect.first_name || '')} ${escapeHtml(draft.prospect.last_name || '')}</div>
                        <div class="context-company">${escapeHtml(draft.prospect.company || '')}</div>

                        ${draft.personalization_used && draft.personalization_used !== 'none' ? `
                            <div class="context-personalization">
                                ✨ Personnalisé avec : ${escapeHtml(draft.personalization_used)}
                            </div>
                        ` : ''}
                    </div>

                    <!-- Objet -->
                    <div class="email-field">
                        <div class="field-label">Objet</div>
                        <input type="text" id="emailSubject" class="email-subject-input" value="${escapeHtml(draft.subject)}">
                    </div>

                    <!-- Corps -->
                    <div class="email-field">
                        <div class="field-label">Message (${draft.word_count || '?'} mots)</div>
                        <textarea id="emailBody" class="email-body-textarea" rows="10">${escapeHtml(draft.body)}</textarea>
                    </div>

                    <!-- Score -->
                    ${draft.analysis?.confidence_score ? `
                        <div class="confidence-score">
                            Score de confiance : ${draft.analysis.confidence_score}%
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn-reject" onclick="EnrichmentModule.rejectEmail('${draft.prospect.id}')">
                        ❌ Rejeter
                    </button>
                    <button class="btn-regenerate" onclick="EnrichmentModule.regenerateEmail('${draft.prospect.id}')">
                        🔄 Régénérer
                    </button>
                    <button class="btn-approve" onclick="EnrichmentModule.approveEmail('${draft.prospect.id}')">
                        ✅ Approuver
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // ==========================================
    // EVENT HANDLERS
    // ==========================================

    let currentCampaign = null;
    let currentProspects = [];
    let currentDraft = null;

    /**
     * Initialiser le module avec une campagne
     */
    function init(campaign, prospects) {
        currentCampaign = campaign;
        currentProspects = prospects;
    }

    /**
     * Handler pour enrichir un prospect
     */
    async function handleEnrich(prospectId) {
        const prospect = currentProspects.find(p => p.id === prospectId);
        if (!prospect) return;

        // Mettre à jour l'UI
        const card = document.querySelector(`[data-prospect-id="${prospectId}"]`);
        if (card) {
            card.dataset.status = 'enriching';
            card.innerHTML = renderEnrichmentCard({ ...prospect, enrichment_status: 'enriching' }, currentCampaign);
        }

        try {
            const result = await enrichAndAnalyze(prospect, currentCampaign);

            // Mettre à jour le prospect local
            const index = currentProspects.findIndex(p => p.id === prospectId);
            if (index !== -1) {
                currentProspects[index] = {
                    ...currentProspects[index],
                    enrichment_data: result.enrichmentData?.no_data ? { no_data: true } : { raw: result.enrichmentData, analysis: result.analysis },
                    enrichment_status: result.enrichmentData?.no_data ? 'no_data' : 'enriched'
                };
            }

            // Rafraîchir la carte
            if (card) {
                card.outerHTML = renderEnrichmentCard(currentProspects[index], currentCampaign);
            }

        } catch (error) {
            showToast(error.message, 'error');

            // Remettre l'état à pending
            if (card) {
                card.outerHTML = renderEnrichmentCard({ ...prospect, enrichment_status: 'error' }, currentCampaign);
            }
        }
    }

    /**
     * Handler pour enrichir en batch
     */
    async function handleBatchEnrich() {
        const pendingProspects = currentProspects.filter(p => !p.enrichment_status || p.enrichment_status === 'pending');
        const prospectIds = pendingProspects.map(p => p.id);

        if (prospectIds.length === 0) {
            showToast('Aucun prospect à enrichir', 'info');
            return;
        }

        // Afficher la barre de progression
        const progressContainer = document.getElementById('batchProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        if (progressContainer) {
            progressContainer.style.display = 'block';
        }

        // Désactiver le bouton batch
        const batchBtn = document.querySelector('.btn-batch-enrich');
        if (batchBtn) {
            batchBtn.disabled = true;
            batchBtn.textContent = '⏳ Enrichissement en cours...';
        }

        const results = await batchEnrich(prospectIds, currentCampaign, (progress) => {
            // Mettre à jour la progression
            const percentage = Math.round((progress.processed / progress.total) * 100);
            if (progressFill) progressFill.style.width = `${percentage}%`;
            if (progressText) progressText.textContent = `${progress.processed} / ${progress.total}`;
        });

        // Résumé
        showToast(`Enrichissement terminé : ${results.success} succès, ${results.noData} sans données, ${results.errors} erreurs`, 'success');

        // Rafraîchir la liste
        await refreshProspectsList();

        // Réactiver le bouton
        if (batchBtn) {
            batchBtn.disabled = false;
            batchBtn.textContent = '🚀 Enrichir les prospects en attente';
        }
    }

    /**
     * Handler pour générer un email
     */
    async function handleGenerateEmail(prospectId) {
        const prospect = currentProspects.find(p => p.id === prospectId);
        if (!prospect) return;

        // Afficher un loader sur le bouton
        const btn = document.querySelector(`[data-prospect-id="${prospectId}"] .btn-generate-email, [data-prospect-id="${prospectId}"] .btn-generate-generic`);
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-small"></span> Génération...';
        }

        try {
            const email = await generateEmailForProspect(prospect, currentCampaign);

            currentDraft = {
                prospect,
                ...email,
                analysis: prospect.enrichment_data?.analysis
            };

            renderEmailValidationModal(currentDraft);

        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = btn.classList.contains('btn-generate-generic') ? 'Générer quand même →' : '✉️ Générer l\'email personnalisé';
            }
        }
    }

    /**
     * Approuver l'email
     */
    async function approveEmail(prospectId) {
        const subject = document.getElementById('emailSubject')?.value;
        const body = document.getElementById('emailBody')?.value;

        if (!subject || !body) {
            showToast('Objet et message requis', 'error');
            return;
        }

        // Sauvegarder l'email approuvé
        try {
            // Ajouter à la séquence d'emails de la campagne
            if (typeof CampaignsModule !== 'undefined' && CampaignsModule.addApprovedEmail) {
                await CampaignsModule.addApprovedEmail(prospectId, { subject, body });
            }

            closeEmailModal();
            showToast('Email approuvé !', 'success');

            // Marquer le prospect comme "email_ready"
            await window.supabaseClient
                .from('prospects')
                .update({ status: 'email_ready' })
                .eq('id', prospectId);

        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    /**
     * Rejeter l'email
     */
    function rejectEmail(prospectId) {
        closeEmailModal();
        showToast('Email rejeté', 'info');
    }

    /**
     * Régénérer l'email
     */
    async function regenerateEmail(prospectId) {
        closeEmailModal();
        await handleGenerateEmail(prospectId);
    }

    /**
     * Fermer le modal email
     */
    function closeEmailModal() {
        const modal = document.getElementById('emailValidationModal');
        if (modal) modal.remove();
        currentDraft = null;
    }

    /**
     * Rafraîchir la liste des prospects
     */
    async function refreshProspectsList() {
        // Cette fonction sera implémentée selon l'intégration avec CampaignsModule
        if (typeof CampaignsModule !== 'undefined' && CampaignsModule.loadProspects) {
            currentProspects = await CampaignsModule.loadProspects();
            const container = document.getElementById('enrichmentCardsList');
            if (container) {
                container.innerHTML = currentProspects.map(p => renderEnrichmentCard(p, currentCampaign)).join('');
            }
        }
    }

    // ==========================================
    // UTILITIES
    // ==========================================

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

    // ==========================================
    // PUBLIC API
    // ==========================================

    return {
        // Initialisation
        init,

        // API calls
        enrichProspect,
        analyzeRelevance,
        generateSmartEmail,
        enrichAndAnalyze,
        generateEmailForProspect,
        batchEnrich,

        // UI
        renderEnrichmentCard,
        renderBatchPanel,
        renderEmailValidationModal,

        // Event handlers
        handleEnrich,
        handleBatchEnrich,
        handleGenerateEmail,
        approveEmail,
        rejectEmail,
        regenerateEmail,
        closeEmailModal,

        // State
        getCurrentCampaign: () => currentCampaign,
        getCurrentProspects: () => currentProspects,
        getCurrentDraft: () => currentDraft
    };

})();

// Export global
window.EnrichmentModule = EnrichmentModule;
