const CACHE_NAME = 'zotov-navigator-v1';

// Статические ресурсы — кэшируются при установке
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/main.js',
  '/js/scene.js',
  '/js/building.js',
  '/js/routing.js',
  '/js/api.js',
  '/js/ui.js',
  '/manifest.json',
  '/icons/icon.svg',
];

// Установка: кэшируем статику
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Активация: удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Стратегия запросов:
// - /api/** → network-first (данные должны быть свежими)
// - /api/floors, /api/zones → cache-first (карта здания не меняется)
// - всё остальное → cache-first (статика)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    // Карта здания — кэшируем надолго
    if (url.pathname.startsWith('/api/floors') || url.pathname.startsWith('/api/zones')) {
      event.respondWith(cacheFirst(event.request));
    } else {
      // События и маршруты — всегда свежие, кэш как фолбэк
      event.respondWith(networkFirst(event.request));
    }
  } else {
    event.respondWith(cacheFirst(event.request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Оффлайн — возвращаем index.html как фолбэк для навигации
    return caches.match('/index.html');
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(request);
  }
}
