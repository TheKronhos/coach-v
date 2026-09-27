// Renders one day's session: header (block/week, RPE, time), then every section in order.
import { state, exerciseFor, footworkFor, fmtDate, DAY_LABEL } from '../data.js';
import { ICON } from '../icons.js';
import { posePlayer } from '../components/pose-player.js';
import { footworkPlayer } from '../components/footwork.js';
import { openTimer, settingsFrom } from '../components/timer.js';
import { esc, el } from '../util.js';

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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

// info = sessionFor(date) result. opts.header: 'today' | 'day'
export function renderSession(info, { isToday = false } = {}) {
  const { plan, block, index, week, status, date, day } = info;
  const root = el(`<div class="session"></div>`);
  if (!plan) { root.innerHTML = `<p class="empty">No session found for ${esc(DAY_LABEL[day])} in ${esc(block.name)}.</p>`; return root; }

  const notes = [];
  if (status === 'before') notes.push(`<p class="note">The program starts ${esc(fmtDate(block.start, { weekday: 'long', month: 'short', day: 'numeric' }))}. This is your first session.</p>`);
  if (info.scheduleNote) notes.push(`<p class="note">${esc(info.scheduleNote)}</p>`);
  if (plan.emphasis) notes.push(`<p class="note">${esc(plan.emphasis)}</p>`);
  if (plan.safety) notes.push(`<p class="note warn"><b>Safety:</b> ${esc(plan.safety)}</p>`);

  const head = el(`
    <header class="session-head">
      <p class="kicker">Block ${index + 1}, Week ${week} · ${esc(isToday && status !== 'before' ? 'Today' : DAY_LABEL[day])}${status !== 'before' ? ` · ${esc(fmtDate(date))}` : ''}</p>
      <h1>${esc(plan.title)}</h1>
      <div class="chips">
        <span class="chip chip-rpe">RPE ${esc(plan.rpe)}</span>
        <span class="chip">${esc(plan.minutes)} min</span>
        ${plan.recovery ? '<span class="chip chip-recovery">Active recovery</span>' : '<span class="chip chip-training">Training</span>'}
      </div>
      ${notes.join('')}
      <div class="head-actions">
        <a class="btn" href="#/log/new?date=${esc(status === 'before' ? block.start : date)}&day=${esc(day)}">Log session</a>
        <a class="btn" href="#/print/${esc(day)}/${esc(date)}">Print</a>
      </div>
    </header>`);
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
