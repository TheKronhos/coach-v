// Printable day guide, laid out like the reference PDFs: section headers, exercise text on
// the left, print frames (with dashed ghost + red arrow) on the right, legend footer.
import { state, blockFor, blockDatesFor, todayISO, fmtDate, exerciseFor, footworkFor, DAY_LABEL, WEEKDAYS } from '../data.js';
import { printFrameSVG, THEME } from '../../src/pose-renderer.js';
import { resolveFrames, panelSVG, FW_LIGHT } from '../components/footwork.js';
import { esc, el } from '../util.js';

const LEGEND = 'Dark limbs = near side &nbsp; Light limbs = far side &nbsp; Dashed gray = previous position &nbsp; Red arrow = what moves';

function exBlock(item) {
  const ex = exerciseFor(item);
  const idx = ex.print_frames?.length ? ex.print_frames : ex.frames.map((_, i) => i);
  const frames = idx.map((fi, k) => {
    const [label, pose] = ex.frames[fi], prev = k > 0 ? ex.frames[idx[k - 1]][1] : null;
    return `<figure class="p-frame">${printFrameSVG(pose, ex.props, prev, THEME)}<figcaption>${esc(label)}</figcaption></figure>`;
  }).join('');
  return `
    <div class="p-item">
      <div class="p-text">
        <h3>${esc(ex.name)}</h3>
        ${ex.dose ? `<p class="p-dose">${esc(ex.dose)}</p>` : ''}
        <p class="p-view">${esc(ex.view || '')}</p>
        <ol>${(ex.cues || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
      </div>
      <div class="p-frames">${frames}</div>
    </div>`;
}

function fwBlock(item) {
  const seq = footworkFor(item.footwork);
  const panels = resolveFrames(seq).map((fr) =>
    `<figure class="p-fw"><figcaption>${esc(fr.title)}</figcaption><svg viewBox="0 0 170 215">${panelSVG(seq, fr, FW_LIGHT)}</svg></figure>`).join('');
  return `
    <div class="p-item">
      <div class="p-text">
        <h3>Footwork: ${esc(seq.name)}</h3>
        ${item.dose ? `<p class="p-dose">${esc(item.dose)}</p>` : ''}
        <p>${esc(seq.rule || 'See the footwork sheet for full cues.')}</p>
      </div>
      <div class="p-frames">${panels}</div>
    </div>`;
}

// Recovery days with identical sections print as one combined guide (Tue & Fri).
function twinDays(days, day) {
  const plan = days[day];
  if (!plan?.recovery) return [day];
  const sig = JSON.stringify(plan.sections);
  return WEEKDAYS.filter((d) => days[d]?.recovery && JSON.stringify(days[d].sections) === sig);
}

export function renderPrint(day, date = todayISO()) {
  const info = blockFor(date);
  const days = state.daysFiles[info.block.days_file];
  const group = twinDays(days, day);
  const plan = days[group[0]];
  const names = group.map((d) => DAY_LABEL[d]).join(' & ');
  const title = `${names}: ${plan.title}`;
  const md = (d) => fmtDate(d, { month: 'short', day: 'numeric' });
  const blockLabel = info.block.name.split(':')[0];
  const dates = group.length > 1
    ? group.map((d) => `${DAY_LABEL[d].slice(0, 3)} ${blockDatesFor(info.block, d).map(md).join(', ')}`).join('; ')
    : blockDatesFor(info.block, day).map(md).join(', ');
  const emphasis = group.map((d) => days[d].emphasis ? `${group.length > 1 ? `${DAY_LABEL[d]}: ` : ''}${days[d].emphasis}` : '').filter(Boolean).join(' ');

  const body = plan.sections.map((sec) => {
    let out = `<section class="p-sec"><h2>${esc(sec.name)}</h2>${sec.format ? `<p class="p-format">${esc(sec.format)}</p>` : ''}`;
    let ul = false;
    for (const it of sec.items) {
      if (it.text != null) { out += `${ul ? '' : '<ul class="p-bullets">'}<li>${esc(it.text)}</li>`; ul = true; continue; }
      if (ul) { out += '</ul>'; ul = false; }
      out += it.ex ? exBlock(it) : fwBlock(it);
    }
    return out + (ul ? '</ul>' : '') + '</section>';
  }).join('');

  const root = el(`
    <div class="print-view">
      <div class="print-toolbar no-print">
        <a class="btn" href="#/day/${esc(day)}">◀ Back</a>
        <button class="btn-primary print-btn">Print</button>
      </div>
      <div class="paper">
        <div class="p-header"><span class="p-brand">COACH V</span><span>${esc(title)} — exercise guide</span></div>
        <div class="p-footer">${LEGEND}</div>
        <table class="p-layout"><thead><tr><td><div class="p-space-top"></div></td></tr></thead>
          <tfoot><tr><td><div class="p-space-bottom"></div></td></tr></tfoot>
          <tbody><tr><td>
            <h1>${esc(title)}</h1>
            <p class="p-meta">${esc(blockLabel)}: ${esc(dates)} &nbsp;|&nbsp; RPE ${esc(plan.rpe)} &nbsp;|&nbsp; ${esc(plan.minutes)} min</p>
            ${emphasis ? `<p class="p-emph">${esc(emphasis)}</p>` : ''}
            ${plan.safety ? `<p class="p-safety"><b>Safety:</b> ${esc(plan.safety)}</p>` : ''}
            ${body}
          </td></tr></tbody>
        </table>
      </div>
    </div>`);
  root.querySelector('.print-btn').onclick = () => window.print();
  document.title = `Coach V – ${title}`;
  return root;
}
