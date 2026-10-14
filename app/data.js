// Loads bundled program data, applies any imported update from IndexedDB,
// and runs the rolling session queue.
import { kvGet, kvSet, kvSetMany } from './db.js';
import { WEEKDAYS, applyBundle, effective } from './validate.js';
import * as S from './schedule.js';
import { addDays } from './schedule.js';

export { WEEKDAYS };
export const DAY_LABEL = Object.fromEntries(WEEKDAYS.map((d) => [d, d[0].toUpperCase() + d.slice(1)]));

const getJSON = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });

export const state = {
  program: null,   // program.json as shipped (athlete, rules, blocks, ...)
  base: null,      // { blocks, daysFiles, library, footwork } from data/
  overlay: null,   // imported update (IndexedDB "program:current")
  hasPrevious: false,
  fwMeta: null,    // footwork.json description + rule
  // effective:
  blocks: [], daysFiles: {}, library: {}, footwork: [],
};

export async function loadData() {
  const [program, library, footwork] = await Promise.all([
    getJSON('data/program.json'), getJSON('data/library.json'), getJSON('data/footwork.json'),
  ]);
  const files = [...new Set(program.blocks.map((b) => b.days_file))];
  const days = await Promise.all(files.map((f) => getJSON(`data/${f}`)));
  state.program = program;
  state.fwMeta = { description: footwork.description, rule: footwork.rule };
  state.base = {
    blocks: program.blocks,
    daysFiles: Object.fromEntries(files.map((f, i) => [f, days[i]])),
    library,
    footwork: footwork.sequences,
  };
  try {
    state.overlay = (await kvGet('program:current')) ?? null;
    state.hasPrevious = (await kvGet('program:previous')) !== undefined;
  } catch (e) { console.warn('IndexedDB unavailable', e); }
  recompute();
}

function recompute() {
  Object.assign(state, effective(state.base, state.overlay));
}

// ---- program updates ----
export async function importBundle(bundle) {
  const res = applyBundle(state.base, state.overlay, bundle);
  if (!res.ok) return res;
  // previous = what was current before (null means "bundled data only").
  await kvSetMany([['program:previous', state.overlay ?? null], ['program:current', res.overlay]]);
  state.overlay = res.overlay; state.hasPrevious = true; recompute();
  return res;
}

export async function undoImport() {
  const prev = await kvGet('program:previous');
  if (prev === undefined) return false;
  await kvSetMany([['program:current', prev ?? undefined], ['program:previous', undefined]]);
  state.overlay = prev ?? null; state.hasPrevious = false; recompute();
  return true;
}

// ---- dates (all local, as YYYY-MM-DD strings) ----
export const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = () => iso(new Date());
const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const fmtDate = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(utc(s)).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
// "Today", "Tomorrow", or a short date.
export function relDate(s, today = todayISO()) {
  if (s === today) return 'Today';
  if (s === addDays(today, 1)) return 'Tomorrow';
  return fmtDate(s);
}
export { addDays };

// ---- rolling schedule (queue persisted in IndexedDB "queue") ----
export async function getQueue() {
  const today = todayISO();
  let stored = null;
  try { stored = (await kvGet('queue')) ?? null; } catch (e) { console.warn('IndexedDB unavailable', e); }
  const q = S.normalize(stored, state.blocks, today);
  if (!stored || JSON.stringify(stored) !== JSON.stringify(q)) await saveQueue(q);
  return q;
}
export async function saveQueue(q) { try { await kvSet('queue', q); } catch (e) { console.warn('Could not save queue', e); } }

export async function currentSession() {
  const today = todayISO(), q = await getQueue();
  const c = S.current(q, state.blocks, today);
  return { ...c, plan: planFor(c.block, c.day), today };
}
export async function upcomingSessions(count) {
  const today = todayISO();
  return S.upcoming(await getQueue(), state.blocks, today, count).map((u) => ({ ...u, plan: planFor(u.block, u.day) }));
}
// Apply a queue action ('complete' | 'skip' | 'restartCycle' | 'startOver' | 'dismissRestart').
export async function act(action) {
  const today = todayISO(), q = await getQueue();
  const next = action === 'dismissRestart' ? S.dismissRestart(q, today) : S[action](q, state.blocks, today);
  await saveQueue(next);
  return { before: q, after: next };
}

export const planFor = (block, day) => state.daysFiles[block.days_file]?.[day];
export const activeBlock = async () => S.current(await getQueue(), state.blocks, todayISO()).block;
export const blockById = (id) => state.blocks.find((b) => b.id === id);
export { S as schedule };

export const level = () => state.program.athlete?.level || 'beginner';

export function exerciseFor(item) {
  const ex = state.library[item.ex];
  if (!ex) return null;
  return { ...ex, id: item.ex, props: { ...(ex.props || {}), ...(item.props || {}) }, dose: item.dose ?? ex.default_dose };
}
export const footworkFor = (name) => state.footwork.find((s) => s.name === name);

// Which of a block's cycle keys use an exercise (in cycle order); for the library detail page.
export function usedOn(exId, block) {
  const days = state.daysFiles[block.days_file] || {};
  return [...new Set(S.cycleKeys(block))].filter((d) => days[d]?.sections.some((s) => s.items.some((it) => it.ex === exId)));
}
