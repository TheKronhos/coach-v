// Top-down footprint drawing and step-by-step animation for footwork.json sequences.
// Panel: 170 x 215, y down, top = toward opponent. angle = clockwise from pointing up.
import { state } from '../data.js';
import { ICON } from '../icons.js';
import { esc } from '../util.js';

export const FW_LIGHT = { lead: '#1D9E75', rear: '#DE5F36', arrow: '#A51C1C', line: '#8A8A8A', text: '#FFFFFF', bg: '#FFFFFF' };
export const FW_DARK = { lead: '#2BC48F', rear: '#FF7A4D', arrow: '#FF5A55', line: '#9A9A9A', text: '#0E0E0E', bg: '#161616' };

const RX = 8, RY = 15;
const f1 = (n) => n.toFixed(1);

function footSVG(ft, C, { ghost = false } = {}) {
  const col = ft.foot === 'lead' ? C.lead : C.rear;
  const tr = `translate(${f1(ft.x)} ${f1(ft.y)}) rotate(${f1(ft.angle || 0)})`;
  if (ghost) return `<g transform="${tr}"><ellipse rx="${RX}" ry="${RY}" fill="none" stroke="${col}" stroke-width="1.1" stroke-dasharray="3 2.5"/></g>`;
  const label = ft.label ?? (ft.foot === 'lead' ? 'L' : 'R');
  const heel = ft.heel_up ? `<circle cx="0" cy="${RY - 4}" r="3" fill="none" stroke="${C.text}" stroke-width="1.2"/>` : '';
  // Labels stay upright on square-stance feet (they carry an explicit label).
  return `<g transform="${tr}"><ellipse rx="${RX}" ry="${RY}" fill="${col}"/>${heel}` +
    `<text x="0" y="${ft.label ? 3.5 : 1}" text-anchor="middle" font-size="9" font-weight="700" font-style="${ft.label ? 'normal' : 'italic'}" fill="${C.text}" font-family="Helvetica, Arial, sans-serif">${label}</text></g>`;
}

function arrowSVG([x1, y1, x2, y2], C) {
  const a = Math.atan2(y2 - y1, x2 - x1), h = 6;
  const p1 = [x2 - h * Math.cos(a - 0.45), y2 - h * Math.sin(a - 0.45)], p2 = [x2 - h * Math.cos(a + 0.45), y2 - h * Math.sin(a + 0.45)];
  return `<line x1="${x1}" y1="${y1}" x2="${f1(x2 - 3 * Math.cos(a))}" y2="${f1(y2 - 3 * Math.sin(a))}" stroke="${C.arrow}" stroke-width="1.6"/>` +
    `<polygon points="${x2},${y2} ${f1(p1[0])},${f1(p1[1])} ${f1(p2[0])},${f1(p2[1])}" fill="${C.arrow}"/>`;
}

// ---- pivot: computed from rotation around the ball of the lead foot ----
function stanceAngles() {
  const st = state.footwork.find((s) => s.name === 'Stance')?.frames?.[0]?.feet || [];
  return { lead: st.find((f) => f.foot === 'lead')?.angle ?? 15, rear: st.find((f) => f.foot === 'rear')?.angle ?? 45 };
}
const rot = ([dx, dy], deg) => { const r = (deg * Math.PI) / 180; return [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)]; };

function pivotFeet(pv, deg) {
  const A = stanceAngles(), [cx, cy] = pv.lead_center, [ox, oy] = rot(pv.rear_offset_from_lead, deg);
  return [
    { foot: 'lead', x: cx, y: cy, angle: A.lead + deg },
    { foot: 'rear', x: cx + ox, y: cy + oy, angle: A.rear + deg, heel_up: true },
  ];
}

function pivotArc(pv, deg, C) {
  const [cx, cy] = pv.lead_center, [ox, oy] = pv.rear_offset_from_lead;
  const r = Math.hypot(ox, oy) + 16, a0 = Math.atan2(oy, ox), a1 = a0 + (deg * Math.PI) / 180;
  const pt = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
  const sweep = deg < 0 ? 0 : 1, large = Math.abs(deg) > 180 ? 1 : 0;
  // Arrowhead along the tangent at the end of the arc.
  const t = deg < 0 ? a1 - Math.PI / 2 : a1 + Math.PI / 2, h = 6;
  const p1 = [x1 - h * Math.cos(t - 0.45), y1 - h * Math.sin(t - 0.45)], p2 = [x1 - h * Math.cos(t + 0.45), y1 - h * Math.sin(t + 0.45)];
  return `<path d="M${f1(x0)} ${f1(y0)} A${f1(r)} ${f1(r)} 0 ${large} ${sweep} ${f1(x1)} ${f1(y1)}" fill="none" stroke="${C.arrow}" stroke-width="1.6"/>` +
    `<polygon points="${f1(x1)},${f1(y1)} ${f1(p1[0])},${f1(p1[1])} ${f1(p2[0])},${f1(p2[1])}" fill="${C.arrow}"/>`;
}

// Resolve a sequence into concrete frames: { title, cue, feet, ghosts, arrows, arc }
export function resolveFrames(seq) {
  if (seq.pivot) {
    const pv = seq.pivot, steps = pv.rotation_steps_deg;
    return seq.frames.map((fr, i) => ({
      ...fr, feet: pivotFeet(pv, steps[i] ?? 0), deg: steps[i] ?? 0,
      ghosts: i > 0 ? [pivotFeet(pv, 0)[1]] : [], arrows: [], arcDeg: i > 0 ? steps[i] : 0,
    }));
  }
  return seq.frames.map((fr) => ({ ...fr, ghosts: fr.ghosts || [], arrows: fr.arrows || [] }));
}

// One panel: static frame with ghosts and arrows (print + settled state in app).
export function panelSVG(seq, frame, C = FW_LIGHT, { extras = true, feet = null } = {}) {
  const s = [`<rect width="170" height="215" fill="${C.bg}"/>`];
  for (const [x1, y1, x2, y2] of seq.lines || []) s.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.line}" stroke-width="1.2"/>`);
  if (extras) {
    for (const g of frame.ghosts) s.push(footSVG(g, C, { ghost: true }));
    for (const a of frame.arrows) s.push(arrowSVG(a, C));
    if (frame.arcDeg) s.push(pivotArc(seq.pivot, frame.arcDeg, C));
  }
  for (const ft of feet || frame.feet) s.push(footSVG(ft, C));
  return s.join('');
}

const lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// Animated player: holds on each frame (ghosts + arrows + cue shown), then eases
// the moving feet to the next frame. Loops back to the start after the last step.
export function footworkPlayer(seq, { theme = FW_DARK, hold = 1600, move = 900 } = {}) {
  const frames = resolveFrames(seq);
  const wrap = document.createElement('div');
  wrap.className = 'player fw-player';
  wrap.innerHTML = `
    <div class="fw-title"></div>
    <svg class="stage fw-stage" viewBox="0 0 170 215" role="img" aria-label="${esc(seq.name)} footwork diagram"></svg>
    <div class="fw-cue"></div>
    <div class="player-bar">
      <button class="btn-icon prev" aria-label="Previous step">${ICON.prev}</button>
      <button class="btn-icon play" aria-label="Pause">${ICON.pause}</button>
      <span class="frame-label"></span>
      <button class="btn-icon next" aria-label="Next step">${ICON.next}</button>
    </div>`;
  const svg = wrap.querySelector('svg'), title = wrap.querySelector('.fw-title'), cue = wrap.querySelector('.fw-cue');
  const counter = wrap.querySelector('.frame-label'), playBtn = wrap.querySelector('.play');
  let i = 0, paused = matchMedia('(prefers-reduced-motion: reduce)').matches, visible = false, timer = null, raf = null;

  const settle = (n) => {
    i = n; const fr = frames[i];
    svg.innerHTML = panelSVG(seq, fr, theme);
    title.textContent = fr.title || seq.name;
    cue.textContent = fr.cue || (i === 0 ? (seq.rule || '') : '');
    counter.textContent = `Step ${i + 1} of ${frames.length}`;
  };
  const tween = (a, b, done) => {
    const A = frames[a], B = frames[b], t0 = performance.now();
    const step = (now) => {
      const k = ease(Math.min((now - t0) / move, 1));
      let feet;
      if (seq.pivot) feet = pivotFeet(seq.pivot, lerp(A.deg, B.deg, k));
      else feet = B.feet.map((fb) => { const fa = A.feet.find((x) => x.foot === fb.foot) || fb;
        return { ...fb, x: lerp(fa.x, fb.x, k), y: lerp(fa.y, fb.y, k), angle: lerp(fa.angle || 0, fb.angle || 0, k) }; });
      svg.innerHTML = panelSVG(seq, A, theme, { extras: false, feet });
      if (k < 1) raf = requestAnimationFrame(step); else done();
    };
    raf = requestAnimationFrame(step);
  };
  const clear = () => { clearTimeout(timer); cancelAnimationFrame(raf); timer = raf = null; };
  function loop() {
    clear();
    if (paused || !visible || frames.length < 2 || !wrap.isConnected) return;
    timer = setTimeout(() => {
      const nx = i + 1;
      if (nx >= frames.length) { settle(0); loop(); return; }  // restart, don't animate backwards
      tween(i, nx, () => { settle(nx); loop(); });
    }, i === frames.length - 1 ? hold * 1.5 : hold);
  }
  const syncBtn = () => { playBtn.innerHTML = paused ? ICON.play : ICON.pause; playBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause'); };
  playBtn.onclick = () => { paused = !paused; syncBtn(); loop(); };
  wrap.querySelector('.next').onclick = () => { paused = true; syncBtn(); clear(); settle((i + 1) % frames.length); };
  wrap.querySelector('.prev').onclick = () => { paused = true; syncBtn(); clear(); settle((i - 1 + frames.length) % frames.length); };
  if (frames.length < 2) wrap.querySelectorAll('.prev,.next,.play').forEach((b) => (b.hidden = true));

  settle(0); syncBtn();
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; loop(); if (!wrap.isConnected) io.disconnect(); }, { rootMargin: '100px' });
    io.observe(wrap);
  } else { visible = true; loop(); }
  return wrap;
}
