// Offline checks, run with: node tools/check.mjs
//  - every "ex"/"footwork" reference and timer in the shipped days files is valid
//  - sw.js precaches every runtime file, and every precached file exists
//  - update-bundle validation accepts good bundles and rejects bad ones
//  - block / week resolution and CSV round-trip
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const J = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const { validateDays, validateBlocks, applyBundle, effective, validateExercise, validateFootwork } = await import('../app/validate.js');
globalThis.indexedDB = undefined; // data.js only touches IndexedDB inside functions
const data = await import('../app/data.js');
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
test('shipped blocks + days files are valid (all ex/footwork refs, timers)', () => {
  const errs = []; validateBlocks(program.blocks, daysFiles, errs);
  for (const [n, d] of Object.entries(daysFiles)) validateDays(d, n, libIds, fwNames, errs);
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
const days2 = JSON.parse(JSON.stringify(daysFiles['days.json']));
const goodBundle = {
  type: 'coach-v-update', data_version: 'test',
  blocks: [{ id: 'block-2', name: 'TEST block', start: '2026-10-11', end: '2026-10-24', days_file: 'days-test.json', check_in: 'TEST check-in' }],
  days_files: { 'days-test.json': days2 },
};
test('good bundle is accepted and merged', () => {
  const r = applyBundle(base, null, goodBundle);
  assert.deepEqual(r.errors, []);
  const eff = effective(base, r.overlay);
  assert.deepEqual(eff.blocks.map((b) => b.id), ['block-1', 'block-2']);
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
test('overlapping blocks, missing days file, library overwrite rejected', () => {
  const b = JSON.parse(JSON.stringify(goodBundle));
  b.blocks.push({ id: 'block-3', name: 'x', start: '2026-10-20', end: '2026-11-01', days_file: 'nope.json' });
  b.library = { jab: { ...library.jab, name: 'Changed' } };
  const errs = applyBundle(base, null, b).errors.join('\n');
  assert.match(errs, /overlaps/); assert.match(errs, /nope\.json/); assert.match(errs, /library › jab: already exists/);
});
test('wrong file type rejected', () => { assert.equal(applyBundle(base, null, { hello: 1 }).ok, false); });

// ---- block / week resolution ----
Object.assign(data.state, { program, base, ...base });
test('before start -> Sunday, block 1 week 1', () => {
  const s = data.sessionFor('2026-09-20'); // a Sunday before start
  assert.equal(s.status, 'before'); assert.equal(s.day, 'sunday'); assert.equal(s.week, 1);
  assert.equal(data.sessionFor('2026-09-24').day, 'sunday'); // a Thursday before start
});
test('in block: weekday + week number', () => {
  assert.deepEqual((({ status, day, week }) => ({ status, day, week }))(data.sessionFor('2026-09-27')), { status: 'active', day: 'sunday', week: 1 });
  assert.equal(data.sessionFor('2026-10-03').week, 1);
  assert.equal(data.sessionFor('2026-10-04').week, 2);
  assert.equal(data.sessionFor('2026-10-10').day, 'saturday');
  assert.equal(data.sessionFor('2026-09-27').scheduleNote, 'First-session version of shadow flow');
});
test('after last block -> ended, keeps last block sessions', () => {
  const s = data.sessionFor('2026-10-14');
  assert.equal(s.status, 'ended'); assert.equal(s.block.id, 'block-1'); assert.equal(s.day, 'wednesday'); assert.equal(s.week, 3);
  assert.equal(s.plan.title, daysFiles['days.json'].wednesday.title);
});
test('with imported block 2 -> block 2 week 1', () => {
  Object.assign(data.state, effective(base, applyBundle(base, null, goodBundle).overlay));
  const s = data.sessionFor('2026-10-12');
  assert.equal(s.block.id, 'block-2'); assert.equal(s.index, 1); assert.equal(s.week, 1); assert.equal(s.status, 'active');
  Object.assign(data.state, base);
});

// ---- CSV ----
test('CSV round-trip with commas, quotes, newlines', () => {
  const e = [{ id: 1, date: '2026-09-27', block_id: 'block-1', week: 1, day: 'sunday', session: 'Aerobic Engine & Shadow Flow', rpe_target: '5', rpe_hit: '6', weights: 'KB 16 kg, "heavy"', notes: 'line1\nline2' }];
  const csv = toCSV(e);
  assert.ok(csv.startsWith('date,block_id,week,day,session,rpe_target,rpe_hit,weights,notes\r\n'));
  const back = parseCSV(csv)[0];
  assert.equal(back.weights, 'KB 16 kg, "heavy"'); assert.equal(back.notes, 'line1\nline2'); assert.equal(back.block_id, 'block-1'); assert.equal(back.week, '1');
});

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
