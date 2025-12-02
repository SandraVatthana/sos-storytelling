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

    this.types = [];
    this.structures = [];
    this.tones = [];

    this.init();
  }

  async init() {
    await this.loadMetadata();
    await this.loadClients();
    await this.loadVoices();
    await this.loadTemplates();
    this.render();
    this.attachEventListeners();
  }

  // ============================================================
  // CHARGEMENT DES DONNÉES
  // ============================================================

  async loadMetadata() {
    try {
      const [typesRes, structuresRes, tonesRes] = await Promise.all([
        this.apiCall('/api/newsletters/types'),
        this.apiCall('/api/newsletters/structures'),
        this.apiCall('/api/newsletters/tones')
      ]);

      this.types = typesRes.types || [];
      this.structures = structuresRes.structures || [];
      this.tones = tonesRes.tones || [];
    } catch (error) {
      console.error('Erreur chargement métadonnées:', error);
      // Fallback avec données locales
      this.types = this.getDefaultTypes();
      this.structures = this.getDefaultStructures();
      this.tones = this.getDefaultTones();
    }
  }

  async loadClients() {
    try {
      const res = await this.apiCall('/api/newsletters/clients');
      this.clients = res.clients || [];
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      this.clients = [];
    }
  }

  async loadVoices() {
    try {
      // Utiliser l'API existante des voix
      const res = await this.apiCall('/api/v1/voices');
      this.voices = res.voices || [];
    } catch (error) {
      console.error('Erreur chargement voix:', error);
      this.voices = [];
    }
  }

  async loadTemplates() {
    try {
      const res = await this.apiCall('/api/newsletters/templates');
      this.templates = res.templates || [];
    } catch (error) {
      console.error('Erreur chargement templates:', error);
      this.templates = [];
    }
  }

  // ============================================================
  // API CALLS
  // ============================================================

  async apiCall(endpoint, options = {}) {
    const token = await this.getAuthToken();

    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async getAuthToken() {
    // Récupérer le token Supabase de la session
    if (window.supabase) {
      const { data: { session } } = await window.supabase.auth.getSession();
      return session?.access_token || '';
    }
    return '';
  }

  // ============================================================
  // RENDU PRINCIPAL
  // ============================================================

  render() {
    const container = document.getElementById('newsletter-module');
    if (!container) return;

    container.innerHTML = `
      <div class="newsletter-container">
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
          ` : '<div></div>'}

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
      </div>
    `;
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
              ${type.bestStructures ? `
                <div class="type-hint">
                  Structures recommandées: ${type.bestStructures.slice(0, 2).join(', ')}
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
              <small>Générer plusieurs emails liés (arc narratif cohérent)</small>
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
                      onblur="newsletterModule.updateSubject(${i}, this.innerText)">${subject}</span>
                <button class="copy-btn" onclick="event.stopPropagation(); newsletterModule.copy('${subject}')">📋</button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Preview Text -->
        <div class="result-section">
          <h4 class="section-title">👁️ Preview Text</h4>
          <div class="preview-text-box">
            <span contenteditable="true"
                  onblur="newsletterModule.updatePreviewText(this.innerText)">${email.previewText || ''}</span>
            <button class="copy-btn" onclick="newsletterModule.copy('${email.previewText}')">📋</button>
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
            <button class="btn-small" onclick="newsletterModule.copy(newsletterModule.generatedContent.newsletter.body)">
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
            <button class="cta-button-preview">${email.cta || this.formData.ctaText || 'Découvrir'}</button>
            ${this.formData.ctaUrl ? `<span class="cta-url">→ ${this.formData.ctaUrl}</span>` : ''}
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
      </div>
    `;
  }

  renderEmailContent(email, index) {
    if (!email) return '<div class="no-email">Email non disponible</div>';

    return `
      <div class="email-result-card">
        <div class="email-role-badge">${email.role || `Email ${index + 1}`}</div>
        ${email.sendDelay ? `<div class="send-delay">📅 ${email.sendDelay}</div>` : ''}

        <div class="result-section">
          <h4>📬 Objets</h4>
          <div class="subject-options compact">
            ${(email.subjectLines || []).map((subject, i) => `
              <div class="subject-option">
                <span class="subject-text">${subject}</span>
                <button class="copy-btn" onclick="newsletterModule.copy('${subject}')">📋</button>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="result-section">
          <h4>👁️ Preview</h4>
          <div class="preview-text-box">${email.previewText || ''}</div>
        </div>

        <div class="result-section">
          <h4>✉️ Corps</h4>
          <div class="email-body-box">
            <div class="email-content">${this.formatEmailBody(email.body)}</div>
          </div>
        </div>

        <div class="result-section">
          <h4>🔘 CTA</h4>
          <button class="cta-button-preview">${email.cta || 'Découvrir'}</button>
        </div>
      </div>
    `;
  }

  showEmail(index) {
    this.currentEmailIndex = index;
    this.render();
  }

  // ============================================================
  // GÉNÉRATION
  // ============================================================

  async generate() {
    this.currentStep = 5;
    this.generatedContent = null;
    this.render();

    try {
      const endpoint = this.isSequenceMode ? '/api/newsletters/generate-sequence' : '/api/newsletters/generate';

      const payload = {
        ...this.formData,
        clientId: this.selectedClient?.id || null
      };

      const response = await this.apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (this.isSequenceMode) {
        this.sequenceEmails = response.sequence || [];
        this.generatedContent = response;
      } else {
        this.generatedContent = response;
      }

      this.render();
    } catch (error) {
      console.error('Erreur génération:', error);
      this.showError('Erreur lors de la génération. Réessaie !');
    }
  }

  async regenerate() {
    this.generatedContent = null;
    this.render();
    await this.generate();
  }

  async adjustTone(adjustment) {
    if (!adjustment) return;

    this.showLoading('Ajustement en cours...');

    try {
      const response = await this.apiCall('/api/newsletters/regenerate', {
        method: 'POST',
        body: JSON.stringify({
          originalContent: this.generatedContent.newsletter || this.generatedContent,
          adjustments: adjustment,
          newsletterType: this.formData.newsletterType,
          structure: this.formData.structure,
          tone: this.formData.tone
        })
      });

      this.generatedContent = { newsletter: response.newsletter };
      this.render();
    } catch (error) {
      console.error('Erreur ajustement:', error);
      this.showError('Erreur lors de l\'ajustement');
    }
  }

  // ============================================================
  // SAUVEGARDE
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

      const payload = {
        ...this.formData,
        isSequence: this.isSequenceMode,
        clientId: this.selectedClient?.id || null,
        emails
      };

      await this.apiCall('/api/newsletters', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

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
      await this.apiCall('/api/newsletters/templates', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: `Template pour ${this.getTypeName(this.formData.newsletterType)}`,
          newsletterType: this.formData.newsletterType,
          structure: this.formData.structure,
          tone: this.formData.tone,
          voiceId: this.formData.voiceId,
          targetAudience: this.formData.targetAudience,
          ctaType: this.formData.ctaType,
          clientId: this.selectedClient?.id
        })
      });

      this.showSuccess('Template créé !');
      await this.loadTemplates();
    } catch (error) {
      console.error('Erreur création template:', error);
      this.showError('Erreur lors de la création du template');
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
    return body
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  copy(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.showSuccess('Copié !');
    });
  }

  copyAll() {
    const email = this.generatedContent?.newsletter;
    if (!email) return;

    const text = `Objet: ${email.subjectLines?.[0] || ''}\n\nPreview: ${email.previewText || ''}\n\n${email.body || ''}`;
    this.copy(text);
  }

  copyAsHTML() {
    const email = this.generatedContent?.newsletter;
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
      { id: 'launch', name: 'Lancement produit/service', icon: '🚀', description: 'Annonce d\'un nouveau produit ou service', bestStructures: ['aida', 'hook_story_offer'] },
      { id: 'nurturing', name: 'Nurturing', icon: '💝', description: 'Créer la relation, apporter de la valeur', bestStructures: ['hook_story_offer', 'obi'] },
      { id: 'reengagement', name: 'Réengagement', icon: '🔄', description: 'Réactiver les abonnés inactifs', bestStructures: ['pas', 'bab'] },
      { id: 'promo', name: 'Promo/Vente flash', icon: '⚡', description: 'Offre limitée, promotion spéciale', bestStructures: ['aida', 'pas'] },
      { id: 'storytelling', name: 'Storytelling personnel', icon: '📖', description: 'Coulisses, parcours, histoire personnelle', bestStructures: ['hook_story_offer', 'bab'] },
      { id: 'event', name: 'Annonce événement', icon: '🎉', description: 'Webinar, atelier, conférence...', bestStructures: ['aida', 'pas'] }
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
