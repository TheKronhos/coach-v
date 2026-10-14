// Escape text for HTML. All program strings go through this, since imported
// bundles are user-supplied.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(msg, ms = 3500) {
  const t = el(`<div class="toast" role="status">${esc(msg)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function download(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

// Toast with buttons, e.g. [{ label: 'Undo', onClick }]. Stays up longer than a plain toast.
export function toastActions(msg, actions, ms = 8000) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = el(`<div class="toast toast-action" role="status"><span>${esc(msg)}</span></div>`);
  for (const a of actions) {
    const b = el(`<button class="btn">${esc(a.label)}</button>`);
    b.onclick = async () => { t.remove(); await a.onClick(); };
    t.appendChild(b);
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
