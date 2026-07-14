const CACHE_NAME = 'training-tracker-v1';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request).then(fetchRes => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, fetchRes.clone());
                        return fetchRes;
                    });
                });
            }).catch(() => {
                // If offline and request fails, try serving index.html for navigation
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});

// Periodic Background Sync for Daily Reminders
self.addEventListener('periodicsync', event => {
    if (event.tag === 'daily-reminder') {
        event.waitUntil(checkAndSendReminder());
    }
});

async function checkAndSendReminder() {
    // In a Service Worker without direct access to localStorage, we use IndexedDB in a real scenario.
    // However, since we rely primarily on the frontend interval and window checking (as per user limitations),
    // this acts as a best-effort background check if the user has supported browsers and IndexedDB wired.
    // For this simple localStorage implementation, periodic sync from SW is limited without migrating to IndexedDB.
    // We will fire a generic reminder if we wake up via periodicsync.
    
    const timeToLog = "Time to log today's training — don't break your streak.";
    self.registration.showNotification("Training Reminder", {
        body: timeToLog,
        icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2MxNDQwZSI+PHBhdGggZD0iTTEzLjUgNS41Yy44MyAwIDEuNS0uNjcgMS41LTEuNVMxNC4zMyAyLjUgMTMuNSAyLjUgMTIgMy4xNyAxMiA0czLjY3IDEuNSAxLjUgMS41ek0xNSAxNS41bDIuNSAyLjNWMjRINTF2LTUuNWwtMi4zLTIuM3YtMy40bDItLjYgMS40IDEuNWMtLjQuOC0xIDEuNS0xLjYgMS45TDExLjUgMjA4em0tNy0zLjVMMiA5di0yaDMuM2wxLjcgMS40TDExIDd2LTJjMC0xLjEtLjktMi0yLTJINi41QzUuMSAzIDQgNC4xIDQgNS41UzUuMSA4IDYuNSA4SDdWNi41Yy0uNiAwLTEuMS0uNC0xLjEtMWgwem0xMy0zYzEuMSAwIDItLjkgMi0ydjJIMjBsLTEuNy0xLjRMMTQgOS40di0yLjV6Ii8+PC9zdmc+",
        vibrate: [200, 100, 200],
        tag: 'daily-reminder-notification'
    });
}
