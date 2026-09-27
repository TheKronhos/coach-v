// Training log: form, history, CSV export/import. Stored in IndexedDB on the device.
import { state, blockFor, weekdayOf, todayISO, fmtDate, DAY_LABEL, WEEKDAYS } from '../data.js';
import { ICON } from '../icons.js';
import { logAll, logPut, logDelete } from '../db.js';
import { esc, el, toast, download } from '../util.js';

const COLS = ['date', 'block_id', 'week', 'day', 'session', 'rpe_target', 'rpe_hit', 'weights', 'notes'];

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function toCSV(entries) {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return [COLS.join(','), ...rows.map((e) => COLS.map((c) => csvCell(e[c])).join(','))].join('\r\n') + '\r\n';
}

export function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  const idx = Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), i]));
  if (idx.date == null) throw new Error('No "date" column found.');
  return body.map((r) => Object.fromEntries(COLS.map((c) => [c, idx[c] != null ? (r[idx[c]] ?? '') : ''])));
}

export async function exportLog() {
  const entries = await logAll();
  if (!entries.length) { toast('The log is empty. Nothing to export yet.'); return; }
  download(`coach-v-log-${todayISO()}.csv`, toCSV(entries));
}

async function importLog(file) {
  const rows = parseCSV(await file.text());
  const existing = await logAll();
  const key = (e) => COLS.map((c) => String(e[c] ?? '')).join('\u0001');
  const seen = new Set(existing.map(key));
  let added = 0;
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    r.week = r.week === '' ? '' : Number(r.week);
    if (seen.has(key(r))) continue;
    await logPut({ ...r, created: new Date().toISOString() }); seen.add(key(r)); added++;
  }
  toast(`Imported ${added} entr${added === 1 ? 'y' : 'ies'}${rows.length - added ? `, skipped ${rows.length - added} already in the log` : ''}.`);
}

function sessionOptions(date, selected) {
  const info = blockFor(date);
  const days = info ? state.daysFiles[info.block.days_file] : {};
  return WEEKDAYS.map((d) => `<option value="${d}"${d === selected ? ' selected' : ''}>${DAY_LABEL[d]}: ${esc(days?.[d]?.title || '')}</option>`).join('');
}

export async function renderLogForm(params, editId) {
  let entry = null;
  if (editId) entry = (await logAll()).find((e) => e.id === Number(editId));
  const date = entry?.date || params.get('date') || todayISO();
  const day = entry?.day || params.get('day') || weekdayOf(date);
  const root = el(`
    <div class="log-form">
      <h1>${entry ? 'Edit log entry' : 'Log a session'}</h1>
      <form>
        <label>Date<input type="date" name="date" value="${esc(date)}" required></label>
        <p class="kicker block-info"></p>
        <label>Session<select name="day">${sessionOptions(date, day)}</select></label>
        <p class="kicker rpe-target"></p>
        <fieldset class="rpe">
          <legend>RPE hit</legend>
          <div class="rpe-grid">${Array.from({ length: 10 }, (_, i) => `<label><input type="radio" name="rpe_hit" value="${i + 1}"${String(entry?.rpe_hit) === String(i + 1) ? ' checked' : ''}><span>${i + 1}</span></label>`).join('')}</div>
        </fieldset>
        <label>Weights<textarea name="weights" rows="3" placeholder="e.g. Trap bar 3x8 @ 60 kg; goblet squat 20 kg">${esc(entry?.weights || '')}</textarea></label>
        <label>Notes<textarea name="notes" rows="4" placeholder="Anything that felt off">${esc(entry?.notes || '')}</textarea></label>
        <div class="form-actions">
          <button class="btn-primary btn-huge" type="submit">Save</button>
          <a class="btn" href="#/log">Cancel</a>
        </div>
      </form>
    </div>`);
  const f = root.querySelector('form');
  const refresh = () => {
    const d = f.date.value, info = blockFor(d);
    const plan = info && state.daysFiles[info.block.days_file]?.[f.day.value];
    root.querySelector('.block-info').textContent = info ? `${info.block.id} · Block ${info.index + 1}, Week ${info.week}` : '';
    root.querySelector('.rpe-target').textContent = plan ? `Target RPE ${plan.rpe}` : '';
  };
  f.date.onchange = () => { const cur = f.day.value; f.day.innerHTML = sessionOptions(f.date.value, weekdayOf(f.date.value) || cur); refresh(); };
  f.day.onchange = refresh;
  refresh();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = f.date.value, info = blockFor(d), plan = state.daysFiles[info.block.days_file]?.[f.day.value];
    const rec = {
      ...(entry || {}),
      date: d, block_id: info.block.id, week: info.week, day: f.day.value, session: plan?.title || '',
      rpe_target: plan?.rpe || '', rpe_hit: f.rpe_hit.value || '', weights: f.weights.value.trim(), notes: f.notes.value.trim(),
      created: entry?.created || new Date().toISOString(),
    };
    try { await logPut(rec); toast('Saved.'); location.hash = '#/log'; }
    catch (err) { toast(`Could not save: ${err.message}`); }
  };
  return root;
}

export async function renderLog() {
  const entries = (await logAll()).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const root = el(`
    <div class="log">
      <h1>Training log</h1>
      <div class="head-actions">
        <a class="btn-primary" href="#/log/new">+ Log session</a>
        <button class="btn export">Export CSV</button>
        <label class="btn">Import CSV<input type="file" accept=".csv,text/csv" hidden></label>
      </div>
      <p class="muted small">Saved on this device only. Export regularly and before check-ins.</p>
      ${entries.length ? '' : '<p class="empty">No entries yet.</p>'}
      <ul class="log-list">${entries.map((e) => `
        <li>
          <a href="#/log/edit/${e.id}">
            <span class="log-date">${esc(fmtDate(e.date))}<small>${esc(e.block_id)} · wk ${esc(e.week)}</small></span>
            <span class="log-main"><b>${esc(e.session || DAY_LABEL[e.day] || '')}</b>
              <small>RPE ${esc(e.rpe_hit || '–')} / target ${esc(e.rpe_target || '–')}</small>
              ${e.weights ? `<small>${esc(e.weights)}</small>` : ''}
              ${e.notes ? `<small class="muted">${esc(e.notes)}</small>` : ''}
            </span>
          </a>
          <button class="btn-icon del" data-id="${e.id}" aria-label="Delete entry">${ICON.trash}</button>
        </li>`).join('')}
      </ul>
    </div>`);
  root.querySelector('.export').onclick = exportLog;
  root.querySelector('input[type=file]').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { await importLog(file); } catch (err) { toast(`Import failed: ${err.message}`); }
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  root.querySelectorAll('.del').forEach((b) => (b.onclick = async () => {
    if (!confirm('Delete this log entry? This cannot be undone.')) return;
    await logDelete(Number(b.dataset.id)); window.dispatchEvent(new HashChangeEvent('hashchange'));
  }));
  return root;
}
