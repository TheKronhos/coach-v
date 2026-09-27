// Animated stick figure for one exercise. Scene props are drawn once; the figure
// is redrawn each animation frame. Animations only run while on screen.
import { animate, sceneSVG, figureSVG, DARK_THEME } from '../../src/pose-renderer.js';
import { ICON } from '../icons.js';
import { esc } from '../util.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const players = new Set();

const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const e of entries) { const p = e.target.__player; if (p) p.setVisible(e.isIntersecting); }
}, { rootMargin: '100px' }) : null;

// ex: exercise with merged props ({...ex.props, ...item.props}) and frames.
export function posePlayer(ex, { theme = DARK_THEME } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'player pose-player';
  wrap.innerHTML = `
    <svg class="stage" viewBox="0 0 240 200" role="img" aria-label="${esc(ex.name)} animation">
      <rect width="240" height="200" fill="${theme.bg}"/>
      <g class="scene">${sceneSVG(ex.props, theme)}</g><g class="fig"></g>
    </svg>
    <div class="player-bar">
      <button class="btn-icon play" aria-label="Pause">${ICON.pause}</button>
      <span class="frame-label" aria-live="off"></span>
      <button class="btn-icon step" aria-label="Next position">${ICON.next}</button>
    </div>`;
  const fig = wrap.querySelector('.fig');
  const label = wrap.querySelector('.frame-label');
  const playBtn = wrap.querySelector('.play');
  let anim = null, visible = false, userPaused = reduceMotion(), stepIdx = 0;

  const draw = (pose, i, lbl) => { fig.innerHTML = figureSVG(pose, ex.props, theme); label.textContent = lbl; };
  const showStill = (i) => { const [lbl, pose] = ex.frames[i]; draw(pose, i, lbl); };

  function sync() {
    const shouldRun = visible && !userPaused && ex.frames.length > 1 && wrap.isConnected;
    if (shouldRun && !anim) anim = animate(ex, (pose, i, lbl) => { stepIdx = i; draw(pose, i, lbl); });
    if (!shouldRun && anim) { anim.stop(); anim = null; }
    playBtn.innerHTML = userPaused ? ICON.play : ICON.pause;
    playBtn.setAttribute('aria-label', userPaused ? 'Play' : 'Pause');
  }
  playBtn.onclick = () => { userPaused = !userPaused; if (userPaused && anim) { anim.stop(); anim = null; showStill(stepIdx); } sync(); };
  wrap.querySelector('.step').onclick = () => {
    userPaused = true; if (anim) { anim.stop(); anim = null; }
    stepIdx = (stepIdx + 1) % ex.frames.length; showStill(stepIdx); sync();
  };
  if (ex.frames.length < 2) wrap.querySelector('.step').hidden = true;

  showStill(0);
  const api = { el: wrap, setVisible(v) { visible = v; sync(); }, stop() { visible = false; sync(); } };
  wrap.__player = api; players.add(api);
  if (io) io.observe(wrap); else api.setVisible(true);
  sync();
  return wrap;
}

// Stop everything (called on route change).
export function stopAllPlayers() {
  for (const p of players) { p.stop(); if (io) io.unobserve(p.el); }
  players.clear();
}
