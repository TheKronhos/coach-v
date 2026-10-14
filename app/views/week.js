// Schedule: every session of the active block in cycle order, labelled by session name, with done marks and
// projected dates for what's left (one session per day from the next planned date).
import { state, currentSession, upcomingSessions, relDate, fmtDate, planFor, schedule as S } from '../data.js';
import { sessionType } from './session.js';
import { esc, el } from '../util.js';

function row({ n, plan, status, date, today }) {
  const rec = !!plan?.recovery;
  // The left column has the date; the meta line only adds Today / Tomorrow.
  const rel = date ? relDate(date, today) : '';
  const when = status === 'done' ? '✓ Done' : ['Today', 'Tomorrow'].includes(rel) ? rel : '';
  const meta = [when, plan?.rpe && plan.rpe !== '-' ? `RPE ${plan.rpe}` : '', plan?.minutes && plan.minutes !== '0' ? `${plan.minutes} min` : ''].filter(Boolean).join(' · ');
  return `
    <li class="day ${rec ? 'is-recovery' : 'is-training'}${status === 'current' ? ' is-today' : ''}${status === 'done' ? ' is-done' : ''}">
      <a href="#/session/${n}">
        <span class="day-name">#${n}<small>${esc(status === 'done' ? 'Done' : date ? fmtDate(date, { weekday: 'short', month: 'short', day: 'numeric' }) : '')}</small></span>
        <span class="day-main">
          <span class="day-type">${esc(sessionType(plan))}${status === 'current' ? ' · Up next' : ''}</span>
          <span class="day-title">${esc(plan?.title || '—')}</span>
          <span class="day-meta">${esc(meta)}</span>
        </span>
      </a>
    </li>`;
}

export async function renderWeek() {
  const c = await currentSession(), today = c.today, total = c.total;
  const up = await upcomingSessions(c.finished ? 7 : total - c.n + 1);
  const rows = [];
  for (let n = 1; n <= Math.min(c.n - 1, total); n++) rows.push({ n, plan: planFor(c.block, S.keyOf(c.block, n)), status: 'done' });
  for (const u of up) if (u.block.id === c.block.id) rows.push({ n: u.n, plan: u.plan, status: u.n === c.n ? 'current' : 'planned', date: u.date });

  const root = el(`<div class="week"></div>`);
  root.appendChild(el(`
    <header class="week-head-plain">
      <h1>Block ${esc(c.label)}</h1>
      <p class="kicker">${c.finished ? `All ${total} sessions done` : `Session ${c.n} of ${total} · ${c.block.cycles} cycles of ${S.cycleLength(c.block)}`}${up.length && !c.finished ? ` · last session ${esc(fmtDate(up.filter((u) => u.block.id === c.block.id).at(-1).date))}` : ''}</p>
      <p class="muted small">Dates are projected: one session a day from the next one. Skipping a day pushes everything after it back a day.</p>
    </header>`));
  const cycles = Math.max(...rows.map((r) => S.cycleOf(c.block, r.n)));
  for (let cy = 1; cy <= cycles; cy++) {
    const rs = rows.filter((r) => S.cycleOf(c.block, r.n) === cy);
    if (!rs.length) continue;
    root.appendChild(el(`<section><h2 class="cycle-h">${cy > c.block.cycles ? 'Extra sessions' : `Cycle ${cy}`}</h2><ol class="days">${rs.map((r) => row({ ...r, today })).join('')}</ol></section>`));
  }
  const nextBlock = up.find((u) => u.block.id !== c.block.id);
  if (nextBlock) root.appendChild(el(`<p class="muted">Then Block ${esc(nextBlock.label)} starts ${esc(relDate(nextBlock.date, today))}.</p>`));

  // Program guidance (display only; never applied to sessions).
  const p = state.program;
  root.appendChild(el(`
    <section class="guide">
      <h2>Rules</h2>
      <ul>${(p.rules || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <h2>Progression guidance</h2>
      <p class="muted">Coaching guidance for your check-ins. The app only changes sessions when you import a new block.</p>
      <ul>${(p.progression || []).map((r) => `<li><b>Weeks ${esc(r.weeks)}:</b> ${esc(r.change)}</li>`).join('')}</ul>
      ${p.early_3min_test ? `<p>${esc(p.early_3min_test)}</p>` : ''}
      ${p.nutrition_notes ? `<h2>Nutrition</h2><p>${esc(p.nutrition_notes)}</p>` : ''}
    </section>`));
  return root;
}
