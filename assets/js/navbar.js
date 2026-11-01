/* Navbar: active link follows the section in view AND updates instantly on click; closes the mobile menu; shadow on scroll. */
(() => {
  const nav = document.getElementById('siteNav'); if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Close the offcanvas after choosing a link (mobile).
  document.querySelectorAll('#navMenu .nav-link').forEach(a => a.addEventListener('click', () => { const oc = document.getElementById('navMenu'); bootstrap.Offcanvas.getInstance(oc)?.hide(); }));

  // Section-aware highlighting (home page only: links carry data-spy="sectionId").
  const links = [...document.querySelectorAll('.nav-link[data-spy]')]; if (!links.length) return;
  const set = id => links.forEach(a => { const on = a.dataset.spy === id; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current'); });
  let locked = false, lockTimer;
  const io = new IntersectionObserver(es => { if (!locked) es.forEach(e => { if (e.isIntersecting) set(e.target.id); }); }, { rootMargin: '-40% 0px -55% 0px' });   // thin band near the middle of the screen
  links.forEach(a => { const s = document.getElementById(a.dataset.spy); if (s) io.observe(s); });

  // On click: highlight immediately and ignore the observer until the smooth scroll settles (no flicker through other sections).
  links.forEach(a => a.addEventListener('click', () => { set(a.dataset.spy); locked = true; clearTimeout(lockTimer); lockTimer = setTimeout(() => { locked = false; }, 1600); }));
  addEventListener('scroll', () => { if (!locked) return; clearTimeout(lockTimer); lockTimer = setTimeout(() => { locked = false; }, 160); }, { passive: true });
  set(links.some(a => '#' + a.dataset.spy === location.hash) ? location.hash.slice(1) : 'home');
})();
