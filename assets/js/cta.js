/* "Have a ... in mind?" section: the word, background colour, orbs, button label and link all follow the chosen product.
   Auto-rotates while visible (not when hovered, not for reduced-motion); clicking a chip takes over and stops the rotation. */
(() => {
  const root = document.getElementById('cta'); if (!root) return;
  const P = { website: ['website', 'Start your website'], 'web-app': ['web app', 'Start your web app'], 'mobile-app': ['mobile app', 'Start your mobile app'], dashboard: ['dashboard', 'Start your dashboard'] };
  const keys = Object.keys(P), word = document.getElementById('ctaWord'), btn = document.getElementById('ctaBtn'), btnText = document.getElementById('ctaBtnText');
  const picks = [...root.querySelectorAll('.cta-picks button')], bgs = [...root.querySelectorAll('.cta-bgs i')];
  let cur = 'website', timer = null, manual = false;

  function apply(key) {
    cur = key; root.dataset.active = key;
    bgs.forEach(b => b.classList.toggle('on', b.classList.contains('bg-' + key)));
    picks.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.key === key)));
    btn.href = 'contact.html?type=' + key; btnText.textContent = P[key][1];
    if (word.textContent !== P[key][0]) {                                   // slide the old word out, the new one in
      word.classList.add('out');
      setTimeout(() => { word.textContent = P[key][0]; word.classList.add('pre'); void word.offsetWidth; word.classList.remove('pre', 'out'); }, 280);
    }
  }
  const next = () => apply(keys[(keys.indexOf(cur) + 1) % keys.length]);
  const start = () => { if (!timer && !manual && !matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(next, 3600); };
  const stop = () => { clearInterval(timer); timer = null; };

  picks.forEach(b => b.addEventListener('click', () => { manual = true; stop(); apply(b.dataset.key); }));
  root.addEventListener('mouseenter', stop); root.addEventListener('mouseleave', start);
  new IntersectionObserver(es => es[0].isIntersecting ? start() : stop(), { threshold: .3 }).observe(root);   // only animate while on screen
})();
