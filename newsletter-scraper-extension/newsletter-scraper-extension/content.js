// ========================================
// Newsletter Scraper - Content Script
// Injecté dans Gmail et Substack
// ========================================

// Écouter les messages du popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    const result = extractContent(request.mode);
    sendResponse(result);
  }
  return true; // Permet une réponse asynchrone
});

// ========================================
// Extraction du contenu
// ========================================
function extractContent(mode) {
  try {
    const url = window.location.href;
    let content, title;

    // Mode sélection : récupérer le texte sélectionné
    if (mode === 'selection') {
      const selection = window.getSelection();
      if (!selection || selection.toString().trim() === '') {
        return {
          success: false,
          error: 'Aucun texte sélectionné. Sélectionne un passage avant de capturer.'
        };
      }
      content = selection.toString();
      title = document.title || 'Sélection';
    } 
    // Mode full : extraire selon le contexte
    else {
      if (url.includes('mail.google.com')) {
        // Gmail
        const extracted = extractFromGmail();
        content = extracted.content;
        title = extracted.title;
      } else if (url.includes('substack.com')) {
        // Substack
        const extracted = extractFromSubstack();
        content = extracted.content;
        title = extracted.title;
      } else {
        // Fallback générique
        const extracted = extractGeneric();
        content = extracted.content;
        title = extracted.title;
      }
    }

    if (!content || content.trim() === '') {
      return {
        success: false,
        error: 'Impossible d\'extraire le contenu de cette page.'
      };
    }

    return {
      success: true,
      data: {
        content: cleanContent(content),
        title: title,
        url: url
      }
    };

  } catch (error) {
    return {
      success: false,
      error: `Erreur d'extraction: ${error.message}`
    };
  }
}

// ========================================
// Extraction Gmail
// ========================================
function extractFromGmail() {
  // Sélecteurs Gmail pour le contenu de l'email ouvert
  const selectors = [
    '.a3s.aiL', // Corps de l'email
    '.ii.gt', // Autre sélecteur courant
    '[data-message-id] .a3s', // Avec ID de message
  ];

  let content = '';
  let title = '';

  // Récupérer le sujet
  const subjectEl = document.querySelector('h2.hP') || document.querySelector('[data-thread-perm-id] h2');
  if (subjectEl) {
    title = subjectEl.textContent.trim();
  }

  // Récupérer le contenu
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      content = el.innerText || el.textContent;
      break;
    }
  }

  // Fallback : prendre tout le contenu visible de l'email
  if (!content) {
    const emailContainer = document.querySelector('[role="main"]');
    if (emailContainer) {
      content = emailContainer.innerText;
    }
  }

  return { content, title: title || document.title };
}

// ========================================
// Extraction Substack
// ========================================
function extractFromSubstack() {
  let content = '';
  let title = '';

  // Titre de l'article
  const titleEl = document.querySelector('h1.post-title') || document.querySelector('article h1');
  if (titleEl) {
    title = titleEl.textContent.trim();
  }

  // Corps de l'article
  const bodySelectors = [
    '.body.markup',
    '.post-content',
    'article .available-content',
    'article'
  ];

  for (const selector of bodySelectors) {
    const el = document.querySelector(selector);
    if (el) {
      content = el.innerText || el.textContent;
      break;
    }
  }

  return { content, title: title || document.title };
}

// ========================================
// Extraction générique (fallback)
// ========================================
function extractGeneric() {
  let content = '';
  let title = document.title;

  // Chercher le contenu principal
  const mainSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content'
  ];

  for (const selector of mainSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      content = el.innerText || el.textContent;
      break;
    }
  }

  // Fallback ultime : body entier (moins propre)
  if (!content) {
    content = document.body.innerText;
  }

  return { content, title };
}

// ========================================
// Nettoyage du contenu
// ========================================
function cleanContent(text) {
  return text
    // Supprimer les espaces multiples
    .replace(/\s+/g, ' ')
    // Supprimer les lignes vides multiples
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Supprimer les espaces en début/fin
    .trim()
    // Limiter la longueur (sécurité)
    .substring(0, 50000);
}
