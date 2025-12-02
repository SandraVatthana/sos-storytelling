// ============================================================
// Visual Module - Génération de visuels via Orshot
// ============================================================

(function() {
  'use strict';

  const API_BASE = 'https://sos-storytelling-api.sandra-devonssay.workers.dev';

  // État du module
  let currentContent = null;
  let selectedFormat = null;
  let selectedTemplate = null;
  let templates = {};
  let isGenerating = false;

  // Formats disponibles
  const FORMATS = {
    post_instagram: { name: 'Post Instagram', icon: '📸', dimensions: '1080x1080' },
    story_instagram: { name: 'Story Instagram', icon: '📱', dimensions: '1080x1920' },
    carrousel_instagram: { name: 'Carrousel Instagram', icon: '🎠', dimensions: '1080x1080 (5 slides)' },
    post_linkedin: { name: 'Post LinkedIn', icon: '💼', dimensions: '1200x627' },
    quote: { name: 'Citation', icon: '💬', dimensions: '1080x1080' }
  };

  // Initialiser le module
  async function init() {
    await loadTemplates();
    renderModule();
  }

  // Charger les templates depuis l'API
  async function loadTemplates() {
    try {
      const response = await fetch(`${API_BASE}/api/visuals/templates`);
      if (response.ok) {
        const data = await response.json();
        templates = data.templates || {};
      }
    } catch (error) {
      console.error('Erreur chargement templates:', error);
      // Utiliser les templates par défaut
      templates = getDefaultTemplates();
    }
  }

  // Templates par défaut si l'API ne répond pas
  function getDefaultTemplates() {
    return {
      post_instagram: {
        format: { width: 1080, height: 1080 },
        templates: [
          { id: 'post_ig_minimal', name: 'Minimal', description: 'Design épuré' },
          { id: 'post_ig_bold', name: 'Bold', description: 'Design impactant' },
          { id: 'post_ig_gradient', name: 'Gradient', description: 'Fond dégradé' }
        ]
      },
      story_instagram: {
        format: { width: 1080, height: 1920 },
        templates: [
          { id: 'story_ig_minimal', name: 'Minimal', description: 'Story épurée' },
          { id: 'story_ig_bold', name: 'Bold', description: 'Story percutante' }
        ]
      },
      carrousel_instagram: {
        format: { width: 1080, height: 1080, slides: 5 },
        templates: [
          { id: 'carrousel_ig_minimal', name: 'Minimal', description: 'Carrousel épuré' },
          { id: 'carrousel_ig_educatif', name: 'Éducatif', description: 'Pour les tips' }
        ]
      },
      post_linkedin: {
        format: { width: 1200, height: 627 },
        templates: [
          { id: 'post_li_pro', name: 'Professionnel', description: 'Design corporate' },
          { id: 'post_li_minimal', name: 'Minimal', description: 'Simple et efficace' }
        ]
      },
      quote: {
        format: { width: 1080, height: 1080 },
        templates: [
          { id: 'quote_minimal', name: 'Minimal', description: 'Citation élégante' },
          { id: 'quote_bold', name: 'Bold', description: 'Citation impactante' }
        ]
      }
    };
  }

  // Rendre le module
  function renderModule() {
    const container = document.getElementById('visual-module');
    if (!container) return;

    container.innerHTML = `
      <div class="visual-module-container">
        <div class="visual-module-header">
          <h2>🎨 Créer un visuel</h2>
          <button class="visual-close-btn" onclick="window.visualModule.close()">×</button>
        </div>

        <div class="visual-module-body">
          <!-- Étape 1: Sélection du format -->
          <div class="visual-step" id="step-format">
            <h3>1. Choisis le format</h3>
            <div class="visual-formats">
              ${Object.entries(FORMATS).map(([key, format]) => `
                <button class="visual-format-btn ${selectedFormat === key ? 'active' : ''}"
                        data-format="${key}"
                        onclick="window.visualModule.selectFormat('${key}')">
                  <span class="format-icon">${format.icon}</span>
                  <span class="format-name">${format.name}</span>
                  <span class="format-dimensions">${format.dimensions}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Étape 2: Sélection du template -->
          <div class="visual-step ${!selectedFormat ? 'disabled' : ''}" id="step-template">
            <h3>2. Choisis le style</h3>
            <div class="visual-templates" id="templates-container">
              ${renderTemplates()}
            </div>
          </div>

          <!-- Étape 3: Aperçu du contenu -->
          <div class="visual-step ${!selectedTemplate ? 'disabled' : ''}" id="step-preview">
            <h3>3. Contenu à injecter</h3>
            <div class="visual-content-preview" id="content-preview">
              ${renderContentPreview()}
            </div>
          </div>

          <!-- Actions -->
          <div class="visual-actions">
            <button class="visual-generate-btn"
                    onclick="window.visualModule.generate()"
                    ${!selectedFormat || !selectedTemplate || isGenerating ? 'disabled' : ''}>
              ${isGenerating ? '⏳ Génération en cours...' : '✨ Générer le visuel'}
            </button>
          </div>

          <!-- Résultat -->
          <div class="visual-result" id="visual-result" style="display: none;">
            <h3>🎉 Ton visuel est prêt !</h3>
            <div class="visual-result-image">
              <img id="generated-image" src="" alt="Visuel généré">
            </div>
            <div class="visual-result-actions">
              <button class="visual-download-btn" onclick="window.visualModule.download()">
                📥 Télécharger
              </button>
              <button class="visual-new-btn" onclick="window.visualModule.reset()">
                🔄 Créer un autre
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Rendre les templates pour le format sélectionné
  function renderTemplates() {
    if (!selectedFormat || !templates[selectedFormat]) {
      return '<p class="visual-placeholder">Sélectionne d\'abord un format</p>';
    }

    const formatTemplates = templates[selectedFormat].templates || [];
    if (formatTemplates.length === 0) {
      return '<p class="visual-placeholder">Aucun template disponible</p>';
    }

    return formatTemplates.map(tpl => `
      <button class="visual-template-btn ${selectedTemplate === tpl.id ? 'active' : ''}"
              data-template="${tpl.id}"
              onclick="window.visualModule.selectTemplate('${tpl.id}')">
        <span class="template-name">${tpl.name}</span>
        <span class="template-description">${tpl.description}</span>
      </button>
    `).join('');
  }

  // Rendre l'aperçu du contenu
  function renderContentPreview() {
    if (!currentContent) {
      return '<p class="visual-placeholder">Aucun contenu sélectionné</p>';
    }

    let preview = '<div class="content-items">';

    if (currentContent.titre) {
      preview += `<div class="content-item"><strong>Titre:</strong> ${truncate(currentContent.titre, 50)}</div>`;
    }
    if (currentContent.accroche) {
      preview += `<div class="content-item"><strong>Accroche:</strong> ${truncate(currentContent.accroche, 80)}</div>`;
    }
    if (currentContent.citation) {
      preview += `<div class="content-item"><strong>Citation:</strong> ${truncate(currentContent.citation, 100)}</div>`;
    }
    if (currentContent.cta) {
      preview += `<div class="content-item"><strong>CTA:</strong> ${currentContent.cta}</div>`;
    }
    if (currentContent.points && currentContent.points.length > 0) {
      preview += `<div class="content-item"><strong>Points:</strong><ul>${currentContent.points.map(p => `<li>${truncate(p, 50)}</li>`).join('')}</ul></div>`;
    }

    preview += '</div>';
    return preview;
  }

  // Tronquer le texte
  function truncate(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  // Sélectionner un format
  function selectFormat(format) {
    selectedFormat = format;
    selectedTemplate = null;
    renderModule();
  }

  // Sélectionner un template
  function selectTemplate(templateId) {
    selectedTemplate = templateId;
    renderModule();
  }

  // Définir le contenu
  function setContent(content) {
    currentContent = content;
    renderModule();
  }

  // Générer le visuel
  async function generate() {
    if (!selectedFormat || !selectedTemplate || !currentContent || isGenerating) {
      return;
    }

    isGenerating = true;
    renderModule();

    try {
      const token = window.supabase?.auth?.session?.()?.access_token;
      if (!token) {
        throw new Error('Tu dois être connecté pour générer des visuels');
      }

      const response = await fetch(`${API_BASE}/api/visuals/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content_type: selectedFormat,
          template_id: selectedTemplate,
          content_data: currentContent,
          output_format: 'png'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur lors de la génération');
      }

      const data = await response.json();

      // Afficher le résultat
      showResult(data.visual);

    } catch (error) {
      console.error('Erreur génération:', error);
      alert('Erreur: ' + error.message);
    } finally {
      isGenerating = false;
      renderModule();
    }
  }

  // Afficher le résultat
  function showResult(visual) {
    const resultDiv = document.getElementById('visual-result');
    const img = document.getElementById('generated-image');

    if (resultDiv && img) {
      // Utiliser l'URL ou le base64
      const imageUrl = visual.image_url || (visual.image_base64 ? `data:image/png;base64,${visual.image_base64}` : null);

      if (imageUrl) {
        img.src = imageUrl;
        img.dataset.downloadUrl = visual.image_url || '';
        resultDiv.style.display = 'block';

        // Scroll vers le résultat
        resultDiv.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  // Télécharger le visuel
  function download() {
    const img = document.getElementById('generated-image');
    if (!img || !img.src) return;

    const link = document.createElement('a');
    link.href = img.src;
    link.download = `sos-visual-${selectedFormat}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Réinitialiser
  function reset() {
    selectedFormat = null;
    selectedTemplate = null;
    const resultDiv = document.getElementById('visual-result');
    if (resultDiv) resultDiv.style.display = 'none';
    renderModule();
  }

  // Fermer le modal
  function close() {
    const modal = document.getElementById('visualModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Exposer l'API publique
  window.visualModule = {
    init,
    setContent,
    selectFormat,
    selectTemplate,
    generate,
    download,
    reset,
    close
  };

  // Auto-init si le conteneur existe
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
})();
