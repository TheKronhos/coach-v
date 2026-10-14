// Today (the next incomplete session) and #/session/N, with the queue actions.
import { currentSession, upcomingSessions, act, saveQueue, planFor, schedule as S } from '../data.js';
import { logPut, logDelete } from '../db.js';
import { renderSession } from './session.js';
import { toastActions } from '../util.js';

const rerender = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

// A log row for the current session ('done' or 'skipped').
export function logEntryFor(c, status, extra = {}) {
  return {
    date: c.today, block_id: c.block.id, week: c.cycle, day: c.day, session_number: c.n,
    session: c.plan?.title || '', status, rpe_target: c.plan?.rpe || '', rpe_hit: '', weights: '', notes: '',
    created: new Date().toISOString(), ...extra,
  };
}

const handlers = (c) => ({
  async onDone() {
    const id = await logPut(logEntryFor(c, 'done'));
    const { before } = await act('complete');
    rerender();
    toastActions(`Session ${c.n} done.`, [
      { label: 'Add details', onClick: () => { location.hash = `#/log/edit/${id}`; } },
      { label: 'Undo', onClick: async () => { await saveQueue(before); await logDelete(id); rerender(); } },
    ]);
  },
  async onSkip() {
    const id = await logPut(logEntryFor(c, 'skipped'));
    const { before } = await act('skip');
    rerender();
    toastActions(`Session ${c.n} moved to tomorrow.`, [
      { label: 'Undo', onClick: async () => { await saveQueue(before); await logDelete(id); rerender(); } },
    ]);
  },
  async onRestart() { await act('restartCycle'); rerender(); },
  async onDismissRestart() { await act('dismissRestart'); rerender(); },
});

export async function renderToday() {
  const c = await currentSession();
  return renderSession(c, { current: true, ...handlers(c) });
}

// Session N of the active block: current -> same as Today; earlier -> done; later -> projected date.
export async function renderSessionN(nStr) {
  const c = await currentSession(), n = Number(nStr);
  if (n === c.n) return renderSession(c, { current: true, ...handlers(c) });
  const day = S.keyOf(c.block, n), info = { ...c, n, day, cycle: S.cycleOf(c.block, n), plan: planFor(c.block, day), plannedDate: null };
  if (n < c.n) return renderSession(info, { done: true });
  const up = (await upcomingSessions(n - c.n + 1)).find((u) => u.n === n && u.block.id === c.block.id);
  return renderSession({ ...info, plannedDate: up?.date || null }, {});
}
