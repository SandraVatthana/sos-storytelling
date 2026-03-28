// sos-app-import.js - Injecte les leads depuis chrome.storage dans la page prospects SOS Storytelling
// Ce script s'execute sur sosstorytelling.fr (prospects.html)

(function() {
  'use strict';

  console.log('[SOS Import] Content script loaded on:', window.location.href);

  // Vérifier si on doit importer des leads
  async function checkForPendingImport() {
    try {
      // Vérifier le paramètre URL
      const urlParams = new URLSearchParams(window.location.search);
      const importFlag = urlParams.get('import_leads');

      if (importFlag !== 'pending') {
        console.log('[SOS Import] No pending import');
        return;
      }

      console.log('[SOS Import] Pending import detected, checking storage...');

      // Récupérer les leads depuis chrome.storage
      const result = await chrome.storage.local.get(['pendingLeadsImport']);

      if (!result.pendingLeadsImport) {
        console.log('[SOS Import] No leads found in storage');
        return;
      }

      const { leads, timestamp } = result.pendingLeadsImport;

      // Vérifier que les données ne sont pas trop vieilles (max 5 minutes)
      const maxAge = 5 * 60 * 1000; // 5 minutes
      if (Date.now() - timestamp > maxAge) {
        console.log('[SOS Import] Leads data too old, clearing...');
        await chrome.storage.local.remove(['pendingLeadsImport']);
        return;
      }

      console.log('[SOS Import] Found', leads.length, 'leads to import');

      // Injecter les leads dans la page
      injectLeadsIntoPage(leads);

      // Nettoyer le storage
      await chrome.storage.local.remove(['pendingLeadsImport']);
      console.log('[SOS Import] Storage cleaned');

      // Nettoyer l'URL (enlever le paramètre)
      const cleanUrl = window.location.href.replace(/[?&]import_leads=pending/, '').replace(/[?&]$/, '');
      if (cleanUrl !== window.location.href) {
        window.history.replaceState({}, document.title, cleanUrl);
      }

    } catch (error) {
      console.error('[SOS Import] Error:', error);
    }
  }

  // Injecter les leads dans la page
  function injectLeadsIntoPage(leads) {
    // Méthode 1: Dispatch custom event que l'app peut écouter
    const event = new CustomEvent('sos-leads-import', {
      detail: { leads: leads }
    });
    window.dispatchEvent(event);
    console.log('[SOS Import] Dispatched sos-leads-import event with', leads.length, 'leads');

    // Méthode 2: Stocker dans window pour accès direct
    window.sosImportedLeads = leads;
    console.log('[SOS Import] Set window.sosImportedLeads');

    // Méthode 3: Stocker dans localStorage pour l'app
    try {
      localStorage.setItem('sos_pending_leads', JSON.stringify(leads));
      console.log('[SOS Import] Stored in localStorage');
    } catch (e) {
      console.warn('[SOS Import] Could not store in localStorage:', e);
    }

    // Afficher une notification
    showImportNotification(leads.length);
  }

  // Afficher une notification de succès
  function showImportNotification(count) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: sosSlideIn 0.3s ease-out;
    `;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 24px;">✅</span>
        <div>
          <strong>${count} prospect(s)</strong> pret(s) a importer
          <br><small style="opacity: 0.9;">Selectionnez une campagne pour continuer</small>
        </div>
      </div>
    `;

    // Ajouter l'animation CSS
    const style = document.createElement('style');
    style.textContent = `
      @keyframes sosSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes sosSlideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      notification.style.animation = 'sosSlideOut 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  // Attendre que la page soit chargée
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(checkForPendingImport, 500);
    });
  } else {
    setTimeout(checkForPendingImport, 500);
  }

})();
