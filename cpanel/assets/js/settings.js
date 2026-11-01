/* Website Settings: four sections, each validated and saved independently (no autosave). */
(async () => {
  await cp.ready;
  const L = (min, max, label) => [V.required(label), V.min(min, label), V.max(max, label)];
  const SECTIONS = {
    aboutForm:  { url: 'ajax/settings/update-about.php', rules: { about: L(20, 2000, 'About text') } },
    mvForm:     { url: 'ajax/settings/update-mission-vision.php', rules: { mission: L(10, 600, 'Mission'), vision: L(10, 600, 'Vision') } },
    bioForm:    { url: 'ajax/settings/update-founder-bios.php', rules: { bio_1: L(10, 600, 'Biography'), bio_2: L(10, 600, 'Biography') } },
    socialForm: { url: 'ajax/settings/update-social-links.php', rules: Object.fromEntries(['linkedin', 'x', 'github', 'instagram', 'facebook'].map(k => [k, [V.url, V.max(300, 'URL')]])) }
  };
  /* Load current values (live) or sample text (demo). */
  let s = { about: 'Twin Forge is a product engineering studio that designs and builds digital solutions.', mission: 'To turn ideas into dependable digital products.', vision: 'To be a studio known for quality and honesty.', bio_1: 'Short biography for the first co-founder.', bio_2: 'Short biography for the second co-founder.' }, founders = [];
  if (!TF.DEMO_MODE) { const r = await api.get('ajax/settings/get.php'); if (r.success) { s = { ...r.data.settings }; founders = r.data.founders || []; } else showToast(r.message, 'warning'); }
  const fill = k => { for (const f of Object.values(SECTIONS)) { /* noop: filled below */ } };
  for (const id of Object.keys(SECTIONS)) { const form = document.getElementById(id);
    for (const k of Object.keys(SECTIONS[id].rules)) form.elements[k].value = (id === 'socialForm' ? s['social_' + k] : s[k]) || ''; }
  founders.forEach((f, i) => { const l = document.getElementById('lbl_bio_' + (i + 1)); if (l && f.name) l.textContent = `Biography: ${f.name}`; });

  for (const [id, cfg] of Object.entries(SECTIONS)) {
    const form = document.getElementById(id), btn = form.querySelector('[type=submit]'), note = form.querySelector('[data-saved]');
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (btn.disabled) return;
      const { ok, values } = validateForm(form, cfg.rules); if (!ok) return;
      const label = btn.textContent; btn.disabled = true; btn.textContent = 'Saving…';
      if (TF.DEMO_MODE) { showToast('Demo mode: this section works, but nothing was saved.', 'info'); note.textContent = ''; }
      else {
        const r = await api.post(cfg.url, values);
        if (!r.success) { showToast(r.message, 'warning'); Object.entries(r.errors).forEach(([k, m]) => { const el = form.querySelector(`[data-error-for="${k}"]`); if (el) el.textContent = m; }); btn.disabled = false; btn.textContent = label; return; }
        showToast(r.message, 'success'); note.textContent = 'Saved at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      btn.disabled = false; btn.textContent = label;
    });
  }
})();
