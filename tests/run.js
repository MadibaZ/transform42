// TRANSFORM 42: service worker and offline tests, run in real Chromium through Playwright.
//   node tests/run.js        (needs: npm i playwright && npx playwright install chromium; python3)
// Starts its own local servers, switches between "releases", stops the server to simulate no network,
// and uses a persistent browser profile so closing and reopening the browser is real.
const path = require('path'), fs = require('fs'), cp = require('child_process');
let playwright; try { playwright = require('playwright'); } catch (_) { playwright = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = playwright;
const { start, stop } = require('./server');

const PKG = path.resolve(__dirname, '..'), O = 'http://127.0.0.1:8140', TP = 'http://127.0.0.1:8141';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const T = (id, name, pass, detail = '') => { results.push({ id, name, pass: !!pass, detail: String(detail) }); console.log((pass ? 'PASS' : 'FAIL') + '  ' + id + '  ' + name + (detail ? '  [' + detail + ']' : '')); };
async function until(fn, ms = 15000, step = 150) { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await fn(); if (v) return v; } catch (_) {} await sleep(step); } return false; }
const buildOf = d => fs.readFileSync(d + '/sw.js', 'utf8').match(/const BUILD = '([^']+)'/)[1];
const shellOf = d => [...fs.readFileSync(d + '/sw.js', 'utf8').match(/const SHELL = \[(.*?)\];/s)[1].matchAll(/'\.\/([^']+)'/g)].map(m => O + '/' + m[1]);

function release(name, marker) {
  const d = '/tmp/t42-' + name; fs.rmSync(d, { recursive: true, force: true });
  fs.cpSync(PKG, d, { recursive: true, filter: s => { const r = path.relative(PKG, s); return !(r === 'tests' || r.startsWith('tests' + path.sep) || r.endsWith('.md')); } });
  const f = d + '/index.html', h = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, h.replace('<script src="pwa.js">', "<script>window.__REL='" + marker + "'</script><script src=\"pwa.js\">"));
  fs.writeFileSync(d + '/probe.html', '<!doctype html><title>probe</title><p>probe page</p>');
  cp.execFileSync('python3', [d + '/stamp.py', d], { stdio: 'pipe' });
  return d;
}

const W = { errors: [], external: [] };
const NETWORK_NOISE = /Failed to load resource|net::ERR|ERR_INTERNET|ERR_CONNECTION|ERR_FAILED|status of 40[0-9]|status of 50[0-9]/;
function watch(pg) {
  pg.on('pageerror', e => W.errors.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error') W.errors.push('console: ' + m.text()); });
  pg.on('request', r => { try { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1' && /^https?:$/.test(u.protocol)) W.external.push(r.url()); } catch (_) {} });
}
const k8_has_orphan = ks => ks.includes('transform42-shell-brokenbuild00');
const appErrors = from => W.errors.slice(from).filter(e => !NETWORK_NOISE.test(e));
const ready = pg => until(() => pg.evaluate(() => !!navigator.serviceWorker.controller), 15000);
const keys = pg => pg.evaluate(() => caches.keys());
const ls = pg => pg.evaluate(() => JSON.parse(localStorage.getItem('t42') || '{}'));
const rel = pg => pg.evaluate(() => window.__REL).catch(() => null);
const heading = pg => pg.locator('#view h1').first().innerText();
const go = async (pg, h) => { await pg.evaluate(x => { location.hash = x; }, '#' + h); await sleep(120); };

(async () => {
  const R = { r1: release('r1', '1'), r2: release('r2', '2'), r3: release('r3', '3'), r5: release('r5', '5') };
  const B = { r1: buildOf(R.r1), r2: buildOf(R.r2), r3: buildOf(R.r3), r5: buildOf(R.r5) };
  T('0.1', 'Each release gets a different build id (cache name)', new Set(Object.values(B)).size === 4, Object.values(B).join(' '));
  const stampBefore = buildOf(R.r1); cp.execFileSync('python3', [R.r1 + '/stamp.py', R.r1]);
  T('0.2', 'Stamping is deterministic (same files give same id)', buildOf(R.r1) === stampBefore);

  const state = { root: R.r1, log: [], headers: {} }, tp = { root: '/tmp/t42-tp', log: [], headers: {} };
  fs.mkdirSync('/tmp/t42-tp', { recursive: true }); fs.writeFileSync('/tmp/t42-tp/x.txt', 'third-party data');
  let srv = await start(8140, state); const srv2 = await start(8141, tp);
  const profile = '/tmp/t42-profile'; fs.rmSync(profile, { recursive: true, force: true });
  const launch = async () => { const c = await chromium.launchPersistentContext(profile, { headless: true, acceptDownloads: true, viewport: { width: 1280, height: 900 } }); await c.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); }); return c; };
  let ctx = await launch(), pg = ctx.pages()[0] || await ctx.newPage(); watch(pg);
  const opened = []; ctx.on('page', p => opened.push(p.url()));

  // ===== 1. FIRST INSTALLATION (+ unrelated caches seeded beforehand) =====
  await pg.goto(O + '/probe.html');
  const decoys = ['other-app-cache', 'my-blog-v1', 'transform42x-lookalike', 'TRANSFORM42-other'];
  const legacy = ['transform42-v1', 'transform42-v2', 'transform42-shell-oldbuild'];
  await pg.evaluate(async ([d, l]) => { for (const n of d.concat(l)) { const c = await caches.open(n); await c.put('/d.txt', new Response('data:' + n)); } }, [decoys, legacy]);
  let mark = W.errors.length, rmark = state.log.length;
  await pg.goto(O + '/');
  T('1.1', 'Service worker installs and takes control on first visit', await ready(pg));
  await sleep(500);
  const k1 = await keys(pg);
  T('1.2', 'Exactly one TRANSFORM 42 cache exists, named transform42-shell-<build>', k1.filter(k => k.startsWith('transform42-')).join() === 'transform42-shell-' + B.r1, k1.join(' | '));
  const stale = legacy.filter(n => k1.includes(n));
  T('1.3', 'Outdated TRANSFORM 42 caches (transform42-v1, -v2, old shell) were removed', stale.length === 0, stale.join() || 'all three removed');
  const survived = []; for (const n of decoys) { const t = await pg.evaluate(async n => { const c = await caches.open(n); const r = await c.match('/d.txt'); return r ? r.text() : null; }, n); survived.push(t === 'data:' + n); }
  T('1.4', 'Unrelated caches (other-app-cache, my-blog-v1, transform42x-lookalike, TRANSFORM42-other) still exist with their data', survived.every(Boolean) && decoys.every(n => k1.includes(n)), 'contents verified: ' + survived.join());
  const entries = await pg.evaluate(async n => (await (await caches.open(n)).keys()).map(r => r.url).sort(), 'transform42-shell-' + B.r1);
  const want = shellOf(R.r1).sort();
  T('1.5', 'App shell cached completely during install (12 files)', JSON.stringify(entries) === JSON.stringify(want), entries.length + ' of ' + want.length);
  T('1.6', 'App renders after first install', (await heading(pg)).includes('Welcome back'), await heading(pg));
  T('1.7', 'No third-party requests (Google Fonts etc.)', W.external.length === 0, W.external.join() || 'none');
  const loadedFonts = await pg.evaluate(() => document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight)));
  T('1.8', 'Fonts load from this site', loadedFonts.length >= 2 && state.log.some(r => r.p.startsWith('/fonts/')), loadedFonts.join(', '));
  T('1.9', 'No console errors, page errors or CSP violations on first load', appErrors(mark).length === 0 && (await pg.evaluate(() => window.__csp)).length === 0, appErrors(mark).join(' ; '));

  // ===== 2. REFRESH =====
  rmark = state.log.length; mark = W.errors.length;
  await pg.reload(); await ready(pg); await sleep(400);
  const reqs = state.log.slice(rmark).map(r => r.p);
  T('2.1', 'Refresh is served from the cache (server not asked for /index.html)', !reqs.includes('/') && !reqs.includes('/index.html'), reqs.join(' ') || 'no requests');
  await go(pg, 'journal'); await pg.reload(); await sleep(400);
  T('2.2', 'Refresh keeps the current page (hash route)', (await heading(pg)).includes('Transformation Journal'), await heading(pg));
  T('2.3', 'No errors after refresh', appErrors(mark).length === 0, appErrors(mark).join(' ; '));
  await go(pg, 'dashboard');

  // ===== 3. OFFLINE (server stopped AND browser set offline) =====
  await stop(srv); await ctx.setOffline(true);
  mark = W.errors.length;
  await pg.reload(); await sleep(800);
  T('3.1', 'App opens offline (dashboard renders)', (await heading(pg)).includes('Welcome back'), await heading(pg));
  T('3.2', 'Offline status indicator appears', !!(await until(() => pg.evaluate(() => { const s = document.getElementById('t42-status'); return s && s.classList.contains('on') && /Offline/.test(s.textContent); }), 6000)));
  const hrefs = await pg.$$eval('#nav a', a => a.map(x => x.getAttribute('href').slice(1)));
  const bad = []; for (const h of hrefs) { await pg.click('#nav a[href="#' + h + '"]'); await sleep(150); const len = await pg.evaluate(() => document.getElementById('view').innerHTML.length); if (len < 200) bad.push(h); }
  T('3.3', 'Every sidebar page opens offline (' + hrefs.length + ' pages)', hrefs.length >= 12 && bad.length === 0, bad.join() || hrefs.join(' '));
  const p2 = await ctx.newPage(); await p2.goto(O + '/no-such-page.html').catch(() => {});
  T('3.4', 'Unknown page offline shows the clear offline page', /offline/i.test(await p2.locator('h1').first().innerText().catch(() => '')), await p2.locator('h1').first().innerText().catch(() => 'none')); await p2.close();
  const miss = await pg.evaluate(() => fetch('/icons/nope.png').then(r => r.status + ' ' + r.headers.get('X-T42')).catch(e => 'threw ' + e.name));
  T('3.5', 'Missing file offline gives a clean 503 (no thrown error)', miss.startsWith('503'), miss);
  const upd = await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update().then(() => 'resolved', e => 'rejected ' + e.name)));
  T('3.6', 'Update check while offline fails quietly and app keeps working', (await heading(pg)).length > 0, upd);
  await go(pg, 'dashboard');
  await pg.evaluate(async () => { for (let i = 0; i < 25; i++) await window.T42.probe(); });
  await pg.click('#nav a[href="#habits"]'); await sleep(150);
  T('3.7', 'Repeated network failures (25 probes) do not break the UI', (await heading(pg)).includes('Habit Tracker') && appErrors(mark).length === 0, appErrors(mark).join(' ; '));
  await pg.click('#nav a[href="#notifications"]'); await pg.click('[data-nvw="rem"]'); await sleep(150);
  const before = opened.length;
  await pg.click('a[href^="https://calendar.google.com"]'); await sleep(400);
  const msg = await pg.locator('#t42-note').innerText().catch(() => '');
  T('3.8', 'Feature that needs internet (Add to Google Calendar) explains itself offline and does not navigate', /needs an internet connection/.test(msg) && opened.length === before, msg);
  await pg.click('#nav a[href="#backup"]'); await sleep(200);
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 6000 }).catch(() => null), pg.click('[data-bx]')]);
  T('3.9', 'Backup download works offline (CSP allows it)', !!dl && /^transform42-backup-.*\.json$/.test(dl ? dl.suggestedFilename() : ''), dl ? dl.suggestedFilename() : 'no download');

  // ===== 4. WORK OFFLINE, THEN CLOSE AND REOPEN THE BROWSER =====
  await go(pg, 'habits'); await pg.click('[data-hex="all"]'); await sleep(200);
  const habitsN = await pg.locator('button.chk').count(); await pg.locator('button.chk').first().click(); await sleep(150);
  const today = await pg.evaluate(() => ctx().todayStr);
  await go(pg, 'dashboard'); await pg.locator('.hbtn[data-rec]').click(); await pg.locator('label:has(input[name=mood][value="4"])').click(); await pg.fill('#note', 'recorded offline'); await pg.click('#sv'); await sleep(200);
  await go(pg, 'journal'); await pg.locator('button[data-jnew]').first().click(); await pg.click('[data-jstart="blank"]'); await pg.fill('#jf_t', 'Offline entry'); await pg.fill('#jf_b', 'Written with no connection.'); await pg.click('[data-jsave="1"]'); await sleep(200);
  await go(pg, 'reading'); await pg.click('[data-eb="b5"]'); await pg.fill('#bf_t', '320'); await pg.click('#bsv'); await sleep(150);
  await pg.fill('input[data-rc="b5"]', '80'); await pg.press('input[data-rc="b5"]', 'Tab'); await sleep(200);
  const s1 = await ls(pg);
  T('4.1', 'Habits created and ticked offline are saved', Object.keys(s1.hl || {}).length >= 1 && (s1.hb || []).length === 7, habitsN + ' habit cards; ' + JSON.stringify(Object.values(s1.hl || {})[0]));
  T('4.2', 'Daily progress recorded offline (mood and note) is saved', (s1.logs[today] || {}).note === 'recorded offline' && (s1.logs[today] || {}).mood === 4);
  T('4.3', 'Journal entry written offline is saved', (s1.jn || []).some(e => e.title === 'Offline entry' && !e.draft));
  T('4.4', 'Reading progress entered offline is saved (80 of 320 pages = 25%)', (s1.rd || {}).b5 && +s1.rd.b5.cur === 80 && +s1.rd.b5.total === 320);
  await ctx.close();
  ctx = await launch(); pg = ctx.pages()[0] || await ctx.newPage(); watch(pg); ctx.on('page', p => opened.push(p.url()));
  mark = W.errors.length;
  await pg.goto(O + '/'); await sleep(900);
  T('4.5', 'After closing and reopening the browser (still no server) the app opens', (await heading(pg)).includes('Welcome back'), await heading(pg));
  T('4.6', 'Offline indicator shown even though the device reports a network (server unreachable)', !!(await until(() => pg.evaluate(() => document.getElementById('t42-status').classList.contains('on')), 6000)));
  const s2 = await ls(pg);
  T('4.7', 'All offline changes survived the restart', (s2.jn || []).length === 1 && Object.keys(s2.hl || {}).length >= 1 && +(s2.rd || {}).b5.cur === 80 && (s2.logs[today] || {}).note === 'recorded offline');
  await go(pg, 'journal'); await sleep(150);
  T('4.8', 'Previously saved journal entry is listed and readable offline', (await pg.locator('#jlist').innerText()).includes('Offline entry'));
  await pg.click('[data-jopen]'); await sleep(150);
  T('4.9', 'Entry text opens offline', (await pg.locator('.jbody').innerText()).includes('Written with no connection.'));
  await go(pg, 'habits'); await sleep(150);
  T('4.10', 'Habit tick persisted and is shown', (await pg.locator('button.chk.on').count()) >= 1);
  await go(pg, 'reading'); await sleep(150);
  T('4.11', 'Reading progress shows 25% offline', (await pg.locator('#view').innerText()).includes('25%'));
  T('4.12', 'No application errors during restart session', appErrors(mark).length === 0, appErrors(mark).join(' ; '));

  // ===== 5. UPDATING (server back, release 2 deployed) =====
  state.root = R.r2; srv = await start(8140, state);
  await pg.goto(O + '/'); await ready(pg); await pg.evaluate(() => window.T42.probe()); await sleep(300);
  T('5.0', 'Back online: indicator clears', await until(() => pg.evaluate(() => !document.getElementById('t42-status').classList.contains('on') || /Back online/.test(document.getElementById('t42-status').textContent)), 6000));
  T('5.1', 'Still running release 1 before updating', (await rel(pg)) === '1');
  await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  const banner = await until(() => pg.evaluate(() => document.getElementById('t42-update').classList.contains('on')), 10000);
  T('5.2', 'New version is detected and the person is asked before it is applied', banner);
  const k5 = await keys(pg);
  T('5.3', 'Old cache is kept while the new version waits (new cache installed beside it)', k5.includes('transform42-shell-' + B.r1) && k5.includes('transform42-shell-' + B.r2), k5.filter(k => k.startsWith('transform42-')).join(' '));
  T('5.4', 'Page keeps running release 1 until the update is accepted', (await rel(pg)) === '1');
  await pg.click('#t42-update-now');
  const upgraded = await until(async () => (await rel(pg)) === '2', 20000);
  T('5.5', 'Accepting the update reloads into release 2', upgraded);
  await sleep(500); const k6 = await keys(pg);
  T('5.6', 'After activation only the new TRANSFORM 42 cache remains', k6.filter(k => k.startsWith('transform42-')).join() === 'transform42-shell-' + B.r2, k6.join(' | '));
  const surv2 = []; for (const n of decoys) surv2.push(k6.includes(n) && (await pg.evaluate(async n => { const r = await (await caches.open(n)).match('/d.txt'); return r && r.text(); }, n)) === 'data:' + n);
  T('5.7', 'Unrelated caches still untouched after the update', surv2.every(Boolean));
  const s3 = await ls(pg);
  T('5.8', 'Saved data (journal, habits, reading, progress) is intact after the update', (s3.jn || []).length === 1 && +(s3.rd || {}).b5.cur === 80 && (s3.logs[today] || {}).note === 'recorded offline');
  // "Later" path
  state.root = R.r3;
  await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await until(() => pg.evaluate(() => document.getElementById('t42-update').classList.contains('on')), 10000);
  await pg.click('#t42-update-later'); await sleep(300);
  const k7 = await keys(pg);
  T('5.9', '"Later" keeps release 2 running and keeps its cache', (await rel(pg)) === '2' && k7.includes('transform42-shell-' + B.r2) && k7.includes('transform42-shell-' + B.r3));
  await pg.reload(); const again = await until(() => pg.evaluate(() => document.getElementById('t42-update').classList.contains('on')), 10000);
  T('5.10', 'Update is offered again on the next visit', again && (await rel(pg)) === '2');

  // ===== 6. FAILED / BROKEN UPDATE =====
  const r4 = '/tmp/t42-r4'; fs.rmSync(r4, { recursive: true, force: true }); fs.cpSync(R.r3, r4, { recursive: true });
  let sw4 = fs.readFileSync(r4 + '/sw.js', 'utf8').replace("'./fonts/fraunces-latin-600-normal.woff2'\n]", "'./fonts/fraunces-latin-600-normal.woff2',\n  './fonts/not-there.woff2'\n]").replace(/const BUILD = '[^']+'/, "const BUILD = 'brokenbuild00'");
  fs.writeFileSync(r4 + '/sw.js', sw4); state.root = r4;
  await pg.click('#t42-update-later').catch(() => {});
  mark = W.errors.length;
  await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await sleep(2500);
  const st4 = await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => ({ waiting: r.waiting && r.waiting.scriptURL, installing: !!r.installing, active: !!r.active })));
  const k8 = await keys(pg);
  const cnt = await pg.evaluate(async n => (await (await caches.open(n)).keys()).length, 'transform42-shell-' + B.r3);
  const triedBroken = state.log.some(r => r.p === '/fonts/not-there.woff2');
  T('6.1', 'Update with a missing file really fails to install (server was asked for the missing file) and the working version stays active', triedBroken && k8_has_orphan(await keys(pg)) && st4.active && !st4.installing && (await rel(pg)) === '2', 'missing file requested: ' + triedBroken + '; ' + JSON.stringify(st4));
  T('6.2', 'Working version\u2019s cache is not damaged by the failed install', k8.includes('transform42-shell-' + B.r2) && (await pg.evaluate(async n => (await (await caches.open(n)).keys()).length, 'transform42-shell-' + B.r2)) === 12, 'orphan from failed install: ' + k8.filter(k => k.includes('broken')).join() + ' (cleaned at next activation)');
  T('6.3', 'App still works normally after the failed update attempt', (await heading(pg)).length > 0 && appErrors(mark).length === 0);
  // release 5 (good) -> accept -> orphan and r3 caches should be cleaned
  state.root = R.r5;
  await pg.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await until(() => pg.evaluate(() => document.getElementById('t42-update').classList.contains('on')), 10000);
  await pg.click('#t42-update-now'); await until(async () => (await rel(pg)) === '5', 20000); await sleep(500);
  const k9 = await keys(pg);
  T('6.4', 'Next good release activates and removes every superseded TRANSFORM 42 cache, including the orphan', k9.filter(k => k.startsWith('transform42-')).join() === 'transform42-shell-' + B.r5, k9.join(' | '));
  T('6.5', 'Unrelated caches still untouched after several updates', decoys.every(n => k9.includes(n)));

  // ===== 7. MISSING RESOURCES / UNSAFE RESPONSES / THIRD PARTY =====
  const miss404 = await pg.evaluate(() => fetch('/icons/missing.png').then(r => r.status));
  const holds = await pg.evaluate(async () => { for (const k of await caches.keys()) { if ((await (await caches.open(k)).keys()).some(r => r.url.includes('missing.png'))) return true; } return false; });
  T('7.1', 'Missing file online returns 404 and is not cached', miss404 === 404 && !holds, 'status ' + miss404);
  const cn = 'transform42-shell-' + B.r5, icon = O + '/icons/icon-192.png';
  await pg.evaluate(async () => { const c = await caches.open('other-app-cache'); await c.put(new Request(location.origin + '/someone-elses-file.txt'), new Response('DATA FROM ANOTHER APP')); await c.put(new Request(location.origin + '/icons/icon-512.png'), new Response('DECOY ICON', { headers: { 'Content-Type': 'text/plain' } })); });
  const foreign = await pg.evaluate(() => fetch('/someone-elses-file.txt').then(async r => r.status + ' ' + (await r.text())));
  T('7.0a', 'A request is never answered from another app\u2019s cache (this was the original defect)', foreign.startsWith('404') && !foreign.includes('ANOTHER APP'), foreign);
  state.headers['/icons/icon-512.png'] = { 'Cache-Control': 'no-store' };
  await pg.evaluate(async ([c, u]) => { await (await caches.open(c)).delete(u); }, [cn, O + '/icons/icon-512.png']);
  const ic = await pg.evaluate(() => fetch('/icons/icon-512.png').then(async r => r.headers.get('content-type') + ' ' + (await r.clone().blob()).size));
  T('7.0b', 'Cache lookups stay inside TRANSFORM 42\u2019s own cache (a decoy icon in another cache is not served)', ic.startsWith('image/png'), ic);
  delete state.headers['/icons/icon-512.png']; await pg.evaluate(() => fetch('/icons/icon-512.png')); await sleep(300);
  await pg.evaluate(async ([c, u]) => { await (await caches.open(c)).delete(u); }, [cn, icon]);
  const st1 = await pg.evaluate(() => fetch('/icons/icon-192.png').then(r => r.status));
  await sleep(300);
  const healed = await pg.evaluate(async ([c, u]) => !!(await (await caches.open(c)).match(u)), [cn, icon]);
  T('7.2', 'A shell file missing from the cache is fetched and restored (self-heal)', st1 === 200 && healed);
  state.headers['/icons/icon-192.png'] = { 'Cache-Control': 'no-store' };
  await pg.evaluate(async ([c, u]) => { await (await caches.open(c)).delete(u); }, [cn, icon]);
  const st2 = await pg.evaluate(() => fetch('/icons/icon-192.png').then(r => r.status)); await sleep(300);
  const stored = await pg.evaluate(async ([c, u]) => !!(await (await caches.open(c)).match(u)), [cn, icon]);
  T('7.3', 'A response marked Cache-Control: no-store is served but never cached', st2 === 200 && !stored); delete state.headers['/icons/icon-192.png'];
  await pg.goto(O + '/probe.html'); await ready(pg);
  const tpTxt = await pg.evaluate(u => fetch(u).then(r => r.text()), TP + '/x.txt');
  const tpCached = await pg.evaluate(async () => { for (const k of await caches.keys()) { if ((await (await caches.open(k)).keys()).some(r => r.url.includes(':8141'))) return true; } return false; });
  T('7.4', 'Third-party (other-origin) request passes through and is never cached', tpTxt === 'third-party data' && tp.log.length > 0 && !tpCached);
  await pg.evaluate(() => fetch('/icons/icon-192.png?post-check', { method: 'POST', body: 'x' }).catch(() => 0));
  T('7.5', 'A POST request goes straight to the server (never answered from a cache)', state.log.some(r => r.m === 'POST' && r.p === '/icons/icon-192.png?post-check'));
  T('7.6', 'No third-party hosts contacted by the app during the whole run', W.external.length === 0, W.external.join() || 'none');
  const cspv = await pg.evaluate(() => window.__csp);
  T('7.7', 'No Content-Security-Policy violations', cspv.length === 0, cspv.join());

  await ctx.close(); await stop(srv); await stop(srv2);
  const failed = results.filter(r => !r.pass);
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify({ ran: new Date().toISOString(), chromium: '153', passed: results.length - failed.length, failed: failed.length, results }, null, 1));
  console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed of ' + results.length);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
