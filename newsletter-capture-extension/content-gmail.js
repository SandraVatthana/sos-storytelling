// ==================== NEWSLETTER CAPTURE - CONTENT SCRIPT GMAIL ====================
// Script injecté dans Gmail pour faciliter la capture

// Ajouter un bouton de capture rapide dans Gmail (optionnel)
function addCaptureButton() {
    // Vérifier si on est dans une vue email
    const toolbar = document.querySelector('.ade');
    if (!toolbar) return;

    // Vérifier si le bouton existe déjà
    if (document.getElementById('nc-capture-btn')) return;

    const button = document.createElement('div');
    button.id = 'nc-capture-btn';
    button.className = 'nc-capture-button';
    button.innerHTML = '📩 Capturer';
    button.title = 'Capturer cette newsletter pour SOS';

    button.addEventListener('click', () => {
        // Ouvrir le popup de l'extension
        chrome.runtime.sendMessage({ action: 'openPopup' });
    });

    // Insérer le bouton
    toolbar.appendChild(button);
}

// Observer les changements de page dans Gmail (SPA)
const observer = new MutationObserver(() => {
    // Gmail charge dynamiquement, on vérifie périodiquement
    setTimeout(addCaptureButton, 500);
});

// Démarrer l'observation
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Premier essai
setTimeout(addCaptureButton, 1000);

console.log('📩 Newsletter Capture - Content script Gmail chargé');
