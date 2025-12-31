// ========================================
// Newsletter Scraper - Background Service Worker
// ========================================

// Écouter l'installation de l'extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Newsletter Scraper installé !');
    
    // Ouvrir la page de configuration au premier lancement
    chrome.tabs.create({ url: 'options.html' });
  }
});

// Écouter les messages des autres scripts si nécessaire
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Pour l'instant, pas de logique background spécifique
  // Peut servir plus tard pour des notifications, etc.
  
  if (request.action === 'showNotification') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: request.title || 'Newsletter Scraper',
      message: request.message
    });
  }
  
  return true;
});
