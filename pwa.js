/* TRANSFORM 42: offline and install support.
 * Registers the service worker, shows connection status, and handles updates.
 * Nothing here sends data anywhere. All progress stays on this device. */
(function () {
  'use strict';
  var online = navigator.onLine !== false, updateRequested = false;
  var hadController = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  var $ = function (id) { return document.getElementById(id); };

  // ---- small self-contained UI (own styles, so it works whatever the app does) ----
  var css = '.t42p{position:fixed;z-index:90;background:#0B1A33;color:#fff;border:1px solid #3FBF8A;border-radius:12px;padding:10px 14px;font:500 14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 6px 20px #0007;display:none;max-width:min(380px,calc(100% - 24px))}' +
    '.t42p.on{display:block}.t42p b{color:#3FBF8A}.t42p button{font:600 14px system-ui,sans-serif;border-radius:9px;padding:7px 12px;cursor:pointer;margin:8px 8px 0 0;border:1px solid #ffffff66;background:transparent;color:#fff}.t42p button.go{background:#3FBF8A;border-color:#3FBF8A;color:#06251a}' +
    '#t42-status{left:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px))}#t42-note{left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom,0px));text-align:center}' +
    '#t42-update{left:50%;transform:translateX(-50%);top:calc(12px + env(safe-area-inset-top,0px))}';
  function mount() {
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    [['t42-status', 'status'], ['t42-note', 'status'], ['t42-update', 'alert']].forEach(function (x) {
      var d = document.createElement('div'); d.id = x[0]; d.className = 't42p'; d.setAttribute('role', x[1]); document.body.appendChild(d);
    });
    paint();
  }
  var noteTimer, backTimer;
  function note(text, ms) {
    var n = $('t42-note'); if (!n) return;
    n.textContent = text; n.classList.add('on');
    clearTimeout(noteTimer); noteTimer = setTimeout(function () { n.classList.remove('on'); }, ms || 6000);
  }

  // ---- connection status ----
  function paint(back) {
    var s = $('t42-status'); if (!s) return;
    document.documentElement.setAttribute('data-network', online ? 'online' : 'offline');
    if (!online) { s.innerHTML = '<b>Offline.</b> Everything you record is saved on this device.'; s.classList.add('on'); }
    else if (back) {
      s.innerHTML = '<b>Back online.</b>'; s.classList.add('on');
      clearTimeout(backTimer); backTimer = setTimeout(function () { s.classList.remove('on'); }, 3000);
    } else s.classList.remove('on');
  }
  function setOnline(v) {
    if (v === online) return;
    online = v; paint(v);
    try { window.dispatchEvent(new CustomEvent('t42:network', { detail: { online: v } })); } catch (_) {}
  }
  // navigator.onLine only knows about the network adapter, so also ask our own server.
  function probe() {
    if (location.protocol.indexOf('http') !== 0) return Promise.resolve();
    if (navigator.onLine === false) { setOnline(false); return Promise.resolve(); }
    return fetch('./manifest.webmanifest?t42ping=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { setOnline(r.status < 500); }, function () { setOnline(false); });
  }
  window.addEventListener('online', probe);
  window.addEventListener('offline', function () { setOnline(false); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) probe(); });
  setInterval(function () { if (!document.hidden) probe(); }, 30000);

  // ---- features that really need the internet ----
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (_) { return; }
    if (u.origin === location.origin || /^(mailto|tel|blob|data|javascript):$/.test(u.protocol)) return;
    if (!online) {
      e.preventDefault(); e.stopPropagation();
      note(/calendar\.google\.com/.test(u.hostname) ?
        'Add to Google Calendar needs an internet connection. Try again when you\u2019re back online. \u201cDownload calendar file\u201d works offline.' :
        'That link needs an internet connection. Try again when you\u2019re back online.', 8000);
    }
  }, true);

  // ---- updates ----
  function flush() { try { if (typeof window.jFlush === 'function') window.jFlush(); } catch (_) {} }
  function offerUpdate(worker) {
    var u = $('t42-update'); if (!u) return;
    u.innerHTML = '<b>A new version is ready.</b><br>Your saved data stays as it is.<br><button class="go" id="t42-update-now">Update now</button><button id="t42-update-later">Later</button>';
    u.classList.add('on');
    $('t42-update-now').onclick = function () { updateRequested = true; flush(); worker.postMessage({ type: 'SKIP_WAITING' }); u.innerHTML = 'Updating\u2026'; };
    $('t42-update-later').onclick = function () { u.classList.remove('on'); };
  }
  function offerReload() {
    var u = $('t42-update'); if (!u) return;
    u.innerHTML = '<b>TRANSFORM 42 was updated in another tab.</b><br><button class="go" id="t42-reload">Reload</button><button id="t42-reload-later">Later</button>';
    u.classList.add('on');
    $('t42-reload').onclick = function () { flush(); location.reload(); };
    $('t42-reload-later').onclick = function () { u.classList.remove('on'); };
  }
  function track(worker, first) {
    worker.addEventListener('statechange', function () {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
      if (worker.state === 'activated' && first) note('Ready to use offline.', 5000);
    });
  }
  function register() {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(function (reg) {
      if (reg.installing) track(reg.installing, !navigator.serviceWorker.controller);
      if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () { if (reg.installing) track(reg.installing, !navigator.serviceWorker.controller); });
      var check = function () { reg.update().catch(function () {}); };
      document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
      setInterval(check, 60 * 60 * 1000);
    }).catch(function () { /* a registration problem never stops the app from working */ });
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController) { hadController = true; return; }     // first install taking control: no reload needed
      if (reloading) return;
      if (updateRequested) { reloading = true; location.reload(); } else offerReload();
    });
  }

  window.T42 = { probe: probe, online: function () { return online; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) window.addEventListener('load', register);
  if (location.protocol.indexOf('http') === 0) window.addEventListener('load', function () { setTimeout(probe, 500); });
})();
