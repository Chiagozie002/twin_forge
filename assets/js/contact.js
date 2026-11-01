/* Contact page: Google map, project-type chips (also preselected from ?type=), message counter, validation, duplicate-submit lock, AJAX. */

/* ---- MAP: SAMPLE LOCATION (Benin City). Replace both URLs with your real location:
   MAP_EMBED_URL = Google Maps > Share > Embed a map > copy ONLY the src="..." value.
   MAP_LINK_URL  = any normal Google Maps link to your place. ---- */
const MAP_EMBED_URL = 'https://www.google.com/maps?q=Benin+City,+Edo+State,+Nigeria&output=embed';
const MAP_LINK_URL  = 'https://www.google.com/maps/search/?api=1&query=Benin+City,+Edo+State,+Nigeria';

(() => {
  // 1. Map (graceful placeholder stays if the URL is empty)
  const mapBox = document.getElementById('mapBox'), mapLink = document.getElementById('mapLink');
  if (MAP_EMBED_URL) { const f = document.createElement('iframe'); f.src = MAP_EMBED_URL; f.title = 'Twin Forge location map'; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade'; mapBox.replaceChildren(f); }
  if (MAP_LINK_URL) mapLink.href = MAP_LINK_URL; else mapLink.hidden = true;

  // 2. Project type chips fill the subject (without overwriting something the visitor typed)
  const form = document.getElementById('contactForm'), btn = form.querySelector('button[type=submit]'), label = btn.querySelector('.btn-label');
  const TYPES = { website: 'I need a website', 'web-app': 'I need a web application', 'mobile-app': 'I need a mobile app', dashboard: 'I need a dashboard', 'ui-ux': 'I need UI/UX design', other: 'I have another idea' };
  const chips = [...form.querySelectorAll('.type-chip')]; let autoSubject = '';
  const pick = key => {
    if (!TYPES[key]) return;
    chips.forEach(c => { const on = c.dataset.type === key; c.classList.toggle('active', on); c.setAttribute('aria-pressed', String(on)); });
    const s = form.elements.subject; if (!s.value.trim() || s.value === autoSubject) { s.value = autoSubject = TYPES[key]; }
  };
  chips.forEach(c => c.addEventListener('click', () => pick(c.dataset.type)));
  pick(new URLSearchParams(location.search).get('type'));                       // arriving from the homepage CTA

  // 3. Live character counter
  const msg = form.elements.message, count = document.getElementById('msgCount');
  msg.addEventListener('input', () => { count.textContent = `${msg.value.length} / 4000`; });

  // 4. Validation + AJAX (server validates again in ajax/messages/submit.php)
  const rules = { name: [V.required('Name'), V.min(2, 'Name'), V.max(120, 'Name')], email: [V.required('Email'), V.email, V.max(160, 'Email')],
    subject: [V.required('Subject'), V.min(3, 'Subject'), V.max(160, 'Subject')], message: [V.required('Message'), V.min(10, 'Message'), V.max(4000, 'Message')] };
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (btn.classList.contains('loading')) return;           // block duplicate submits
    const { ok, values } = validateForm(form, rules); if (!ok) return;
    values.website = form.elements.website.value;                                 // honeypot (must stay empty)
    btn.classList.add('loading'); btn.disabled = true; label.textContent = 'Sending…';
    const res = await api.post('ajax/messages/submit.php', values);
    if (res.success) { showToast(res.message, 'success'); form.reset(); autoSubject = ''; chips.forEach(c => c.classList.remove('active')); count.textContent = '0 / 4000'; }
    else { showToast(res.message, 'warning'); Object.entries(res.errors || {}).forEach(([k, v]) => { const s = form.querySelector(`[data-error-for="${k}"]`); if (s) s.textContent = v; }); }
    btn.classList.remove('loading'); btn.disabled = false; label.textContent = 'Send message';
  });
})();
