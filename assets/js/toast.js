/* Global toast: showToast(message, type) with type = success | warning | info. Glass card, icon, title, countdown bar. */
function showToast(message, type = 'info') {
  const KINDS = { success: ['fa-circle-check', 'Success'], warning: ['fa-triangle-exclamation', 'Warning'], info: ['fa-circle-info', 'Notice'] };
  if (!KINDS[type]) type = 'info';
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('aria-live', 'polite'); document.body.append(box); }
  if (box.children.length >= 4) box.firstChild.remove();                       // cap stacked toasts
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };   // textContent only: XSS-safe

  const t = el('div', `tf-toast ${type}`); t.setAttribute('role', type === 'warning' ? 'alert' : 'status');
  const ic = el('span', 'tt-ic'); ic.append(el('i', `fa-solid ${KINDS[type][0]}`)); ic.setAttribute('aria-hidden', 'true');
  const body = el('div', 'tt-body'); body.append(el('strong', null, KINDS[type][1]), el('p', null, message));
  const x = el('button', 'tt-x'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss notification'); x.append(el('i', 'fa-solid fa-xmark'));
  const bar = el('span', 'tt-bar'); t.append(ic, body, x, bar); box.append(t);

  let gone = false;
  const close = () => { if (gone) return; gone = true; t.classList.add('out'); setTimeout(() => t.remove(), 320); };
  x.onclick = close;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(close, 6000);   // animations are off, so use a timer instead
  else bar.addEventListener('animationend', close);                                      // the bar IS the timer, and it pauses on hover
}
