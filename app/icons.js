// Inline SVG icons (glyphs like ⏱ ⏭ render as emoji on iOS).
const svg = (body, extra = '') => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"${extra}>${body}</svg>`;

export const ICON = {
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>'),
  pause: svg('<path d="M7 4v16M17 4v16" stroke-width="3.5"/>'),
  next: svg('<path d="M5 5v14l10-7z" fill="currentColor"/><path d="M19 5v14" stroke-width="3"/>'),
  prev: svg('<path d="M19 5v14L9 12z" fill="currentColor"/><path d="M5 5v14" stroke-width="3"/>'),
  timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M18.5 6.5l1.5-1.5"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  close: svg('<path d="M5 5l14 14M19 5L5 19"/>'),
  settings: svg('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  today: svg('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.8" fill="currentColor"/>'),
  week: svg('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4M9 10v10M15 10v10"/>'),
  library: svg('<path d="M4 5h4v15H4zM10 5h4v15h-4zM16 6l3.5-1 3 14-3.5 1z"/>'),
  log: svg('<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h6M9 8h3"/>'),
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
};
