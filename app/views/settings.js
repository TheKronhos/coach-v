// Settings: program blocks, "Import program update" (validated, stored in IndexedDB,
// one-step undo), log export, storage status.
import { state, importBundle, undoImport, currentSession, act, schedule as S, level } from '../data.js';
import { exportLog } from './log.js';
import { esc, el, toast, cap } from '../util.js';
import { APP_VERSION } from '../version.js';

export async function renderSettings() {
  const cur = await currentSession();
  let persisted = null;
  try { persisted = await navigator.storage?.persisted?.(); } catch {}
  const ov = state.overlay;
  const root = el(`
    <div class="settings">
      <h1>Settings</h1>
      <p class="app-version">Version ${esc(APP_VERSION)}</p>

      <section class="card">
        <h2>Program</h2>
        <p>Athlete level: <b>${esc(cap(level()))}</b> · Stance: <b>${esc(cap(state.program.athlete?.stance || ''))}</b></p>
        <p class="muted small">Program data ${esc(state.program.data_version || '')}${ov ? ` + update ${esc(ov.data_version || '')} imported ${esc(new Date(ov.importedAt).toLocaleString())}` : ''}</p>
        <ol class="blocks">${state.blocks.map((b, i) => {
          const isCur = cur.block.id === b.id, status = isCur ? (cur.finished ? 'complete' : `current · Session ${cur.n} of ${cur.total}`) : i < cur.index ? 'complete' : 'up next';
          return `
          <li class="${isCur ? 'is-current' : ''}">
            <b>Block ${esc(S.blockLabel(b))}${b.name ? `: ${esc(b.name)}` : ''}</b>
            <small>${b.cycles} cycle${b.cycles === 1 ? '' : 's'} · ${S.totalSessions(b)} sessions · ${esc(b.days_file)} · ${esc(status)}</small>
          </li>`; }).join('')}
        </ol>
      </section>

      <section class="card">
        <h2>Start over</h2>
        <p class="muted small">Go back to Session 1 of Block ${esc(cur.label)}, starting today. Your log history is kept.</p>
        <button class="btn start-over">Start over</button>
      </section>

      <section class="card">
        <h2>Import program update</h2>
        <p class="muted small">A JSON bundle from Coach V with new blocks and days files (and any new exercises or footwork). Every exercise and footwork reference is checked before anything changes.</p>
        <label class="btn-primary">Choose update file<input type="file" accept=".json,application/json" hidden class="imp"></label>
        <div class="imp-result" aria-live="polite"></div>
        ${state.hasPrevious ? '<button class="btn undo">Undo last update</button>' : ''}
      </section>

      <section class="card">
        <h2>Training log</h2>
        <button class="btn export">Export log (CSV)</button>
      </section>

      <section class="card">
        <h2>Device</h2>
        <p class="small">Offline storage: ${persisted === true ? '<b>persistent</b>' : persisted === false ? 'best-effort (install the app to the home screen to keep data safer)' : 'unknown'}</p>
        <button class="btn check-update">Check for app update</button>
      </section>
    </div>`);

  root.querySelector('.export').onclick = exportLog;
  root.querySelector('.start-over').onclick = async () => {
    if (!confirm(`Start over at Session 1 of Block ${cur.label}, beginning today?\n\nYour training log is kept.`)) return;
    await act('startOver'); toast(`Back to Session 1 of Block ${cur.label}.`); location.hash = '#/today';
  };
  root.querySelector('.check-update').onclick = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (!reg) return toast('Offline support is not active in this browser.');
    try { await reg.update(); toast(reg.installing || reg.waiting ? 'Update found. It will apply on reload.' : 'You have the latest version.'); }
    catch { toast('Could not reach the server. Try again when online.'); }
  };
  root.querySelector('.undo')?.addEventListener('click', async () => {
    if (!confirm('Undo the last program update and go back to the previous version?')) return;
    await undoImport(); toast('Update undone.'); window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  root.querySelector('.imp').onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    const out = root.querySelector('.imp-result');
    let bundle;
    try { bundle = JSON.parse(await file.text()); }
    catch (err) { out.innerHTML = `<div class="errors"><b>That file isn't valid JSON.</b><p>${esc(err.message)}</p></div>`; return; }
    const res = await importBundle(bundle);
    if (!res.ok) {
      out.innerHTML = `<div class="errors"><b>Update not imported. ${res.errors.length} problem${res.errors.length === 1 ? '' : 's'} found:</b>
        <ul>${res.errors.slice(0, 50).map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
        ${res.errors.length > 50 ? `<p>…and ${res.errors.length - 50} more.</p>` : ''}
        <p>Nothing was changed.</p></div>`;
      return;
    }
    toast('Program update imported.');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  return root;
}
