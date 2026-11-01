/* Count-up statistics: animates [data-count] numbers once when they scroll into view. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const run = n => {
    const end = +n.dataset.count, suffix = n.dataset.suffix || '';
    if (reduce) { n.textContent = end + suffix; return; }
    const t0 = performance.now(), dur = 1400;
    const tick = t => { const k = Math.min(1, (t - t0) / dur); n.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + suffix; if (k < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  };
  window.countUp = run;   // usage: el.dataset.count = 12; countUp(el)
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: .6 });
  document.querySelectorAll('[data-count]').forEach(n => io.observe(n));
})();

/* Founder photos: if a portrait file is missing, remove the broken <img> so the gradient + initials fallback shows. */
document.querySelectorAll('img[data-fallback]').forEach(i => {
  const drop = () => i.remove();
  i.addEventListener('error', drop);
  if (i.complete && !i.naturalWidth) drop();
});
