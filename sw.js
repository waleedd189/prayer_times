const CACHE_NAME = 'prayer-app-v2';

// ملفات يتم تخزينها عند التثبيت - مسارات نسبية
const STATIC_ASSETS = [
    './',
    './prayer_times.html',
    './manifest.json'
];

// ======= INSTALL =======
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            // نخزن الملفات الأساسية - نتجاهل الفشل عشان manifest.json ممكن ميكونش موجود
            return Promise.allSettled(
                STATIC_ASSETS.map(url => 
                    cache.add(url).catch(err => console.log('Cache skip:', url, err))
                )
            );
        }).then(function() {
            return self.skipWaiting();
        })
    );
});

// ======= ACTIVATE =======
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

// ======= FETCH =======
self.addEventListener('fetch', function(event) {
    const url = event.request.url;

    // راديو + API: دايماً من الشبكة (مش بنكاشه)
    if (url.includes('qurango.net') ||
        url.includes('api.anthropic.com') ||
        url.includes('workers.dev') ||
        url.includes('aladhan.com')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // Google Fonts: كاشها للـ offline
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(function(cache) {
                return cache.match(event.request).then(function(cached) {
                    if (cached) return cached;
                    return fetch(event.request).then(function(response) {
                        if (response && response.status === 200) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(function() {
                        // الفونتس مش متاحة offline - مشكلش، عندنا system fonts كـ fallback
                        return new Response('', { status: 200, headers: { 'Content-Type': 'text/css' } });
                    });
                });
            })
        );
        return;
    }

    // كل حاجة تانية: cache-first ثم network ثم fallback للصفحة الرئيسية
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
                // offline ومفيش كاش: رجّع الصفحة الرئيسية من الكاش
                return caches.match('./prayer_times.html') || 
                       caches.match('./') ||
                       new Response('<h1>لا يوجد اتصال بالإنترنت</h1>', {
                           headers: { 'Content-Type': 'text/html; charset=utf-8' }
                       });
            });
        })
    );
});
