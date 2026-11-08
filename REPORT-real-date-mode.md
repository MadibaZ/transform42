# TRANSFORM 42: real-date default, sample preview and programme dates

Run: 2026-11-08T03:51:07.460Z · Real Chromium 153 via Playwright, with a controllable clock and a device timezone that is **not** South Africa · **84 passed, 0 failed of 84** (date and mode tests) · **60 passed, 0 failed of 60** (service worker and offline tests, rerun on this build) · service worker build `96c9e76e3763`

## 1. What I found (inspection of the current app)

Sample mode worked as an **overlay on the person's real data**, which is where the contamination risk came from:

| Where | What sample mode did |
|---|---|
| Default | `sample` was `true` in the initial memory and in `defMem()`, so every fresh install started in the preview. |
| `ctx()` | Replaced today's date with 20 Nov 2026. Everything that stamps a date (habit ticks, journal entries, goal start dates, exercise completions, reviews) used that fake date. |
| Goals, reasons | Sample goals and reasons were added on top of real ones (read-only, not saved). |
| Phases, exercises | `pv()` / `SAMPLE_PH` showed sample ticks as if done, which also fed the Dashboard percentages. |
| Dashboard tasks | The six "Today's tasks" were **fixed placeholder text in every mode**, including real mode ("Current book: sample title"). |
| Banners, Settings | A banner on four pages and a toggle that saved the flag together with the person's data. |
| Real date | "Today" came from the **device** clock (9 places used `fmt(new Date())`), not South Africa time. |

So anything created while the preview was on was saved with the real data but carried the fake date 20 Nov.

## 2. What changed

- **Real dates are the default.** `sample` is `false` in the initial memory and in `defMem()`. Imported backups can no longer switch the real data into sample mode.
- **South Africa date.** Programme "today" is computed in `Africa/Johannesburg` (`realToday()`), whatever the device timezone. It is also used for file names, reading-note dates and the daily snapshot.
- **Sample mode is now an isolated preview.** It keeps your real data completely out of sight and untouched, shows the sample goals, reasons, phase progress and task names, and discards everything done inside it (nothing is written to storage). A bar on every page says so and offers "Return to my data". It survives a reload in the same tab only; a new tab starts in real mode. Backup, import, restore and exports are switched off inside it so sample data can never be exported or replace real data.
- **Real "Today's tasks".** In real mode the list is built from your own habits due today, the lead phase's reading and exercise for this week, and a journal item that ticks itself when a completed entry exists. Ticking an item updates the tracker it belongs to (no separate placeholder ticks). Before the start it explains when Day 1 is; after the end it says the programme finished.
- **Programme states.** Before the start: "Day 0 · Starts in N days", week 1 shown as "from 9 November". Active: day, completed, remaining, phase and week. After the end: "Done · Programme complete", week 6 labelled finished, no Sunday prompt. The Dashboard also moves to the next day by itself after midnight in South Africa.
- **Existing saved data.** Nothing is cleared or overwritten at load. Data saved by the old version (including `sample: true`) opens in real mode with a one-time "Real dates are now the default" notice. The stored flag is rewritten only the next time the app saves (as with every save).
- Settings wording now describes the real mode and the preview; "Clear saved ticks" became "Clear daily notes" with an accurate description (its behaviour is unchanged and it still asks first).

**Files changed:** `index.html` (rebuilt from the updated app) and the build id in `sw.js` (stamped with `stamp.py`). The hosted copy inside Claude was updated with the same code.

## 3. PWA files preserved

Compared byte for byte with the previous delivery: `pwa.js`, `manifest.webmanifest`, `offline.html`, `stamp.py`, all four icons, all fonts and the font licence are **identical**. `sw.js` differs only in its build line (`79ceb3be9a55` → `96c9e76e3763`), produced by `stamp.py`. The offline behaviour and update flow are unchanged, and the full offline suite below was rerun on this build.

## 4. Date and mode test results (all executed)

| ID | Test | Result | Detail |
|---|---|---|---|
| A1 | Fresh install: sample is false in the initial memory and in defMem() | PASS | {"memSample":false,"def":false,"raw":null,"preview":false} |
| A2 | Fresh install writes nothing to storage just by opening the app | PASS | null |
| A3 | Fresh install starts in real-date mode (no preview bar, no sample banner) | PASS |  |
| A4 | Settings says real dates (South Africa time) with today’s programme status | PASS | You are using real dates (South Africa time). Today is 07 Nov 2026: Before the programme starts. |
| A5 | No sample content on any page in real mode (11 pages checked) | PASS | clean |
| A6 | Official programme dates preserved: 9 Nov 2026 to 20 Dec 2026, 42 days | PASS | ["2026-11-09","2026-12-20",42,1,42,43] |
| B1 | Dashboard, two days before start | PASS | 0 / 42 / 0% · Day 0 |
| B1p |   all 12 pages render without NaN/undefined/Invalid Date, two days before start | PASS | ok |
| B2 | Dashboard, 23:59 SAST the night before (device in Los Angeles) | PASS | 0 / 42 / 0% · Day 0 |
| B2p |   all 12 pages render without NaN/undefined/Invalid Date, 23:59 SAST the night before (device in Los Angeles) | PASS | ok |
| B3 | Dashboard, 23:59 SAST the night before (device in Auckland, a day ahead) | PASS | 0 / 42 / 0% · Day 0 |
| B3p |   all 12 pages render without NaN/undefined/Invalid Date, 23:59 SAST the night before (device in Auckland, a day ahead) | PASS | ok |
| B4 | Dashboard, 00:00 SAST on 9 Nov = Day 1 (device in Los Angeles, still 8 Nov there) | PASS | 0 / 42 / 0% · Day 1 of 42 |
| B4p |   all 12 pages render without NaN/undefined/Invalid Date, 00:00 SAST on 9 Nov = Day 1 (device in Los Angeles, still 8 Nov there) | PASS | ok |
| B5 | Dashboard, Day 2 | PASS | 1 / 41 / 0% · Day 2 of 42 |
| B5p |   all 12 pages render without NaN/undefined/Invalid Date, Day 2 | PASS | ok |
| B6 | Dashboard, Sunday Day 7 (Week 1 review prompt) | PASS | 6 / 36 / 0% · Day 7 of 42 |
| B6p |   all 12 pages render without NaN/undefined/Invalid Date, Sunday Day 7 (Week 1 review prompt) | PASS | ok |
| B7 | Dashboard, Day 12 (Phase 1, Week 2) | PASS | 11 / 31 / 0% · Day 12 of 42 |
| B7p |   all 12 pages render without NaN/undefined/Invalid Date, Day 12 (Phase 1, Week 2) | PASS | ok |
| B8 | Dashboard, Day 15 (Phase 2 begins, Week 3) | PASS | 14 / 28 / 0% · Day 15 of 42 |
| B8p |   all 12 pages render without NaN/undefined/Invalid Date, Day 15 (Phase 2 begins, Week 3) | PASS | ok |
| B9 | Dashboard, Day 29 (Phase 3 begins, Week 5) | PASS | 28 / 14 / 0% · Day 29 of 42 |
| B9p |   all 12 pages render without NaN/undefined/Invalid Date, Day 29 (Phase 3 begins, Week 5) | PASS | ok |
| B10 | Dashboard, Last day, Sunday 20 Dec (Week 6 review prompt) | PASS | 41 / 1 / 0% · Day 42 of 42 |
| B10p |   all 12 pages render without NaN/undefined/Invalid Date, Last day, Sunday 20 Dec (Week 6 review prompt) | PASS | ok |
| B11 | Dashboard, 23:59 SAST on 20 Dec is still Day 42 | PASS | 41 / 1 / 0% · Day 42 of 42 |
| B11p |   all 12 pages render without NaN/undefined/Invalid Date, 23:59 SAST on 20 Dec is still Day 42 | PASS | ok |
| B12 | Dashboard, 00:00 SAST on 21 Dec: programme complete (device in Los Angeles) | PASS | 42 / 0 / 0% · Done of 42 |
| B12p |   all 12 pages render without NaN/undefined/Invalid Date, 00:00 SAST on 21 Dec: programme complete (device in Los Angeles) | PASS | ok |
| B13 | Dashboard, months after the end | PASS | 42 / 0 / 0% · Done of 42 |
| B13p |   all 12 pages render without NaN/undefined/Invalid Date, months after the end | PASS | ok |
| C1 | Day 12: Weekly Reviews opens on Week 2, in progress | PASS |  |
| C2 | Day 12: Week 1 review is shown as past due but still open (not failed) | PASS |  |
| C3 | Day 12: Analytics shows programme day 12 of 42 and no broken numbers | PASS |  |
| C4 | Habit consistency counts only elapsed days (Reading: 2 ticks of 11 elapsed days = 18%) | PASS | Reading 2 of 11 expected check-ins 18% |
| C5 | Day 12: an unfinished week 1 exercise is "Not done yet", week 2 is "Due now", week 3 is "Upcoming", and one the person ticked stays "Completed" | PASS | Phase 2Not done yet / Phase 2Due now / Phase 2Upcoming / Phase 1Completed |
| C6 | Day 12: goals due 15 Nov counts as overdue; 20 Dec goal with 5% is at risk | PASS | Active (2) At risk (1) Overdue (1) Completed (0) |
| C7 | Weekly Reviews before the start: opens on Week 1, "Not started", no Sunday prompt | PASS | Week 1 |
| C7a | Analytics before the start: programme day 0 of 42, no NaN | PASS |  |
| C8 | Weekly Reviews after the end: opens on Week 6, no Sunday prompt | PASS | Week 6 |
| C8a | Analytics after the end: programme day 42 of 42, no NaN | PASS |  |
| D1 | Day 12 tasks are built from the person’s own habits and this week’s phase work (no sample wording) | PASS | Today’s tasks 0 of 5 done / Reading / Every day · 20 min / Habit / Focused work / Weekdays (Mon–Fri)… |
| D2 | Ticking a habit on the dashboard writes that habit’s check-in for the South African date | PASS |  |
| D3 | Ticking the reading and the exercise updates the phase tracker (and the exercise gets a completion date) | PASS |  |
| D4 | Real mode never writes the old placeholder task ids (t1 to t6) into the saved data | PASS | {"2026-11-20":{"t1":1,"t2":1}} |
| D5 | The Habit Tracker shows the habit as done today | PASS |  |
| D6 | The Phases page shows the week 2 reading and exercise ticked | PASS |  |
| D7 | A new journal entry defaults to the South African date (20 Nov) | PASS | 2026-11-20 |
| D8 | The journal task ticks itself once a completed entry exists for today | PASS |  |
| D9 | Record today’s progress saves habit ticks, mood and note to the right places | PASS |  |
| D10 | Saturday: the weekdays-only habit is not listed as a task | PASS |  |
| D11 | Before the start: the record dialog offers a mood note but no tasks | PASS |  |
| E1 | Preview bar is shown on all 12 pages while the preview is on | PASS | all pages |
| E2 | The person’s own records are hidden in the preview (none appear on any page) | PASS | none visible |
| E3 | Preview shows the demonstration date (Day 12 of 42, 20 Nov) while the real date is before the start | PASS |  |
| E4 | Preview shows sample goals marked "Sample" | PASS |  |
| E5 | Preview shows sample reasons | PASS |  |
| E6 | Preview shows sample phase progress without real reflections | PASS |  |
| E7 | Backup, import and restore are unavailable in the preview | PASS |  |
| E8 | Creating a goal, journal entry and habits inside the preview works on screen | PASS |  |
| E9 | Stored data is byte-for-byte unchanged after all that preview activity | PASS |  |
| E10 | A reload in the same tab stays in the preview, with the preview-only items gone (nothing was saved) | PASS |  |
| E11 | A new tab starts in real mode, not in the preview | PASS |  |
| E12 | Returning to my data shows the real programme state (before the start), no sample bar | PASS |  |
| E13 | My real goals are back; no sample goals and no preview-only goal | PASS |  |
| E14 | My real journal entry is back; the preview-only entry is not | PASS |  |
| E15 | Stored data still byte-for-byte identical after leaving the preview | PASS |  |
| E16 | Switching on and off three more times changes nothing in the saved data | PASS |  |
| E17 | After a real change every other record is exactly as before, and the new reason is saved | PASS |  |
| E18 | No sample or preview content ended up in the saved records | PASS |  |
| F1 | Opening the app with old saved data (sample:true) does not write or overwrite storage | PASS |  |
| F2 | It opens in real-date mode with a one-time notice, not in the preview | PASS | {"sample":false,"preview":false,"notice":1} |
| F3 | The notice explains that nothing was changed or removed | PASS |  |
| F4 | All records (goals, reasons, habits, check-ins, reading, notes, journal, reviews, reminders, alerts) loaded exactly as saved | PASS |  |
| F5 | The old records are visible in the app (goals, journal, habits, reading progress) | PASS | all visible |
| F6 | After the first save every data record is still identical to the old data; only the mode flag changed | PASS |  |
| F7 | The notice does not come back after it is dismissed | PASS |  |
| F8 | Old first-run state (sample:true, no records) opens in real mode with no notice | PASS |  |
| F9 | Importing an old backup file shows a preview comparison first | PASS |  |
| F10 | The import restores every record and forces real mode (sample:false) | PASS | goals 2, journal 1 |
| F11 | With reminders on, the only keys that change at load are the mode flags, the reminder bookkeeping and one new "missed" alert; the old alert is kept | PASS | lastSaved,modeNotice,nc,rmF,sample |
| G1 | Dashboard moves from Day 12 to Day 13 by itself after midnight in South Africa | PASS | Day 12 -> Day 13 |
| Z1 | No page errors or console errors in the whole run (failed resource loads excluded) | PASS |  |

## 5. Service worker and offline suite, rerun on this build

60 passed, 0 failed of 60. Details are in `REPORT.md` and `tests/results.json`. Four steps that ticked the old placeholder tasks were updated to the real-mode behaviour (mood and note are checked instead).

## 6. Things to know

- **Earlier records keep their dates.** Anything recorded while the old sample mode was on carries the sample-mode date (for example 20 Nov). It was preserved untouched. It will line up with the real calendar when that date arrives, and I did not change or move it.
- **Behaviour change in the preview:** edits made in the preview are no longer kept (before, they were saved with your real data).
- **Placeholder dashboard ticks:** earlier ticks of the old placeholder tasks stay in your data and still count in the Analytics daily chart ("Dashboard tasks ticked"), but the dashboard no longer shows those tasks.
- **Which phase work appears:** the dashboard task list shows the lead phase's reading and exercise; all three phases are on the Phases page.
- **Two tests I got wrong first:** my first run had 6 failures. Four were because my test data had reminders switched on, and the reminders engine legitimately adds a "missed while closed" alert and saves at load. Two were wrong expectations. I confirmed that with a direct diff (with reminders off, nothing at all is written at load), fixed the tests, and added F11 to cover the reminders-on case. No app defect was involved.

## 7. Not tested (so no claim is made)

- Firefox, Safari, iPhone and Android devices; the hosted copy inside Claude's viewer was only checked through the same code in a simulated browser, not in the viewer itself.
- A device whose clock is simply wrong (the app trusts the device clock and converts it to South Africa time).
- Browsers without `Intl` time-zone support (the app falls back to the device date; this path was not run).
- How weekly statistics treat records dated in the future that were created under the old sample mode.
- Switching modes while another tab has the app open, and unsaved journal writing carried across a preview switch (the flush before switching was not tested separately).
- The same untested items listed in `REPORT.md` for the service worker (other browsers, real HTTPS host, the browser's install prompt, the "updated in another tab" prompt).
