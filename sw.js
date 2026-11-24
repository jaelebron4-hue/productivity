// Service worker : fonctionnement hors ligne.
// Stratégie « stale-while-revalidate » : réponse instantanée depuis le cache,
// mise à jour en arrière-plan. Incrémentez VERSION à chaque déploiement.
const VERSION = 'pt-v2';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js', 'js/bus.js', 'js/charts.js', 'js/components.js', 'js/domain.js', 'js/editors.js',
  'js/icons.js', 'js/seed.js', 'js/store.js', 'js/sync.js', 'js/ui.js', 'js/utils.js',
  'js/views/dashboard.js', 'js/views/tasks.js', 'js/views/habits.js', 'js/views/goals.js',
  'js/views/stats.js', 'js/views/settings.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // l'API GitHub passe directement
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: true });
      const network = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(key, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
