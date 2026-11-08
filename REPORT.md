# TRANSFORM 42: service worker audit, offline improvements and test report

Run: 2026-11-08T03:51:39.176Z · Real Chromium 153 through Playwright · Local origin (127.0.0.1) · **60 passed, 0 failed of 60** · rerun after the real-date change (see REPORT-real-date-mode.md)

## 1. Audit: what was wrong

| # | Problem in the original `sw.js` | How I know |
|---|---|---|
| F1 | Activation deleted **every** cache whose name was not the current one, so it deleted other apps' caches on the same address. | **Reproduced** in real Chromium before changing anything: `other-app-cache` and `my-blog-v1` were deleted when the old worker activated. |
| F2 | Lookups used `caches.match()`, which searches **all** caches, so a request could be answered from another app's cache. | **Reproduced**: the old worker answered a request with `200 DATA FROM ANOTHER APP` taken from a cache it did not own. |
| F3 | The cache name was a hand-edited string (`transform42-v1`/`-v2`). Forgetting to bump it meant devices kept old files. | Code review (not separately reproduced). |
| F4 | The worker called `skipWaiting()` on install, so an update replaced the running version immediately, with no choice and a risk of mixing old page and new files. | Code review (not separately reproduced). |
| F5 | Navigations were cached with no check that the response was good, so an error page could overwrite the cached app. Google Fonts responses were also cached (third-party). | Code review (not separately reproduced). |
| F6 | The app needed Google Fonts (third-party). Fallback fonts existed, but the exact look needed the internet. | Code review. |
| F7 | No offline status, no clear offline page, no update prompt, no message for features that need the internet. | Code review. |

## 2. What changed

**`sw.js` (rewritten)**
- Cache namespace `transform42-`. One cache per release: `transform42-shell-<build>`.
- **Versioning:** the build id is a hash of every cached file plus `sw.js`, written by `stamp.py`. Any change gives a new cache name, so stale files cannot be reused. Hashing is deterministic.
- **Install:** downloads the whole shell (12 files, bypassing the HTTP cache) with `addAll`. If any file fails, the whole install fails and the working version keeps running.
- **Update flow:** no `skipWaiting()` on install. The new version waits until the person presses "Update now" (`pwa.js` sends `SKIP_WAITING`).
- **Activate:** takes over pages first, then deletes only caches that start with `transform42-` and are not the current one. Nothing else is ever listed for deletion.
- **Lookups and writes** always use the app's own cache object (`caches.open(SHELL_CACHE)`), never `caches.match()`.
- **Strategies:** pages from the app's own cache (so scripts and fonts always match), static files cache-first, other same-origin requests network-first with a clear 503 fallback, connection check network-only, unknown pages offline get `offline.html`.
- **What is never cached:** other-origin requests (not even intercepted), non-GET requests, failed responses, responses marked `no-store` or `private`, and anything outside the shell list.
- Never touches the app's saved data (that is in browser storage, not in caches).

**`index.html`**: Google Fonts link removed and replaced by self-hosted font files; a Content-Security-Policy that blocks third-party loads; manifest, icon and theme tags; `pwa.js` added. No application feature was changed.

**New files:** `pwa.js` (registration, offline indicator, update prompt, "needs internet" messages), `offline.html`, `stamp.py`, `fonts/` (Inter and Fraunces, SIL OFL), `tests/`.

**Data safety:** the worker never reads or writes saved data. Journal, habits, reading, goals and progress stay in the browser's own storage exactly as before, and test 5.8 confirms they survive an update.

## 3. What works offline and what needs the internet

| Works offline (after one online visit) | Needs the internet |
|---|---|
| Dashboard, daily progress recording, goals, phases, reading tracker, habits, exercises, journal (reading, writing, editing), weekly reviews, analytics | The **first visit** (to download the app) |
| Notification centre and in-app reminders (they fire while the app is open) | **Add to Google Calendar** links (the app explains this offline) |
| Backup, restore points, JSON and CSV export, import from a file or pasted text | Checking for and downloading a new app version |
| Offline calendar file download | Any external web link |
| Fonts, icons, install details | Reminders do **not** fire when the app is closed, online or not (unchanged) |

There is no cloud sync. Nothing was added that pretends to sync.

## 4. Test results (all executed)

Method: a real local server that the tests stop (so the network genuinely fails) and swap between releases, plus `setOffline`, plus a persistent browser profile so closing and reopening the browser is real. Rerun with `node tests/run.js` (needs `npm i playwright`, a Chromium install and python3).

| ID | Test | Result | Detail |
|---|---|---|---|
| 0.1 | Each release gets a different build id (cache name) | PASS | 8f2b3a07eb1b bf122efbcb54 d2e94b341f80 284b684c45b4 |
| 0.2 | Stamping is deterministic (same files give same id) | PASS |  |
| 1.1 | Service worker installs and takes control on first visit | PASS |  |
| 1.2 | Exactly one TRANSFORM 42 cache exists, named transform42-shell-<build> | PASS | other-app-cache / my-blog-v1 / transform42x-lookalike / TRANSFORM42-other / transform42-shell-8f2b3a… |
| 1.3 | Outdated TRANSFORM 42 caches (transform42-v1, -v2, old shell) were removed | PASS | all three removed |
| 1.4 | Unrelated caches (other-app-cache, my-blog-v1, transform42x-lookalike, TRANSFORM42-other) still exist with their data | PASS | contents verified: true,true,true,true |
| 1.5 | App shell cached completely during install (12 files) | PASS | 12 of 12 |
| 1.6 | App renders after first install | PASS | Welcome back, Champion |
| 1.7 | No third-party requests (Google Fonts etc.) | PASS | none |
| 1.8 | Fonts load from this site | PASS | Inter 400, Inter 500, Inter 600, Fraunces 600 |
| 1.9 | No console errors, page errors or CSP violations on first load | PASS |  |
| 2.1 | Refresh is served from the cache (server not asked for /index.html) | PASS | no requests |
| 2.2 | Refresh keeps the current page (hash route) | PASS | Your Transformation Journal |
| 2.3 | No errors after refresh | PASS |  |
| 3.1 | App opens offline (dashboard renders) | PASS | Welcome back, Champion |
| 3.2 | Offline status indicator appears | PASS |  |
| 3.3 | Every sidebar page opens offline (12 pages) | PASS | dashboard goals phases reading habits exercises journal reviews analytics notifications backup setti… |
| 3.4 | Unknown page offline shows the clear offline page | PASS | You’re offline |
| 3.5 | Missing file offline gives a clean 503 (no thrown error) | PASS | 503 static |
| 3.6 | Update check while offline fails quietly and app keeps working | PASS | rejected TypeError |
| 3.7 | Repeated network failures (25 probes) do not break the UI | PASS |  |
| 3.8 | Feature that needs internet (Add to Google Calendar) explains itself offline and does not navigate | PASS | Add to Google Calendar needs an internet connection. Try again when you’re back online. “Download ca… |
| 3.9 | Backup download works offline (CSP allows it) | PASS | transform42-backup-2026-11-08.json |
| 4.1 | Habits created and ticked offline are saved | PASS | 7 habit cards; {"2026-11-08":1} |
| 4.2 | Daily progress recorded offline (mood and note) is saved | PASS |  |
| 4.3 | Journal entry written offline is saved | PASS |  |
| 4.4 | Reading progress entered offline is saved (80 of 320 pages = 25%) | PASS |  |
| 4.5 | After closing and reopening the browser (still no server) the app opens | PASS | Welcome back, Champion |
| 4.6 | Offline indicator shown even though the device reports a network (server unreachable) | PASS |  |
| 4.7 | All offline changes survived the restart | PASS |  |
| 4.8 | Previously saved journal entry is listed and readable offline | PASS |  |
| 4.9 | Entry text opens offline | PASS |  |
| 4.10 | Habit tick persisted and is shown | PASS |  |
| 4.11 | Reading progress shows 25% offline | PASS |  |
| 4.12 | No application errors during restart session | PASS |  |
| 5.0 | Back online: indicator clears | PASS |  |
| 5.1 | Still running release 1 before updating | PASS |  |
| 5.2 | New version is detected and the person is asked before it is applied | PASS |  |
| 5.3 | Old cache is kept while the new version waits (new cache installed beside it) | PASS | transform42-shell-8f2b3a07eb1b transform42-shell-bf122efbcb54 |
| 5.4 | Page keeps running release 1 until the update is accepted | PASS |  |
| 5.5 | Accepting the update reloads into release 2 | PASS |  |
| 5.6 | After activation only the new TRANSFORM 42 cache remains | PASS | other-app-cache / my-blog-v1 / transform42x-lookalike / TRANSFORM42-other / transform42-shell-bf122e… |
| 5.7 | Unrelated caches still untouched after the update | PASS |  |
| 5.8 | Saved data (journal, habits, reading, progress) is intact after the update | PASS |  |
| 5.9 | "Later" keeps release 2 running and keeps its cache | PASS |  |
| 5.10 | Update is offered again on the next visit | PASS |  |
| 6.1 | Update with a missing file really fails to install (server was asked for the missing file) and the working version stays active | PASS | missing file requested: true; {"waiting":"http://127.0.0.1:8140/sw.js","installing":false,"active":t… |
| 6.2 | Working version’s cache is not damaged by the failed install | PASS | orphan from failed install: transform42-shell-brokenbuild00 (cleaned at next activation) |
| 6.3 | App still works normally after the failed update attempt | PASS |  |
| 6.4 | Next good release activates and removes every superseded TRANSFORM 42 cache, including the orphan | PASS | other-app-cache / my-blog-v1 / transform42x-lookalike / TRANSFORM42-other / transform42-shell-284b68… |
| 6.5 | Unrelated caches still untouched after several updates | PASS |  |
| 7.1 | Missing file online returns 404 and is not cached | PASS | status 404 |
| 7.0a | A request is never answered from another app’s cache (this was the original defect) | PASS | 404 not found |
| 7.0b | Cache lookups stay inside TRANSFORM 42’s own cache (a decoy icon in another cache is not served) | PASS | image/png 42065 |
| 7.2 | A shell file missing from the cache is fetched and restored (self-heal) | PASS |  |
| 7.3 | A response marked Cache-Control: no-store is served but never cached | PASS |  |
| 7.4 | Third-party (other-origin) request passes through and is never cached | PASS |  |
| 7.5 | A POST request goes straight to the server (never answered from a cache) | PASS |  |
| 7.6 | No third-party hosts contacted by the app during the whole run | PASS | none |
| 7.7 | No Content-Security-Policy violations | PASS |  |

**Negative controls:** the same checks run against the original worker showed the two reproduced failures (F1 and F2) above.

**Honesty notes**
- My first draft of two tests (failed install, non-GET requests) was weak. I tightened them: 6.1 now proves the server was asked for the missing file, and 7.5 proves the POST reached the server. I also added 7.0a and 7.0b, which test the original cross-cache defect directly.
- Test 6.1 detail shows a waiting worker: that is release 3 left waiting by the earlier "Later" test, not the broken one. The broken install left a partly filled cache named `transform42-shell-brokenbuild00`, which test 6.4 shows being removed by the next successful activation.

**Not tested (so I make no claim about them)**
- Firefox, Safari, iPhone or iPad Home Screen apps, and real Android devices. Offline was simulated by stopping the server and Playwright's offline switch, not by airplane mode.
- A real HTTPS host and its cache headers (Netlify, GitHub Pages, Cloudflare).
- The browser's own install prompt and install flow.
- The "updated in another tab" reload prompt, and updating with several tabs open.
- The 30-second connection check over long idle periods, and the browser clearing storage when the device is low on space.
- The copy of the app inside Claude does not use this service worker (it can't).

## 5. Known limits
- The Content-Security-Policy has to allow inline scripts because the app is one file, so it blocks third-party loads but is not a full defence against injected scripts.
- `navigator.onLine` can say "online" on a network with no internet. The app also checks its own server every 30 seconds, but a very short drop may go unnoticed.
- A failed install can leave a partly filled cache until the next successful update cleans it.
