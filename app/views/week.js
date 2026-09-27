// Weekly schedule: the 7 days (Sun-Sat) of a week, with program guidance below.
import { state, sessionFor, weekStart, addDays, todayISO, fmtDate, DAY_LABEL, WEEKDAYS } from '../data.js';
import { ICON } from '../icons.js';
import { esc, el } from '../util.js';

export function renderWeek(anchor = todayISO()) {
  const start = weekStart(anchor), today = todayISO();
  const first = sessionFor(start);
  const root = el(`<div class="week"></div>`);
  const title = first.status === 'before' ? 'Before the program starts' : `Block ${first.index + 1}, Week ${first.week}`;
  root.appendChild(el(`
    <header class="week-head">
      <a class="btn-icon" href="#/week/${addDays(start, -7)}" aria-label="Previous week">${ICON.left}</a>
      <div><h1>${esc(title)}</h1><p class="kicker">${esc(fmtDate(start, { month: 'short', day: 'numeric' }))} – ${esc(fmtDate(addDays(start, 6), { month: 'short', day: 'numeric' }))} · ${esc(first.block.name)}</p></div>
      <a class="btn-icon" href="#/week/${addDays(start, 7)}" aria-label="Next week">${ICON.right}</a>
    </header>`));
  if (start !== weekStart(today)) root.appendChild(el(`<p class="center"><a class="btn" href="#/week">This week</a></p>`));

  const list = el('<ol class="days"></ol>');
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i), info = sessionFor(date);
    // Before the program starts, sessionFor maps every date to Sunday; show the real weekday's plan instead.
    const day = WEEKDAYS[i];
    const plan = state.daysFiles[info.block.days_file]?.[day];
    const rec = !!plan?.recovery;
    list.appendChild(el(`
      <li class="day ${rec ? 'is-recovery' : 'is-training'}${date === today ? ' is-today' : ''}">
        <a href="#/day/${day}/${date}">
          <span class="day-name">${esc(DAY_LABEL[day].slice(0, 3))}<small>${esc(fmtDate(date, { month: 'short', day: 'numeric' }))}</small></span>
          <span class="day-main">
            <span class="day-type">${rec ? 'Active recovery' : 'Training'}${date === today ? ' · Today' : ''}</span>
            <span class="day-title">${esc(plan?.title || '—')}</span>
            <span class="day-meta">RPE ${esc(plan?.rpe)} · ${esc(plan?.minutes)} min</span>
          </span>
        </a>
      </li>`));
  }
  root.appendChild(list);

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
