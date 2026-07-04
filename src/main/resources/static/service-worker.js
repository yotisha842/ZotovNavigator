const CACHE_PREFIX = 'zotov-navigator-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const STATIC_ASSETS = [
    '/', '/index.html', '/css/styles.css', '/manifest.json', '/icons/icon.svg',
    '/js/main.js', '/js/scene.js', '/js/building.js', '/js/routing.js', '/js/api.js',
    '/js/ui.js', '/js/chat.js',
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME)
        .then(cache => cache.addAll(STATIC_ASSETS))
        .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys
            .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map(key => caches.delete(key))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;
    event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            try {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, response.clone());
            } catch { /* A full cache must not break a successful response. */ }
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('/index.html');
        return new Response(JSON.stringify({ detail: 'Нет подключения к серверу' }), {
            status: 503,
            headers: { 'Content-Type': 'application/problem+json; charset=utf-8' },
        });
    }
}
