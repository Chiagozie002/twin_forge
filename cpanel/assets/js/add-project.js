/* Add Project page: validation, technology tags, image preview (type check only, no size limit; a picture is required), AJAX multipart submit. */
(async () => {
  await cp.ready;
  const form = document.getElementById('addForm'), sb = form.querySelector('[type=submit]');
  const tags = cp.tags(form.querySelector('.tag-box')), picker = cp.imagePicker(form.elements.image, document.getElementById('addPreview'), form.querySelector('[data-error-for=image]'), true);
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (sb.disabled) return;                                   // duplicate-submit guard
    const { ok, values } = validateForm(form, cp.projectRules()); const techs = tags.get();
    form.querySelector('[data-error-for=technologies]').textContent = techs.length ? '' : 'Add at least one technology.';
    const pOk = picker.check();                                     // evaluate first so the picture error shows together with the others
    if (!ok || !techs.length || !pOk) return;
    sb.disabled = true; sb.textContent = 'Saving…';
    if (TF.DEMO_MODE) { showToast('Demo mode: this form works, but the project was NOT saved anywhere.', 'info'); }
    else {
      const fd = new FormData(); Object.entries(values).forEach(([k, v]) => fd.append(k, v)); fd.append('technologies', JSON.stringify(techs)); fd.append('image', form.elements.image.files[0]);
      const r = await api.post('ajax/projects/add.php', fd);
      if (!r.success) { showToast(r.message, 'warning'); Object.entries(r.errors).forEach(([k, m]) => { const s = form.querySelector(`[data-error-for="${k}"]`); if (s) s.textContent = m; }); sb.disabled = false; sb.textContent = 'Add project'; return; }
      showToast(r.message, 'success');
    }
    form.reset(); tags.clear(); picker.reset(); sb.disabled = false; sb.textContent = 'Add project';
  });
})();
