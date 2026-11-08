// TRANSFORM 42: real-date default, sample preview isolation, South Africa dates, programme states.
//   node tests/modes.js      (needs: npm i playwright && npx playwright install chromium)
// Runs in real Chromium with a controllable clock and a device timezone that is NOT South Africa.
const path = require('path'), fs = require('fs');
let playwright; try { playwright = require('playwright'); } catch (_) { playwright = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = playwright;
const { start, stop } = require('./server');
const PKG = path.resolve(__dirname, '..'), O = 'http://127.0.0.1:8150';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const T = (id, name, pass, detail = '') => { results.push({ id, name, pass: !!pass, detail: String(detail) }); console.log((pass ? 'PASS' : 'FAIL') + '  ' + id + '  ' + name + (detail ? '  [' + String(detail).slice(0, 160) + ']' : '')); };

const ROOT = '/tmp/t42-modes'; fs.rmSync(ROOT, { recursive: true, force: true });
fs.cpSync(PKG, ROOT, { recursive: true, filter: s => { const r = path.relative(PKG, s); return !(r === 'tests' || r.startsWith('tests' + path.sep)); } });

const PAGES = ['dashboard', 'goals', 'phases', 'reading', 'habits', 'exercises', 'journal', 'reviews', 'analytics', 'notifications', 'backup', 'settings'];
let browser; const errs = [];
async function mk({ time, tz = 'America/Los_Angeles', seed, raw }) {
  const ctx = await browser.newContext({ timezoneId: tz, serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
  if (seed || raw) await ctx.addInitScript(r => { if (!localStorage.getItem('t42')) localStorage.setItem('t42', r); }, raw || JSON.stringify(seed));
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  if (time) await pg.clock.install({ time: new Date(time) });
  await pg.goto(O + '/'); await sleep(250);
  return { ctx, pg };
}
const go = async (pg, h) => { await pg.evaluate(x => { location.hash = x; }, '#' + h); await sleep(120); };
const txt = (pg, sel = '#view') => pg.locator(sel).first().innerText();
const ls = pg => pg.evaluate(() => localStorage.getItem('t42'));
const lsj = async pg => JSON.parse((await ls(pg)) || '{}');

// a realistic saved state, as an earlier version of the app would have written it (sample:true was the old default)
function oldSaved(sample) {
  return {
    sample, done: { '2026-11-20': { t1: 1, t2: 1 } }, logs: { '2026-11-20': { mood: 4, note: 'old note' } },
    goals: [{ id: 'g1', title: 'My real goal', scope: 'sprint', cat: 'identity', pri: 'high', due: '2026-11-15', start: '2026-11-09', prog: 10, miles: [{ t: 'm', done: false }], acts: ['a'], wk: { 1: 10 }, p0: 0, done: false, outcome: '', ind: '', desc: '', why: '', from: '' },
      { id: 'g2', title: 'Late goal', scope: 'sprint', cat: 'focus', pri: 'med', due: '2026-12-20', start: '2026-11-09', prog: 5, miles: [], acts: [], wk: {}, p0: 0, done: false, outcome: '', ind: '', desc: '', why: '', from: '' }],
    reasons: [{ id: 'r1', t: 'My own reason', d: '2026-11-05' }],
    ph: { 1: { read: { 1: true }, ex: { 1: true }, wk: {}, obj: {}, refl: { 1: 'my reflection' }, notes: 'my phase note' }, 2: { read: {}, ex: {}, wk: {}, obj: {}, refl: {}, notes: '' }, 3: { read: {}, ex: {}, wk: {}, obj: {}, refl: {}, notes: '' } },
    rd: { b5: { total: 320, cur: 80, sp: 1, chd: 3, cht: 20, start: '2026-11-09', target: '2026-12-01', status: '', role: 'main' } },
    rn: [{ id: 'n1', b: 'b5', t: 'lessons', x: 'my reading note', r: 'p.4', d: '2026-11-10' }],
    hb: [{ id: 'h1', name: 'Reading', cat: 'Identity', freq: 'daily', dur: 20, desc: '', why: '', created: '2026-11-09' }, { id: 'h2', name: 'Focused work', cat: 'Focus and productivity', freq: 'weekdays', dur: 90, desc: '', why: '', created: '2026-11-09' }],
    hl: { h1: { '2026-11-09': 1, '2026-11-10': 1 } }, xs: [{ id: 'x1', title: 'My exercise', p: 1, pur: 'p', ins: 'i', out: 'o', ad: '2026-11-09', dd: '2026-11-15' }],
    xc: { p1w1: '2026-11-10' }, xr: { p1w1: 'my exercise reflection' },
    rm: [{ id: 'r1', title: 'Morning identity reflection', msg: 'm', cat: 'reflection', freq: 'daily', time: '07:00', on: true, date: '' }], rmOn: false, rmTz: 'Africa/Johannesburg', rmBrowser: false, rmSince: '2026-11-05 10:00', rmF: {},
    nc: [{ id: 'nc1', title: 'Old alert', msg: 'x', cat: 'other', late: false, ts: '2026-11-06T10:00:00Z', read: false }],
    wr: { 1: { a: { m1: 'my review answer' }, ach: ['a1', '', ''], imp: ['', '', ''], pri: ['', '', ''], lesson: 'my lesson', adj: '', done: false, doneOn: '' } },
    jn: [{ id: 'j1', title: 'My journal entry', date: '2026-11-10', cat: 'free', tracks: [1], body: 'private words', goal: '', book: '', draft: false, created: '2026-11-10T08:00:00Z', upd: '2026-11-10T08:00:00Z' }], jbuf: null,
    lastBackup: '2026-11-06T09:00:00Z', lastSaved: '2026-11-06T09:00:00Z'
  };
}
const DATA_KEYS = ['done', 'logs', 'goals', 'reasons', 'ph', 'rd', 'rn', 'hb', 'hl', 'xs', 'xc', 'xr', 'rm', 'rmOn', 'rmTz', 'nc', 'wr', 'jn', 'lastBackup'];

(async () => {
  const srv = await start(8150, { root: ROOT, log: [], headers: {} });
  browser = await chromium.launch();

  // ===== A. FRESH INSTALL DEFAULTS =====
  {
    const { ctx, pg } = await mk({ time: '2026-11-07T10:00:00+02:00' });
    const f = await pg.evaluate(() => ({ memSample: mem.sample, def: defMem().sample, raw: localStorage.getItem('t42'), preview: !!window.REAL }));
    T('A1', 'Fresh install: sample is false in the initial memory and in defMem()', f.memSample === false && f.def === false, JSON.stringify(f));
    T('A2', 'Fresh install writes nothing to storage just by opening the app', f.raw === null, String(f.raw));
    T('A3', 'Fresh install starts in real-date mode (no preview bar, no sample banner)', !(await txt(pg)).includes('Sample preview'));
    await go(pg, 'settings');
    T('A4', 'Settings says real dates (South Africa time) with today\u2019s programme status', /real dates \(South Africa time\)/.test(await txt(pg)) && /Before the programme starts|Day \d+ of 42|After the programme ends/.test(await txt(pg)), (await txt(pg)).split('\n').find(l => /real dates/.test(l)));
    const leaks = [];
    for (const p of PAGES.filter(p => p !== 'settings')) { await go(pg, p); if (/sample/i.test(await txt(pg))) leaks.push(p); }
    T('A5', 'No sample content on any page in real mode (11 pages checked)', leaks.length === 0, leaks.join() || 'clean');
    const c = await pg.evaluate(() => [START, END, TOTAL, dayNo(START), dayNo(END), dayNo('2026-12-21')]);
    T('A6', 'Official programme dates preserved: 9 Nov 2026 to 20 Dec 2026, 42 days', JSON.stringify(c) === JSON.stringify(['2026-11-09', '2026-12-20', 42, 1, 42, 43]), JSON.stringify(c));
    await ctx.close();
  }

  // ===== B. DASHBOARD IN EVERY PROGRAMME STATE (SA date, wrong device timezones) =====
  const cases = [
    ['B1', 'two days before start', '2026-11-07T10:00:00+02:00', 'America/Los_Angeles', { big: 'Day 0', has: ['Starts in 2 days'], done: 0, rem: 42, ribDone: 0, now: -1, wk: 'Week 1 objective (from 9 November)', tasks: 'in 2 days', sunday: false }],
    ['B2', '23:59 SAST the night before (device in Los Angeles)', '2026-11-08T21:59:00Z', 'America/Los_Angeles', { big: 'Day 0', has: ['Starts in 1 day'], done: 0, rem: 42, ribDone: 0, now: -1, sunday: false }],
    ['B3', '23:59 SAST the night before (device in Auckland, a day ahead)', '2026-11-08T21:59:00Z', 'Pacific/Auckland', { big: 'Day 0', has: ['Starts in 1 day'], done: 0, rem: 42, sunday: false }],
    ['B4', '00:00 SAST on 9 Nov = Day 1 (device in Los Angeles, still 8 Nov there)', '2026-11-08T22:00:00Z', 'America/Los_Angeles', { big: 'Day 1', has: ['Day 1 of 42'], done: 0, rem: 42, ribDone: 0, now: 0, wk: 'Week 1 objective', sunday: false }],
    ['B5', 'Day 2', '2026-11-10T09:00:00+02:00', 'America/Los_Angeles', { big: 'Day 2', done: 1, rem: 41, ribDone: 1, now: 1 }],
    ['B6', 'Sunday Day 7 (Week 1 review prompt)', '2026-11-15T09:00:00+02:00', 'America/Los_Angeles', { big: 'Day 7', done: 6, rem: 36, sunday: true, sundayText: 'Week 1 review' }],
    ['B7', 'Day 12 (Phase 1, Week 2)', '2026-11-20T12:00:00+02:00', 'America/Los_Angeles', { big: 'Day 12', done: 11, rem: 31, has: ['Phase 1: Mental reprogramming'], wk: 'Week 2 objective', sunday: false }],
    ['B8', 'Day 15 (Phase 2 begins, Week 3)', '2026-11-23T08:00:00+02:00', 'America/Los_Angeles', { big: 'Day 15', done: 14, rem: 28, has: ['Phase 2: Identity development'], wk: 'Week 3 objective' }],
    ['B9', 'Day 29 (Phase 3 begins, Week 5)', '2026-12-07T08:00:00+02:00', 'America/Los_Angeles', { big: 'Day 29', done: 28, rem: 14, has: ['Phase 3: Behavioural transformation'], wk: 'Week 5 objective' }],
    ['B10', 'Last day, Sunday 20 Dec (Week 6 review prompt)', '2026-12-20T20:00:00+02:00', 'America/Los_Angeles', { big: 'Day 42', done: 41, rem: 1, sunday: true, sundayText: 'Week 6 review', ribDone: 41, now: 41 }],
    ['B11', '23:59 SAST on 20 Dec is still Day 42', '2026-12-20T21:59:00Z', 'Pacific/Auckland', { big: 'Day 42', done: 41, rem: 1 }],
    ['B12', '00:00 SAST on 21 Dec: programme complete (device in Los Angeles)', '2026-12-20T22:00:00Z', 'America/Los_Angeles', { big: 'Done', has: ['Programme complete', 'Completed: Phase 3'], done: 42, rem: 0, ribDone: 42, now: -1, wk: 'Week 6 objective (programme finished)', tasks: 'The programme finished on 20 December', sunday: false }],
    ['B13', 'months after the end', '2027-03-01T10:00:00+02:00', 'America/Los_Angeles', { big: 'Done', has: ['Programme complete'], done: 42, rem: 0, sunday: false }]
  ];
  for (const [id, name, time, tz, x] of cases) {
    const { ctx, pg } = await mk({ time, tz });
    const hero = await txt(pg, '.hero'), stats = (await pg.$$eval('.stat .n', n => n.map(e => e.textContent))), body = await txt(pg);
    const ribDone = await pg.$$eval('.ribbon b.done', b => b.length), now = await pg.$$eval('.ribbon b', b => b.findIndex(e => e.classList.contains('now')));
    const wk = await txt(pg, '.col:last-child section:first-child h2'), tasks = await txt(pg, '.col:first-child section:first-child');
    const bad = [];
    if (x.big && !new RegExp('^' + x.big + '\\b', 'm').test(hero)) bad.push('big:' + hero.split('\n')[1]);
    (x.has || []).forEach(h => { if (!(hero + body).includes(h)) bad.push('missing "' + h + '"'); });
    if (x.done !== undefined && +stats[0] !== x.done) bad.push('completed ' + stats[0]);
    if (x.rem !== undefined && +stats[1] !== x.rem) bad.push('remaining ' + stats[1]);
    if (x.ribDone !== undefined && ribDone !== x.ribDone) bad.push('ribbon done ' + ribDone);
    if (x.now !== undefined && now !== x.now) bad.push('ribbon today ' + now);
    if (x.wk && wk.trim() !== x.wk) bad.push('week heading "' + wk.trim() + '"');
    if (x.tasks && !tasks.includes(x.tasks)) bad.push('tasks: ' + tasks.slice(0, 60));
    if (x.sunday !== undefined && body.includes('It\u2019s Sunday') !== x.sunday) bad.push('sunday prompt ' + !x.sunday);
    if (x.sundayText && !body.includes(x.sundayText)) bad.push('sunday text');
    if (!/^\d+%$/.test(stats[2])) bad.push('overall ' + stats[2]);
    T(id, 'Dashboard, ' + name, bad.length === 0, bad.join('; ') || stats.join(' / ') + ' · ' + hero.split('\n')[1]);
    // every page renders cleanly in this state
    const dirty = [];
    for (const p of PAGES) { await go(pg, p); const t = await txt(pg); if (t.length < 40 || /NaN|undefined|Invalid Date|\[object/.test(t)) dirty.push(p); }
    T(id + 'p', '  all 12 pages render without NaN/undefined/Invalid Date, ' + name, dirty.length === 0, dirty.join() || 'ok');
    await ctx.close();
  }

  // ===== C. DATE-DEPENDENT FEATURES (weekly reviews, analytics, exercises, goals, habits) =====
  const seed = oldSaved(false);
  {
    const { ctx, pg } = await mk({ time: '2026-11-20T12:00:00+02:00', seed });
    await go(pg, 'reviews');
    T('C1', 'Day 12: Weekly Reviews opens on Week 2, in progress', (await pg.locator('.tabs button[aria-pressed="true"]').innerText()).includes('Week 2') && (await txt(pg)).includes('In progress'));
    await pg.click('[data-rw="1"]'); await sleep(100);
    T('C2', 'Day 12: Week 1 review is shown as past due but still open (not failed)', (await txt(pg)).includes('Past due, still open'));
    await go(pg, 'analytics');
    const a = await txt(pg);
    T('C3', 'Day 12: Analytics shows programme day 12 of 42 and no broken numbers', /Programme day\s*12 of 42/.test(a.replace(/\n/g, ' ')) && !/NaN|undefined/.test(a));
    const habTxt = await pg.evaluate(() => { const s = [...document.querySelectorAll('#view section')].find(x => x.querySelector('h2') && x.querySelector('h2').textContent === 'Habit consistency'); return s ? s.innerText.replace(/\n/g, ' ') : ''; });
    const hab = habTxt.match(/Reading\s+(\d+) of (\d+) expected check-ins\s+(\d+)%/);
    T('C4', 'Habit consistency counts only elapsed days (Reading: 2 ticks of 11 elapsed days = 18%)', hab && hab[1] === '2' && hab[2] === '11' && hab[3] === '18', hab ? hab[0] : habTxt.slice(0, 120));
    await go(pg, 'exercises');
    const ex = await pg.$$eval('article', a => a.map(x => [x.querySelector('h3').textContent, x.querySelector('.chips').textContent]));
    const st = t => (ex.find(e => e[0] === t) || [0, ''])[1];
    T('C5', 'Day 12: an unfinished week 1 exercise is "Not done yet", week 2 is "Due now", week 3 is "Upcoming", and one the person ticked stays "Completed"', /Not done yet/.test(st('Values hunt')) && /Due now/.test(st('Proud moments')) && /Upcoming/.test(st('Identity draft')) && /Completed/.test(st('Belief audit')), st('Values hunt') + ' | ' + st('Proud moments') + ' | ' + st('Identity draft') + ' | ' + st('Belief audit'));
    await go(pg, 'goals');
    const g = await txt(pg);
    T('C6', 'Day 12: goals due 15 Nov counts as overdue; 20 Dec goal with 5% is at risk', /Overdue \(1\)/.test(g) && /At risk \(1\)/.test(g), (g.match(/(Active|At risk|Overdue|Completed) \(\d+\)/g) || []).join(' '));
    await ctx.close();
  }
  for (const [id, name, time, wantWeek, extra] of [['C7', 'before the start', '2026-11-07T10:00:00+02:00', 'Week 1', 'Not started'], ['C8', 'after the end', '2026-12-22T10:00:00+02:00', 'Week 6', null]]) {
    const { ctx, pg } = await mk({ time, seed });
    await go(pg, 'reviews');
    const w = await pg.locator('.tabs button[aria-pressed="true"]').innerText(), t = await txt(pg);
    T(id, 'Weekly Reviews ' + name + ': opens on ' + wantWeek + (extra ? ', "' + extra + '"' : '') + ', no Sunday prompt', w.includes(wantWeek) && (!extra || t.includes(extra)) && !t.includes('It\u2019s Sunday'), w);
    await go(pg, 'analytics'); const a = (await txt(pg)).replace(/\n/g, ' ');
    T(id + 'a', 'Analytics ' + name + ': programme day ' + (extra ? '0' : '42') + ' of 42, no NaN', new RegExp('Programme day\\s*' + (extra ? '0' : '42') + ' of 42').test(a) && !/NaN|undefined/.test(a));
    await ctx.close();
  }

  // ===== D. REAL TASKS WRITE TO THE REAL TRACKERS =====
  {
    const { ctx, pg } = await mk({ time: '2026-11-20T12:00:00+02:00', seed: oldSaved(false) });
    const tl = await txt(pg, '.col:first-child section:first-child');
    T('D1', 'Day 12 tasks are built from the person\u2019s own habits and this week\u2019s phase work (no sample wording)', tl.includes('Reading') && tl.includes('Focused work') && tl.includes('Read: Mindset, Chapters 1\u20132') && tl.includes('Exercise: Reframe three') && !/sample title|t1\b/i.test(tl), tl.split('\n').filter(Boolean).slice(0, 8).join(' | '));
    const before = await lsj(pg);
    await pg.locator('input[data-t="h:h1"]').check(); await sleep(150);
    await pg.locator('input[data-t="r:1:2"]').check(); await sleep(150);
    await pg.locator('input[data-t="x:p1w2"]').check(); await sleep(150);
    const a1 = await lsj(pg);
    T('D2', 'Ticking a habit on the dashboard writes that habit\u2019s check-in for the South African date', a1.hl.h1['2026-11-20'] === 1 && before.hl.h1['2026-11-20'] === undefined);
    T('D3', 'Ticking the reading and the exercise updates the phase tracker (and the exercise gets a completion date)', a1.ph[1].read[2] === true && a1.ph[1].ex[2] === true && a1.xc.p1w2 === '2026-11-20');
    T('D4', 'Real mode never writes the old placeholder task ids (t1 to t6) into the saved data', JSON.stringify(a1.done) === JSON.stringify(before.done), JSON.stringify(a1.done));
    await go(pg, 'habits'); T('D5', 'The Habit Tracker shows the habit as done today', (await pg.locator('button.chk.on').count()) >= 1);
    await go(pg, 'phases'); await pg.click('[data-pv="1"]'); await sleep(100);
    T('D6', 'The Phases page shows the week 2 reading and exercise ticked', (await pg.locator('input[data-pk="read:1:2"]:checked, input[id="read1_2"]:checked').count()) >= 1 && (await pg.locator('input[id="ex1_2"]:checked').count()) >= 1);
    await go(pg, 'journal'); await pg.locator('button[data-jnew]').first().click(); await pg.click('[data-jstart="blank"]'); await pg.fill('#jf_b', 'Today I wrote.'); await pg.click('[data-jsave="1"]'); await sleep(150);
    const je = (await lsj(pg)).jn.find(e => e.body === 'Today I wrote.');
    T('D7', 'A new journal entry defaults to the South African date (20 Nov)', je && je.date === '2026-11-20', je && je.date);
    await go(pg, 'dashboard');
    T('D8', 'The journal task ticks itself once a completed entry exists for today', (await pg.locator('input[data-t="j"]').isChecked()) && (await pg.locator('input[data-t="j"]').isDisabled()));
    await pg.locator('.hbtn[data-rec]').click(); await pg.locator('input[data-r="h:h2"]').check(); await pg.locator('label:has(input[name=mood][value="3"])').click(); await pg.fill('#note', 'steady'); await pg.click('#sv'); await sleep(200);
    const a2 = await lsj(pg);
    T('D9', 'Record today\u2019s progress saves habit ticks, mood and note to the right places', a2.hl.h2['2026-11-20'] === 1 && a2.logs['2026-11-20'].mood === 3 && a2.logs['2026-11-20'].note === 'steady');
    await ctx.close();
    const c2 = await mk({ time: '2026-11-21T12:00:00+02:00', seed: oldSaved(false) });
    T('D10', 'Saturday: the weekdays-only habit is not listed as a task', !(await txt(c2.pg, '.col:first-child section:first-child')).includes('Focused work'));
    await c2.ctx.close();
    const c3 = await mk({ time: '2026-11-07T10:00:00+02:00', seed: oldSaved(false) });
    await c3.pg.locator('.hbtn[data-rec]').click(); await sleep(100);
    T('D11', 'Before the start: the record dialog offers a mood note but no tasks', (await txt(c3.pg, '#dlg')).includes('no tasks yet') && (await c3.pg.locator('#dlg input[type=checkbox]').count()) === 0);
    await c3.ctx.close();
  }

  // ===== E. SAMPLE PREVIEW IS ISOLATED; DATA NEVER MIXED OR LOST =====
  {
    const { ctx, pg } = await mk({ time: '2026-11-07T10:00:00+02:00', seed: oldSaved(false) });
    const raw1 = await ls(pg); const REALDAY = 'Day 0';
    await go(pg, 'settings'); await pg.click('#mode'); await sleep(250);
    const bars = []; const mixed = [];
    for (const p of PAGES) { await go(pg, p); const t = await txt(pg); if (!t.includes('Sample preview')) bars.push(p); if (/My real goal|Late goal|My own reason|My journal entry|private words|my reading note|my reflection/.test(t)) mixed.push(p); }
    T('E1', 'Preview bar is shown on all 12 pages while the preview is on', bars.length === 0, bars.join() || 'all pages');
    T('E2', 'The person\u2019s own records are hidden in the preview (none appear on any page)', mixed.length === 0, mixed.join() || 'none visible');
    await go(pg, 'dashboard');
    T('E3', 'Preview shows the demonstration date (Day 12 of 42, 20 Nov) while the real date is before the start', (await txt(pg, '.hero')).includes('Day 12') && (await txt(pg)).includes('Task names are sample content'));
    await go(pg, 'goals'); T('E4', 'Preview shows sample goals marked "Sample"', (await txt(pg)).includes('Launch my own business') && (await pg.locator('.chip:has-text("Sample")').count()) >= 1);
    await pg.click('[data-gv="why"]'); await sleep(100); T('E5', 'Preview shows sample reasons', (await txt(pg)).includes('keeps promises to myself'));
    await go(pg, 'phases'); await pg.click('[data-pv="1"]'); await sleep(100);
    T('E6', 'Preview shows sample phase progress without real reflections', (await txt(pg)).includes('Phase 1') && !(await txt(pg)).includes('my reflection'));
    await go(pg, 'backup'); T('E7', 'Backup, import and restore are unavailable in the preview', (await txt(pg)).includes('Not available in the sample preview') && (await pg.locator('[data-bx]').count()) === 0);
    // do things in the preview
    await go(pg, 'goals'); await pg.click('[data-gv="active"]'); await pg.locator('button[data-gnew]').first().click(); await pg.fill('#gf_t', 'Preview-only goal'); await pg.click('#gsv'); await sleep(150);
    await go(pg, 'journal'); await pg.locator('button[data-jnew]').first().click(); await pg.click('[data-jstart="blank"]'); await pg.fill('#jf_t', 'Preview-only entry'); await pg.fill('#jf_b', 'preview words'); await pg.click('[data-jsave="1"]'); await sleep(150);
    await go(pg, 'habits'); await pg.click('[data-hex="all"]'); await sleep(150);
    T('E8', 'Creating a goal, journal entry and habits inside the preview works on screen', (await pg.evaluate(() => mem.goals.length + mem.jn.length + mem.hb.length)) === 9);
    T('E9', 'Stored data is byte-for-byte unchanged after all that preview activity', (await ls(pg)) === raw1);
    await pg.reload(); await sleep(300);
    const afterReload = await txt(pg);
    T('E10', 'A reload in the same tab stays in the preview, with the preview-only items gone (nothing was saved)', afterReload.includes('Sample preview') && !(await pg.evaluate(() => mem.goals.length + mem.jn.length + mem.hb.length)));
    const tab2 = await ctx.newPage(); await tab2.clock.install({ time: new Date('2026-11-07T10:00:00+02:00') }); await tab2.goto(O + '/'); await sleep(250);
    T('E11', 'A new tab starts in real mode, not in the preview', !(await txt(tab2)).includes('Sample preview') && (await tab2.evaluate(() => mem.sample)) === false); await tab2.close();
    await pg.click('[data-prevoff]'); await sleep(250);
    await go(pg, 'dashboard');
    T('E12', 'Returning to my data shows the real programme state (before the start), no sample bar', (await txt(pg, '.hero')).includes(REALDAY) && !(await txt(pg)).includes('Sample preview'));
    await go(pg, 'goals'); const gt = await txt(pg);
    T('E13', 'My real goals are back; no sample goals and no preview-only goal', gt.includes('My real goal') && !gt.includes('Launch my own business') && !gt.includes('Preview-only goal'));
    await go(pg, 'journal'); const jt = await txt(pg);
    T('E14', 'My real journal entry is back; the preview-only entry is not', jt.includes('My journal entry') && !jt.includes('Preview-only entry'));
    T('E15', 'Stored data still byte-for-byte identical after leaving the preview', (await ls(pg)) === raw1);
    for (let i = 0; i < 3; i++) { await go(pg, 'settings'); await pg.click('#mode'); await sleep(120); await pg.click('[data-prevoff]'); await sleep(120); }
    T('E16', 'Switching on and off three more times changes nothing in the saved data', (await ls(pg)) === raw1);
    // a normal real change after all that
    await go(pg, 'goals'); await pg.click('[data-gv="why"]'); await pg.fill('#rtext', 'A reason added after the preview'); await pg.click('#radd'); await sleep(200);
    const fin = await lsj(pg), orig = oldSaved(false);
    const same = DATA_KEYS.filter(k => k !== 'reasons').every(k => JSON.stringify(fin[k]) === JSON.stringify(orig[k]));
    T('E17', 'After a real change every other record is exactly as before, and the new reason is saved', same && fin.reasons.length === 2 && fin.reasons[1].t === 'A reason added after the preview');
    const sj = JSON.stringify(fin);
    T('E18', 'No sample or preview content ended up in the saved records', !/Launch my own business|Preview-only|keeps promises|sample title/.test(sj) && fin.sample === false);
    await ctx.close();
  }

  // ===== F. EXISTING SAVED DATA (old default was sample:true) IS PRESERVED =====
  {
    const old = oldSaved(true), rawOld = JSON.stringify(old);
    const { ctx, pg } = await mk({ time: '2026-11-07T10:00:00+02:00', raw: rawOld });
    await sleep(300);
    T('F1', 'Opening the app with old saved data (sample:true) does not write or overwrite storage', (await ls(pg)) === rawOld);
    const m = await pg.evaluate(() => ({ sample: mem.sample, preview: !!REAL, notice: mem.modeNotice }));
    T('F2', 'It opens in real-date mode with a one-time notice, not in the preview', m.sample === false && m.preview === false && m.notice === 1, JSON.stringify(m));
    T('F3', 'The notice explains that nothing was changed or removed', /Real dates are now the default[\s\S]*Nothing was changed or removed/.test(await txt(pg)));
    const inMem = await pg.evaluate(k => k.map(x => JSON.stringify(mem[x])), DATA_KEYS);
    T('F4', 'All records (goals, reasons, habits, check-ins, reading, notes, journal, reviews, reminders, alerts) loaded exactly as saved', DATA_KEYS.every((k, i) => inMem[i] === JSON.stringify(old[k])));
    const seen = [];
    for (const [p, w] of [['goals', 'My real goal'], ['journal', 'My journal entry'], ['habits', 'Focused work'], ['reading', '25%']]) { await go(pg, p); if (!(await txt(pg)).includes(w)) seen.push(p); }
    T('F5', 'The old records are visible in the app (goals, journal, habits, reading progress)', seen.length === 0, seen.join() || 'all visible');
    await go(pg, 'dashboard'); await pg.click('[data-nodismiss]'); await sleep(200);
    const saved = await lsj(pg);
    T('F6', 'After the first save every data record is still identical to the old data; only the mode flag changed', DATA_KEYS.every(k => JSON.stringify(saved[k]) === JSON.stringify(old[k])) && saved.sample === false && saved.modeNotice === 0);
    await pg.reload(); await sleep(250);
    T('F7', 'The notice does not come back after it is dismissed', !(await txt(pg)).includes('Real dates are now the default'));
    await ctx.close();
    const e2 = await mk({ time: '2026-11-07T10:00:00+02:00', raw: JSON.stringify({ sample: true, done: {}, logs: {}, goals: [], reasons: [] }) });
    T('F8', 'Old first-run state (sample:true, no records) opens in real mode with no notice', !(await txt(e2.pg)).includes('Real dates are now the default') && (await e2.pg.evaluate(() => mem.sample)) === false); await e2.ctx.close();
    // old backup file import
    const bk = { app: 'TRANSFORM 42', format: 1, exportedAt: '2026-11-06T09:00:00Z', data: oldSaved(true) }; fs.writeFileSync('/tmp/t42-old-backup.json', JSON.stringify(bk));
    const i3 = await mk({ time: '2026-11-07T10:00:00+02:00' });
    await go(i3.pg, 'backup'); await i3.pg.setInputFiles('#imf', '/tmp/t42-old-backup.json'); await sleep(300);
    T('F9', 'Importing an old backup file shows a preview comparison first', (await txt(i3.pg)).includes('Replace my data with this backup'));
    await i3.pg.click('[data-imgo]'); await i3.pg.click('#cdo'); await sleep(300);
    const im = await lsj(i3.pg);
    T('F10', 'The import restores every record and forces real mode (sample:false)', im.sample === false && DATA_KEYS.filter(k => !['lastBackup', 'rmF'].includes(k)).every(k => JSON.stringify(im[k]) === JSON.stringify(oldSaved(true)[k])), 'goals ' + im.goals.length + ', journal ' + im.jn.length);
    await i3.ctx.close();
  }

  {
    const old = oldSaved(true); old.rmOn = true; const rawOn = JSON.stringify(old);
    const { ctx, pg } = await mk({ time: '2026-11-07T10:00:00+02:00', raw: rawOn }); await sleep(400);
    const a = await lsj(pg), diff = Object.keys(Object.assign({}, old, a)).filter(k => JSON.stringify(old[k]) !== JSON.stringify(a[k])).sort().join();
    T('F11', 'With reminders on, the only keys that change at load are the mode flags, the reminder bookkeeping and one new "missed" alert; the old alert is kept', diff === ['lastSaved', 'modeNotice', 'nc', 'rmF', 'sample'].join() && a.nc.length === 2 && a.nc.some(n => n.id === 'nc1') && DATA_KEYS.filter(k => !['nc', 'rmF'].includes(k)).every(k => JSON.stringify(a[k]) === JSON.stringify(old[k])), diff);
    await ctx.close();
  }

  // ===== G. THE DATE ROLLS OVER WHILE THE APP IS OPEN =====
  {
    const { ctx, pg } = await mk({ time: '2026-11-20T23:58:30+02:00' });
    const d1 = (await txt(pg, '.hero')).match(/Day \d+/)[0];
    await pg.clock.fastForward(150000); await sleep(400);
    const d2 = (await txt(pg, '.hero')).match(/Day \d+/)[0];
    T('G1', 'Dashboard moves from Day 12 to Day 13 by itself after midnight in South Africa', d1 === 'Day 12' && d2 === 'Day 13', d1 + ' -> ' + d2);
    await ctx.close();
  }

  T('Z1', 'No page errors or console errors in the whole run (failed resource loads excluded)', errs.length === 0, errs.slice(0, 3).join(' ; '));
  await browser.close(); await stop(srv);
  const failed = results.filter(r => !r.pass);
  fs.writeFileSync(path.join(__dirname, 'modes-results.json'), JSON.stringify({ ran: new Date().toISOString(), chromium: '153', passed: results.length - failed.length, failed: failed.length, results }, null, 1));
  console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed of ' + results.length);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
