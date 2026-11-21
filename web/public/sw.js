/* Minimal service worker: lets the browser offer "Install app". Network-first, no caching of API or health data. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* pass through to the network */ });
