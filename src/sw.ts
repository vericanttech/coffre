/**
 * Custom service worker: precache app shell (manifest injected at build by vite-plugin-pwa),
 * serve index.html for navigation, and runtime-cache Firebase Storage (thumbnails/originals).
 */
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

precacheAndRoute(self.__WB_MANIFEST);

// SPA: navigation requests fall back to index.html for offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// Firebase Storage: cache thumbnails and originals so previously viewed docs show images offline
registerRoute(
  ({ url }) => url.hostname.includes('firebasestorage.googleapis.com'),
  new CacheFirst({ cacheName: 'trouvedoc-storage' })
);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', () => self.clients.claim());
