// ============================================
// SERVICE WORKER - SOS STORYTELLING B2B
// PWA + Push Notifications
// ============================================

const CACHE_NAME = 'sos-b2b-v1';
const OFFLINE_URL = '/offline.html';

// Files to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/app-b2b.html',
  '/login.html',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ============================================
// INSTALL EVENT
// Cache static assets
// ============================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      })
  );
});

// ============================================
// ACTIVATE EVENT
// Clean up old caches
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH EVENT
// Network first, fallback to cache
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip API requests
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone response to cache
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseClone);
            });
        }
        return response;
      })
      .catch(async () => {
        // Try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
          const offlinePage = await caches.match(OFFLINE_URL);
          if (offlinePage) {
            return offlinePage;
          }
        }

        // Return empty response for other requests
        return new Response('Offline', { status: 503 });
      })
  );
});

// ============================================
// PUSH NOTIFICATIONS
// Handle incoming push messages
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {
    title: 'SOS Storytelling',
    body: 'Tu as un nouveau message !',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    url: '/app-b2b.html'
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = { ...data, ...pushData };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/app-b2b.html',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Ouvrir',
        icon: '/icons/action-open.png'
      },
      {
        action: 'dismiss',
        title: 'Plus tard',
        icon: '/icons/action-dismiss.png'
      }
    ],
    // For iOS
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: data.requireInteraction || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============================================
// NOTIFICATION CLICK
// Handle notification interactions
// ============================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }

  // Open the app
  const urlToOpen = event.notification.data?.url || '/app-b2b.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) {
            return client.focus();
          }
        }

        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ============================================
// NOTIFICATION CLOSE
// Track notification dismissals
// ============================================
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed without action');

  // Could track this for analytics
  const data = event.notification.data;
  if (data && data.analyticsId) {
    // Send analytics event
  }
});

// ============================================
// BACKGROUND SYNC
// Sync data when back online
// ============================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'sync-mood') {
    event.waitUntil(syncMoodData());
  }

  if (event.tag === 'sync-content') {
    event.waitUntil(syncContentData());
  }
});

async function syncMoodData() {
  // Get pending mood updates from IndexedDB
  // Send to server
  console.log('[SW] Syncing mood data...');
}

async function syncContentData() {
  // Get pending content from IndexedDB
  // Send to server
  console.log('[SW] Syncing content data...');
}

// ============================================
// MESSAGE HANDLER
// Communication with main app
// ============================================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ cleared: true });
    });
  }
});

// ============================================
// PERIODIC BACKGROUND SYNC
// For daily message refresh (if supported)
// ============================================
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);

  if (event.tag === 'daily-refresh') {
    event.waitUntil(refreshDailyContent());
  }
});

async function refreshDailyContent() {
  // Fetch latest daily message
  // Update cache
  console.log('[SW] Refreshing daily content...');
}
