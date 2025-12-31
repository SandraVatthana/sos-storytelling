// ==================== NEWSLETTER CAPTURE - POPUP.JS ====================
// Extension privée pour capturer les newsletters

// ==================== CONFIGURATION ====================
const STORAGE_KEYS = {
    PIN_HASH: 'nc_pin_hash',
    SUPABASE_URL: 'nc_supabase_url',
    SUPABASE_KEY: 'nc_supabase_key',
    HISTORY: 'nc_history',
    IS_SETUP: 'nc_is_setup'
};

// ==================== UTILITAIRES ====================

// Hash simple pour le PIN (pas besoin de crypto avancé pour usage perso)
async function hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + '_newsletter_capture_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Obtenir les données du storage
async function getStorage(keys) {
    return new Promise(resolve => {
        chrome.storage.local.get(keys, resolve);
    });
}

// Sauvegarder dans le storage
async function setStorage(data) {
    return new Promise(resolve => {
        chrome.storage.local.set(data, resolve);
    });
}

// Afficher un écran
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    document.getElementById(screenId).style.display = 'block';
}

// Afficher le status
function showStatus(message, type = 'success') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';

    if (type !== 'loading') {
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}

// ==================== SUPABASE CLIENT ====================

class SupabaseClient {
    constructor(url, key) {
        // Nettoyer l'URL (enlever le slash final si présent)
        this.url = url.replace(/\/$/, '');
        this.key = key;
        console.log('📩 Supabase initialisé:', this.url);
    }

    async insert(table, data) {
        const endpoint = `${this.url}/rest/v1/${table}`;
        console.log('📩 Envoi vers:', endpoint);
        console.log('📩 Données:', data);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.key,
                    'Authorization': `Bearer ${this.key}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(data)
            });

            console.log('📩 Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('📩 Erreur Supabase:', errorText);
                throw new Error(`Supabase ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('📩 Succès:', result);
            return result;
        } catch (error) {
            console.error('📩 Fetch error:', error);
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Connexion impossible. Vérifie ton URL Supabase et ta connexion internet.');
            }
            throw error;
        }
    }
}

let supabase = null;

async function initSupabase() {
    const storage = await getStorage([STORAGE_KEYS.SUPABASE_URL, STORAGE_KEYS.SUPABASE_KEY]);
    if (storage[STORAGE_KEYS.SUPABASE_URL] && storage[STORAGE_KEYS.SUPABASE_KEY]) {
        supabase = new SupabaseClient(
            storage[STORAGE_KEYS.SUPABASE_URL],
            storage[STORAGE_KEYS.SUPABASE_KEY]
        );
        return true;
    }
    return false;
}

// ==================== ÉCRAN DE VERROUILLAGE ====================

async function checkPin() {
    const pinInput = document.getElementById('pinInput');
    const pinError = document.getElementById('pinError');
    const pin = pinInput.value.trim();

    if (!pin) return;

    const storage = await getStorage([STORAGE_KEYS.PIN_HASH]);
    const storedHash = storage[STORAGE_KEYS.PIN_HASH];
    const inputHash = await hashPin(pin);

    if (inputHash === storedHash) {
        pinError.style.display = 'none';
        pinInput.value = '';
        await initSupabase();
        await loadHistory();
        showScreen('mainScreen');
    } else {
        pinError.style.display = 'block';
        pinInput.value = '';
        pinInput.focus();
    }
}

function lockExtension() {
    showScreen('lockScreen');
    document.getElementById('pinInput').focus();
}

// ==================== ÉCRAN DE CONFIGURATION ====================

async function saveSetup() {
    const newPin = document.getElementById('newPinInput').value.trim();
    const confirmPin = document.getElementById('confirmPinInput').value.trim();
    const supabaseUrl = document.getElementById('supabaseUrlInput').value.trim();
    const supabaseKey = document.getElementById('supabaseKeyInput').value.trim();
    const setupError = document.getElementById('setupError');

    // Validations
    if (!newPin || newPin.length < 4) {
        setupError.textContent = 'Le PIN doit faire au moins 4 caractères';
        setupError.style.display = 'block';
        return;
    }

    if (newPin !== confirmPin) {
        setupError.textContent = 'Les PIN ne correspondent pas';
        setupError.style.display = 'block';
        return;
    }

    if (!supabaseUrl || !supabaseUrl.includes('supabase')) {
        setupError.textContent = 'URL Supabase invalide';
        setupError.style.display = 'block';
        return;
    }

    if (!supabaseKey || supabaseKey.length < 20) {
        setupError.textContent = 'Clé Supabase invalide';
        setupError.style.display = 'block';
        return;
    }

    // Test de connexion Supabase
    try {
        const testClient = new SupabaseClient(supabaseUrl, supabaseKey);
        // On ne teste pas vraiment ici, on fait confiance
    } catch (e) {
        setupError.textContent = 'Erreur de connexion Supabase';
        setupError.style.display = 'block';
        return;
    }

    // Sauvegarder
    const pinHash = await hashPin(newPin);
    await setStorage({
        [STORAGE_KEYS.PIN_HASH]: pinHash,
        [STORAGE_KEYS.SUPABASE_URL]: supabaseUrl,
        [STORAGE_KEYS.SUPABASE_KEY]: supabaseKey,
        [STORAGE_KEYS.IS_SETUP]: true,
        [STORAGE_KEYS.HISTORY]: []
    });

    setupError.style.display = 'none';
    await initSupabase();
    showScreen('mainScreen');
}

// ==================== CAPTURE DE NEWSLETTER ====================

async function extractFromPage() {
    showStatus('Extraction en cours...', 'loading');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractNewsletterContent
        });

        if (results && results[0] && results[0].result) {
            const data = results[0].result;

            if (data.subject) {
                document.getElementById('subjectInput').value = data.subject;
            }
            if (data.content) {
                document.getElementById('contentInput').value = data.content;
            }
            if (data.url) {
                document.getElementById('urlInput').value = data.url;
            }
            if (data.source) {
                document.getElementById('sourceInput').value = data.source;
            }

            showStatus('Contenu extrait !', 'success');
        } else {
            showStatus('Aucun contenu trouvé sur cette page', 'error');
        }
    } catch (error) {
        console.error('Erreur extraction:', error);
        showStatus('Erreur lors de l\'extraction', 'error');
    }
}

// Fonction injectée dans la page pour extraire le contenu
function extractNewsletterContent() {
    const result = {
        subject: '',
        content: '',
        url: window.location.href,
        source: ''
    };

    // Gmail
    if (window.location.hostname === 'mail.google.com') {
        // Sujet
        const subjectEl = document.querySelector('h2[data-thread-perm-id]') ||
                          document.querySelector('.hP') ||
                          document.querySelector('[data-legacy-thread-id] h2');
        if (subjectEl) {
            result.subject = subjectEl.textContent.trim();
        }

        // Expéditeur
        const senderEl = document.querySelector('.gD') ||
                         document.querySelector('[email]') ||
                         document.querySelector('.go');
        if (senderEl) {
            result.source = senderEl.getAttribute('email') || senderEl.textContent.trim();
        }

        // Contenu
        const contentEl = document.querySelector('.a3s.aiL') ||
                          document.querySelector('.ii.gt') ||
                          document.querySelector('[data-message-id] .a3s');
        if (contentEl) {
            result.content = contentEl.innerText.trim();
        }
    }
    // Substack
    else if (window.location.hostname.includes('substack.com')) {
        const titleEl = document.querySelector('h1.post-title') || document.querySelector('h1');
        if (titleEl) result.subject = titleEl.textContent.trim();

        const authorEl = document.querySelector('.author-name') || document.querySelector('[rel="author"]');
        if (authorEl) result.source = authorEl.textContent.trim();

        const contentEl = document.querySelector('.body.markup') || document.querySelector('.post-content');
        if (contentEl) result.content = contentEl.innerText.trim();
    }
    // Beehiiv
    else if (window.location.hostname.includes('beehiiv.com')) {
        const titleEl = document.querySelector('h1');
        if (titleEl) result.subject = titleEl.textContent.trim();

        const contentEl = document.querySelector('[data-testid="post-content"]') || document.querySelector('article');
        if (contentEl) result.content = contentEl.innerText.trim();
    }
    // Page web générique
    else {
        const titleEl = document.querySelector('h1') || document.querySelector('title');
        if (titleEl) result.subject = titleEl.textContent.trim();

        const articleEl = document.querySelector('article') ||
                          document.querySelector('.post-content') ||
                          document.querySelector('.entry-content') ||
                          document.querySelector('main');
        if (articleEl) {
            result.content = articleEl.innerText.trim();
        } else {
            // Fallback: tout le body nettoyé
            const body = document.body.cloneNode(true);
            body.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());
            result.content = body.innerText.trim().substring(0, 10000);
        }
    }

    return result;
}

async function captureNewsletter() {
    const source = document.getElementById('sourceInput').value.trim();
    const subject = document.getElementById('subjectInput').value.trim();
    const content = document.getElementById('contentInput').value.trim();
    const url = document.getElementById('urlInput').value.trim();
    const tagsRaw = document.getElementById('tagsInput').value.trim();

    // Validations
    if (!source) {
        showStatus('La source est requise', 'error');
        return;
    }
    if (!content) {
        showStatus('Le contenu est requis', 'error');
        return;
    }

    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(t => t) : [];

    showStatus('Envoi vers Supabase...', 'loading');

    try {
        if (!supabase) {
            throw new Error('Supabase non initialisé');
        }

        const data = {
            source: source,
            subject: subject || null,
            content: content,
            url: url || null,
            tags: tags,
            status: 'raw',
            captured_at: new Date().toISOString()
        };

        await supabase.insert('newsletter_raw', data);

        // Ajouter à l'historique local
        await addToHistory({ source, subject, captured_at: data.captured_at });

        // Reset form
        document.getElementById('sourceInput').value = '';
        document.getElementById('subjectInput').value = '';
        document.getElementById('contentInput').value = '';
        document.getElementById('urlInput').value = '';
        document.getElementById('tagsInput').value = '';

        showStatus('Newsletter capturée !', 'success');
        await loadHistory();

    } catch (error) {
        console.error('Erreur capture:', error);
        showStatus(`Erreur: ${error.message}`, 'error');
    }
}

// ==================== HISTORIQUE ====================

async function addToHistory(item) {
    const storage = await getStorage([STORAGE_KEYS.HISTORY]);
    const history = storage[STORAGE_KEYS.HISTORY] || [];

    history.unshift(item);

    // Garder seulement les 10 dernières
    if (history.length > 10) {
        history.pop();
    }

    await setStorage({ [STORAGE_KEYS.HISTORY]: history });
}

async function loadHistory() {
    const storage = await getStorage([STORAGE_KEYS.HISTORY]);
    const history = storage[STORAGE_KEYS.HISTORY] || [];
    const historyList = document.getElementById('historyList');

    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty">Aucune capture récente</p>';
        return;
    }

    historyList.innerHTML = history.map(item => {
        const date = new Date(item.captured_at);
        const dateStr = date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="history-item">
                <span class="history-item-icon">📩</span>
                <div class="history-item-info">
                    <div class="history-item-source">${item.source}</div>
                    <div class="history-item-date">${dateStr}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== INITIALISATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier si l'extension est configurée
    const storage = await getStorage([STORAGE_KEYS.IS_SETUP]);

    if (!storage[STORAGE_KEYS.IS_SETUP]) {
        showScreen('setupScreen');
    } else {
        showScreen('lockScreen');
        document.getElementById('pinInput').focus();
    }

    // Event listeners
    document.getElementById('unlockBtn').addEventListener('click', checkPin);
    document.getElementById('pinInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkPin();
    });

    document.getElementById('lockBtn').addEventListener('click', lockExtension);
    document.getElementById('saveSetupBtn').addEventListener('click', saveSetup);
    document.getElementById('extractBtn').addEventListener('click', extractFromPage);
    document.getElementById('captureBtn').addEventListener('click', captureNewsletter);

    // Settings event listeners
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('backBtn').addEventListener('click', () => showScreen('mainScreen'));
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('resetAllBtn').addEventListener('click', resetAll);
});

// ==================== PARAMÈTRES ====================

async function openSettings() {
    const storage = await getStorage([STORAGE_KEYS.SUPABASE_URL, STORAGE_KEYS.SUPABASE_KEY]);

    document.getElementById('editSupabaseUrl').value = storage[STORAGE_KEYS.SUPABASE_URL] || '';
    document.getElementById('editSupabaseKey').value = storage[STORAGE_KEYS.SUPABASE_KEY] || '';

    document.getElementById('settingsError').style.display = 'none';
    document.getElementById('settingsSuccess').style.display = 'none';

    showScreen('settingsScreen');
}

async function saveSettings() {
    const url = document.getElementById('editSupabaseUrl').value.trim();
    const key = document.getElementById('editSupabaseKey').value.trim();
    const errorEl = document.getElementById('settingsError');
    const successEl = document.getElementById('settingsSuccess');

    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!url || !url.includes('supabase')) {
        errorEl.textContent = 'URL Supabase invalide';
        errorEl.style.display = 'block';
        return;
    }

    if (!key || key.length < 20) {
        errorEl.textContent = 'Clé Supabase invalide';
        errorEl.style.display = 'block';
        return;
    }

    await setStorage({
        [STORAGE_KEYS.SUPABASE_URL]: url,
        [STORAGE_KEYS.SUPABASE_KEY]: key
    });

    // Réinitialiser le client Supabase
    await initSupabase();

    successEl.textContent = '✅ Paramètres sauvegardés !';
    successEl.style.display = 'block';

    setTimeout(() => {
        showScreen('mainScreen');
    }, 1500);
}

async function resetAll() {
    if (confirm('Tout réinitialiser ? Tu devras reconfigurer le PIN et Supabase.')) {
        await chrome.storage.local.clear();
        showScreen('setupScreen');
    }
}
