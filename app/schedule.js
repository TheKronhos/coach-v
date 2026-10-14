// Rolling schedule. Pure functions, no DOM or storage, so tools/check.mjs can test them.
//
// A block runs `cycles` repeats of its `cycle`: an ordered list of keys into its days file
// (e.g. ["monday", "wednesday", "tuesday", ..., "rest"]). The keys are only ids; the queue
// assigns real dates. Blocks without a `cycle` use Sun..Sat. The queue never advances because a day passed. It advances only on Done (or a saved
// log entry for the current session). Skip moves the same session to tomorrow.
//
// queue = {
//   blockId,          active block
//   pos,              0-based index of the next incomplete session in the block
//                     (>= total once the last block is finished: "extra" sessions)
//   nextDate,         earliest date the next session is planned for (YYYY-MM-DD)
//   startedOn,        when this run of the queue began (Start over resets it)
//   lastDoneOn,       date of the most recent completion (null if none)
//   restartDismissedOn  date the user said "Not now" to the restart offer
// }
import { WEEKDAYS } from './validate.js';

export const STALE_DAYS = 7;

const utc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const addDays = (s, n) => { const t = new Date(utc(s) + n * 86400000); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`; };
export const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
const maxDate = (a, b) => (a > b ? a : b);

export const cycleKeys = (block) => (Array.isArray(block.cycle) && block.cycle.length ? block.cycle : WEEKDAYS);
export const cycleLength = (block) => cycleKeys(block).length;
export const totalSessions = (block) => block.cycles * cycleLength(block);
// "block-1r" -> "1R"
export const blockLabel = (block) => block.label || String(block.id).replace(/^block-?/i, '').toUpperCase();
// Session n (1-based) -> days-file key and cycle number.
export const keyOf = (block, n) => cycleKeys(block)[(n - 1) % cycleLength(block)];
export const cycleOf = (block, n) => Math.floor((n - 1) / cycleLength(block)) + 1;

export function newQueue(blocks, today) {
  return { blockId: blocks[0].id, pos: 0, nextDate: today, startedOn: today, lastDoneOn: null, restartDismissedOn: null };
}

// Make a stored queue consistent with the current blocks (e.g. after an undo removed a block).
export function normalize(queue, blocks, today) {
  if (!queue || !blocks.some((b) => b.id === queue.blockId)) return newQueue(blocks, today);
  const q = { ...queue };
  // Finished a block that now has a successor (e.g. a new block was imported): move on.
  let i = blocks.findIndex((b) => b.id === q.blockId);
  while (i < blocks.length - 1 && q.pos >= totalSessions(blocks[i])) { q.pos -= totalSessions(blocks[i]); i++; q.blockId = blocks[i].id; }
  return q;
}

// Everything the Today view needs.
export function current(queue, blocks, today) {
  const q = normalize(queue, blocks, today);
  const index = blocks.findIndex((b) => b.id === q.blockId), block = blocks[index];
  const total = totalSessions(block), n = q.pos + 1;
  const finished = index === blocks.length - 1 && q.pos >= total;
  const plannedDate = maxDate(q.nextDate, today);
  const since = daysBetween(q.lastDoneOn ? maxDate(q.lastDoneOn, q.startedOn) : q.startedOn, today);
  return {
    queue: q, block, index, label: blockLabel(block), total, n, day: keyOf(block, n), cycle: cycleOf(block, n),
    finished,                                   // last block complete: show check-in banner
    plannedDate, isDueToday: plannedDate === today,
    offerRestart: !finished && q.pos % cycleLength(block) !== 0 && since >= STALE_DAYS && q.restartDismissedOn !== today,
    daysSinceDone: since,
  };
}

// The next `count` sessions with projected dates (one per day from the planned date),
// continuing into later blocks and stopping at the end of the program. Once the last
// block is finished, the extra sessions repeat its cycle (marked `extra`).
export function upcoming(queue, blocks, today, count = 14) {
  const c = current(queue, blocks, today);
  const out = [];
  let bi = c.index, pos = c.queue.pos, date = c.plannedDate;
  while (out.length < count) {
    const b = blocks[bi], total = totalSessions(b);
    if (!c.finished && pos >= total) { if (bi === blocks.length - 1) break; bi++; pos = 0; continue; }
    const n = pos + 1;
    out.push({ block: b, label: blockLabel(b), n, total, day: keyOf(b, n), cycle: cycleOf(b, n), date, extra: pos >= total });
    pos++; date = addDays(date, 1);
  }
  return out;
}

// ---- actions: each returns a new queue ----
export function complete(queue, blocks, today) {
  const q = normalize(queue, blocks, today);
  return normalize({ ...q, pos: q.pos + 1, nextDate: addDays(today, 1), lastDoneOn: today }, blocks, today);
}

export function skip(queue, blocks, today) {
  const q = normalize(queue, blocks, today);
  return { ...q, nextDate: maxDate(q.nextDate, addDays(today, 1)) };
}

// Back to the first session of the current cycle, starting today.
export function restartCycle(queue, blocks, today) {
  const q = normalize(queue, blocks, today);
  const len = cycleLength(blocks.find((b) => b.id === q.blockId));
  return { ...q, pos: Math.floor(q.pos / len) * len, nextDate: today, startedOn: today, restartDismissedOn: null };
}

export const dismissRestart = (queue, today) => ({ ...queue, restartDismissedOn: today });

// Settings > Start over: session 1 of the active block, starting today.
export function startOver(queue, blocks, today) {
  const q = normalize(queue, blocks, today);
  return { blockId: q.blockId, pos: 0, nextDate: today, startedOn: today, lastDoneOn: null, restartDismissedOn: null };
}
