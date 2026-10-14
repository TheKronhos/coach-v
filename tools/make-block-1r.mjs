// Builds data/days-block-1r.json (reset block, reduced volume, 4 training days) from
// data/days.json. The Sunday session is not used in this block (it stays in days.json),
// a "rest" entry is added, and every other change is listed explicitly with its old value, so Coach V can review the
// exact edits and re-running the script is deterministic. The script fails if any
// old value doesn't match, or if anything other than the listed fields changed.
//
// Usage: node tools/make-block-1r.mjs            writes the file, prints the change table
//        node tools/make-block-1r.mjs --check    verifies the committed file is up to date
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(readFileSync(join(root, 'data/days.json'), 'utf8'));
const OUT = join(root, 'data/days-block-1r.json');

// Rule keys (from Coach V's reset rules)
const R = {
  rounds: 'Round timer: 2 min -> 1 min work, rounds 5->3 / 4->3 / 3->2',
  hold: 'Timed hold: halve, nearest 5 sec, min 10 sec',
  sets: 'Strength/core: 3 sets -> 2',
  zone2: 'Zone 2: 1500 -> 900 sec, "12-15 min"',
  intervals: 'Wed bag intervals: 3 rounds, beginner [15,45]',
  circuit: 'Wed circuit: 3 -> 2 rounds',
  emom: 'Thu EMOM: 12 -> 6 min (2 cycles)',
  footwork: 'Footwork drills: 4 x 1 min -> 3 x 1 min',
  walk: 'Recovery days: easy walk or easy bike',
  coach: 'Coach V decision (Oct 13)',
};

// [day, path within the day, old, new, rule]
const s = (i) => `sections.${i}`;
const EDITS = [
  // ---- Monday ----
  ['monday', `${s(1)}.timer.rounds`, 4, 3, R.footwork],
  ['monday', 'rpe', '6', '5', R.coach],
  ['monday', 'minutes', '~60', '~50', R.coach],
  ['monday', `${s(1)}.items.0.dose`, 'Step-drag, all four directions: 4 x 1 min, 30 sec rest', 'Step-drag, all four directions: 3 x 1 min, 30 sec rest', R.footwork],
  ['monday', `${s(1)}.items.5.dose`, '3 x 30 sec', '2 x 30 sec', R.coach],
  ['monday', `${s(2)}.format`, '4 x 2 min, 1 min rest', '3 x 1 min, 1 min rest', R.rounds],
  ['monday', `${s(2)}.timer.rounds`, 4, 3, R.rounds],
  ['monday', `${s(2)}.timer.work_sec`, 120, 60, R.rounds],
  ['monday', `${s(3)}.format`, '5 x 2 min, 1 min rest, 60% power', '3 x 1 min, 1 min rest, 60% power', R.rounds],
  ['monday', `${s(3)}.timer.rounds`, 5, 3, R.rounds],
  ['monday', `${s(3)}.timer.work_sec`, 120, 60, R.rounds],
  ['monday', `${s(4)}.format`, '3 x 2 min, 1 min rest', '2 x 1 min, 1 min rest', R.rounds],
  ['monday', `${s(4)}.timer.rounds`, 3, 2, R.rounds],
  ['monday', `${s(4)}.timer.work_sec`, 120, 60, R.rounds],
  ['monday', `${s(5)}.items.0.dose`, '3 x 10 per side', '2 x 10 per side', R.sets],
  ['monday', `${s(5)}.items.1.dose`, '3 x 30 sec', '2 x 15 sec', `${R.sets}; ${R.hold}`],
  ['monday', `${s(5)}.items.2.dose`, '2 x 20 sec per side', '2 x 10 sec per side', R.hold],

  // ---- Tuesday / Friday (active recovery) ----
  ['tuesday', 'emphasis', "Extra time on shoulders and upper back after Monday's bag work.", 'Extra time on shoulders, upper back, forearms and wrists after the Heavy Bag session.', R.coach],
  ['tuesday', `${s(0)}.items.0.text`, 'Easy walk: 15-20 min, relaxed pace.', 'Easy walk or easy bike: 15-20 min at a pace where you can talk in full sentences.', R.walk],
  ['friday', 'emphasis', "Extra time on legs and hips after Thursday's lifting.", 'Extra time on legs and hips after the Strength session.', R.coach],
  ['friday', `${s(0)}.items.0.text`, 'Easy walk: 15-20 min, relaxed pace.', 'Easy walk or easy bike: 15-20 min at a pace where you can talk in full sentences.', R.walk],

  // ---- Wednesday ----
  ['wednesday', 'rpe', '7-8', '6-7', R.coach],
  ['wednesday', 'minutes', '~65', '~50', R.coach],
  ['wednesday', `${s(1)}.format`, '5 x 2 min, 1 min rest. One combo at 80-85%, reset, breathe, repeat.', '3 x 1 min, 1 min rest. One combo at 80-85%, reset, breathe, repeat.', R.rounds],
  ['wednesday', `${s(1)}.timer.rounds`, 5, 3, R.rounds],
  ['wednesday', `${s(1)}.timer.work_sec`, 120, 60, R.rounds],
  ['wednesday', `${s(2)}.format`, '4 rounds. Beginner 20 on / 40 off. Intermediate 30/30. Advanced 40/20.', '3 rounds. Beginner 15 on / 45 off. Intermediate 30/30. Advanced 40/20.', R.intervals],
  ['wednesday', `${s(2)}.timer.rounds`, 4, 3, R.intervals],
  ['wednesday', `${s(2)}.timer.by_level.beginner`, [20, 40], [15, 45], R.intervals],
  ['wednesday', `${s(3)}.format`, '3 rounds, 90 sec rest between rounds', '2 rounds, 90 sec rest between rounds', R.circuit],
  ['wednesday', `${s(3)}.timer.rounds`, 3, 2, R.circuit],
  ['wednesday', `${s(4)}.items.0.dose`, '3 x 10 per side', '2 x 10 per side', R.sets],
  ['wednesday', `${s(4)}.items.1.dose`, '3 x 8', '2 x 8', R.sets],
  ['wednesday', `${s(4)}.items.2.dose`, '3 x 15-20 m', '2 x 15-20 m', R.sets],

  // ---- Thursday ----
  ['thursday', 'rpe', '8', '7', R.coach],
  ['thursday', 'minutes', '~65', '~50', R.coach],
  ['thursday', `${s(1)}.items.0.dose`, '3 x 5 per side', '2 x 5 per side', R.coach],
  ['thursday', `${s(1)}.items.1.dose`, '3 x 5', '2 x 5', R.coach],
  ['thursday', `${s(2)}.items.0.dose`, 'A. 3 x 8, 2 min rest', 'A. 2 x 8, 2 min rest', R.sets],
  ['thursday', `${s(2)}.items.1.dose`, 'B1. 3 x 10, alternate with B2', 'B1. 2 x 10, alternate with B2', R.sets],
  ['thursday', `${s(2)}.items.2.dose`, 'B2. 3 x 10 per side. 90 sec rest after each B pair.', 'B2. 2 x 10 per side. 90 sec rest after each B pair.', R.sets],
  ['thursday', `${s(2)}.items.3.dose`, 'C1. 3 x 8 per side, alternate with C2', 'C1. 2 x 8 per side, alternate with C2', R.sets],
  ['thursday', `${s(2)}.items.4.dose`, 'C2. 3 x 8 per side. 90 sec rest after each C pair.', 'C2. 2 x 8 per side. 90 sec rest after each C pair.', R.sets],
  ['thursday', `${s(3)}.format`, '12 min EMOM: cycle the 3 stations 4 times. Beginner: 30 sec work, rest the rest of each minute.', '6 min EMOM: cycle the 3 stations 2 times. Beginner: 30 sec work, rest the rest of each minute.', R.emom],
  ['thursday', `${s(3)}.timer.rounds`, 12, 6, R.emom],
  ['thursday', `${s(4)}.items.0.dose`, '3 x 30-40 m, heavy', '2 x 30-40 m, heavy', R.sets],
  ['thursday', `${s(4)}.items.1.dose`, '3 x 8', '2 x 8', R.sets],
  ['thursday', `${s(4)}.items.2.dose`, '2 x 30 sec per side', '2 x 15 sec per side', R.hold],

  // ---- Saturday ----
  ['saturday', 'rpe', '6-7', '5-6', R.coach],
  ['saturday', 'minutes', '~55', '~50', R.coach],
  ['saturday', `${s(1)}.format`, "4 x 2 min, 1 min rest. It will hit you in the face. That's the lesson.", "3 x 1 min, 1 min rest. It will hit you in the face. That's the lesson.", R.rounds],
  ['saturday', `${s(1)}.timer.rounds`, 4, 3, R.rounds],
  ['saturday', `${s(1)}.timer.work_sec`, 120, 60, R.rounds],
  ['saturday', `${s(2)}.format`, '3 x 2 min, 1 min rest', '2 x 1 min, 1 min rest', R.rounds],
  ['saturday', `${s(2)}.timer.rounds`, 3, 2, R.rounds],
  ['saturday', `${s(2)}.timer.work_sec`, 120, 60, R.rounds],
  ['saturday', `${s(3)}.items.1.timer.rounds`, 4, 3, R.rounds],
  ['saturday', `${s(3)}.items.1.dose`, '4 x 20 sec between two cones 3 m apart, 40 sec rest', '3 x 20 sec between two cones 3 m apart, 40 sec rest', R.rounds],
  ['saturday', `${s(3)}.items.2.dose`, 'Angle-out drill: 3 x 2 min. Throw a 1-2, then pivot or step off to the side.', 'Angle-out drill: 2 x 1 min, 1 min rest. Throw a 1-2, then pivot or step off to the side.', R.coach],
  ['saturday', `${s(3)}.items.2.timer`, undefined, { type: 'rounds', rounds: 2, work_sec: 60, rest_sec: 60 }, R.coach],
  ['saturday', `${s(4)}.items.0.dose`, '3 x 20', '2 x 15', R.coach],
  ['saturday', `${s(4)}.items.1.dose`, '3 x 6 per side', '2 x 5 per side', R.coach],
  ['saturday', `${s(5)}.items.0.dose`, '3 x 20 sec', '2 x 10 sec', `${R.sets}; ${R.hold}`],
  ['saturday', `${s(5)}.items.1.dose`, '3 x 15 per side', '2 x 15 per side', R.sets],
];

const get = (o, path) => path.split('.').reduce((x, k) => x?.[k], o);
function set(o, path, v) { const ks = path.split('.'); const last = ks.pop(); ks.reduce((x, k) => x[k], o)[last] = v; }

// Round lines past the new round count (Coach V: delete). [day, section, item, expected dose/text]
const DELETES = [
  ['monday', 2, 3, 'R4: freestyle 1, 2, and 1-1-2 with footwork'],
  ['monday', 3, 4, 'R4: 1-1-2'],
  ['monday', 3, 5, 'R5: freestyle, moving after every combo.'],
  ['wednesday', 1, 3, 'R4: 1-2-3-2'],
  ['wednesday', 1, 4, 'R5: freestyle power combos, moving between them.'],
  ['saturday', 1, 3, 'R4: freestyle with movement.'],
];

// New entry for the block's rest day.
const REST = {
  title: 'Full Rest', rpe: '-', minutes: '0', recovery: true,
  sections: [{ name: 'Rest', items: [{ text: 'Full rest. An easy walk is fine if you feel like it. No training.' }] }],
};
const DROPPED = ['sunday']; // not in this block's cycle

const out = JSON.parse(JSON.stringify(src));
for (const [day, path, from, to] of EDITS) {
  assert.deepEqual(get(src[day], path), from, `${day}.${path}: expected ${JSON.stringify(from)}, found ${JSON.stringify(get(src[day], path))}`);
  set(out[day], path, to);
}

// Nothing but the listed fields may differ.
const listed = new Set(EDITS.map(([d, p]) => `${d}.${p}`));
function walk(a, b, path) {
  if (listed.has(path)) return;
  if (a && typeof a === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], path ? `${path}.${k}` : k); return; }
  assert.equal(b, a, `unexpected change at ${path}`);
}
walk(src, out, '');
// Delete from the highest index down so earlier indexes stay valid.
for (const [day, si, ii, label] of [...DELETES].sort((a, b) => b[2] - a[2])) {
  const it = out[day].sections[si].items[ii];
  assert.equal(it.dose ?? it.text, label, `delete ${day} section ${si} item ${ii}: found ${JSON.stringify(it)}`);
  out[day].sections[si].items.splice(ii, 1);
}
for (const d of DROPPED) delete out[d];
out.rest = REST;

const text = JSON.stringify(out, null, 1) + '\n';
if (process.argv.includes('--check')) {
  assert.equal(readFileSync(OUT, 'utf8'), text, 'data/days-block-1r.json is out of date: run node tools/make-block-1r.mjs');
  console.log(`days-block-1r.json matches (${EDITS.length} edits)`);
} else {
  writeFileSync(OUT, text);
  const where = (day, path) => {
    const m = path.match(/^sections\.(\d+)(?:\.items\.(\d+))?\.(.*)$/);
    if (!m) return `${day[0].toUpperCase() + day.slice(1, 3)} · ${src[day].title} · ${path}`;
    const sec = src[day].sections[+m[1]];
    const it = m[2] != null ? sec.items[+m[2]] : null;
    const label = it ? (it.ex || it.footwork) : sec.name;
    return `${day[0].toUpperCase() + day.slice(1, 3)} · ${it ? `${sec.name} › ${label}` : sec.name} · ${m[3]}`;
  };
  const fmt = (v) => (v === undefined ? '(none)' : typeof v === 'string' ? v : JSON.stringify(v)).replace(/\|/g, '\\|');
  console.log('| # | Where | Old | New | Rule |\n|---|---|---|---|---|');
  EDITS.forEach(([day, path, from, to, rule], i) => console.log(`| ${i + 1} | ${where(day, path)} | ${fmt(from)} | ${fmt(to)} | ${rule} |`));
  for (const [day, si, ii, label] of DELETES) console.log(`| - | ${day[0].toUpperCase() + day.slice(1, 3)} · ${src[day].sections[si].name} › ${src[day].sections[si].items[ii].ex || 'text'} | ${fmt(label)} | deleted | ${R.coach} |`);
  console.log(`| - | Sun · whole session (${src.sunday.title}) | in block | not in this block (kept in days.json) | 4 training days |`);
  console.log(`| - | rest (new) | - | ${fmt(JSON.stringify(REST))} | Full rest day |`);
  console.log(`\nWrote data/days-block-1r.json (${EDITS.length} edits)`);
}
