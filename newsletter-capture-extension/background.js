// ==================== NEWSLETTER CAPTURE - BACKGROUND.JS ====================
// Service Worker pour l'extension

// Écouter les messages depuis le popup ou content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTabInfo') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                sendResponse({ url: tabs[0].url, title: tabs[0].title });
            }
        });
        return true; // Indique une réponse asynchrone
    }
});

// Log au démarrage
console.log('📩 Newsletter Capture - Extension chargée');
