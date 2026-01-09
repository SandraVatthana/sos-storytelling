// ========================================
// Newsletter Scraper - Popup Script
// ========================================

document.addEventListener('DOMContentLoaded', init);

// Configuration Supabase (à remplir)
const CONFIG = {
  SUPABASE_URL: '', // Ex: https://xxxxx.supabase.co
  SUPABASE_ANON_KEY: '', // Ta clé anon/public
  TABLE_NAME: 'newsletter_raw'
};

// ========================================
// Initialisation
// ========================================
function init() {
  // Gestion du champ source personnalisé
  const sourceSelect = document.getElementById('source');
  const sourceCustom = document.getElementById('source-custom');
  
  sourceSelect.addEventListener('change', () => {
    if (sourceSelect.value === 'autre') {
      sourceCustom.style.display = 'block';
      sourceCustom.focus();
    } else {
      sourceCustom.style.display = 'none';
    }
  });

  // Bouton de capture
  const captureBtn = document.getElementById('capture-btn');
  captureBtn.addEventListener('click', handleCapture);

  // Charger la config depuis le storage
  loadConfig();
}

// ========================================
// Charger la configuration
// ========================================
async function loadConfig() {
  const stored = await chrome.storage.local.get(['supabaseUrl', 'supabaseKey']);
  if (stored.supabaseUrl) CONFIG.SUPABASE_URL = stored.supabaseUrl;
  if (stored.supabaseKey) CONFIG.SUPABASE_ANON_KEY = stored.supabaseKey;
}

// ========================================
// Gestion de la capture
// ========================================
async function handleCapture() {
  const btn = document.getElementById('capture-btn');
  const statusEl = document.getElementById('status');
  
  // Vérifier la config
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    showStatus('error', '⚠️ Configure Supabase dans les paramètres');
    return;
  }

  // Récupérer les valeurs du formulaire
  const sourceSelect = document.getElementById('source');
  const sourceCustom = document.getElementById('source-custom');
  const source = sourceSelect.value === 'autre' 
    ? sourceCustom.value 
    : sourceSelect.value;

  if (!source) {
    showStatus('error', '⚠️ Sélectionne une source');
    return;
  }

  // Récupérer les tags sélectionnés
  const tags = Array.from(document.querySelectorAll('input[name="tags"]:checked'))
    .map(cb => cb.value);

  // Mode de capture
  const mode = document.querySelector('input[name="mode"]:checked').value;

  // Désactiver le bouton
  btn.disabled = true;
  btn.textContent = '⏳ Capture en cours...';
  showStatus('loading', 'Extraction du contenu...');

  try {
    // Récupérer le contenu via le content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'extractContent',
      mode: mode
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Échec de l\'extraction');
    }

    // Préparer les données
    const data = {
      source: source,
      subject: response.data.title || 'Sans titre',
      content: response.data.content,
      url: response.data.url,
      captured_at: new Date().toISOString(),
      tags: tags,
      status: 'raw',
      extracted_rules: null
    };

    // Envoyer à Supabase
    showStatus('loading', 'Envoi vers Supabase...');
    await sendToSupabase(data);

    // Succès
    showStatus('success', '✅ Newsletter capturée !');
    
    // Sauvegarder dans l'historique local
    await saveToHistory(data);

    // Reset après 2s
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '📥 Capturer cette newsletter';
    }, 2000);

  } catch (error) {
    console.error('Capture error:', error);
    showStatus('error', `❌ ${error.message}`);
    btn.disabled = false;
    btn.textContent = '📥 Capturer cette newsletter';
  }
}

// ========================================
// Envoi vers Supabase
// ========================================
async function sendToSupabase(data) {
  const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${CONFIG.TABLE_NAME}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase error: ${response.status} - ${errorText}`);
  }

  return true;
}

// ========================================
// Historique local
// ========================================
async function saveToHistory(data) {
  const { captureHistory = [] } = await chrome.storage.local.get('captureHistory');
  
  // Garder les 10 dernières
  captureHistory.unshift({
    source: data.source,
    subject: data.subject,
    captured_at: data.captured_at
  });
  
  if (captureHistory.length > 10) {
    captureHistory.pop();
  }

  await chrome.storage.local.set({ captureHistory });
}

// ========================================
// Affichage du statut
// ========================================
function showStatus(type, message) {
  const statusEl = document.getElementById('status');
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
}
