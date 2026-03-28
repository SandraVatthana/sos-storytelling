// ============================================================
// MODULE NEWSLETTERS QUI CONVERTISSENT
// SOS Storytelling & Personal Branding
// ============================================================

class NewsletterModule {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 5;
    this.formData = {};
    this.generatedContent = null;
    this.isSequenceMode = false;
    this.sequenceEmails = [];
    this.currentEmailIndex = 0;
    this.clients = [];
    this.selectedClient = null;
    this.voices = [];
    this.selectedVoice = null;
    this.templates = [];
    this.isAgencyMode = false;
    this.activeTab = 'curation';
    this.analysisResult = null;
    this.analysisLoading = false;
    this.savedAnalyses = this.loadSavedAnalyses();

    this.types = [];
    this.structures = [];
    this.tones = [];

    this.init();
  }

  async init() {
    // Charger les données locales (pas d'API)
    this.loadLocalData();
    this.render();
    this.attachEventListeners();
  }

  // ============================================================
  // CHARGEMENT DES DONNÉES LOCALES
  // ============================================================

  loadLocalData() {
    // Utiliser directement les données par défaut (pas d'API externe)
    this.types = this.getDefaultTypes();
    this.structures = this.getDefaultStructures();
    this.tones = this.getDefaultTones();
    this.clients = [];
    this.voices = [];
    this.templates = this.loadLocalTemplates();

    // Charger MA VOIX depuis localStorage si disponible
    this.loadSavedVoice();
  }

  loadLocalTemplates() {
    try {
      const saved = localStorage.getItem('sos_newsletter_templates');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  loadSavedVoice() {
    // Charger les données MA VOIX sauvegardées
    try {
      // Charger les échantillons de texte
      const savedSamples = localStorage.getItem('tithot_voice_samples');
      this.voiceSamples = savedSamples ? JSON.parse(savedSamples) : [];

      // Charger le profil de voix analysé depuis UserProfile
      const userProfileData = localStorage.getItem('tithot_user_profile');
      if (userProfileData) {
        const profile = JSON.parse(userProfileData);
        this.voiceProfile = profile?.voiceProfile || null;
      } else {
        this.voiceProfile = null;
      }

      console.log('📧 Newsletter - Voice data loaded:', {
        samplesCount: this.voiceSamples?.length || 0,
        hasVoiceProfile: !!this.voiceProfile
      });
    } catch (e) {
      console.error('📧 Newsletter - Erreur chargement voix:', e);
      this.voiceSamples = [];
      this.voiceProfile = null;
    }
  }

  hasSavedVoice() {
    // Recharger à chaque vérification pour avoir les données fraîches
    this.loadSavedVoice();
    return (this.voiceSamples && this.voiceSamples.length > 0) || this.voiceProfile;
  }

  useSavedVoice() {
    if (!this.hasSavedVoice()) {
      this.showError('Aucune donnée MA VOIX sauvegardée. Va dans l\'onglet MA VOIX pour entrer tes textes.');
      return;
    }

    // Construire une description de voix à partir des données sauvegardées
    let voiceDescription = '';

    // Utiliser le profil analysé s'il existe
    if (this.voiceProfile) {
      voiceDescription += '## Mon profil de voix analysé:\n';
      if (this.voiceProfile.ton) voiceDescription += `- Ton général: ${this.voiceProfile.ton}\n`;
      if (this.voiceProfile.longueur) voiceDescription += `- Style de phrases: ${this.voiceProfile.longueur}\n`;
      if (this.voiceProfile.vocabulaire) voiceDescription += `- Vocabulaire: ${this.voiceProfile.vocabulaire}\n`;
      if (this.voiceProfile.ponctuation) voiceDescription += `- Ponctuation: ${this.voiceProfile.ponctuation}\n`;
      if (this.voiceProfile.structure) voiceDescription += `- Structure: ${this.voiceProfile.structure}\n`;
      voiceDescription += '\n';
    }

    // Ajouter les échantillons de texte
    if (this.voiceSamples && this.voiceSamples.length > 0) {
      voiceDescription += '## Exemples de mon style d\'écriture:\n';
      this.voiceSamples.slice(0, 5).forEach((sample, i) => {
        voiceDescription += `\n--- Exemple ${i + 1} ---\n${sample}\n`;
      });
    }

    this.formData.customVoice = voiceDescription.trim();
    this.formData.voiceId = null; // Désélectionner les profils existants
    this.render();
    this.showSuccess('✨ Voix MA VOIX chargée !');
  }

  renderVoicePreview() {
    let preview = '';

    // Afficher le profil analysé
    if (this.voiceProfile) {
      preview += '<div class="voice-preview-profile">';
      if (this.voiceProfile.ton) preview += `<span class="voice-tag">🎭 ${this.voiceProfile.ton}</span>`;
      if (this.voiceProfile.vocabulaire) preview += `<span class="voice-tag">📚 ${this.voiceProfile.vocabulaire}</span>`;
      if (this.voiceProfile.longueur) preview += `<span class="voice-tag">📏 ${this.voiceProfile.longueur}</span>`;
      preview += '</div>';
    }

    // Afficher un extrait des échantillons
    if (this.voiceSamples && this.voiceSamples.length > 0) {
      const sampleCount = this.voiceSamples.length;
      const firstSample = this.voiceSamples[0];
      const truncated = firstSample.length > 100 ? firstSample.substring(0, 100) + '...' : firstSample;

      preview += `<div class="voice-preview-samples">`;
      preview += `<span class="samples-count">${sampleCount} exemple${sampleCount > 1 ? 's' : ''} de texte</span>`;
      preview += `<div class="sample-excerpt">"${this.escapeHtml(truncated)}"</div>`;
      preview += `</div>`;
    }

    return preview || '<em>Aucun aperçu disponible</em>';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================

  render() {
    const container = document.getElementById('newsletter-module');
    if (!container) return;

    container.innerHTML = `
      <div class="newsletter-container">
        <!-- Onglets principaux -->
        <div class="newsletter-tabs-bar">
          <button class="newsletter-tab ${this.activeTab === 'curation' ? 'active' : ''}"
                  onclick="newsletterModule.switchTab('curation')">
            🔍 Curation
          </button>
          <button class="newsletter-tab ${this.activeTab === 'redaction' ? 'active' : ''}"
                  onclick="newsletterModule.switchTab('redaction')">
            ✍️ Rédaction
          </button>
        </div>

        ${this.activeTab === 'curation' ? this.renderCurationTab() : this.renderRedactionTab()}
      </div>
    `;
  }

  renderRedactionTab() {
    return `
        <!-- Header avec mode Agency -->
        <div class="newsletter-header">
          <div class="newsletter-title-row">
            <h2 class="newsletter-main-title">
              <span class="newsletter-icon">📧</span>
              Newsletters qui Convertissent
            </h2>
            ${this.clients.length > 0 ? `
              <div class="agency-mode-toggle">
                <label class="toggle-switch">
                  <input type="checkbox" id="agency-mode-toggle" ${this.isAgencyMode ? 'checked' : ''}>
                  <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">Mode Agence</span>
              </div>
            ` : ''}
          </div>

          ${this.isAgencyMode && this.clients.length > 0 ? this.renderClientSelector() : ''}
        </div>

        <!-- Progress Bar -->
        <div class="newsletter-progress">
          <div class="progress-steps">
            ${this.renderProgressSteps()}
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${(this.currentStep / this.totalSteps) * 100}%"></div>
          </div>
        </div>

        <!-- Wizard Content -->
        <div class="newsletter-wizard">
          ${this.renderCurrentStep()}
        </div>

        <!-- Navigation -->
        <div class="newsletter-nav">
          ${this.currentStep > 1 ? `
            <button class="btn-secondary" onclick="newsletterModule.prevStep()">
              ← Précédent
            </button>
          ` : `
            <button class="btn-secondary" onclick="newsletterModule.backToEmailChoice()">
              ← Retour
            </button>
          `}

          ${this.currentStep < this.totalSteps ? `
            <button class="btn-primary" onclick="newsletterModule.nextStep()" ${this.canProceed() ? '' : 'disabled'}>
              Suivant →
            </button>
          ` : ''}

          ${this.currentStep === 4 ? `
            <button class="btn-generate" onclick="newsletterModule.generate()">
              ✨ Générer la Newsletter
            </button>
          ` : ''}
        </div>

        <!-- Templates rapides -->
        ${this.currentStep === 1 && this.templates.length > 0 ? this.renderQuickTemplates() : ''}
    `;
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.render();
  }

  // ============================================================
  // ONGLET CURATION (ANALYSE)
  // ============================================================

  loadSavedAnalyses() {
    try {
      const saved = localStorage.getItem('sos_newsletter_analyses');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveAnalysis(analysis, source, subject) {
    const entry = {
      id: Date.now().toString(),
      analysis,
      source: source || '',
      subject: subject || '',
      createdAt: new Date().toISOString()
    };
    this.savedAnalyses.unshift(entry);
    this.savedAnalyses = this.savedAnalyses.slice(0, 20);
    localStorage.setItem('sos_newsletter_analyses', JSON.stringify(this.savedAnalyses));
  }

  renderCurationTab() {
    return `
      <div class="curation-container">
        <h3 class="step-title">🔍 Analyse une newsletter</h3>
        <p class="step-description">Colle une newsletter pour la décortiquer : structure, hook, ton, CTA, ce qui fonctionne...</p>

        <!-- Zone de saisie -->
        <div class="curation-input-section">
          <textarea class="analysis-textarea" id="analysis-content"
                    placeholder="Colle ici le contenu complet d'une newsletter que tu veux analyser...&#10;&#10;Inclus tout : objet, corps du texte, CTA, etc.">${this._analysisContent || ''}</textarea>

          <div class="curation-meta-fields">
            <div class="form-group">
              <label>📝 Source (optionnel)</label>
              <input type="text" id="analysis-source" placeholder="Ex: Newsletter de Mathilde Langevin"
                     value="${this._analysisSource || ''}">
            </div>
            <div class="form-group">
              <label>📬 Objet de l'email (optionnel)</label>
              <input type="text" id="analysis-subject" placeholder="Ex: 3 erreurs qui tuent ton engagement"
                     value="${this._analysisSubject || ''}">
            </div>
          </div>

          <button class="btn-generate" onclick="newsletterModule.analyzeNewsletter()" ${this.analysisLoading ? 'disabled' : ''}>
            ${this.analysisLoading ? '⏳ Analyse en cours...' : '🔍 Analyser cette newsletter'}
          </button>
        </div>

        <!-- Résultats -->
        ${this.analysisResult ? this.renderAnalysisResults(this.analysisResult) : ''}

        <!-- Historique -->
        ${this.savedAnalyses.length > 0 ? this.renderAnalysisHistory() : ''}

        <!-- Bouton Fermer -->
        <div class="curation-close-section">
          <button class="btn-close-modal" onclick="closeNewsletterModal()">
            ✕ Fermer
          </button>
        </div>
      </div>
    `;
  }

  async analyzeNewsletter() {
    const content = document.getElementById('analysis-content')?.value?.trim();
    const source = document.getElementById('analysis-source')?.value?.trim();
    const subject = document.getElementById('analysis-subject')?.value?.trim();

    if (!content || content.length < 50) {
      this.showError('Colle au moins 50 caractères de newsletter pour une analyse pertinente.');
      return;
    }

    // Sauvegarder les valeurs du formulaire pour le re-render
    this._analysisContent = content;
    this._analysisSource = source;
    this._analysisSubject = subject;

    this.analysisLoading = true;
    this.analysisResult = null;
    this.render();

    try {
      if (typeof window.callAI !== 'function') {
        throw new Error('La fonction callAI n\'est pas disponible. Recharge la page.');
      }

      const prompt = `Tu es un expert en email marketing et copywriting. Analyse en profondeur cette newsletter.

${source ? `Source / Auteur : ${source}` : ''}
${subject ? `Objet de l'email : ${subject}` : ''}

## NEWSLETTER A ANALYSER :
---
${content}
---

Fais un décorticage complet et réponds UNIQUEMENT avec ce JSON, sans texte avant ou après :
{
  "structure": {
    "summary": "Description de la structure globale (hook, corps, transitions, CTA)",
    "sections": ["Liste des sections identifiées dans l'ordre"]
  },
  "hook": {
    "subject_analysis": "Analyse de l'objet de l'email (si fourni)",
    "opening_analysis": "Analyse de la première phrase / accroche",
    "score": "Fort / Moyen / Faible",
    "why": "Pourquoi ça fonctionne ou pas"
  },
  "tone": {
    "register": "Registre identifié (familier, courant, soutenu)",
    "personality": "Traits de personnalité perçus",
    "proximity": "Niveau de proximité avec le lecteur (distant, neutre, proche, intime)",
    "details": "Analyse détaillée du ton et de la voix"
  },
  "copywriting": {
    "techniques": ["Liste des techniques identifiées"],
    "details": "Explication de comment chaque technique est utilisée"
  },
  "cta": {
    "type": "Type de CTA",
    "placement": "Où est placé le CTA",
    "formulation": "Texte exact du CTA",
    "effectiveness": "Analyse de l'efficacité"
  },
  "strengths": ["Liste des points forts"],
  "improvements": ["Liste des points d'amélioration avec suggestions"],
  "actionable_rules": [
    {
      "category": "algorithme|format|timing|engagement|erreurs|copywriting|strategie",
      "rule": "Règle actionnable",
      "example": "Exemple concret tiré du texte"
    }
  ]
}`;

      const response = await window.callAI(prompt);

      let analysis;
      try {
        let cleaned = String(response).trim()
          .replace(/^```json\s*\n?/i, '')
          .replace(/^```\s*\n?/, '')
          .replace(/\n?\s*```\s*$/g, '');
        analysis = JSON.parse(cleaned);
      } catch (e) {
        // Essayer de trouver le JSON dans la réponse
        const match = String(response).match(/\{[\s\S]*\}/);
        if (match) {
          try { analysis = JSON.parse(match[0]); } catch (e2) {
            analysis = { raw: String(response) };
          }
        } else {
          analysis = { raw: String(response) };
        }
      }

      this.analysisResult = analysis;
      this.saveAnalysis(analysis, source, subject);
      this.analysisLoading = false;
      this.render();
      this.showSuccess('Analyse terminée !');

    } catch (error) {
      console.error('📧 Newsletter - Erreur analyse:', error);
      this.analysisLoading = false;
      this.render();
      this.showError('Erreur lors de l\'analyse: ' + error.message);
    }
  }

  renderAnalysisResults(data) {
    if (data.raw) {
      return `
        <div class="analysis-results">
          <h4 class="analysis-results-title">📊 Résultats de l'analyse</h4>
          <div class="analysis-card">
            <h4>📄 Analyse brute</h4>
            <div class="analysis-card-content">${this.escapeHtml(data.raw).replace(/\n/g, '<br>')}</div>
          </div>
        </div>
      `;
    }

    const categoryColors = {
      algorithme: '#667eea',
      format: '#f093fb',
      timing: '#4facfe',
      engagement: '#38ef7d',
      erreurs: '#f5576c',
      copywriting: '#ff9800',
      strategie: '#764ba2'
    };

    return `
      <div class="analysis-results">
        <div class="analysis-results-header">
          <h4 class="analysis-results-title">📊 Résultats de l'analyse</h4>
          <button class="btn-small" onclick="newsletterModule.copyAnalysis()">
            📋 Copier l'analyse
          </button>
        </div>

        ${data.structure ? `
          <div class="analysis-card">
            <h4>🏗️ Structure</h4>
            <div class="analysis-card-content">
              <p>${this.escapeHtml(data.structure.summary || '')}</p>
              ${data.structure.sections?.length ? `
                <div class="analysis-sections-list">
                  ${data.structure.sections.map(s => `<span class="analysis-section-tag">${this.escapeHtml(s)}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        ${data.hook ? `
          <div class="analysis-card">
            <h4>🪝 Hook / Accroche</h4>
            <div class="analysis-card-content">
              ${data.hook.subject_analysis ? `<p><strong>Objet :</strong> ${this.escapeHtml(data.hook.subject_analysis)}</p>` : ''}
              ${data.hook.opening_analysis ? `<p><strong>Accroche :</strong> ${this.escapeHtml(data.hook.opening_analysis)}</p>` : ''}
              ${data.hook.score ? `<p><strong>Score :</strong> <span class="analysis-score analysis-score-${(data.hook.score || '').toLowerCase().replace(/[^a-z]/g, '')}">${this.escapeHtml(data.hook.score)}</span></p>` : ''}
              ${data.hook.why ? `<p>${this.escapeHtml(data.hook.why)}</p>` : ''}
            </div>
          </div>
        ` : ''}

        ${data.tone ? `
          <div class="analysis-card">
            <h4>🎤 Ton & Voix</h4>
            <div class="analysis-card-content">
              <div class="analysis-tone-tags">
                ${data.tone.register ? `<span class="analysis-tone-tag">📚 ${this.escapeHtml(data.tone.register)}</span>` : ''}
                ${data.tone.proximity ? `<span class="analysis-tone-tag">🤝 ${this.escapeHtml(data.tone.proximity)}</span>` : ''}
                ${data.tone.personality ? `<span class="analysis-tone-tag">🎭 ${this.escapeHtml(data.tone.personality)}</span>` : ''}
              </div>
              ${data.tone.details ? `<p>${this.escapeHtml(data.tone.details)}</p>` : ''}
            </div>
          </div>
        ` : ''}

        ${data.copywriting ? `
          <div class="analysis-card">
            <h4>✍️ Copywriting</h4>
            <div class="analysis-card-content">
              ${data.copywriting.techniques?.length ? `
                <div class="analysis-techniques">
                  ${data.copywriting.techniques.map(t => `<span class="analysis-technique-tag">${this.escapeHtml(t)}</span>`).join('')}
                </div>
              ` : ''}
              ${data.copywriting.details ? `<p>${this.escapeHtml(data.copywriting.details)}</p>` : ''}
            </div>
          </div>
        ` : ''}

        ${data.cta ? `
          <div class="analysis-card">
            <h4>🎯 CTA</h4>
            <div class="analysis-card-content">
              ${data.cta.formulation ? `<p><strong>Texte :</strong> "${this.escapeHtml(data.cta.formulation)}"</p>` : ''}
              ${data.cta.type ? `<p><strong>Type :</strong> ${this.escapeHtml(data.cta.type)}</p>` : ''}
              ${data.cta.placement ? `<p><strong>Placement :</strong> ${this.escapeHtml(data.cta.placement)}</p>` : ''}
              ${data.cta.effectiveness ? `<p><strong>Efficacité :</strong> ${this.escapeHtml(data.cta.effectiveness)}</p>` : ''}
            </div>
          </div>
        ` : ''}

        ${data.strengths?.length ? `
          <div class="analysis-card analysis-card-success">
            <h4>✅ Points forts</h4>
            <div class="analysis-card-content">
              <ul class="analysis-list">${data.strengths.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}</ul>
            </div>
          </div>
        ` : ''}

        ${data.improvements?.length ? `
          <div class="analysis-card analysis-card-warning">
            <h4>⚠️ Améliorations</h4>
            <div class="analysis-card-content">
              <ul class="analysis-list">${data.improvements.map(s => `<li>${this.escapeHtml(s)}</li>`).join('')}</ul>
            </div>
          </div>
        ` : ''}

        ${data.actionable_rules?.length ? `
          <div class="analysis-card">
            <h4>💡 Règles actionnables</h4>
            <div class="analysis-card-content">
              ${data.actionable_rules.map(r => `
                <div class="actionable-rule">
                  <span class="rule-badge" style="background: ${categoryColors[r.category] || '#667eea'}22; color: ${categoryColors[r.category] || '#667eea'}">${this.escapeHtml(r.category || '')}</span>
                  <div class="rule-text">
                    <strong>${this.escapeHtml(r.rule || '')}</strong>
                    ${r.example ? `<div class="rule-example">"${this.escapeHtml(r.example)}"</div>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  renderAnalysisHistory() {
    return `
      <div class="analysis-history">
        <h4 class="analysis-history-title">📂 Analyses précédentes</h4>
        <div class="analysis-history-list">
          ${this.savedAnalyses.slice(0, 5).map(entry => `
            <div class="analysis-history-item" onclick="newsletterModule.loadAnalysis('${entry.id}')">
              <div class="analysis-history-info">
                <span class="analysis-history-source">${this.escapeHtml(entry.source || 'Sans source')}</span>
                <span class="analysis-history-date">${new Date(entry.createdAt).toLocaleDateString('fr-FR')}</span>
              </div>
              ${entry.subject ? `<div class="analysis-history-subject">${this.escapeHtml(entry.subject)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  loadAnalysis(id) {
    const entry = this.savedAnalyses.find(a => a.id === id);
    if (entry) {
      this.analysisResult = entry.analysis;
      this._analysisSource = entry.source || '';
      this._analysisSubject = entry.subject || '';
      this.render();
    }
  }

  copyAnalysis() {
    if (!this.analysisResult) return;
    const data = this.analysisResult;

    let text = '📊 ANALYSE DE NEWSLETTER\n\n';

    if (data.structure) {
      text += '🏗️ STRUCTURE\n' + (data.structure.summary || '') + '\n';
      if (data.structure.sections?.length) text += 'Sections : ' + data.structure.sections.join(' → ') + '\n';
      text += '\n';
    }
    if (data.hook) {
      text += '🪝 HOOK / ACCROCHE\n';
      if (data.hook.subject_analysis) text += 'Objet : ' + data.hook.subject_analysis + '\n';
      if (data.hook.opening_analysis) text += 'Accroche : ' + data.hook.opening_analysis + '\n';
      if (data.hook.score) text += 'Score : ' + data.hook.score + '\n';
      if (data.hook.why) text += data.hook.why + '\n';
      text += '\n';
    }
    if (data.tone) {
      text += '🎤 TON & VOIX\n';
      if (data.tone.register) text += 'Registre : ' + data.tone.register + '\n';
      if (data.tone.personality) text += 'Personnalité : ' + data.tone.personality + '\n';
      if (data.tone.proximity) text += 'Proximité : ' + data.tone.proximity + '\n';
      if (data.tone.details) text += data.tone.details + '\n';
      text += '\n';
    }
    if (data.copywriting) {
      text += '✍️ COPYWRITING\n';
      if (data.copywriting.techniques?.length) text += 'Techniques : ' + data.copywriting.techniques.join(', ') + '\n';
      if (data.copywriting.details) text += data.copywriting.details + '\n';
      text += '\n';
    }
    if (data.cta) {
      text += '🎯 CTA\n';
      if (data.cta.formulation) text += 'Texte : "' + data.cta.formulation + '"\n';
      if (data.cta.type) text += 'Type : ' + data.cta.type + '\n';
      if (data.cta.effectiveness) text += 'Efficacité : ' + data.cta.effectiveness + '\n';
      text += '\n';
    }
    if (data.strengths?.length) {
      text += '✅ POINTS FORTS\n' + data.strengths.map(s => '• ' + s).join('\n') + '\n\n';
    }
    if (data.improvements?.length) {
      text += '⚠️ AMÉLIORATIONS\n' + data.improvements.map(s => '• ' + s).join('\n') + '\n\n';
    }
    if (data.actionable_rules?.length) {
      text += '💡 RÈGLES ACTIONNABLES\n' + data.actionable_rules.map(r =>
        `[${r.category}] ${r.rule}${r.example ? ' — Ex: "' + r.example + '"' : ''}`
      ).join('\n') + '\n';
    }

    this.copy(text.trim());
  }

  renderProgressSteps() {
    const steps = [
      { num: 1, label: 'Type', icon: '📋' },
      { num: 2, label: 'Structure', icon: '🏗️' },
      { num: 3, label: 'Voix', icon: '🎤' },
      { num: 4, label: 'Détails', icon: '✍️' },
      { num: 5, label: 'Résultat', icon: '✨' }
    ];

    return steps.map(step => `
      <div class="progress-step ${this.currentStep >= step.num ? 'active' : ''} ${this.currentStep === step.num ? 'current' : ''}">
        <div class="step-icon">${step.icon}</div>
        <div class="step-label">${step.label}</div>
      </div>
    `).join('');
  }

  renderCurrentStep() {
    switch(this.currentStep) {
      case 1: return this.renderStep1Type();
      case 2: return this.renderStep2Structure();
      case 3: return this.renderStep3Voice();
      case 4: return this.renderStep4Details();
      case 5: return this.renderStep5Result();
      default: return '';
    }
  }

  // ============================================================
  // ÉTAPE 1 : TYPE DE NEWSLETTER
  // ============================================================

  renderStep1Type() {
    return `
      <div class="step-content">
        <h3 class="step-title">Quel type de newsletter veux-tu créer ?</h3>
        <p class="step-description">Choisis le type qui correspond à ton objectif</p>

        <div class="type-grid">
          ${this.types.map(type => `
            <div class="type-card ${this.formData.newsletterType === type.id ? 'selected' : ''}"
                 onclick="newsletterModule.selectType('${type.id}')">
              <div class="type-icon">${type.icon}</div>
              <div class="type-name">${type.name}</div>
              <div class="type-description">${type.description}</div>
              ${type.example ? `
                <div class="type-example">
                  <div class="example-label">📧 Exemple :</div>
                  <div class="example-subject">${type.example.subject}</div>
                  <div class="example-preview">${type.example.preview}</div>
                </div>
              ` : ''}
              ${type.bestStructures ? `
                <div class="type-hint">
                  💡 Structures recommandées: ${type.bestStructures.slice(0, 2).join(', ').toUpperCase()}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <!-- Mode Séquence -->
        <div class="sequence-option">
          <label class="sequence-toggle">
            <input type="checkbox" id="sequence-mode" ${this.isSequenceMode ? 'checked' : ''}
                   onchange="newsletterModule.toggleSequenceMode(this.checked)">
            <span class="toggle-text">
              <strong>Mode Séquence</strong>
              <span class="sequence-tooltip" title="Génère 3-7 emails liés racontant une histoire cohérente sur plusieurs jours (ex: séquence de nurturing sur 2 semaines, lancement en 5 emails...)">ⓘ</span>
              <small>Génère plusieurs emails liés avec un arc narratif cohérent</small>
            </span>
          </label>

          ${this.isSequenceMode ? `
            <div class="sequence-count">
              <label>Nombre d'emails dans la séquence:</label>
              <div class="count-selector">
                ${[2, 3, 4, 5, 6, 7].map(n => `
                  <button class="count-btn ${this.formData.sequenceCount === n ? 'active' : ''}"
                          onclick="newsletterModule.setSequenceCount(${n})">${n}</button>
                `).join('')}
              </div>
              <div class="sequence-arc-preview">
                ${this.renderSequenceArcPreview()}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  selectType(typeId) {
    this.formData.newsletterType = typeId;

    // Recommander une structure basée sur le type
    const type = this.types.find(t => t.id === typeId);
    if (type?.bestStructures?.length > 0) {
      this.formData.recommendedStructure = type.bestStructures[0];
    }

    this.render();
  }

  toggleSequenceMode(enabled) {
    this.isSequenceMode = enabled;
    if (enabled && !this.formData.sequenceCount) {
      this.formData.sequenceCount = 5;
    }
    this.render();
  }

  setSequenceCount(count) {
    this.formData.sequenceCount = count;
    this.render();
  }

  renderSequenceArcPreview() {
    const count = this.formData.sequenceCount || 5;
    const type = this.formData.newsletterType || 'launch';

    const arcs = {
      launch: ['Teasing', 'Valeur', 'Offre', 'Urgence', 'Dernier rappel', 'Bonus', 'Clôture'],
      promo: ['Teasing', 'Offre', 'Valeur', 'Urgence', 'Dernier rappel', 'Bonus', 'Clôture'],
      nurturing: ['Valeur', 'Valeur', 'Valeur', 'Offre douce', 'Valeur', 'Valeur', 'Valeur'],
      event: ['Annonce', 'Valeur', 'Détails', 'Urgence', 'Dernier rappel', 'J-1', 'Post-event'],
      reengagement: ['Tu nous manques', 'Valeur', 'Offre spéciale', 'Urgence', 'Dernier rappel'],
      storytelling: ['Teaser', 'Histoire P1', 'Suite', 'Révélation', 'Offre', 'Valeur', 'Clôture']
    };

    const arc = (arcs[type] || arcs.launch).slice(0, count);

    return `
      <div class="arc-preview">
        <span class="arc-label">Arc narratif:</span>
        <div class="arc-steps">
          ${arc.map((step, i) => `
            <span class="arc-step">
              <span class="arc-num">${i + 1}</span>
              ${step}
            </span>
            ${i < arc.length - 1 ? '<span class="arc-arrow">→</span>' : ''}
          `).join('')}
        </div>
      </div>
    `;
  }

  // ============================================================
  // ÉTAPE 2 : STRUCTURE COPYWRITING
  // ============================================================

  renderStep2Structure() {
    return `
      <div class="step-content">
        <h3 class="step-title">Quelle structure copywriting utiliser ?</h3>
        <p class="step-description">
          ${this.formData.recommendedStructure ?
            `<span class="recommendation">💡 Recommandé pour ce type: <strong>${this.formData.recommendedStructure.toUpperCase()}</strong></span>` :
            'Choisis la structure qui correspond à ton message'}
        </p>

        <div class="structure-grid">
          ${this.structures.map(structure => `
            <div class="structure-card ${this.formData.structure === structure.id ? 'selected' : ''}
                        ${this.formData.recommendedStructure === structure.id ? 'recommended' : ''}"
                 onclick="newsletterModule.selectStructure('${structure.id}')">
              <div class="structure-header">
                <span class="structure-icon">${structure.icon}</span>
                <span class="structure-name">${structure.name}</span>
                ${this.formData.recommendedStructure === structure.id ? '<span class="rec-badge">Recommandé</span>' : ''}
              </div>
              <div class="structure-fullname">${structure.fullName}</div>
              <div class="structure-description">${structure.description}</div>
              <div class="structure-steps">
                ${structure.steps.map(step => `<div class="structure-step">• ${step}</div>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  selectStructure(structureId) {
    this.formData.structure = structureId;
    this.render();
  }

  // ============================================================
  // ÉTAPE 3 : PERSONNALISATION DE LA VOIX
  // ============================================================

  renderStep3Voice() {
    const hasSavedVoice = this.hasSavedVoice();

    return `
      <div class="step-content">
        <h3 class="step-title">Personnalise la voix de ta newsletter</h3>
        <p class="step-description">L'IA va adapter le contenu à ton style d'écriture</p>

        <!-- Choix du ton -->
        <div class="voice-section">
          <h4 class="section-label">Ton de l'email</h4>
          <div class="tone-grid">
            ${this.tones.map(tone => `
              <div class="tone-card ${this.formData.tone === tone.id ? 'selected' : ''}"
                   onclick="newsletterModule.selectTone('${tone.id}')">
                <span class="tone-icon">${tone.icon}</span>
                <span class="tone-name">${tone.name}</span>
                <span class="tone-desc">${tone.description}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Bouton MA VOIX -->
        <div class="voice-section ma-voix-section">
          <h4 class="section-label">🎤 Utiliser ta voix personnalisée</h4>
          <div class="ma-voix-option">
            <button class="btn-ma-voix ${hasSavedVoice ? '' : 'disabled'}"
                    onclick="newsletterModule.useSavedVoice()"
                    ${hasSavedVoice ? '' : 'disabled'}>
              <span class="ma-voix-icon">🎤</span>
              <span class="ma-voix-text">
                <strong>Utiliser MA VOIX</strong>
                <small>${hasSavedVoice ? 'Tes textes et ton style seront utilisés' : 'Aucune voix sauvegardée'}</small>
              </span>
            </button>
            ${!hasSavedVoice ? `
              <p class="ma-voix-hint">
                💡 Pour utiliser cette option, va dans l'onglet <strong>MA VOIX</strong> et entre des exemples de tes textes.
              </p>
            ` : ''}
            ${this.formData.customVoice && (this.formData.customVoice.includes('Exemples de mon style') || this.formData.customVoice.includes('Mon profil de voix')) ? `
              <div class="ma-voix-active">
                ✅ MA VOIX est activée pour cette newsletter
              </div>
              <div class="ma-voix-preview">
                <h5>📋 Aperçu de ta voix chargée :</h5>
                <div class="ma-voix-preview-content">
                  ${this.renderVoicePreview()}
                </div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Profil de voix existant -->
        ${this.voices.length > 0 ? `
          <div class="voice-section">
            <h4 class="section-label">Utiliser un profil MA VOIX existant</h4>
            <div class="voice-profiles">
              <div class="voice-profile-card ${!this.formData.voiceId ? 'selected' : ''}"
                   onclick="newsletterModule.selectVoice(null)">
                <span class="voice-icon">✏️</span>
                <span class="voice-name">Écrire manuellement</span>
              </div>
              ${this.voices.map(voice => `
                <div class="voice-profile-card ${this.formData.voiceId === voice.id ? 'selected' : ''}"
                     onclick="newsletterModule.selectVoice('${voice.id}')">
                  <span class="voice-icon">🎤</span>
                  <span class="voice-name">${voice.name}</span>
                  ${voice.is_default ? '<span class="default-badge">Par défaut</span>' : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Description personnalisée de la voix -->
        ${!this.formData.voiceId ? `
          <div class="voice-section">
            <h4 class="section-label">Décris ton style d'écriture (optionnel)</h4>
            <textarea class="voice-textarea" id="custom-voice"
                      placeholder="Ex: Je parle de manière directe et chaleureuse. J'utilise beaucoup de questions rhétoriques. Je ponctue mes textes d'émojis subtils. Mon vocabulaire est accessible mais précis..."
                      oninput="newsletterModule.updateCustomVoice(this.value)">${this.formData.customVoice || ''}</textarea>
            <div class="voice-hint">
              💡 Plus ta description est précise, plus l'IA reproduira fidèlement ton style.
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  selectTone(toneId) {
    this.formData.tone = toneId;
    this.render();
  }

  selectVoice(voiceId) {
    this.formData.voiceId = voiceId;
    if (voiceId) {
      this.formData.customVoice = null;
    }
    this.render();
  }

  updateCustomVoice(value) {
    this.formData.customVoice = value;
  }

  // ============================================================
  // ÉTAPE 4 : DÉTAILS DE LA NEWSLETTER
  // ============================================================

  renderStep4Details() {
    return `
      <div class="step-content">
        <h3 class="step-title">Les détails de ta newsletter</h3>
        <p class="step-description">Ces informations permettront à l'IA de créer un contenu ultra-pertinent</p>

        <div class="details-form">
          <!-- Objectif -->
          <div class="form-group required">
            <label>🎯 Objectif de cette newsletter</label>
            <textarea id="objective" placeholder="Ex: Annoncer le lancement de ma nouvelle formation et générer des inscriptions à la liste d'attente"
                      oninput="newsletterModule.updateField('objective', this.value)">${this.formData.objective || ''}</textarea>
          </div>

          <!-- Produit/Service -->
          <div class="form-group">
            <label>📦 Produit / Service / Sujet concerné</label>
            <textarea id="productService" placeholder="Ex: Formation 'Personal Branding Mastery' - 6 semaines pour construire une marque personnelle qui attire les clients"
                      oninput="newsletterModule.updateField('productService', this.value)">${this.formData.productService || ''}</textarea>
          </div>

          <!-- Cible -->
          <div class="form-group required">
            <label>👥 À qui tu parles (ta cible)</label>
            <textarea id="targetAudience" placeholder="Ex: Entrepreneurs et freelances qui veulent se démarquer sur LinkedIn mais ne savent pas par où commencer"
                      oninput="newsletterModule.updateField('targetAudience', this.value)">${this.formData.targetAudience || ''}</textarea>
          </div>

          <!-- CTA -->
          <div class="form-group-row">
            <div class="form-group">
              <label>🔘 Action attendue (CTA)</label>
              <select id="ctaType" onchange="newsletterModule.updateField('ctaType', this.value)">
                <option value="">Choisir...</option>
                <option value="click_link" ${this.formData.ctaType === 'click_link' ? 'selected' : ''}>Cliquer sur un lien</option>
                <option value="reply" ${this.formData.ctaType === 'reply' ? 'selected' : ''}>Répondre à l'email</option>
                <option value="purchase" ${this.formData.ctaType === 'purchase' ? 'selected' : ''}>Acheter</option>
                <option value="register" ${this.formData.ctaType === 'register' ? 'selected' : ''}>S'inscrire</option>
                <option value="download" ${this.formData.ctaType === 'download' ? 'selected' : ''}>Télécharger</option>
                <option value="book_call" ${this.formData.ctaType === 'book_call' ? 'selected' : ''}>Réserver un appel</option>
              </select>
            </div>
            <div class="form-group">
              <label>📝 Texte du bouton CTA</label>
              <input type="text" id="ctaText" placeholder="Ex: Je m'inscris maintenant"
                     value="${this.formData.ctaText || ''}"
                     oninput="newsletterModule.updateField('ctaText', this.value)">
            </div>
          </div>

          <!-- URL du CTA -->
          ${this.formData.ctaType === 'click_link' || this.formData.ctaType === 'register' || this.formData.ctaType === 'purchase' ? `
            <div class="form-group">
              <label>🔗 URL du lien</label>
              <input type="url" id="ctaUrl" placeholder="https://..."
                     value="${this.formData.ctaUrl || ''}"
                     oninput="newsletterModule.updateField('ctaUrl', this.value)">
            </div>
          ` : ''}

          <!-- Anecdote (optionnel) -->
          <div class="form-group optional">
            <label>✨ Anecdote ou élément personnel à intégrer (optionnel)</label>
            <textarea id="anecdote" placeholder="Ex: La semaine dernière, un client m'a dit que grâce à mes conseils, il avait décroché 3 nouveaux contrats en un mois..."
                      oninput="newsletterModule.updateField('anecdote', this.value)">${this.formData.anecdote || ''}</textarea>
            <div class="form-hint">Une histoire vraie rend ton email plus authentique et mémorable</div>
          </div>
        </div>

        <!-- Récap -->
        <div class="generation-preview">
          <h4>📋 Récapitulatif</h4>
          <div class="preview-items">
            <div class="preview-item">
              <span class="preview-label">Type:</span>
              <span class="preview-value">${this.getTypeName(this.formData.newsletterType)}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">Structure:</span>
              <span class="preview-value">${this.getStructureName(this.formData.structure)}</span>
            </div>
            <div class="preview-item">
              <span class="preview-label">Ton:</span>
              <span class="preview-value">${this.getToneName(this.formData.tone)}</span>
            </div>
            ${this.isSequenceMode ? `
              <div class="preview-item">
                <span class="preview-label">Séquence:</span>
                <span class="preview-value">${this.formData.sequenceCount} emails</span>
              </div>
            ` : ''}
            ${this.selectedClient ? `
              <div class="preview-item">
                <span class="preview-label">Client:</span>
                <span class="preview-value">${this.selectedClient.name}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  updateField(field, value) {
    this.formData[field] = value;
  }

  // ============================================================
  // ÉTAPE 5 : RÉSULTAT GÉNÉRÉ
  // ============================================================

  renderStep5Result() {
    if (!this.generatedContent) {
      return `
        <div class="step-content loading-state">
          <div class="generation-loader">
            <div class="loader-animation"></div>
            <h3>✨ Génération en cours...</h3>
            <p>L'IA rédige ta newsletter parfaite</p>
          </div>
        </div>
      `;
    }

    if (this.isSequenceMode && this.sequenceEmails.length > 0) {
      return this.renderSequenceResult();
    }

    return this.renderSingleEmailResult();
  }

  renderSingleEmailResult() {
    const email = this.generatedContent.newsletter || this.generatedContent;

    return `
      <div class="step-content result-content">
        <div class="result-header">
          <h3 class="step-title">🎉 Ta newsletter est prête !</h3>
          <div class="result-actions">
            <button class="btn-icon" onclick="newsletterModule.regenerate()" title="Régénérer">
              🔄
            </button>
            <button class="btn-icon" onclick="newsletterModule.copyAll()" title="Tout copier">
              📋
            </button>
            <button class="btn-secondary" onclick="newsletterModule.saveNewsletter()">
              💾 Sauvegarder
            </button>
            <button class="btn-secondary" onclick="newsletterModule.saveAsTemplate()">
              📑 Créer un template
            </button>
          </div>
        </div>

        <!-- Objets d'email -->
        <div class="result-section">
          <h4 class="section-title">📬 Objets d'email (choisis-en un)</h4>
          <div class="subject-options">
            ${(email.subjectLines || []).map((subject, i) => `
              <div class="subject-option ${this.formData.selectedSubject === i ? 'selected' : ''}"
                   onclick="newsletterModule.selectSubject(${i})">
                <span class="subject-num">${i + 1}</span>
                <span class="subject-text" contenteditable="true"
                      onblur="newsletterModule.updateSubject(${i}, this.innerText)">${this.escapeHtml(subject)}</span>
                <button class="copy-btn" onclick="event.stopPropagation(); newsletterModule.copySubject(${i})">📋</button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Preview Text -->
        <div class="result-section">
          <h4 class="section-title">👁️ Preview Text</h4>
          <div class="preview-text-box">
            <span contenteditable="true"
                  onblur="newsletterModule.updatePreviewText(this.innerText)">${this.escapeHtml(email.previewText || '')}</span>
            <button class="copy-btn" onclick="newsletterModule.copyPreview()">📋</button>
          </div>
        </div>

        <!-- Corps de l'email -->
        <div class="result-section">
          <h4 class="section-title">✉️ Corps de l'email</h4>
          <div class="email-body-box">
            <div class="email-content" contenteditable="true"
                 onblur="newsletterModule.updateBody(this.innerHTML)">${this.formatEmailBody(email.body)}</div>
          </div>
          <div class="body-actions">
            <button class="btn-small" onclick="newsletterModule.copyBody()">
              📋 Copier le texte
            </button>
            <button class="btn-small" onclick="newsletterModule.copyAsHTML()">
              🌐 Copier en HTML
            </button>
          </div>
        </div>

        <!-- CTA -->
        <div class="result-section">
          <h4 class="section-title">🔘 Call-to-Action</h4>
          <div class="cta-preview">
            <button class="cta-button-preview">${this.escapeHtml(email.cta || this.formData.ctaText || 'Découvrir')}</button>
            ${this.formData.ctaUrl ? `<span class="cta-url">→ ${this.escapeHtml(this.formData.ctaUrl)}</span>` : ''}
          </div>
        </div>

        <!-- Ajustements -->
        <div class="result-section adjustments">
          <h4 class="section-title">⚙️ Ajuster le résultat</h4>
          <div class="adjustment-options">
            <button class="adjust-btn" onclick="newsletterModule.adjustTone('plus court')">Plus court</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustTone('plus long')">Plus long</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustTone('plus chaleureux')">Plus chaleureux</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustTone('plus direct')">Plus direct</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustTone('ajoute de urgence')">+ Urgence</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustTone('plus de storytelling')">+ Storytelling</button>
          </div>
          <div class="custom-adjustment">
            <input type="text" id="custom-adjust" placeholder="Autre ajustement personnalisé...">
            <button class="btn-primary" onclick="newsletterModule.adjustTone(document.getElementById('custom-adjust').value)">
              Appliquer
            </button>
          </div>
        </div>

        </div>
    `;
  }

  renderSequenceResult() {
    return `
      <div class="step-content result-content sequence-result">
        <div class="result-header">
          <h3 class="step-title">🎉 Ta séquence de ${this.sequenceEmails.length} emails est prête !</h3>
          <div class="result-actions">
            <button class="btn-secondary" onclick="newsletterModule.saveNewsletter()">
              💾 Sauvegarder la séquence
            </button>
          </div>
        </div>

        <!-- Tabs pour les emails -->
        <div class="sequence-tabs">
          ${this.sequenceEmails.map((email, i) => `
            <button class="sequence-tab ${this.currentEmailIndex === i ? 'active' : ''}"
                    onclick="newsletterModule.showEmail(${i})">
              <span class="tab-num">${i + 1}</span>
              <span class="tab-role">${email.role || `Email ${i + 1}`}</span>
            </button>
          `).join('')}
        </div>

        <!-- Contenu de l'email sélectionné -->
        <div class="sequence-email-content">
          ${this.renderEmailContent(this.sequenceEmails[this.currentEmailIndex], this.currentEmailIndex)}
        </div>

        <!-- Navigation séquence -->
        <div class="sequence-nav">
          ${this.currentEmailIndex > 0 ? `
            <button class="btn-secondary" onclick="newsletterModule.showEmail(${this.currentEmailIndex - 1})">
              ← Email précédent
            </button>
          ` : '<div></div>'}
          ${this.currentEmailIndex < this.sequenceEmails.length - 1 ? `
            <button class="btn-secondary" onclick="newsletterModule.showEmail(${this.currentEmailIndex + 1})">
              Email suivant →
            </button>
          ` : '<div></div>'}
        </div>

        <!-- Ajustements pour l'email actuel -->
        <div class="result-section adjustments">
          <h4 class="section-title">⚙️ Ajuster l'email ${this.currentEmailIndex + 1}</h4>
          <div class="adjustment-options">
            <button class="adjust-btn" onclick="newsletterModule.adjustSequenceEmail('plus court')">Plus court</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustSequenceEmail('plus long')">Plus long</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustSequenceEmail('plus chaleureux')">Plus chaleureux</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustSequenceEmail('plus direct')">Plus direct</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustSequenceEmail('ajoute de urgence')">+ Urgence</button>
            <button class="adjust-btn" onclick="newsletterModule.adjustSequenceEmail('plus de storytelling')">+ Storytelling</button>
          </div>
          <div class="custom-adjustment">
            <input type="text" id="custom-adjust-seq" placeholder="Autre ajustement personnalisé...">
            <button class="btn-primary" onclick="newsletterModule.adjustSequenceEmail(document.getElementById('custom-adjust-seq').value)">
              Appliquer
            </button>
          </div>
        </div>

        </div>
    `;
  }

  renderEmailContent(email, index) {
    if (!email) return '<div class="no-email">Email non disponible</div>';

    return `
      <div class="email-result-card">
        <div class="email-role-badge">${this.escapeHtml(email.role || `Email ${index + 1}`)}</div>
        ${email.sendDelay ? `<div class="send-delay">📅 ${this.escapeHtml(email.sendDelay)}</div>` : ''}

        <div class="result-section">
          <h4>📬 Objets</h4>
          <div class="subject-options compact">
            ${(email.subjectLines || []).map((subject, i) => `
              <div class="subject-option">
                <span class="subject-text">${this.escapeHtml(subject)}</span>
                <button class="copy-btn" onclick="newsletterModule.copySequenceSubject(${index}, ${i})">📋</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="result-section">
          <h4>👁️ Preview</h4>
          <div class="preview-text-box">${this.escapeHtml(email.previewText || '')}</div>
        </div>

        <div class="result-section">
          <h4>✉️ Corps</h4>
          <div class="email-body-box">
            <div class="email-content">${this.formatEmailBody(email.body)}</div>
          </div>
        </div>

        <div class="result-section">
          <h4>🔘 CTA</h4>
          <button class="cta-button-preview">${this.escapeHtml(email.cta || 'Découvrir')}</button>
        </div>
      </div>
    `;
  }

  showEmail(index) {
    this.currentEmailIndex = index;
    this.render();
  }

  // ============================================================
  // GÉNÉRATION (utilise callAI de l'app principale)
  // ============================================================

  async generate() {
    // Vérifier la limite freemium pour les newsletters
    if (window.FreemiumSystem && !window.FreemiumSystem.canGenerateNewsletter()) {
      window.FreemiumSystem.showPaywall('newsletters');
      return;
    }

    this.currentStep = 5;
    this.generatedContent = null;
    this.render();

    try {
      // Vérifier que callAI est disponible
      if (typeof window.callAI !== 'function') {
        throw new Error('La fonction callAI n\'est pas disponible. Recharge la page.');
      }

      // Construire le prompt pour la génération
      const prompt = this.buildGenerationPrompt();
      console.log('📧 Newsletter - Prompt envoyé:', prompt.substring(0, 300) + '...');

      // Appeler l'IA via la fonction globale de l'app
      const response = await window.callAI(prompt);
      console.log('📧 Newsletter - Réponse reçue, longueur:', response?.length || 0);

      if (!response) {
        throw new Error('Réponse vide de l\'IA');
      }

      // Parser la réponse JSON
      const parsed = this.parseAIResponse(response);
      console.log('📧 Newsletter - Contenu parsé:', {
        hasSubjects: parsed.subjectLines?.length > 0,
        hasPreview: !!parsed.previewText,
        hasBody: !!parsed.body,
        bodyLength: parsed.body?.length || 0
      });

      // Gérer le cas où l'IA renvoie une séquence même si pas demandé
      if (parsed.sequence && Array.isArray(parsed.sequence) && parsed.sequence.length > 0) {
        console.log('📧 Newsletter - Séquence détectée avec', parsed.sequence.length, 'emails');
        this.sequenceEmails = parsed.sequence;

        if (this.isSequenceMode) {
          // Mode séquence : garder tous les emails
          this.generatedContent = parsed;
        } else {
          // Pas en mode séquence : prendre le premier email
          const firstEmail = parsed.sequence[0];
          this.generatedContent = { newsletter: firstEmail };
          console.log('📧 Newsletter - Utilisation du premier email:', firstEmail);
        }
      } else if (this.isSequenceMode) {
        // Mode séquence demandé mais réponse simple
        this.sequenceEmails = [parsed];
        this.generatedContent = { sequence: [parsed] };
      } else {
        // Email simple
        this.generatedContent = { newsletter: parsed };
      }

      // Vérifier que le contenu est bien présent
      const newsletter = this.generatedContent?.newsletter;
      console.log('📧 Newsletter - Contenu final:', {
        hasNewsletter: !!newsletter,
        subjectLines: newsletter?.subjectLines,
        previewText: newsletter?.previewText?.substring(0, 50),
        bodyLength: newsletter?.body?.length || 0
      });

      if (!newsletter?.body && !this.isSequenceMode) {
        console.warn('📧 Newsletter - Body vide après parsing!');
      }

      // Incrémenter le compteur freemium après génération réussie
      if (window.FreemiumSystem && typeof window.FreemiumSystem.incrementNewsletters === 'function') {
        await window.FreemiumSystem.incrementNewsletters();
      }

      this.render();
    } catch (error) {
      console.error('📧 Newsletter - Erreur génération:', error);
      this.showError('Erreur lors de la génération: ' + error.message);

      // Revenir à l'étape 4 pour permettre de réessayer
      this.currentStep = 4;
      this.render();
    }
  }

  buildGenerationPrompt() {
    const type = this.types.find(t => t.id === this.formData.newsletterType);
    const structure = this.structures.find(s => s.id === this.formData.structure);
    const tone = this.tones.find(t => t.id === this.formData.tone);

    let prompt = `Tu es un expert en copywriting et email marketing. Génère une newsletter professionnelle.

## PARAMÈTRES
- Type: ${type?.name || this.formData.newsletterType} - ${type?.description || ''}
- Structure: ${structure?.name || this.formData.structure} (${structure?.fullName || ''})
  Étapes: ${structure?.steps?.join(' → ') || ''}
- Ton: ${tone?.name || this.formData.tone} - ${tone?.description || ''}

## DÉTAILS
- Objectif: ${this.formData.objective || 'Non spécifié'}
- Produit/Service: ${this.formData.productService || 'Non spécifié'}
- Cible: ${this.formData.targetAudience || 'Non spécifié'}
- CTA souhaité: ${this.formData.ctaText || 'Non spécifié'}
${this.formData.anecdote ? `- Anecdote à intégrer: ${this.formData.anecdote}` : ''}

## STYLE D'ÉCRITURE
${this.formData.customVoice || 'Style professionnel et engageant'}

## FORMAT DE RÉPONSE (JSON strict)
Réponds UNIQUEMENT avec ce JSON, sans texte avant ou après:
{
  "subjectLines": ["Objet 1 accrocheur", "Objet 2 alternatif", "Objet 3 avec curiosité"],
  "previewText": "Texte de prévisualisation (max 90 caractères)",
  "body": "Corps de l'email complet avec sauts de ligne (\\n\\n pour paragraphes)",
  "cta": "${this.formData.ctaText || 'Découvrir'}"
}

Génère une newsletter ${tone?.name || 'engageante'} qui suit la structure ${structure?.name || 'AIDA'}.`;

    if (this.isSequenceMode) {
      const count = this.formData.sequenceCount || 5;
      prompt = `Tu es un expert en copywriting et séquences email. Génère une séquence de ${count} emails cohérents.

## PARAMÈTRES
- Type de séquence: ${type?.name || this.formData.newsletterType}
- Structure par email: ${structure?.name || 'AIDA'}
- Ton général: ${tone?.name || 'Chaleureux'}

## DÉTAILS
- Objectif: ${this.formData.objective || 'Non spécifié'}
- Produit/Service: ${this.formData.productService || 'Non spécifié'}
- Cible: ${this.formData.targetAudience || 'Non spécifié'}
${this.formData.anecdote ? `- Anecdote à intégrer: ${this.formData.anecdote}` : ''}

## STYLE D'ÉCRITURE
${this.formData.customVoice || 'Style professionnel et engageant'}

## FORMAT DE RÉPONSE (JSON strict)
Réponds UNIQUEMENT avec ce JSON:
{
  "sequence": [
    {
      "role": "Email 1 - [Rôle dans la séquence]",
      "sendDelay": "J+0",
      "subjectLines": ["Objet 1", "Objet 2"],
      "previewText": "Preview...",
      "body": "Corps de l'email...",
      "cta": "CTA..."
    }
  ]
}

Génère exactement ${count} emails avec une progression logique.`;
    }

    return prompt;
  }

  parseAIResponse(response) {
    console.log('📧 Newsletter - Réponse IA brute:', response);

    try {
      // Si déjà un objet, vérifier qu'il a les bonnes propriétés
      if (typeof response === 'object' && response !== null) {
        if (response.body || response.subjectLines) {
          return this.validateEmailStructure(response);
        }
        if (response.newsletter) {
          return this.validateEmailStructure(response.newsletter);
        }
      }

      // Si c'est une chaîne, nettoyer et parser
      let cleaned = String(response).trim();
      console.log('📧 Newsletter - Texte à parser:', cleaned.substring(0, 500));

      // Enlever les code blocks markdown (plusieurs formats possibles)
      cleaned = cleaned
        .replace(/^```json\s*\n?/i, '')
        .replace(/^```\s*\n?/, '')
        .replace(/\n?\s*```\s*$/g, '');

      // Chercher le JSON dans la réponse - pattern plus flexible
      const jsonPatterns = [
        /\{[\s\S]*"subjectLines"\s*:\s*\[[\s\S]*\][\s\S]*"body"\s*:[\s\S]*\}/,
        /\{[\s\S]*"body"\s*:[\s\S]*"subjectLines"\s*:\s*\[[\s\S]*\][\s\S]*\}/,
        /\{\s*"subjectLines"[\s\S]*\}/,
        /\{\s*"body"[\s\S]*\}/
      ];

      for (const pattern of jsonPatterns) {
        const match = cleaned.match(pattern);
        if (match) {
          console.log('📧 Newsletter - JSON trouvé avec pattern');
          try {
            const parsed = JSON.parse(match[0]);
            console.log('📧 Newsletter - Parsé:', parsed);
            // Si c'est une séquence, la retourner telle quelle (sans validation)
            if (parsed.sequence && Array.isArray(parsed.sequence)) {
              console.log('📧 Newsletter - Séquence détectée dans parsing, retour direct');
              return parsed;
            }
            return this.validateEmailStructure(parsed);
          } catch (parseErr) {
            console.log('📧 Newsletter - Erreur parse pattern:', parseErr.message);
          }
        }
      }

      // Essayer de parser directement
      try {
        const parsed = JSON.parse(cleaned);
        console.log('📧 Newsletter - Parse direct réussi:', parsed);
        // Si c'est une séquence, la retourner telle quelle
        if (parsed.sequence && Array.isArray(parsed.sequence)) {
          console.log('📧 Newsletter - Séquence détectée, retour direct');
          return parsed;
        }
        return this.validateEmailStructure(parsed);
      } catch (directErr) {
        console.log('📧 Newsletter - Erreur parse direct:', directErr.message);
      }

      // Extraction manuelle des champs
      console.log('📧 Newsletter - Tentative extraction manuelle');
      return this.extractFieldsManually(cleaned);

    } catch (e) {
      console.error('📧 Newsletter - Erreur parsing:', e);
      return this.extractFieldsManually(String(response));
    }
  }

  extractFieldsManually(text) {
    let subjectLines = ['Newsletter générée'];
    let previewText = '';
    let body = '';
    let cta = this.formData.ctaText || 'Découvrir';

    // Extraire subjectLines
    const subjectMatch = text.match(/"subjectLines"\s*:\s*\[([\s\S]*?)\]/);
    if (subjectMatch) {
      try {
        const subjects = subjectMatch[1].match(/"([^"]+)"/g);
        if (subjects) {
          subjectLines = subjects.map(s => s.replace(/"/g, ''));
        }
      } catch (e) {}
    }

    // Extraire previewText
    const previewMatch = text.match(/"previewText"\s*:\s*"([^"]+)"/);
    if (previewMatch) {
      previewText = previewMatch[1];
    }

    // Extraire body - plus complexe car peut contenir des \n
    const bodyMatch = text.match(/"body"\s*:\s*"([\s\S]*?)(?:"\s*[,\}])/);
    if (bodyMatch) {
      body = bodyMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }

    // Extraire cta
    const ctaMatch = text.match(/"cta"\s*:\s*"([^"]+)"/);
    if (ctaMatch) {
      cta = ctaMatch[1];
    }

    // Si pas de body extrait, utiliser le texte nettoyé
    if (!body) {
      body = this.cleanRawResponse(text);
    }

    console.log('📧 Newsletter - Extraction manuelle:', { subjectLines, previewText, bodyLength: body.length, cta });

    return {
      subjectLines,
      previewText,
      body,
      cta
    };
  }

  validateEmailStructure(obj) {
    // S'assurer que toutes les propriétés existent et sont du bon type
    let body = obj.body;

    // Si body est un objet, extraire le texte
    if (typeof body === 'object' && body !== null) {
      body = body.body || JSON.stringify(body);
    }

    // Nettoyer le body de tout JSON résiduel
    if (typeof body === 'string') {
      body = this.cleanBodyFromJson(body);
    }

    return {
      subjectLines: Array.isArray(obj.subjectLines) ? obj.subjectLines : [obj.subjectLines || 'Newsletter'],
      previewText: typeof obj.previewText === 'string' ? obj.previewText : '',
      body: body || '',
      cta: typeof obj.cta === 'string' ? obj.cta : (this.formData.ctaText || 'Découvrir')
    };
  }

  cleanBodyFromJson(text) {
    if (!text) return '';

    // Supprimer les fragments JSON qui pourraient rester dans le body
    let cleaned = text
      // Supprimer les structures JSON de séquence qui traînent
      .replace(/\s*\},?\s*\{[\s\S]*?"role"\s*:/g, '')
      .replace(/\s*\},?\s*\{[\s\S]*?"sendDelay"\s*:/g, '')
      .replace(/\s*\},?\s*\{[\s\S]*?"subjectLines"\s*:/g, '')
      // Supprimer les fins de JSON
      .replace(/"\s*,?\s*"cta"\s*:\s*"[^"]*"\s*\}[\s\S]*$/g, '')
      .replace(/"\s*\}\s*\]\s*\}\s*$/g, '')
      .replace(/\s*\]\s*\}\s*$/g, '')
      // Supprimer les propriétés JSON orphelines
      .replace(/"previewText"\s*:\s*"[^"]*",?\s*/g, '')
      .replace(/"subjectLines"\s*:\s*\[[^\]]*\],?\s*/g, '')
      .replace(/"role"\s*:\s*"[^"]*",?\s*/g, '')
      .replace(/"sendDelay"\s*:\s*"[^"]*",?\s*/g, '')
      // Nettoyer les caractères JSON résiduels
      .replace(/^\s*[\{\[\]\}]\s*/g, '')
      .replace(/\s*[\{\[\]\}]\s*$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .trim();

    return cleaned;
  }

  cleanRawResponse(text) {
    // Nettoyer une réponse brute qui n'est pas du JSON valide
    let cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '');

    // Essayer d'extraire le body d'un JSON
    const bodyMatch = cleaned.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (bodyMatch) {
      return bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }

    return this.cleanBodyFromJson(cleaned);
  }

  async regenerate() {
    this.generatedContent = null;
    this.render();
    await this.generate();
  }

  async adjustTone(adjustment) {
    if (!adjustment) return;

    this.showLoading('Ajustement en cours...');
    console.log('📧 Newsletter - Ajustement demandé:', adjustment);

    try {
      if (typeof window.callAI !== 'function') {
        throw new Error('La fonction callAI n\'est pas disponible');
      }

      const currentEmail = this.generatedContent?.newsletter || this.generatedContent;
      console.log('📧 Newsletter - Email actuel:', {
        hasBody: !!currentEmail?.body,
        bodyLength: currentEmail?.body?.length || 0
      });

      const prompt = `Tu es un expert copywriter. Modifie cette newsletter selon l'instruction donnée.

## NEWSLETTER ACTUELLE
Objet: ${currentEmail?.subjectLines?.[0] || ''}
Preview: ${currentEmail?.previewText || ''}
Corps:
${currentEmail?.body || ''}

## INSTRUCTION D'AJUSTEMENT
Rends le texte: ${adjustment}

## FORMAT DE RÉPONSE (JSON strict uniquement, pas de séquence)
Réponds UNIQUEMENT avec ce JSON, sans texte avant ou après:
{
  "subjectLines": ["Objet 1 modifié", "Objet 2 modifié", "Objet 3 modifié"],
  "previewText": "Nouveau preview...",
  "body": "Corps modifié complet...",
  "cta": "${currentEmail?.cta || 'Découvrir'}"
}`;

      const response = await window.callAI(prompt);
      console.log('📧 Newsletter - Réponse ajustement reçue, longueur:', response?.length || 0);

      let parsed = this.parseAIResponse(response);

      // Si l'IA renvoie une séquence, prendre le premier email
      if (parsed.sequence && Array.isArray(parsed.sequence) && parsed.sequence.length > 0) {
        console.log('📧 Newsletter - Ajustement: séquence détectée, extraction premier email');
        parsed = parsed.sequence[0];
      }

      console.log('📧 Newsletter - Ajustement parsé:', {
        hasBody: !!parsed?.body,
        bodyLength: parsed?.body?.length || 0,
        subjectLines: parsed?.subjectLines
      });

      this.generatedContent = { newsletter: parsed };
      this.hideLoading();
      this.render();
      this.showSuccess('✅ Newsletter ajustée !');
    } catch (error) {
      console.error('📧 Newsletter - Erreur ajustement:', error);
      this.hideLoading();
      this.showError('Erreur lors de l\'ajustement: ' + error.message);
    }
  }

  async adjustSequenceEmail(adjustment) {
    if (!adjustment) return;

    this.showLoading(`Ajustement de l'email ${this.currentEmailIndex + 1} en cours...`);
    console.log('📧 Newsletter - Ajustement séquence demandé:', adjustment, 'pour email', this.currentEmailIndex);

    try {
      if (typeof window.callAI !== 'function') {
        throw new Error('La fonction callAI n\'est pas disponible');
      }

      const currentEmail = this.sequenceEmails[this.currentEmailIndex];
      if (!currentEmail) {
        throw new Error('Email non trouvé');
      }

      const prompt = `Tu es un expert copywriter. Modifie cet email de séquence selon l'instruction donnée.

## EMAIL ACTUEL (${currentEmail.role || `Email ${this.currentEmailIndex + 1}`})
Objet: ${currentEmail.subjectLines?.[0] || ''}
Preview: ${currentEmail.previewText || ''}
Corps:
${currentEmail.body || ''}

## INSTRUCTION D'AJUSTEMENT
Rends le texte: ${adjustment}

## FORMAT DE RÉPONSE (JSON strict uniquement)
Réponds UNIQUEMENT avec ce JSON, sans texte avant ou après:
{
  "subjectLines": ["Objet 1 modifié", "Objet 2 modifié", "Objet 3 modifié"],
  "previewText": "Nouveau preview...",
  "body": "Corps modifié complet...",
  "cta": "${currentEmail.cta || 'Découvrir'}",
  "role": "${currentEmail.role || `Email ${this.currentEmailIndex + 1}`}"
}`;

      const response = await window.callAI(prompt);
      console.log('📧 Newsletter - Réponse ajustement séquence reçue');

      let parsed = this.parseAIResponse(response);

      // Si l'IA renvoie une séquence, prendre le premier email
      if (parsed.sequence && Array.isArray(parsed.sequence) && parsed.sequence.length > 0) {
        parsed = parsed.sequence[0];
      }

      // Préserver le rôle original
      parsed.role = currentEmail.role || parsed.role;

      // Mettre à jour l'email dans la séquence
      this.sequenceEmails[this.currentEmailIndex] = parsed;

      this.hideLoading();
      this.render();
      this.showSuccess(`✅ Email ${this.currentEmailIndex + 1} ajusté !`);
    } catch (error) {
      console.error('📧 Newsletter - Erreur ajustement séquence:', error);
      this.hideLoading();
      this.showError('Erreur lors de l\'ajustement: ' + error.message);
    }
  }

  hideLoading() {
    const loader = document.querySelector('.newsletter-loading-overlay');
    if (loader) loader.remove();
  }

  // ============================================================
  // SAUVEGARDE (localStorage)
  // ============================================================

  async saveNewsletter() {
    try {
      const emails = this.isSequenceMode ?
        this.sequenceEmails.map(e => ({
          subjectLines: e.subjectLines,
          previewText: e.previewText,
          body: e.body,
          cta: e.cta,
          role: e.role
        })) :
        [{
          subjectLines: this.generatedContent.newsletter?.subjectLines,
          selectedSubject: this.generatedContent.newsletter?.subjectLines?.[this.formData.selectedSubject || 0],
          previewText: this.generatedContent.newsletter?.previewText,
          body: this.generatedContent.newsletter?.body,
          cta: this.generatedContent.newsletter?.cta
        }];

      const newsletter = {
        id: Date.now().toString(),
        ...this.formData,
        isSequence: this.isSequenceMode,
        emails,
        createdAt: new Date().toISOString()
      };

      // Sauvegarder dans localStorage
      const saved = JSON.parse(localStorage.getItem('sos_newsletters') || '[]');
      saved.unshift(newsletter);
      localStorage.setItem('sos_newsletters', JSON.stringify(saved.slice(0, 50))); // Garder max 50

      this.showSuccess('Newsletter sauvegardée !');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      this.showError('Erreur lors de la sauvegarde');
    }
  }

  async saveAsTemplate() {
    const name = prompt('Nom du template:');
    if (!name) return;

    try {
      const template = {
        id: Date.now().toString(),
        name,
        description: `Template pour ${this.getTypeName(this.formData.newsletterType)}`,
        newsletter_type: this.formData.newsletterType,
        structure: this.formData.structure,
        tone: this.formData.tone,
        target_audience: this.formData.targetAudience,
        cta_type: this.formData.ctaType,
        use_count: 0,
        createdAt: new Date().toISOString()
      };

      // Sauvegarder dans localStorage
      const saved = JSON.parse(localStorage.getItem('sos_newsletter_templates') || '[]');
      saved.unshift(template);
      localStorage.setItem('sos_newsletter_templates', JSON.stringify(saved.slice(0, 20)));

      this.templates = saved;
      this.showSuccess('Template créé !');
    } catch (error) {
      console.error('Erreur création template:', error);
      this.showError('Erreur lors de la création du template');
    }
  }

  // ============================================================
  // AUTOPILOT INTEGRATION
  // ============================================================

  openAutopilotFromNewsletter() {
    // Sauvegarder le contenu de la newsletter pour l'Autopilot
    const emailContent = {
      subject: this.generatedContent?.newsletter?.subjectLines?.[0] ||
               this.generatedContent?.subjectLines?.[0] || '',
      body: this.generatedContent?.newsletter?.body ||
            this.generatedContent?.body || '',
      previewText: this.generatedContent?.newsletter?.previewText ||
                   this.generatedContent?.previewText || '',
      isSequence: this.isSequenceMode,
      sequenceEmails: this.isSequenceMode ? this.sequenceEmails : null
    };

    // Stocker temporairement pour l'Autopilot
    localStorage.setItem('sos_autopilot_email_draft', JSON.stringify(emailContent));

    // Fermer la modal Newsletter
    const modal = document.getElementById('newsletterModal');
    if (modal) modal.classList.remove('active');

    // Ouvrir l'Autopilot
    if (typeof AgentAutopilot !== 'undefined' && AgentAutopilot.openAutopilotModal) {
      AgentAutopilot.openAutopilotModal();
      this.showSuccess('Email transféré vers l\'Autopilot !');
    } else {
      this.showError('Module Autopilot non disponible');
    }
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  nextStep() {
    if (this.canProceed() && this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.render();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.render();
    }
  }

  canProceed() {
    switch(this.currentStep) {
      case 1: return !!this.formData.newsletterType;
      case 2: return !!this.formData.structure;
      case 3: return !!this.formData.tone;
      case 4: return !!this.formData.objective && !!this.formData.targetAudience;
      default: return true;
    }
  }

  backToEmailChoice() {
    // Fermer la modal Newsletter
    const modal = document.getElementById('newsletterModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';

    // Ouvrir la modal de choix
    if (typeof showEmailChoiceModal === 'function') {
      showEmailChoiceModal();
    }
  }

  // ============================================================
  // MODE AGENCY
  // ============================================================

  renderClientSelector() {
    return `
      <div class="client-selector">
        <label>Client:</label>
        <select id="client-select" onchange="newsletterModule.selectClient(this.value)">
          <option value="">-- Sélectionner un client --</option>
          ${this.clients.map(client => `
            <option value="${client.id}" ${this.selectedClient?.id === client.id ? 'selected' : ''}>
              ${client.name}${client.company ? ` (${client.company})` : ''}
            </option>
          `).join('')}
        </select>
        <button class="btn-small" onclick="newsletterModule.showAddClientModal()">+ Nouveau</button>
      </div>
    `;
  }

  selectClient(clientId) {
    this.selectedClient = this.clients.find(c => c.id === clientId) || null;

    // Charger la voix du client si elle existe
    if (this.selectedClient?.voice_description) {
      this.formData.customVoice = this.selectedClient.voice_description;
    }
    if (this.selectedClient?.tone) {
      this.formData.tone = this.selectedClient.tone;
    }

    this.render();
  }

  toggleAgencyMode() {
    this.isAgencyMode = !this.isAgencyMode;
    if (!this.isAgencyMode) {
      this.selectedClient = null;
    }
    this.render();
  }

  // ============================================================
  // TEMPLATES RAPIDES
  // ============================================================

  renderQuickTemplates() {
    return `
      <div class="quick-templates">
        <h4>📑 Templates rapides</h4>
        <div class="templates-list">
          ${this.templates.slice(0, 5).map(template => `
            <div class="template-card" onclick="newsletterModule.loadTemplate('${template.id}')">
              <span class="template-icon">${this.getTypeIcon(template.newsletter_type)}</span>
              <span class="template-name">${template.name}</span>
              <span class="template-uses">${template.use_count} utilisations</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  async loadTemplate(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    this.formData = {
      ...this.formData,
      newsletterType: template.newsletter_type,
      structure: template.structure,
      tone: template.tone,
      voiceId: template.voice_id,
      targetAudience: template.target_audience,
      ctaType: template.cta_type
    };

    this.currentStep = 4; // Aller directement aux détails
    this.render();
    this.showSuccess('Template chargé !');
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================

  formatEmailBody(body) {
    if (!body) return '';

    // Si c'est un objet, extraire le body ou convertir
    if (typeof body === 'object') {
      if (body.body) {
        body = body.body;
      } else {
        // Ne pas afficher du JSON brut
        body = JSON.stringify(body, null, 2);
      }
    }

    // Convertir en string si nécessaire
    let text = String(body);

    // Si ça ressemble à du JSON, essayer d'extraire le contenu
    if (text.trim().startsWith('{') && text.includes('"body"')) {
      try {
        const parsed = JSON.parse(text);
        text = parsed.body || text;
      } catch {
        // Ignorer l'erreur, garder le texte tel quel
      }
    }

    // Nettoyer tout JSON résiduel
    text = this.cleanBodyFromJson(text);

    // Nettoyer le markdown
    text = this.cleanMarkdown(text);

    // Formater en HTML
    return text
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  cleanMarkdown(text) {
    if (!text) return '';
    return text
      // Retirer le gras **texte** ou __texte__
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Retirer l'italique *texte* ou _texte_
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Retirer les titres # ## ###
      .replace(/^#{1,6}\s+/gm, '')
      // Retirer les listes - ou *
      .replace(/^[\-\*]\s+/gm, '• ')
      // Retirer les liens [texte](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Retirer le code `texte`
      .replace(/`([^`]+)`/g, '$1')
      .trim();
  }

  copy(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.showSuccess('Copié !');
    });
  }

  copySubject(index) {
    const email = this.generatedContent?.newsletter || this.generatedContent;
    if (email?.subjectLines?.[index]) {
      this.copy(email.subjectLines[index]);
    }
  }

  copyPreview() {
    const email = this.generatedContent?.newsletter || this.generatedContent;
    if (email?.previewText) {
      this.copy(email.previewText);
    }
  }

  copySequenceSubject(emailIndex, subjectIndex) {
    if (this.sequenceEmails?.[emailIndex]?.subjectLines?.[subjectIndex]) {
      this.copy(this.sequenceEmails[emailIndex].subjectLines[subjectIndex]);
    }
  }

  getCleanBody() {
    const email = this.generatedContent?.newsletter || this.generatedContent;
    if (!email?.body) return '';
    return this.cleanBodyFromJson(String(email.body));
  }

  copyBody() {
    const cleanBody = this.getCleanBody();
    if (cleanBody) {
      this.copy(cleanBody);
    } else {
      this.showError('Aucun contenu à copier');
    }
  }

  copyAll() {
    const email = this.generatedContent?.newsletter || this.generatedContent;
    if (!email) return;

    const cleanBody = this.getCleanBody();
    const text = `Objet: ${email.subjectLines?.[0] || ''}\n\nPreview: ${email.previewText || ''}\n\n${cleanBody}`;
    this.copy(text);
  }

  copyAsHTML() {
    const email = this.generatedContent?.newsletter || this.generatedContent;
    if (!email) return;

    const html = `<h1>${email.subjectLines?.[0] || ''}</h1>\n${this.formatEmailBody(email.body)}`;
    this.copy(html);
  }

  selectSubject(index) {
    this.formData.selectedSubject = index;
    this.render();
  }

  updateSubject(index, text) {
    if (this.generatedContent?.newsletter?.subjectLines) {
      this.generatedContent.newsletter.subjectLines[index] = text;
    }
  }

  updatePreviewText(text) {
    if (this.generatedContent?.newsletter) {
      this.generatedContent.newsletter.previewText = text;
    }
  }

  updateBody(html) {
    if (this.generatedContent?.newsletter) {
      // Convertir HTML en texte
      const temp = document.createElement('div');
      temp.innerHTML = html;
      this.generatedContent.newsletter.body = temp.innerText;
    }
  }

  getTypeName(id) {
    return this.types.find(t => t.id === id)?.name || id;
  }

  getTypeIcon(id) {
    return this.types.find(t => t.id === id)?.icon || '📧';
  }

  getStructureName(id) {
    return this.structures.find(s => s.id === id)?.name || id;
  }

  getToneName(id) {
    return this.tones.find(t => t.id === id)?.name || id;
  }

  showSuccess(message) {
    this.showToast(message, 'success');
  }

  showError(message) {
    this.showToast(message, 'error');
  }

  showLoading(message) {
    // Afficher un loader temporaire
    const loader = document.createElement('div');
    loader.className = 'newsletter-loading-overlay';
    loader.innerHTML = `
      <div class="loading-content">
        <div class="loader-animation"></div>
        <p>${message}</p>
      </div>
    `;
    document.body.appendChild(loader);

    setTimeout(() => loader.remove(), 10000); // Auto-remove après 10s
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `newsletter-toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  attachEventListeners() {
    // Toggle mode agence
    const agencyToggle = document.getElementById('agency-mode-toggle');
    if (agencyToggle) {
      agencyToggle.addEventListener('change', () => this.toggleAgencyMode());
    }
  }

  // ============================================================
  // DONNÉES PAR DÉFAUT (fallback)
  // ============================================================

  getDefaultTypes() {
    return [
      {
        id: 'launch',
        name: 'Lancement produit/service',
        icon: '🚀',
        description: 'Annonce d\'un nouveau produit ou service',
        bestStructures: ['aida', 'hook_story_offer'],
        example: {
          subject: '🎉 C\'est le grand jour ! [Nom produit] est enfin disponible',
          preview: 'Après 6 mois de travail acharné, je suis fière de te présenter...'
        }
      },
      {
        id: 'nurturing',
        name: 'Nurturing',
        icon: '💝',
        description: 'Créer la relation, apporter de la valeur',
        bestStructures: ['hook_story_offer', 'obi'],
        example: {
          subject: 'La technique qui a changé ma façon de [domaine]',
          preview: 'Pas de vente aujourd\'hui. Juste une pépite que j\'aurais aimé connaître plus tôt...'
        }
      },
      {
        id: 'reengagement',
        name: 'Réengagement',
        icon: '🔄',
        description: 'Réactiver les abonnés inactifs',
        bestStructures: ['pas', 'bab'],
        example: {
          subject: 'Tu nous manques ! (+ un cadeau pour toi)',
          preview: 'Ça fait un moment qu\'on ne s\'est pas parlé. J\'ai pensé à toi...'
        }
      },
      {
        id: 'promo',
        name: 'Promo/Vente flash',
        icon: '⚡',
        description: 'Offre limitée, promotion spéciale',
        bestStructures: ['aida', 'pas'],
        example: {
          subject: '⏰ Plus que 24h : -50% sur [produit]',
          preview: 'Cette offre se termine ce soir à minuit. Ne rate pas ça...'
        }
      },
      {
        id: 'storytelling',
        name: 'Storytelling personnel',
        icon: '📖',
        description: 'Coulisses, parcours, histoire personnelle',
        bestStructures: ['hook_story_offer', 'bab'],
        example: {
          subject: 'Le jour où j\'ai failli tout abandonner...',
          preview: 'Je ne t\'ai jamais raconté cette histoire. Mais aujourd\'hui, j\'ai décidé...'
        }
      },
      {
        id: 'event',
        name: 'Annonce événement',
        icon: '🎉',
        description: 'Webinar, atelier, conférence...',
        bestStructures: ['aida', 'pas'],
        example: {
          subject: '🎙️ Webinar gratuit : [Thème] - Places limitées',
          preview: 'Le [date], je t\'invite à un événement exclusif où je partagerai...'
        }
      }
    ];
  }

  getDefaultStructures() {
    return [
      { id: 'aida', name: 'AIDA', fullName: 'Attention - Intérêt - Désir - Action', icon: '🎯', description: 'Structure classique de copywriting', steps: ['Attention: Accroche choc', 'Intérêt: Problème identifié', 'Désir: Solution et bénéfices', 'Action: CTA clair'] },
      { id: 'pas', name: 'PAS', fullName: 'Problème - Agitation - Solution', icon: '🔥', description: 'Identifier la douleur, l\'amplifier, puis présenter la solution', steps: ['Problème: Identifier la douleur', 'Agitation: Amplifier l\'urgence', 'Solution: Présenter la réponse'] },
      { id: 'hook_story_offer', name: 'Hook + Story + Offer', fullName: 'Accroche + Histoire + Offre', icon: '📚', description: 'Captiver avec une accroche, raconter une histoire, faire une offre', steps: ['Hook: Accroche irrésistible', 'Story: Histoire engageante', 'Offer: Proposition de valeur'] },
      { id: 'bab', name: 'Before/After/Bridge', fullName: 'Avant - Après - Pont', icon: '🌉', description: 'Montrer la transformation possible', steps: ['Before: Situation actuelle', 'After: Situation rêvée', 'Bridge: Comment y arriver'] },
      { id: 'obi', name: 'One Big Idea', fullName: 'Une Grande Idée', icon: '💡', description: 'Un seul message puissant, développé en profondeur', steps: ['Une idée centrale', 'Développement approfondi', 'Conclusion mémorable'] }
    ];
  }

  getDefaultTones() {
    return [
      { id: 'warm', name: 'Chaleureux', icon: '☀️', description: 'Proche, bienveillant, comme un ami' },
      { id: 'direct', name: 'Direct', icon: '🎯', description: 'Droit au but, sans fioritures' },
      { id: 'inspiring', name: 'Inspirant', icon: '✨', description: 'Motivant, qui donne envie d\'agir' },
      { id: 'quirky', name: 'Décalé', icon: '🎭', description: 'Original, avec une touche d\'humour' },
      { id: 'expert', name: 'Expert', icon: '🎓', description: 'Autorité, maîtrise du sujet' },
      { id: 'friendly', name: 'Amical', icon: '🤝', description: 'Décontracté, accessible' },
      { id: 'professional', name: 'Professionnel', icon: '💼', description: 'Sérieux, corporate' },
      { id: 'storyteller', name: 'Conteur', icon: '📖', description: 'Narratif, captivant' }
    ];
  }
}

// Initialiser le module quand le DOM est prêt
let newsletterModule;

function initNewsletterModule() {
  if (document.getElementById('newsletter-module')) {
    newsletterModule = new NewsletterModule();
  }
}

// Auto-init si le DOM est déjà chargé
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNewsletterModule);
} else {
  initNewsletterModule();
}
