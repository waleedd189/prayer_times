const CACHE_NAME = 'prayer-app-v1';
const ASSETS = [
    '/',
    '/index.html',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&family=Amiri:ital@0;1&display=swap'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll([
                '/',
                '/index.html'
            ]);
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.filter(function(name) {
                    return name !== CACHE_NAME;
                }).map(function(name) {
                    return caches.delete(name);
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);

    // راديو البث: دايماً من الشبكة (مش بنكاشه)
    if (event.request.url.includes('qurango.net') ||
        event.request.url.includes('api.anthropic.com') ||
        event.request.url.includes('workers.dev')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Google Fonts: cache-first
    if (event.request.url.includes('fonts.googleapis.com') ||
        event.request.url.includes('fonts.gstatic.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(function(cache) {
                return cache.match(event.request).then(function(cached) {
                    if (cached) return cached;
                    return fetch(event.request).then(function(response) {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                });
            })
        );
        return;
    }

    // كل حاجة تانية: cache-first ثم network
    event.respondWith(
        caches.match(event.request).then(function(cached) {
            if (cached) return cached;

            return fetch(event.request).then(function(response) {
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
                return response;
            }).catch(function() {
                // لو مفيش نت ومفيش كاش - رجّع صفحة الـ index
                return caches.match('/index.html');
            });
        })
    );
});
