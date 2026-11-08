/* TRANSFORM 42 service worker.
 *
 * What it does: keeps the app files in ONE cache owned by this app so the app opens offline.
 * What it never does: touch caches owned by other apps or sites, cache third-party requests,
 * cache sensitive responses, or read/write your saved data (that lives in the page's own storage).
 */
'use strict';

// Every cache this app creates starts with this prefix. Only names with this prefix are ever deleted.
const APP_PREFIX = 'transform42-';
// Stamped by stamp.py from the contents of every precached file and of this file. Do not edit by hand.
const BUILD = '96c9e76e3763';
const SHELL_CACHE = APP_PREFIX + 'shell-' + BUILD;

// The app shell: everything the app needs to start with no network.
const SHELL = [
  './index.html',
  './offline.html',
  './pwa.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './fonts/inter-latin-400-normal.woff2',
  './fonts/inter-latin-500-normal.woff2',
  './fonts/inter-latin-600-normal.woff2',
  './fonts/fraunces-latin-600-normal.woff2'
];

const SHELL_URLS = SHELL.map(p => new URL(p, self.location).href);
const INDEX_URL = new URL('./index.html', self.location).href;
const OFFLINE_URL = new URL('./offline.html', self.location).href;
const SCOPE_PATH = new URL('./', self.location).pathname;
const STATIC_RE = /\.(?:png|webmanifest|woff2|css|js|ico|svg)$/i;

// INSTALL: download the whole shell into this version's own cache. If any file fails, the install
// fails as a whole and the currently active version keeps running untouched.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_URLS.map(u => new Request(u, { cache: 'reload' })));
    // No skipWaiting() here: an update waits until the person chooses to apply it.
  })());
});

// ACTIVATE: this version is now in charge. Take over open pages, then (and only then) remove
// superseded TRANSFORM 42 caches. Caches without our prefix are never listed for deletion.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.allSettled(
      keys.filter(k => k.startsWith(APP_PREFIX) && k !== SHELL_CACHE).map(k => caches.delete(k))
    );
  })());
});

// Messages from the page: apply a waiting update, or report which version is running.
self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  else if (data.type === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'VERSION', build: BUILD, cache: SHELL_CACHE });
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                          // never touch anything that writes
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // third-party: the browser handles it, we never cache it
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  if (url.searchParams.has('t42ping')) {                     // connection check: always the real network
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }
  if (req.mode === 'navigate') { event.respondWith(navigate(req, url)); return; }
  if (STATIC_RE.test(url.pathname)) { event.respondWith(cacheFirst(req, url)); return; }
  event.respondWith(networkFirst(req));
});

const shellCache = () => caches.open(SHELL_CACHE);           // always OUR cache, never caches.match()

function cacheable(res) {
  return !!res && res.ok && res.status === 200 && res.type === 'basic' &&
    !/no-store|private/i.test(res.headers.get('Cache-Control') || '');
}
function unavailable(kind) {
  return new Response('This file isn\u2019t available offline.', {
    status: 503, statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-T42': kind }
  });
}

// Pages. The app opens from its own cache (so it matches the cached scripts and fonts exactly);
// a new version arrives through the update flow, never by silently mixing files.
async function navigate(req, url) {
  const cache = await shellCache();
  const isApp = url.pathname === SCOPE_PATH || url.pathname === SCOPE_PATH + 'index.html';
  if (isApp) {
    const hit = await cache.match(INDEX_URL);
    if (hit) return hit;
  }
  try { return await fetch(req); }
  catch (_) { return (await cache.match(OFFLINE_URL)) || unavailable('offline-page'); }
}

// Static files: our cache first. A missing shell file is fetched and restored only if the response is safe to store.
async function cacheFirst(req, url) {
  const cache = await shellCache();
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    const key = url.origin + url.pathname;
    if (SHELL_URLS.indexOf(key) !== -1 && cacheable(res)) await cache.put(key, res.clone());
    return res;
  } catch (_) { return unavailable('static'); }
}

// Anything else on our own origin: network first. We keep nothing extra, so we fall back
// only to a copy that is already part of the shell, then to a clear "unavailable" answer.
async function networkFirst(req) {
  try { return await fetch(req); }
  catch (_) {
    const cache = await shellCache();
    return (await cache.match(req)) || unavailable('network');
  }
}
