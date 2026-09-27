// Full-screen round timer. Timer configs come from days.json "timer" objects:
//   rounds    { rounds, work_sec, rest_sec, warning_sec?, label?, note? }  work_sec 0 = manual work (reps)
//   intervals { rounds, by_level: { beginner: [work, rest], ... } }       picks athlete.level
//   emom      { rounds, work_sec, labels[], <level>_work_sec? }          station label each minute
//   countdown { seconds, note? }
import { state, level } from '../data.js';
import { ICON } from '../icons.js';
import { esc } from '../util.js';

const GET_READY = 5;

// ---------- sound ----------
let ctx = null;
function audio() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// Struck-bell: a few inharmonic partials with exponential decay.
function bell(times = 1, gap = 0.28) {
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + 0.02;
  for (let n = 0; n < times; n++) {
    const t = t0 + n * gap;
    for (const [ratio, amp, dec] of [[1, 0.5, 1.6], [2.76, 0.25, 0.9], [5.4, 0.12, 0.5], [8.93, 0.06, 0.3]]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 830 * ratio;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dec + 0.05);
    }
  }
}
// Warning: three sharp wood-block clacks.
function clack(times = 3) {
  const c = audio(); if (!c) return;
  const t0 = c.currentTime + 0.02;
  for (let n = 0; n < times; n++) {
    const t = t0 + n * 0.16, o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.1);
  }
}
const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };

// ---------- wake lock ----------
let lock = null, wantLock = false;
async function acquireLock() {
  wantLock = true;
  try { if ('wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => (lock = null)); } }
  catch (e) { console.warn('Wake lock unavailable', e); }
}
function releaseLock() { wantLock = false; lock?.release().catch(() => {}); lock = null; }
document.addEventListener('visibilitychange', () => { if (wantLock && document.visibilityState === 'visible') acquireLock(); });

// ---------- config ----------
// Normalise a days.json timer (or null for the standalone timer) into editable settings.
export function settingsFrom(t, title = 'Round timer') {
  const def = state.program.round_timer_default;
  const warn = t?.warning_sec ?? def.warning_sec;
  const base = { title: t?.label || title, note: t?.note || '', warn };
  if (!t) return { ...base, type: 'rounds', rounds: 3, work: def.work_sec, rest: def.rest_sec };
  switch (t.type) {
    case 'rounds': return { ...base, type: 'rounds', rounds: t.rounds, work: t.work_sec, rest: t.rest_sec };
    case 'intervals': {
      const lv = level(), [work, rest] = t.by_level[lv] || Object.values(t.by_level)[0];
      return { ...base, type: 'rounds', rounds: t.rounds, work, rest, note: base.note || `${lv[0].toUpperCase() + lv.slice(1)}: ${work} on / ${rest} off` };
    }
    case 'emom': {
      const lv = level(), work = t[`${lv}_work_sec`] ?? t.work_sec;
      return { ...base, type: 'emom', rounds: t.rounds, work, minute: t.work_sec, labels: t.labels,
        note: base.note || (work < t.work_sec ? `${lv[0].toUpperCase() + lv.slice(1)}: ${work} sec work, rest the rest of each minute` : '') };
    }
    case 'countdown': return { ...base, type: 'countdown', seconds: t.seconds };
  }
  throw new Error(`Unknown timer type ${t.type}`);
}

function buildPhases(s) {
  const P = [{ kind: 'ready', dur: GET_READY, label: 'Get ready' }];
  if (s.type === 'countdown') P.push({ kind: 'work', dur: s.seconds, label: s.title, warn: s.warn, round: 1, of: 1 });
  if (s.type === 'rounds') for (let r = 1; r <= s.rounds; r++) {
    P.push({ kind: 'work', dur: s.work, manual: s.work === 0, warn: s.warn, round: r, of: s.rounds, label: s.title });
    if (r < s.rounds && s.rest > 0) P.push({ kind: 'rest', dur: s.rest, warn: Math.min(s.warn, s.rest), round: r, of: s.rounds, label: 'Rest' });
  }
  if (s.type === 'emom') for (let m = 1; m <= s.rounds; m++) {
    const label = s.labels[(m - 1) % s.labels.length], next = m < s.rounds ? s.labels[m % s.labels.length] : '';
    const work = Math.min(s.work, s.minute), rest = s.minute - work;
    // Warning goes on whatever phase ends the minute.
    P.push({ kind: 'work', dur: work, round: m, of: s.rounds, label, next, warn: rest > 0 ? 0 : s.warn });
    if (rest > 0) P.push({ kind: 'rest', dur: rest, round: m, of: s.rounds, label: 'Rest', next, warn: s.warn });
  }
  return P;
}

const mmss = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };

// ---------- UI ----------
export function openTimer(timerDef, sectionName) {
  const s = settingsFrom(timerDef, sectionName);
  const el = document.createElement('div');
  el.className = 'timer-overlay';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Round timer');
  document.body.appendChild(el); document.body.classList.add('no-scroll');
  let phases = [], idx = -1, endAt = 0, remainingAtPause = 0, running = false, warned = false, tick = null;

  const close = () => { stop(); el.remove(); document.body.classList.remove('no-scroll'); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  // --- setup screen ---
  const field = (key, label, step, unit) => `
    <div class="stepper" data-key="${key}" data-step="${step}">
      <span class="stepper-label">${label}</span>
      <button class="btn-step" data-d="-1" aria-label="Less ${label}">−</button>
      <output class="stepper-val"></output>
      <button class="btn-step" data-d="1" aria-label="More ${label}">+</button>
      <span class="stepper-unit">${unit}</span>
    </div>`;
  function renderSetup() {
    const fields = [];
    if (s.type !== 'countdown') fields.push(field('rounds', s.type === 'emom' ? 'Minutes' : 'Rounds', 1, ''));
    if (s.type === 'rounds') fields.push(field('work', 'Work', 15, ''), field('rest', 'Rest', 15, ''));
    if (s.type === 'emom') fields.push(field('work', 'Work / min', 5, ''));
    if (s.type === 'countdown') fields.push(field('seconds', 'Time', 30, ''));
    fields.push(field('warn', 'Warning', 5, ''));
    el.innerHTML = `
      <div class="timer-setup">
        <div class="timer-top"><h2>${esc(s.title)}</h2><button class="btn-close" aria-label="Close timer">${ICON.close}</button></div>
        ${s.note ? `<p class="timer-note">${esc(s.note)}</p>` : ''}
        ${s.type === 'emom' ? `<ol class="emom-list">${s.labels.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : ''}
        ${s.type === 'rounds' && s.work === 0 && !s.note ? '<p class="timer-note">Work is reps: tap DONE at the end of each round to start the rest.</p>' : ''}
        <div class="steppers">${fields.join('')}</div>
        <button class="btn-primary btn-huge start">Start</button>
      </div>`;
    const show = () => el.querySelectorAll('.stepper').forEach((st) => {
      const k = st.dataset.key, v = s[k];
      st.querySelector('output').textContent = ['rounds'].includes(k) ? v : (k === 'work' && s.type === 'rounds' && v === 0 ? 'reps' : mmss(v));
    });
    el.querySelectorAll('.btn-step').forEach((b) => (b.onclick = () => {
      const st = b.closest('.stepper'), k = st.dataset.key, step = +st.dataset.step;
      const max = k === 'rounds' ? 30 : k === 'work' && s.type === 'emom' ? s.minute : 3600;
      const min = k === 'rounds' || k === 'seconds' ? 1 : 0;
      s[k] = Math.min(max, Math.max(min, s[k] + step * +b.dataset.d)); show();
    }));
    el.querySelector('.btn-close').onclick = close;
    el.querySelector('.start').onclick = start;
    show();
  }

  // --- running screen ---
  function renderRun() {
    el.innerHTML = `
      <div class="timer-run">
        <div class="timer-top"><h2 class="t-label"></h2><button class="btn-close" aria-label="Close timer">${ICON.close}</button></div>
        <div class="t-round"></div>
        <div class="t-clock" aria-live="off"></div>
        <div class="t-phase"></div>
        <div class="t-next"></div>
        <div class="t-controls">
          <button class="btn-big t-pause">Pause</button>
          <button class="btn-big t-done" hidden>DONE</button>
          <button class="btn-big t-skip">Skip</button>
        </div>
        <button class="btn-link t-reset">Reset</button>
      </div>`;
    el.querySelector('.btn-close').onclick = close;
    el.querySelector('.t-pause').onclick = () => (running ? pause() : resume());
    el.querySelector('.t-skip').onclick = () => advance(performance.now(), true);
    el.querySelector('.t-done').onclick = () => advance(performance.now(), true);
    el.querySelector('.t-reset').onclick = () => { stop(); renderSetup(); };
  }

  function start() {
    audio(); // unlock audio on this tap (iOS)
    phases = buildPhases(s); idx = -1; renderRun();
    running = true; acquireLock();
    advance(performance.now(), true);
    tick = setInterval(update, 100);
  }
  function stop() { clearInterval(tick); tick = null; running = false; releaseLock(); }
  function pause() {
    const p = phases[idx]; if (!p || p.manual) return;
    remainingAtPause = endAt - performance.now(); running = false; releaseLock();
    el.querySelector('.t-pause').textContent = 'Resume'; el.classList.add('paused');
  }
  function resume() {
    endAt = performance.now() + remainingAtPause; running = true; acquireLock();
    el.querySelector('.t-pause').textContent = 'Pause'; el.classList.remove('paused');
  }

  // Move to the next phase. `now` is when the previous one ended, so the schedule doesn't drift.
  function advance(now, manual = false) {
    const prev = phases[idx];
    idx++;
    const p = phases[idx];
    if (!p) return finish();
    endAt = (manual ? performance.now() : now) + p.dur * 1000; warned = false;
    if (!running) { running = true; el.querySelector('.t-pause').textContent = 'Pause'; el.classList.remove('paused'); acquireLock(); }
    // Sounds: bell starts work; double bell ends work.
    if (p.kind === 'work') { bell(1); buzz(400); }
    else if (p.kind === 'rest' && prev?.kind === 'work') { bell(2); buzz([200, 100, 200]); }
    paint();
  }
  function finish() {
    stop(); bell(3, 0.35); buzz([300, 100, 300, 100, 300]);
    el.className = 'timer-overlay phase-done';
    el.querySelector('.t-clock').textContent = 'Done';
    el.querySelector('.t-phase').textContent = 'Session block complete';
    el.querySelector('.t-round').textContent = el.querySelector('.t-next').textContent = '';
    el.querySelector('.t-controls').hidden = true;
    el.querySelector('.t-reset').textContent = 'Run again';
  }
  function update() {
    if (!running) return;
    const p = phases[idx]; if (!p) return;
    if (p.manual) return;
    const now = performance.now(), rem = (endAt - now) / 1000;
    if (!warned && p.warn > 0 && rem <= p.warn && p.dur > p.warn) { warned = true; clack(); buzz([80, 60, 80, 60, 80]); el.classList.add('warning'); }
    if (rem <= 0) {
      // Catch up if the page was suspended across several phases; sound only the latest.
      let end = endAt;
      advance(end);
      while (phases[idx] && !phases[idx].manual && endAt <= now) { end = endAt; idx++; if (!phases[idx]) return finish(); endAt = end + phases[idx].dur * 1000; paint(); }
      return;
    }
    el.querySelector('.t-clock').textContent = mmss(rem);
  }
  function paint() {
    const p = phases[idx];
    el.className = `timer-overlay phase-${p.kind}`;
    el.querySelector('.t-label').textContent = p.kind === 'ready' ? s.title : (s.type === 'emom' ? `Minute ${p.round}` : s.title);
    el.querySelector('.t-round').textContent = p.round ? `${s.type === 'emom' ? 'Minute' : 'Round'} ${p.round} / ${p.of}` : '';
    el.querySelector('.t-phase').textContent = p.manual ? 'WORK — tap DONE when the round is finished' : p.kind === 'work' ? (s.type === 'emom' ? p.label : 'WORK') : p.kind === 'rest' ? 'REST' : 'GET READY';
    el.querySelector('.t-next').textContent = p.next ? `Next: ${p.next}` : (s.type === 'emom' && p.kind === 'ready' ? `First: ${s.labels[0]}` : '');
    el.querySelector('.t-clock').textContent = p.manual ? '—' : mmss(p.dur);
    el.querySelector('.t-done').hidden = !p.manual;
    el.querySelector('.t-pause').hidden = !!p.manual;
    el.querySelector('.t-skip').hidden = !!p.manual;
  }

  renderSetup();
  return { close };
}
