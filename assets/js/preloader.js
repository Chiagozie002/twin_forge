/* Public preloader: progress eases toward 90% while the page loads, then completes and wipes upward. Shows at least ~0.9s so it never flashes.
   If this script never runs, a CSS animation hides the preloader after 7s anyway. */
(() => {
  const pl = document.getElementById('preloader'); if (!pl) return;
  const fill = document.getElementById('plFill'), pct = document.getElementById('plPct'), root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, MIN = reduce ? 0 : 900, t0 = performance.now();
  let p = 0, loaded = document.readyState === 'complete', finished = false;
  root.classList.add('is-loading');
  window.addEventListener('load', () => { loaded = true; });

  const paint = v => { p = v; fill.style.width = v + '%'; pct.textContent = Math.round(v) + '%'; };
  const finish = () => {
    if (finished) return; finished = true; paint(100);
    setTimeout(() => { pl.classList.add('done'); root.classList.remove('is-loading'); setTimeout(() => pl.remove(), 1100); }, reduce ? 0 : 250);
  };
  const tick = () => {
    if (finished) return;
    paint(Math.min(100, loaded ? p + (100 - p) * .22 + 1 : p + (90 - p) * .035));
    if (p >= 99.5 && performance.now() - t0 >= MIN) finish(); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(finish, 8000);                                   // hard stop
})();
