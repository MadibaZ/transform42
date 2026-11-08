# TRANSFORM 42: installable, offline-capable version

No account, no server, no cloud. Your data is saved in the browser on the device you use.

## Files
- `index.html`: the app (fonts are self-hosted; no third-party requests)
- `sw.js`: service worker (offline access, safe updates)
- `pwa.js`: registers the worker, shows offline status, offers updates
- `offline.html`: shown if a page that isn't saved is opened offline
- `manifest.webmanifest`, `icons/`, `fonts/`: install details, icons, fonts (SIL OFL, see fonts/LICENSE.txt)
- `stamp.py`: gives each release its own cache name (see Updating)
- `tests/`: the automated tests (see REPORT.md)
- `REPORT.md`: what was fixed and what was tested

## Put it online (HTTPS required)
Netlify (drag this folder onto app.netlify.com/drop), GitHub Pages, or Cloudflare Pages.
To try it locally: `python3 -m http.server 8000` in this folder, then open http://localhost:8000
Open the app once while online. After that it opens offline.

## Updating the app
1. Edit any file (for example `index.html`).
2. Run `python3 stamp.py`. It writes a new build id into `sw.js` from the contents of every cached file.
3. Upload the whole folder again.
People who already have the app see "A new version is ready" and choose when to update. Their saved data is not touched.
If you skip step 2, devices will not notice the change.

## Dates and sample preview
The app uses the real date in South Africa time. Day 1 is 9 November 2026 and Day 42 is 20 December 2026.
Settings has an optional "Preview sample data" screen. It never touches your own data, shows demonstration content,
and nothing you do in it is saved. Use "Return to my data" to leave it.

## Moving your data
Data lives only on the device and web address you use. This copy starts empty.
Use Backup and Restore: download a backup in the old place, import it here.
