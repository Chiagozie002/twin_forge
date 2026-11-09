/* Navbar: the active link follows the section you are READING (desktop bar and mobile menu stay in sync), updates instantly on click,
   clears once you scroll past the last linked section (milestones, CTA, footer), closes the mobile menu, and adds a shadow on scroll. */
(() => {
  const nav = document.getElementById('siteNav'); if (!nav) return;
  const onScrollShadow = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScrollShadow, { passive: true }); onScrollShadow();

  // Close the offcanvas after choosing a link (mobile).
  document.querySelectorAll('#navMenu .nav-link').forEach(a => a.addEventListener('click', () => bootstrap.Offcanvas.getInstance(document.getElementById('navMenu'))?.hide()));

  // Section-aware highlighting (home page only: links carry data-spy="sectionId").
  const links = [...document.querySelectorAll('.nav-link[data-spy]')]; if (!links.length) return;
  const secs = [...new Set(links.map(a => a.dataset.spy))].map(id => document.getElementById(id)).filter(Boolean), last = secs[secs.length - 1];
  const set = id => links.forEach(a => { const on = a.dataset.spy === id; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current'); });

  // A section counts as "reached" when its top passes an activation line a little below the navbar.
  let locked = false, raf = 0, timer;
  const compute = () => {
    raf = 0; if (locked) return;
    const line = nav.offsetHeight + innerHeight * 0.3; let cur = null;
    for (const s of secs) if (s.getBoundingClientRect().top <= line) cur = s;
    if (cur === last && cur.getBoundingClientRect().bottom <= line) cur = null;      // past the final linked section: nothing is active
    set(cur ? cur.id : null);
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(compute); };
  addEventListener('scroll', schedule, { passive: true }); addEventListener('resize', schedule); addEventListener('load', schedule);

  // Clicking: highlight at once, ignore scroll updates until the smooth scroll has stopped (no flicker through other sections).
  const unlock = () => { locked = false; schedule(); };
  links.forEach(a => a.addEventListener('click', () => { set(a.dataset.spy); locked = true; clearTimeout(timer); timer = setTimeout(unlock, 1800); }));
  addEventListener('scroll', () => { if (!locked) return; clearTimeout(timer); timer = setTimeout(unlock, 140); }, { passive: true });
  schedule();
})();
