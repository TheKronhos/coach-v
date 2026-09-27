// Reference implementation of the Coach V stick-figure system.
// Plain JS, no dependencies. Produces SVG markup; adapt freely.
//
// COORDINATES: 240 x 200 box, origin top-left, y DOWN, floor at y = 181.
// ANGLES: absolute degrees per segment, measured from straight down:
//   0 = down, 90 = right (+x), 180 = up, -90 / 270 = left. Vector = (sin a, cos a).
//
// POSE FIELDS (see data/library.json):
//   h [x,y] hip · t torso angle (hip->shoulder)
//   a [upper,fore] near arm · b [upper,fore] far arm
//   l [thigh,shin] near leg · m [thigh,shin] far leg
//   fa, fb  foot angles (default shin + 90) · fl foot length (default 12)
//   al      global arm scale (default 1) · sa, sb near/far arm scale (default 1)
//   n       head tilt offset from torso angle (default 0)
//   k       spine curve: torso drawn as a quadratic curve bowed by k (default 0)
//   r       jump-rope low/high point y (only used with props.rope)
// LENGTHS: torso 46, neck->head 14 (head r 9), upper arm 26, forearm 24, thigh 38, shin 38.
// Interpolation is linear on angles, so the data uses equivalent angles that
// sweep the right way (e.g. 260 instead of -100).

export const LEN = { torso: 46, head: 14, upper: 26, fore: 24, thigh: 38, shin: 38 };
const DEFAULTS = { al: 1, fl: 12, sa: 1, sb: 1, n: 0, k: 0, r: 0 };

export function normalizePose(p) {
  const q = { ...DEFAULTS, ...p };
  q.fa = p.fa ?? p.l[1] + 90;
  q.fb = p.fb ?? p.m[1] + 90;
  return q;
}
const KEYS = ['al', 'fl', 'sa', 'sb', 'n', 'k', 'r', 'fa', 'fb'];
export const flat = (p) => { const q = normalizePose(p);
  return [q.h[0], q.h[1], q.t, q.a[0], q.a[1], q.b[0], q.b[1], q.l[0], q.l[1], q.m[0], q.m[1], ...KEYS.map((k) => q[k])]; };
export const unflat = (v) => { const [hx, hy, t, a0, a1, b0, b1, l0, l1, m0, m1, ...rest] = v;
  const p = { h: [hx, hy], t, a: [a0, a1], b: [b0, b1], l: [l0, l1], m: [m0, m1] };
  KEYS.forEach((k, i) => (p[k] = rest[i])); return p; };
export const lerp = (va, vb, k) => va.map((x, i) => x + (vb[i] - x) * k);

const dir = (a) => { const r = (a * Math.PI) / 180; return [Math.sin(r), Math.cos(r)]; };
const add = (p, a, L) => { const d = dir(a); return [p[0] + L * d[0], p[1] + L * d[1]]; };

export function joints(pose) {
  const p = normalizePose(pose);
  const hip = p.h, sh = add(hip, p.t, LEN.torso), head = add(sh, p.t + p.n, LEN.head);
  const sa = p.al * p.sa, sb = p.al * p.sb;
  const eN = add(sh, p.a[0], LEN.upper * sa), hN = add(eN, p.a[1], LEN.fore * sa);
  const eF = add(sh, p.b[0], LEN.upper * sb), hF = add(eF, p.b[1], LEN.fore * sb);
  const kN = add(hip, p.l[0], LEN.thigh), aN = add(kN, p.l[1], LEN.shin), tN = add(aN, p.fa, p.fl);
  const kF = add(hip, p.m[0], LEN.thigh), aF = add(kF, p.m[1], LEN.shin), tF = add(aF, p.fb, p.fl);
  return { p, hip, sh, head, eN, hN, eF, hF, kN, aN, tN, kF, aF, tF };
}

const f = (n) => n.toFixed(1);
const pl = (pts) => pts.map((q) => `${f(q[0])},${f(q[1])}`).join(' ');
const qcurve = (a, c, b, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const u = i / n;
  return [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * c[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * c[1] + u * u * b[1]]; });

// COLORS: pass your own theme. near = dark limbs, far = light limbs.
export const THEME = { near: '#1F1F1F', far: '#9A9A9A', prop: '#8A8A8A', propFill: '#E6E6E6', accent: '#BA7517', glove: '#E24B4A', bg: '#FFFFFF' };

// Static scene props (drawn behind the figure). props come from the exercise,
// merged with any per-day override in days.json ({...exercise.props, ...item.props}).
export function sceneSVG(props = {}, C = THEME) {
  const s = []; const L = (x1, y1, x2, y2, w = 1.2) => s.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.prop}" stroke-width="${w}"/>`);
  if (!props.top && !props.nofloor) L(6, 181, 234, 181, 0.8);
  if (props.wall != null) L(props.wall + 2, 20, props.wall + 2, 181, 2);
  if (props.rower) { L(55, 161, 215, 161); L(181, 130, 181, 161, 1.6); s.push(`<circle cx="222" cy="142" r="14" fill="none" stroke="${C.prop}" stroke-width="1.2"/>`); }
  for (const key of ['box', 'bench']) if (props[key]) { const [x, w, h] = props[key]; s.push(`<rect x="${x}" y="${181 - h}" width="${w}" height="${h}" fill="${C.propFill}" stroke="${C.prop}" stroke-width="0.8"/>`); }
  if (props.bag != null) { const x = props.bag; L(x + 14, 0, x + 14, 28, 1); s.push(`<rect x="${x}" y="28" width="28" height="122" rx="4" fill="${C.propFill}" stroke="${C.prop}" stroke-width="0.8"/>`); }
  if (props.speedbag) { const [x, y] = props.speedbag; L(x - 24, y - 8, x + 26, y - 8, 2); s.push(`<ellipse cx="${x}" cy="${y + 6}" rx="5" ry="10" fill="${C.propFill}" stroke="${C.prop}" stroke-width="0.8"/>`); }
  if (props.doubleend) { const [x, y] = props.doubleend; L(x, 0, x, y - 8, 0.6); L(x, y + 8, x, 181, 0.6); s.push(`<circle cx="${x}" cy="${y}" r="8" fill="${C.propFill}" stroke="${C.prop}" stroke-width="0.8"/>`); }
  if (props.pullbar) { const [x, y] = props.pullbar; L(x - 40, y, x + 40, y, 2.2); }
  if (props.cable) { const [x, y] = props.cable; L(x, 10, x, 181, 1.4); s.push(`<circle cx="${x}" cy="${y}" r="3" fill="${C.prop}"/>`); }
  if (props.landmine) { const [x, y] = props.landmine; s.push(`<circle cx="${x}" cy="${y}" r="3" fill="${C.prop}"/>`); }
  if (props.roller) { const [x, y, r] = props.roller; s.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${C.propFill}" stroke="${C.prop}" stroke-width="0.8"/>`); }
  return s.join('');
}

// Figure plus hand-attached props, for one (possibly interpolated) pose.
export function figureSVG(pose, props = {}, C = THEME) {
  const j = joints(pose), p = j.p, s = [];
  const line = (pts, col, w) => s.push(`<polyline points="${pl(pts)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);
  const mid = [(j.hN[0] + j.hF[0]) / 2, (j.hN[1] + j.hF[1]) / 2];
  if (props.band) line([j.hN, j.hF], C.accent, 2.5);
  if (props.rope) { const c = [mid[0], 2 * p.r - mid[1]]; line(qcurve(j.hN, c, j.hF, 16), C.accent, 1.6); }
  if (props.cable) line([props.cable, mid], C.prop, 1);
  if (props.landmine) line([props.landmine, j.hN], C.prop, 3);
  if (props.rower) { s.push(`<rect x="${f(j.hip[0] - 8)}" y="${f(j.hip[1] + 3)}" width="16" height="4" rx="1" fill="${C.far}"/>`); line([j.hN, [214, 142]], C.prop, 1); }
  line([j.hip, j.kF, j.aF, j.tF], C.far, 4); line([j.sh, j.eF, j.hF], C.far, 4);
  if (Math.abs(p.k) < 0.01) line([j.hip, j.sh], C.near, 4.5);
  else { const d = dir(p.t), perp = [d[1], -d[0]], m = [(j.hip[0] + j.sh[0]) / 2, (j.hip[1] + j.sh[1]) / 2];
    line(qcurve(j.hip, [m[0] + 2 * p.k * perp[0], m[1] + 2 * p.k * perp[1]], j.sh), C.near, 4.5); }
  s.push(`<circle cx="${f(j.head[0])}" cy="${f(j.head[1])}" r="9" fill="${C.bg}" stroke="${C.near}" stroke-width="3"/>`);
  line([j.hip, j.kN, j.aN, j.tN], C.near, 4.5); line([j.sh, j.eN, j.hN], C.near, 4.5);
  if (props.gloves) { s.push(`<circle cx="${f(j.hF[0])}" cy="${f(j.hF[1])}" r="5" fill="${C.far}"/>`, `<circle cx="${f(j.hN[0])}" cy="${f(j.hN[1])}" r="5.5" fill="${C.glove}"/>`); }
  const h = props.hold;
  if (h) { const at = { near: [j.hN], far: [j.hF], both: [j.hN, j.hF], mid: [mid] }[h.at];
    for (const [x, y] of at) s.push({
      kb: `<circle cx="${f(x)}" cy="${f(y + 5)}" r="5.5" fill="${C.accent}"/>`,
      db: `<rect x="${f(x - 5)}" y="${f(y - 2)}" width="10" height="4" fill="${C.accent}"/>`,
      mb: `<circle cx="${f(x)}" cy="${f(y)}" r="8" fill="${C.accent}"/>`,
      plates: `<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="none" stroke="${C.accent}" stroke-width="2"/>`,
      wheel: `<circle cx="${f(x)}" cy="${f(y + 2)}" r="7" fill="none" stroke="${C.accent}" stroke-width="2"/>`,
    }[h.type]); }
  return s.join('');
}

export const frameSVG = (pose, props = {}, C = THEME) =>
  `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg">${sceneSVG(props, C)}${figureSVG(pose, props, C)}</svg>`;

// Dark theme for the app screen. Far limbs are kept at ~7.5:1 against bg so they
// read in a dim gym while staying clearly lighter-weight than the near limbs.
export const DARK_THEME = { near: '#F2F2F2', far: '#A3A3A3', prop: '#8A8A8A', propFill: '#2A2A2A', accent: '#F0A030', glove: '#FF5A55', bg: '#161616' };

// Previous position, drawn dashed behind the current figure (print view).
export function ghostSVG(pose, C = { ghost: '#BDBDBD', bg: '#FFFFFF' }) {
  const j = joints(pose), s = [];
  const line = (pts) => s.push(`<polyline points="${pl(pts)}" fill="none" stroke="${C.ghost}" stroke-width="1.3" stroke-dasharray="3 2.5" stroke-linecap="round" stroke-linejoin="round"/>`);
  line([j.hip, j.kF, j.aF]); line([j.sh, j.eF, j.hF]); line([j.hip, j.sh]);
  line([j.hip, j.kN, j.aN]); line([j.sh, j.eN, j.hN]);
  s.push(`<circle cx="${f(j.head[0])}" cy="${f(j.head[1])}" r="9" fill="none" stroke="${C.ghost}" stroke-width="1.3" stroke-dasharray="3 2.5"/>`);
  return s.join('');
}

// Which tracked joint moved most between two poses: hands, ankles, hip, head.
const TRACKED = ['hN', 'hF', 'aN', 'aF', 'hip', 'head'];
export function mostMoved(prev, cur) {
  const a = joints(prev), b = joints(cur);
  let best = null;
  for (const k of TRACKED) { const d = Math.hypot(b[k][0] - a[k][0], b[k][1] - a[k][1]);
    if (!best || d > best.dist) best = { joint: k, dist: d, from: a[k], to: b[k] }; }
  return best;
}

// Red "what moves" arrow, only when the most-moved joint travelled > minDist units.
export function arrowSVG(prev, cur, color = '#B3261E', minDist = 10) {
  const m = mostMoved(prev, cur);
  if (!m || m.dist <= minDist) return '';
  const [x1, y1] = m.from, [x2, y2] = m.to, ang = Math.atan2(y2 - y1, x2 - x1), hl = 6;
  const p1 = [x2 - hl * Math.cos(ang - 0.45), y2 - hl * Math.sin(ang - 0.45)], p2 = [x2 - hl * Math.cos(ang + 0.45), y2 - hl * Math.sin(ang + 0.45)];
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${color}" stroke-width="1.6"/>` +
    `<polygon points="${pl([[x2, y2], p1, p2])}" fill="${color}"/>`;
}

// Print frame: scene, dashed ghost of the previous print frame, figure, arrow.
export function printFrameSVG(pose, props = {}, prev = null, C = THEME) {
  return `<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg">${sceneSVG(props, C)}` +
    `${prev ? ghostSVG(prev) : ''}${figureSVG(pose, props, C)}${prev ? arrowSVG(prev, pose) : ''}</svg>`;
}

const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

// Loop an exercise's frames: hold each pose, then ease to the next.
// onFrame(pose, index, label) fires every animation frame; render with figureSVG.
export function animate(exercise, onFrame, { hold = 650, move = 1100 } = {}) {
  const frames = exercise.frames.map(([label, p]) => [label, flat(p)]);
  let i = 0, t0 = performance.now(), holding = true, raf, paused = false;
  onFrame(unflat(frames[0][1]), 0, frames[0][0]);
  function tick(now) {
    if (!paused) { const el = now - t0;
      if (holding) { if (el > hold) { holding = false; t0 = now; } }
      else { const k = Math.min(el / move, 1), nx = (i + 1) % frames.length;
        onFrame(unflat(lerp(frames[i][1], frames[nx][1], easeInOut(k))), i, frames[i][0]);
        if (k >= 1) { i = nx; holding = true; t0 = now; onFrame(unflat(frames[i][1]), i, frames[i][0]); } } }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return { pause() { paused = true; }, play() { paused = false; t0 = performance.now(); }, stop() { cancelAnimationFrame(raf); } };
}
