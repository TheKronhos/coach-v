// Loads bundled program data, applies any imported update from IndexedDB,
// and answers "what session is on this date?".
import { kvGet, kvSetMany } from './db.js';
import { WEEKDAYS, applyBundle, effective } from './validate.js';

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
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
export const addDays = (s, n) => { const t = new Date(utc(s) + n * 86400000); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`; };
export const weekdayOf = (s) => WEEKDAYS[new Date(utc(s)).getUTCDay()];
export const fmtDate = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(utc(s)).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
// Sunday on or before the given date (program weeks start Sunday).
export const weekStart = (s) => addDays(s, -new Date(utc(s)).getUTCDay());

// Resolve which block governs a date.
//   before the first block -> first block, status "before"
//   inside a block         -> that block, status "active"
//   in a gap               -> most recent block that started, status "gap"
//   after the last block   -> last block, status "ended" (show check-in banner)
export function blockFor(date) {
  const bs = state.blocks;
  if (!bs.length) return null;
  const n = bs.length;
  if (date < bs[0].start) return { block: bs[0], index: 0, status: 'before', week: 1 };
  let i = n - 1;
  while (i > 0 && bs[i].start > date) i--;
  const block = bs[i];
  const status = date <= block.end ? 'active' : (i === n - 1 ? 'ended' : 'gap');
  const week = Math.floor(daysBetween(weekStart(block.start), date) / 7) + 1;
  return { block, index: i, status, week };
}

// The session for a date. Before the program starts, show the first session day (Sunday).
export function sessionFor(date) {
  const info = blockFor(date);
  if (!info) return null;
  const day = info.status === 'before' ? weekdayOf(info.block.start) : weekdayOf(date);
  const plan = state.daysFiles[info.block.days_file]?.[day];
  const sched = (state.program.schedule_weeks_1_2 || []).find((s) => s.date === date);
  return { ...info, date, day, plan, scheduleNote: sched?.note || '' };
}

// A specific weekday's plan, from the block that governs `date` (for the day view).
export function sessionForDay(day, date) {
  const info = blockFor(date);
  if (!info) return null;
  const plan = state.daysFiles[info.block.days_file]?.[day];
  const sched = (state.program.schedule_weeks_1_2 || []).find((s) => s.date === date && s.day === day);
  return { ...info, date, day, plan, scheduleNote: sched?.note || '' };
}

// Dates on which a given weekday falls inside a block.
export function blockDatesFor(block, day) {
  const out = [];
  for (let d = block.start; d <= block.end; d = addDays(d, 1)) if (weekdayOf(d) === day) out.push(d);
  return out;
}

export const lastBlock = () => state.blocks[state.blocks.length - 1];
export const level = () => state.program.athlete?.level || 'beginner';

export function exerciseFor(item) {
  const ex = state.library[item.ex];
  if (!ex) return null;
  return { ...ex, id: item.ex, props: { ...(ex.props || {}), ...(item.props || {}) }, dose: item.dose ?? ex.default_dose };
}
export const footworkFor = (name) => state.footwork.find((s) => s.name === name);

// Which days (in the current block) use an exercise; for the library detail page.
export function usedOn(exId, block) {
  const days = state.daysFiles[block.days_file] || {};
  return WEEKDAYS.filter((d) => days[d]?.sections.some((s) => s.items.some((it) => it.ex === exId)));
}
