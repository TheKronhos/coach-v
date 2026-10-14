// Exercise library (browse by category) and single-exercise detail.
import { state, activeBlock, usedOn, planFor } from '../data.js';
import { frameSVG, DARK_THEME } from '../../src/pose-renderer.js';
import { posePlayer } from '../components/pose-player.js';
import { esc, el, cap } from '../util.js';

const ORDER = ['warm-up', 'cardio', 'boxing', 'power', 'strength', 'conditioning', 'core', 'mobility', 'recovery'];

function categories() {
  const cats = [...new Set(Object.values(state.library).map((e) => e.category))];
  return cats.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
}

export function renderLibrary(active = 'all') {
  const lib = Object.entries(state.library);
  const cats = categories();
  const root = el(`<div class="library"><h1>Exercise library</h1><p class="kicker">${lib.length} exercises</p></div>`);
  root.appendChild(el(`<nav class="cat-chips" aria-label="Categories">
    <a href="#/library" class="${active === 'all' ? 'on' : ''}">All</a>
    ${cats.map((c) => `<a href="#/library/${encodeURIComponent(c)}" class="${active === c ? 'on' : ''}">${esc(cap(c))} <small>${lib.filter(([, e]) => e.category === c).length}</small></a>`).join('')}
  </nav>`));
  for (const c of cats) {
    if (active !== 'all' && active !== c) continue;
    const items = lib.filter(([, e]) => e.category === c).sort((a, b) => a[1].name.localeCompare(b[1].name));
    root.appendChild(el(`
      <section class="lib-cat">
        <h2>${esc(cap(c))}</h2>
        <ul class="lib-list">${items.map(([id, e]) => `
          <li><a href="#/ex/${esc(id)}">
            <span class="thumb">${frameSVG(e.frames[e.print_frames?.[e.print_frames.length - 1] ?? 0][1], e.props || {}, DARK_THEME)}</span>
            <span><b>${esc(e.name)}</b><small>${esc(e.default_dose || '')}</small></span>
          </a></li>`).join('')}
        </ul>
      </section>`));
  }
  return root;
}

export async function renderExercise(id) {
  const ex = state.library[id];
  if (!ex) return el(`<p class="empty">Unknown exercise "${esc(id)}". <a href="#/library">Back to library</a></p>`);
  const block = await activeBlock();
  const days = usedOn(id, block).map((k) => planFor(block, k)?.title).filter((t, i, a) => t && a.indexOf(t) === i);
  const root = el(`
    <div class="exercise">
      <p class="kicker"><a href="#/library/${encodeURIComponent(ex.category)}">◀ ${esc(cap(ex.category))}</a></p>
      <article class="item item-solo">
        <div class="item-media"></div>
        <div class="item-body">
          <h1>${esc(ex.name)}</h1>
          ${ex.default_dose ? `<p class="dose">${esc(ex.default_dose)}</p>` : ''}
          <p class="view">${esc(ex.view || '')}</p>
          <ol class="cues">${(ex.cues || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
          ${days.length ? `<p class="used">Used in: ${days.map((t) => esc(t)).join(', ')}</p>` : ''}
          <p class="muted small">Positions: ${ex.frames.map((f) => esc(f[0])).join(' → ')}</p>
        </div>
      </article>
    </div>`);
  root.querySelector('.item-media').appendChild(posePlayer({ ...ex, props: ex.props || {} }));
  return root;
}
