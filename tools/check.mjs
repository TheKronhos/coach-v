// Offline checks, run with: node tools/check.mjs
//  - every "ex"/"footwork" reference and timer in the shipped days files is valid
//  - sw.js precaches every runtime file, and every precached file exists
//  - update-bundle validation accepts good bundles and rejects bad ones
//  - rolling schedule (queue) behaviour, data/days-block-1r.json is reproducible, CSV round-trip
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const { validateDays, validateBlocks, requiredKeys, applyBundle, effective, validateExercise, validateFootwork } = await import('../app/validate.js');
const S = await import('../app/schedule.js');
const { toCSV, parseCSV } = await import('../app/views/log.js');

let failures = 0;
const test = (name, fn) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { failures++; console.log(`FAIL ${name}\n     ${e.message}`); } };

const program = J('data/program.json'), library = J('data/library.json'), footwork = J('data/footwork.json');
const daysFiles = Object.fromEntries([...new Set(program.blocks.map((b) => b.days_file))].map((f) => [f, J(`data/${f}`)]));
const base = { blocks: program.blocks, daysFiles, library, footwork: footwork.sequences };
const libIds = new Set(Object.keys(library)), fwNames = new Set(footwork.sequences.map((s) => s.name));

test('library has 56 exercises, all well-formed', () => {
  assert.equal(libIds.size, 56);
  const errs = []; for (const [id, ex] of Object.entries(library)) validateExercise(id, ex, errs);
  assert.deepEqual(errs, []);
});
test('footwork sequences well-formed', () => { const errs = []; footwork.sequences.forEach((s) => validateFootwork(s, errs)); assert.deepEqual(errs, []); });
test('every data/days*.json file is valid (all ex/footwork refs, timers)', () => {
  const errs = [];
  for (const f of readdirSync(join(root, 'data')).filter((f) => /^days.*\.json$/.test(f))) validateDays(J(`data/${f}`), f, libIds, fwNames, errs, []);
  assert.deepEqual(errs, []);
});
test('days-block-1r.json is exactly what tools/make-block-1r.mjs produces', () => {
  execFileSync(process.execPath, [join(root, 'tools/make-block-1r.mjs'), '--check'], { stdio: 'pipe' });
});
test('shipped blocks are valid (cycle-based, days files contain every cycle key)', () => {
  const errs = []; validateBlocks(program.blocks, daysFiles, errs);
  for (const [n, keys] of Object.entries(requiredKeys(program.blocks))) validateDays(daysFiles[n], n, libIds, fwNames, errs, keys);
  assert.deepEqual(errs, []);
});

test('sw.js precache covers every runtime file and nothing missing', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const list = [...sw.matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1]);
  const walk = (d) => readdirSync(join(root, d)).flatMap((f) => { const p = join(d, f); return statSync(join(root, p)).isDirectory() ? walk(p) : [p]; });
  const runtime = ['app', 'src', 'data', 'icons'].flatMap(walk).filter((p) => !/\.DS_Store$/.test(p)).concat(['index.html', 'manifest.webmanifest']);
  const missingFromList = runtime.filter((p) => !list.includes(p));
  const missingOnDisk = list.filter((p) => p !== './' && !existsSync(join(root, p)));
  assert.deepEqual({ missingFromList, missingOnDisk }, { missingFromList: [], missingOnDisk: [] });
});

test('app/version.js and sw.js versions match (x.y)', () => {
  const app = readFileSync(join(root, 'app/version.js'), 'utf8').match(/APP_VERSION = '([^']+)'/)[1];
  const sw = readFileSync(join(root, 'sw.js'), 'utf8').match(/CACHE_VERSION = 'coach-v-([^']+)'/)[1];
  assert.match(app, /^\d+\.\d+$/); assert.equal(sw, app);
});

// ---- update bundles ----
const days2 = JSON.parse(JSON.stringify(J('data/days.json')));
const goodBundle = {
  type: 'coach-v-update', data_version: 'test',
  blocks: [{ id: 'block-test', cycles: 2, days_file: 'days-test.json', check_in: 'TEST check-in' }],
  days_files: { 'days-test.json': days2 },
};
test('good bundle is accepted and appended after the shipped blocks', () => {
  const r = applyBundle(base, null, goodBundle);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(effective(base, r.overlay).blocks.map((b) => b.id), [...program.blocks.map((b) => b.id), 'block-test']);
});
test('bad refs are rejected with clear paths', () => {
  const bad = JSON.parse(JSON.stringify(goodBundle));
  bad.days_files['days-test.json'].monday.sections[1].items[0] = { footwork: 'Moonwalk' };
  bad.days_files['days-test.json'].friday.sections[0].items[1] = { ex: 'jabb' };
  bad.days_files['days-test.json'].sunday.sections[2].timer = { type: 'tabata' };
  const r = applyBundle(base, null, bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('unknown footwork sequence "Moonwalk"') && e.includes('monday')), r.errors.join('\n'));
  assert.ok(r.errors.some((e) => e.includes('unknown exercise "jabb"') && e.includes('friday')));
  assert.ok(r.errors.some((e) => e.includes('unknown timer type "tabata"')));
});
test('bundle may add exercises/footwork that its days file uses', () => {
  const b = JSON.parse(JSON.stringify(goodBundle));
  b.library = { 'test-ex': { ...library.jab, name: 'Test ex' } };
  b.footwork = [{ ...footwork.sequences[1], name: 'Test step' }];
  b.days_files['days-test.json'].monday.sections[0].items.push({ ex: 'test-ex' }, { footwork: 'Test step' });
  assert.deepEqual(applyBundle(base, null, b).errors, []);
});
test('date-based blocks, bad cycles, missing days file, library overwrite rejected', () => {
  const b = JSON.parse(JSON.stringify(goodBundle));
  b.blocks.push({ id: 'b3', start: '2026-10-20', end: '2026-11-01', days_file: 'days-test.json' });
  b.blocks.push({ id: 'b4', cycles: 0, days_file: 'nope.json' });
  b.library = { jab: { ...library.jab, name: 'Changed' } };
  const errs = applyBundle(base, null, b).errors.join('\n');
  assert.match(errs, /b3: uses "start"\/"end" dates/); assert.match(errs, /b3: "cycles" must be/);
  assert.match(errs, /b4: "cycles" must be/); assert.match(errs, /nope\.json/); assert.match(errs, /library › jab: already exists/);
});
test('cycle-based bundle: days file needs only its cycle keys', () => {
  const d1r = J('data/days-block-1r.json');
  const b = { type: 'coach-v-update', blocks: [{ id: 'block-c', cycles: 1, cycle: ['monday', 'rest', 'monday'], days_file: 'days-c.json' }], days_files: { 'days-c.json': { monday: d1r.monday, rest: d1r.rest } } };
  assert.deepEqual(applyBundle(base, null, b).errors, []);
  const missing = JSON.parse(JSON.stringify(b)); delete missing.days_files['days-c.json'].rest;
  assert.match(applyBundle(base, null, missing).errors.join('\n'), /cycle uses "rest", which is not in days-c\.json/);
  const badCycle = JSON.parse(JSON.stringify(b)); badCycle.blocks[0].cycle = 'monday';
  assert.match(applyBundle(base, null, badCycle).errors.join('\n'), /"cycle" must be a non-empty list/);
  const noCycle = JSON.parse(JSON.stringify(b)); delete noCycle.blocks[0].cycle;   // defaults to Sun..Sat
  assert.match(applyBundle(base, null, noCycle).errors.join('\n'), /days-c\.json › sunday: missing day/);
});
test('wrong file type rejected', () => { assert.equal(applyBundle(base, null, { hello: 1 }).ok, false); });

// ---- rolling schedule ----
const CYCLE = ['monday', 'wednesday', 'tuesday', 'thursday', 'friday', 'saturday', 'rest'];
const B1 = { id: 'block-1r', cycles: 2, cycle: CYCLE, days_file: 'x', check_in: 'c' };
const B2 = { id: 'block-2', cycles: 1, days_file: 'y' };
const T = '2026-10-13'; // a Tuesday: the queue ignores the weekday
const d = (n) => S.addDays(T, n);
test('fresh queue: session 1 (Fundamentals = monday key) today, label "1R", 14 sessions', () => {
  const c = S.current(null, [B1], T);
  assert.deepEqual([c.label, c.n, c.total, c.day, c.cycle, c.plannedDate, c.isDueToday, c.finished], ['1R', 1, 14, 'monday', 1, T, true, false]);
});
test('days passing never advance the queue', () => {
  const q = S.newQueue([B1], T);
  const later = S.current(q, [B1], d(3));
  assert.equal(later.n, 1); assert.equal(later.plannedDate, d(3)); assert.equal(later.isDueToday, true);
});
test('Done completes: next session planned for tomorrow, Today shows it', () => {
  let q = S.complete(S.newQueue([B1], T), [B1], T);
  let c = S.current(q, [B1], T);
  assert.deepEqual([c.n, c.day, c.plannedDate, c.isDueToday], [2, 'wednesday', d(1), false]);
  c = S.current(q, [B1], d(1)); assert.equal(c.isDueToday, true);
});
test('Skip: same session moves to tomorrow, later sessions shift a day', () => {
  const q0 = S.newQueue([B1], T);
  const before = S.upcoming(q0, [B1], T).map((u) => u.date);
  const q = S.skip(q0, [B1], T);
  const c = S.current(q, [B1], T);
  assert.deepEqual([c.n, c.plannedDate], [1, d(1)]);
  assert.deepEqual(S.upcoming(q, [B1], T).map((u) => u.date), before.map((x) => S.addDays(x, 1)));
});
test('upcoming: projected one per day, ends at session 14, then continues into next block', () => {
  const u = S.upcoming(S.newQueue([B1], T), [B1], T);
  assert.equal(u.length, 14); assert.equal(u[13].n, 14); assert.equal(u[13].date, d(13));
  assert.deepEqual(u.map((x) => x.day), [...CYCLE, ...CYCLE]); assert.deepEqual([u[6].cycle, u[7].cycle], [1, 2]);
  const u2 = S.upcoming(S.newQueue([B1, B2], T), [B1, B2], T, 20);
  assert.deepEqual([u2[14].block.id, u2[14].n, u2.length], ['block-2', 1, 20]);
});
test('7+ days without a completion offers a cycle restart (never automatic)', () => {
  let q = S.newQueue([B1], T);
  for (let i = 0; i < 3; i++) q = S.complete(q, [B1], d(i)); // sessions 1-3 done, next is #4
  assert.equal(S.current(q, [B1], d(8)).offerRestart, false);  // 6 days since last done
  const c = S.current(q, [B1], d(9));                          // 7 days
  assert.deepEqual([c.offerRestart, c.n], [true, 4]);
  const r = S.current(S.restartCycle(q, [B1], d(9)), [B1], d(9));
  assert.deepEqual([r.n, r.day, r.plannedDate, r.offerRestart], [1, 'monday', d(9), false]);
  assert.equal(S.current(S.dismissRestart(q, d(9)), [B1], d(9)).offerRestart, false);
  assert.equal(S.current(S.dismissRestart(q, d(9)), [B1], d(10)).offerRestart, true);
});
test('no restart offer when already at a cycle start', () => {
  let q = S.newQueue([B1], T);
  for (let i = 0; i < 7; i++) q = S.complete(q, [B1], d(i));
  const c = S.current(q, [B1], d(30));
  assert.deepEqual([c.n, c.cycle, c.offerRestart], [8, 2, false]);
});
test('Start over: session 1 of the active block, today', () => {
  let q = S.newQueue([B1], T);
  for (let i = 0; i < 5; i++) q = S.complete(q, [B1], d(i));
  const c = S.current(S.startOver(q, [B1], d(20)), [B1], d(20));
  assert.deepEqual([c.block.id, c.n, c.plannedDate, c.offerRestart], ['block-1r', 1, d(20), false]);
});
test('finishing the last block -> finished (banner), extra sessions repeat the cycle', () => {
  let q = S.newQueue([B1], T);
  for (let i = 0; i < 14; i++) q = S.complete(q, [B1], d(i));
  const c = S.current(q, [B1], d(14));
  assert.deepEqual([c.finished, c.n, c.day], [true, 15, 'monday']);
  assert.equal(S.upcoming(q, [B1], d(14)).length, 14);
});
test('finishing a block with a successor moves to it; importing a block later resumes', () => {
  let q = S.newQueue([B1, B2], T);
  for (let i = 0; i < 14; i++) q = S.complete(q, [B1, B2], d(i));
  assert.deepEqual([S.current(q, [B1, B2], d(14)).block.id, S.current(q, [B1, B2], d(14)).n], ['block-2', 1]);
  let q1 = S.newQueue([B1], T);
  for (let i = 0; i < 15; i++) q1 = S.complete(q1, [B1], d(i));   // finished + 1 extra
  const c = S.current(q1, [B1, B2], d(15));                       // block 2 imported
  assert.deepEqual([c.block.id, c.n, c.finished], ['block-2', 2, false]);
});
test('restart in cycle 2 goes back to session 8 (start of cycle 2)', () => {
  let q = S.newQueue([B1], T);
  for (let i = 0; i < 10; i++) q = S.complete(q, [B1], d(i));
  const r = S.current(S.restartCycle(q, [B1], d(30)), [B1], d(30));
  assert.deepEqual([r.n, r.cycle, r.day], [8, 2, 'monday']);
});
test('block without "cycle" runs Sun..Sat (7 per cycle)', () => {
  const W = { id: 'w', cycles: 1, days_file: 'x' };
  assert.deepEqual(S.upcoming(S.newQueue([W], T), [W], T).map((u) => u.day), ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
});
test('queue for a block that no longer exists falls back to the first block', () => {
  const c = S.current({ blockId: 'gone', pos: 5, nextDate: T, startedOn: T, lastDoneOn: null }, [B1], T);
  assert.deepEqual([c.block.id, c.n], ['block-1r', 1]);
});

// ---- CSV ----
test('CSV round-trip with commas, quotes, newlines', () => {
  const e = [
    { id: 1, date: '2026-10-13', block_id: 'block-1r', week: 1, day: 'sunday', session_number: 1, session: 'Aerobic Engine & Shadow Flow', status: 'done', rpe_target: '5', rpe_hit: '6', weights: 'KB 16 kg, "heavy"', notes: 'line1\nline2' },
    { id: 2, date: '2026-10-14', block_id: 'block-1r', week: 1, day: 'monday', session_number: 2, session: 'Fundamentals & Footwork', status: 'skipped' },
    { id: 3, date: '2026-09-27', block_id: 'block-1', week: 1, day: 'sunday', session: 'Old entry' }, // pre-rolling entry
  ];
  const csv = toCSV(e);
  assert.ok(csv.startsWith('date,block_id,week,day,session_number,session,status,rpe_target,rpe_hit,weights,notes\r\n'));
  const all = parseCSV(csv);
  assert.deepEqual(all.map((r) => [r.session_number, r.status]), [['', 'done'], ['1', 'done'], ['2', 'skipped']]);
  const back = all[1];
  assert.equal(back.weights, 'KB 16 kg, "heavy"'); assert.equal(back.notes, 'line1\nline2'); assert.equal(back.block_id, 'block-1r'); assert.equal(back.week, '1');
});

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
