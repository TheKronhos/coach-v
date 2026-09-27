// App shell: boot, hash router, check-in banner, service worker.
import { state, loadData, sessionFor, sessionForDay, todayISO, lastBlock, blockFor, WEEKDAYS, addDays, weekStart } from './data.js';
import { ICON } from './icons.js';
import { renderSession } from './views/session.js';
import { renderWeek } from './views/week.js';
import { renderLibrary, renderExercise } from './views/library.js';
import { renderLog, renderLogForm, exportLog } from './views/log.js';
import { renderSettings } from './views/settings.js';
import { renderPrint } from './views/print.js';
import { openTimer } from './components/timer.js';
import { stopAllPlayers } from './components/pose-player.js';
import { esc, el } from './util.js';

const view = document.getElementById('view');
const banner = document.getElementById('banner');

const routes = [
  [/^\/?$|^\/today$/, () => renderSession(sessionFor(todayISO()), { isToday: true }), 'today'],
  [/^\/day\/(\w+)(?:\/(\d{4}-\d{2}-\d{2}))?$/, (_, day, date) => renderSession(sessionForDay(day, date || dateInThisWeek(day))), 'week'],
  [/^\/week(?:\/(\d{4}-\d{2}-\d{2}))?$/, (_, date) => renderWeek(date || todayISO()), 'week'],
  [/^\/library(?:\/([^/]+))?$/, (_, cat) => renderLibrary(cat ? decodeURIComponent(cat) : 'all'), 'library'],
  [/^\/ex\/([\w-]+)$/, (_, id) => renderExercise(id), 'library'],
  [/^\/timer$/, () => renderTimerPage(), 'timer'],
  [/^\/log$/, () => renderLog(), 'log'],
  [/^\/log\/new$/, (params) => renderLogForm(params), 'log'],
  [/^\/log\/edit\/(\d+)$/, (params, id) => renderLogForm(params, id), 'log'],
  [/^\/settings$/, () => renderSettings(), 'settings'],
  [/^\/print\/(\w+)(?:\/(\d{4}-\d{2}-\d{2}))?$/, (_, day, date) => renderPrint(day, date || dateInThisWeek(day)), 'print'],
];

// The date of `day` in the current Sunday-to-Saturday week.
const dateInThisWeek = (day) => addDays(weekStart(todayISO()), WEEKDAYS.indexOf(day));

function renderTimerPage() {
  const root = el(`
    <div class="timer-page">
      <h1>Round timer</h1>
      <p>Default ${state.program.round_timer_default.work_sec / 60} min work / ${state.program.round_timer_default.rest_sec / 60} min rest, bell at each change, warning ${state.program.round_timer_default.warning_sec} seconds before the end.</p>
      <button class="btn-primary btn-huge">Open timer</button>
      <p class="muted small">Session timers with the right rounds and rest are on each section of Today.</p>
    </div>`);
  root.querySelector('button').onclick = () => openTimer(null, 'Round timer');
  return root;
}

function decorateShell() {
  document.querySelectorAll('.tabs a').forEach((a) => a.querySelector('span').outerHTML = ICON[a.dataset.tab]);
  document.querySelector('.appbar [href="#/settings"]').innerHTML = ICON.settings;
}

function renderBanner() {
  const lb = lastBlock();
  const info = blockFor(todayISO());
  if (!lb || info?.status !== 'ended') { banner.hidden = true; banner.innerHTML = ''; return; }
  banner.hidden = false;
  banner.innerHTML = '';
  const b = el(`<div class="checkin" role="status"><p><b>${esc(lb.name)} is complete.</b> ${esc(lb.check_in || '')}</p><button class="btn-primary">Export log</button></div>`);
  b.querySelector('button').onclick = exportLog;
  banner.appendChild(b);
}

let renderSeq = 0;
async function route() {
  const seq = ++renderSeq;
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  // In-page anchors (#sec-2) are handled by the session view.
  if (path.startsWith('sec-')) return;
  const params = new URLSearchParams(query);
  stopAllPlayers();
  document.title = 'Coach V';
  for (const [re, fn, tab] of routes) {
    const m = path.match(re);
    if (!m) continue;
    let node;
    try { node = await fn(params, ...m.slice(1)); }
    catch (e) { console.error(e); node = el(`<p class="empty">Something went wrong: ${esc(e.message)}</p>`); }
    if (seq !== renderSeq) return; // a newer navigation won
    document.body.dataset.tab = tab;
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    view.replaceChildren(node);
    renderBanner();
    window.scrollTo(0, 0);
    return;
  }
  location.replace('#/today');
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (w) => {
      const t = el(`<div class="toast toast-action" role="status">New version ready. <button class="btn-primary">Reload</button></div>`);
      t.querySelector('button').onclick = () => w.postMessage('skipWaiting');
      document.body.appendChild(t);
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
  }).catch((e) => console.warn('SW registration failed', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}

async function boot() {
  try { await loadData(); }
  catch (e) {
    view.innerHTML = `<div class="empty"><h1>Couldn't load the program</h1><p>${esc(e.message)}</p><p>Open the app once while online so it can save itself for offline use.</p></div>`;
    return;
  }
  navigator.storage?.persist?.().catch(() => {});
  window.addEventListener('hashchange', route);
  // Re-render Today when the date rolls over while the app stays open.
  let day = todayISO();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && todayISO() !== day) { day = todayISO(); route(); } });
  route();
}

decorateShell();
registerSW();
boot();
