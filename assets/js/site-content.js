/* Public pages: fills About, Mission, Vision, founder cards and social links from Website Settings. Live mode only (demo mode keeps the built-in copy). */
(async () => {
  if (TF.DEMO_MODE) return;
  const r = await api.get('ajax/settings/get.php'); if (!r.success) return;
  const s = r.data.settings || {}, founders = r.data.founders || [];
  document.querySelectorAll('[data-setting]').forEach(n => { const v = s[n.dataset.setting]; if (v) n.textContent = v; });
  document.querySelectorAll('[data-social]').forEach(a => { const u = s['social_' + a.dataset.social]; if (u && /^https?:\/\//i.test(u)) { a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.setAttribute('aria-label', a.dataset.social); } });
  document.querySelectorAll('.f-card').forEach((card, i) => {
    const f = founders[i]; if (!f) return;
    if (f.name) { card.querySelector('h3').textContent = f.name; }
    if (f.role_title) card.querySelector('.f-role').textContent = f.role_title;
    if (s['bio_' + (i + 1)]) card.querySelector('p').textContent = s['bio_' + (i + 1)];
    if (f.picture_url) { const frame = card.querySelector('.f-frame'); frame.querySelector('img')?.remove(); const im = new Image(); im.src = f.picture_url; im.alt = `Portrait of ${f.name || 'co-founder'}`; im.loading = 'lazy'; im.onerror = () => im.remove(); frame.append(im); }
  });
})();
