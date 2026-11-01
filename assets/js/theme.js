/* Theme: stored in localStorage (graceful if blocked), applied via Bootstrap's data-bs-theme. */
(() => {
  const KEY = document.documentElement.dataset.themeKey || 'tf-theme', root = document.documentElement;
  const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch { /* storage unavailable: ignore */ } };
  const apply = t => { root.setAttribute('data-bs-theme', t);
    const i = document.querySelector('#themeToggle i'); if (i) i.className = t === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'; };
  apply(get() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  document.addEventListener('DOMContentLoaded', () => apply(root.getAttribute('data-bs-theme')));   // refresh icon once DOM exists
  document.addEventListener('click', e => {
    if (!e.target.closest('#themeToggle')) return;
    const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark'; apply(next); set(next);
  });
  // Scroll reveal via IntersectionObserver (cheap, no scroll handlers)
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: .12 });
  document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('.reveal').forEach(n => io.observe(n)));
})();
