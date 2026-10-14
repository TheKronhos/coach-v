// Renders one day's session: header (block/week, RPE, time), then every section in order.
import { state, exerciseFor, footworkFor, relDate, planFor, schedule as S } from '../data.js';
import { ICON } from '../icons.js';
import { posePlayer } from '../components/pose-player.js';
import { footworkPlayer } from '../components/footwork.js';
import { openTimer, settingsFrom } from '../components/timer.js';
import { esc, el } from '../util.js';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// "Training", "Active recovery", or "Full rest" (a recovery day with no RPE target).
export const sessionType = (plan) => (!plan?.recovery ? 'Training' : plan.rpe === '-' ? 'Full rest' : 'Active recovery');

export function timerSummary(t) {
  const s = settingsFrom(t);
  if (s.type === 'countdown') return mmss(s.seconds);
  if (s.type === 'emom') return `${s.rounds} min EMOM${s.work < s.minute ? ` · ${s.work}s work` : ''}`;
  if (s.work === 0) return `${s.rounds} rounds · ${mmss(s.rest)} rest`;
  return `${s.rounds} × ${mmss(s.work)}${s.rest ? ` / ${mmss(s.rest)} rest` : ''}`;
}

function timerButton(t, name, small = false) {
  const b = el(`<button class="btn-timer${small ? ' small' : ''}">${ICON.timer}<span>Timer<small>${esc(timerSummary(t))}</small></span></button>`);
  b.onclick = () => openTimer(t, name);
  return b;
}

function exItem(item) {
  const ex = exerciseFor(item);
  const card = el(`
    <article class="item">
      <div class="item-media"></div>
      <div class="item-body">
        <h3><a href="#/ex/${esc(item.ex)}">${esc(ex.name)}</a></h3>
        ${ex.dose ? `<p class="dose">${esc(ex.dose)}</p>` : ''}
        <p class="view">${esc(ex.view || '')}</p>
        <ol class="cues">${(ex.cues || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
      </div>
    </article>`);
  card.querySelector('.item-media').appendChild(posePlayer(ex));
  if (item.timer) card.querySelector('.item-body').appendChild(timerButton(item.timer, ex.name, true));
  return card;
}

function fwItem(item) {
  const seq = footworkFor(item.footwork);
  const card = el(`
    <article class="item fw">
      <div class="item-media"></div>
      <div class="item-body">
        <h3>Footwork: ${esc(seq.name)}</h3>
        ${item.dose ? `<p class="dose">${esc(item.dose)}</p>` : ''}
        <p class="view">Top view · top = toward opponent</p>
        <p class="rule">${esc(seq.rule || state.fwMeta.rule)}</p>
        <ol class="cues">${seq.frames.map((f) => `<li><b>${esc(f.title)}</b>${f.cue ? ` ${esc(f.cue)}` : ''}</li>`).join('')}</ol>
      </div>
    </article>`);
  card.querySelector('.item-media').appendChild(footworkPlayer(seq));
  if (item.timer) card.querySelector('.item-body').appendChild(timerButton(item.timer, seq.name, true));
  return card;
}

// One session of the active block.
// info: { block, label, n, total, cycle, day, plan, plannedDate, today, finished, queue, ... }
// opts.current: this is the next incomplete session (shows Done / Skip today)
// opts.done:    already completed (read-only)
// opts.onDone / onSkip / onRestart / onDismissRestart: handlers for the current session
export function renderSession(info, opts = {}) {
  const { plan, label, n, total, cycle, day, plannedDate, today, finished } = info;
  const root = el(`<div class="session"></div>`);
  if (!plan) { root.innerHTML = `<p class="empty">No session "${esc(day)}" in block ${esc(label)}.</p>`; return root; }
  const extra = n > total;

  const notes = [];
  if (opts.current && info.offerRestart) notes.push(`
    <div class="note restart">
      <p><b>It's been ${info.daysSinceDone} days since your last session.</b> Restart this cycle from its first session (${esc(planFor(info.block, S.cycleKeys(info.block)[0])?.title || 'session 1')})?</p>
      <div class="head-actions"><button class="btn-primary act-restart">Restart cycle</button><button class="btn act-dismiss">Not now</button></div>
    </div>`);
  if (opts.current && !info.isDueToday) notes.push(info.queue.lastDoneOn === today
    ? '<p class="note good">Today\'s session is done. This is up next, planned for tomorrow.</p>'
    : '<p class="note">Skipped today. This session moves to tomorrow, and everything after it shifts a day.</p>');
  if (extra) notes.push('<p class="note">Block complete. Extra sessions repeat the cycle until your next block is imported.</p>');
  if (plan.emphasis) notes.push(`<p class="note">${esc(plan.emphasis)}</p>`);
  if (plan.safety) notes.push(`<p class="note warn"><b>Safety:</b> ${esc(plan.safety)}</p>`);

  const when = opts.done ? 'Done' : plannedDate ? relDate(plannedDate, today) : '';
  const head = el(`
    <header class="session-head">
      <p class="kicker">${extra ? `Block ${esc(label)} complete · Extra session` : `Block ${esc(label)}, Session ${n} of ${total}`}</p>
      <p class="kicker sub">Cycle ${cycle}${when ? ` · ${esc(when)}` : ''}</p>
      <h1>${esc(plan.title)}</h1>
      <div class="chips">
        ${plan.rpe && plan.rpe !== '-' ? `<span class="chip chip-rpe">RPE ${esc(plan.rpe)}</span>` : ''}
        ${plan.minutes && plan.minutes !== '0' ? `<span class="chip">${esc(plan.minutes)} min</span>` : ''}
        <span class="chip ${plan.recovery ? 'chip-recovery' : 'chip-training'}">${esc(sessionType(plan))}</span>
        ${opts.done ? '<span class="chip chip-done">✓ Done</span>' : ''}
      </div>
      ${notes.join('')}
      ${opts.current ? `<div class="queue-actions">
        <button class="btn-primary btn-huge act-done">Done</button>
        ${info.isDueToday ? '<button class="btn act-skip">Skip today</button>' : ''}
      </div>` : ''}
      <div class="head-actions">
        ${opts.current ? `<a class="btn" href="#/log/new?block=${esc(info.block.id)}&n=${n}">Log with details</a>` : ''}
        <a class="btn" href="#/print/${esc(day)}">Print</a>
        ${!opts.current && !finished ? '<a class="btn" href="#/today">Back to today</a>' : ''}
      </div>
    </header>`);
  const on = (sel, fn) => { const b = head.querySelector(sel); if (b && fn) b.onclick = async () => { b.disabled = true; try { await fn(); } finally { b.disabled = false; } }; };
  on('.act-done', opts.onDone); on('.act-skip', opts.onSkip); on('.act-restart', opts.onRestart); on('.act-dismiss', opts.onDismissRestart);
  root.appendChild(head);

  const jump = el(`<nav class="section-jump" aria-label="Sections">${plan.sections.map((s, i) => `<a href="#sec-${i}" data-sec="${i}">${esc(s.name)}</a>`).join('')}</nav>`);
  jump.onclick = (e) => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); root.querySelector(`#sec-${a.dataset.sec}`)?.scrollIntoView({ behavior: 'smooth' }); };
  root.appendChild(jump);

  plan.sections.forEach((sec, i) => {
    const s = el(`
      <section class="sec" id="sec-${i}">
        <div class="sec-head">
          <div><h2>${esc(sec.name)}</h2>${sec.format ? `<p class="format">${esc(sec.format)}</p>` : ''}</div>
        </div>
        <div class="items"></div>
      </section>`);
    if (sec.timer) s.querySelector('.sec-head').appendChild(timerButton(sec.timer, sec.name));
    const items = s.querySelector('.items');
    let ul = null;
    for (const it of sec.items) {
      if (it.text != null) {
        if (!ul) { ul = el('<ul class="text-items"></ul>'); items.appendChild(ul); }
        ul.appendChild(el(`<li>${esc(it.text)}</li>`));
        continue;
      }
      ul = null;
      items.appendChild(it.ex ? exItem(it) : fwItem(it));
    }
    root.appendChild(s);
  });

  return root;
}
