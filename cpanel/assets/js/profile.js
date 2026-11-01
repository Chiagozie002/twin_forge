/* My Profile: picture (preview first, explicit Save), details, password change. Passwords are never prefilled or stored. */
(async () => {
  await cp.ready;
  const user = cp.user, $ = id => document.getElementById(id);
  const lock = (b, on, label) => { b.disabled = on; b.textContent = label; };
  const showErrs = (form, errs) => Object.entries(errs || {}).forEach(([k, m]) => { const s = form.querySelector(`[data-error-for="${k}"]`); if (s) s.textContent = m; });

  /* ---- Picture: add / change / remove. Choosing a file only PREVIEWS it; nothing is saved until "Save Profile Picture". No size limit. ---- */
  const img = $('pfImg'), init = $('pfInit'), file = $('pfFile'), save = $('pfSave'), err = $('pfErr'), edit = $('pfEdit'), cancel = $('pfCancel'), rem = $('pfRemove'), note = $('pfNote');
  let pending = null;
  const sync = () => {                                                        // one place decides which buttons and which image are visible
    const has = !!user.picture_url;
    init.textContent = user.name.charAt(0).toUpperCase();
    if (pending) { img.src = URL.createObjectURL(pending); img.hidden = false; } else if (has) { img.src = cp.img(user.picture_url); img.hidden = false; } else { img.hidden = true; img.removeAttribute('src'); }
    $('pfEditLabel').textContent = has || pending ? 'Change picture' : 'Add picture';
    save.hidden = cancel.hidden = !pending; rem.hidden = !has || !!pending; save.disabled = false;
    note.textContent = pending ? 'Preview only. Not saved yet.' : (has ? '' : 'No picture yet.');
  };
  sync();
  edit.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const f = file.files[0]; if (!f) return; const m = V.image(f); err.textContent = m;
    if (m) { file.value = ''; return; } pending = f; sync();
  });
  cancel.addEventListener('click', () => { pending = null; file.value = ''; err.textContent = ''; sync(); });
  save.addEventListener('click', async () => {
    if (save.disabled) return; lock(save, true, 'Saving…');
    if (TF.DEMO_MODE) { user.picture_url = URL.createObjectURL(pending); cp.setIdentity(user); pending = null; showToast('Demo mode: shown on screen only, nothing was saved.', 'info'); lock(save, false, 'Save Profile Picture'); sync(); return; }
    const fd = new FormData(); fd.append('image', pending);
    const r = await api.post('ajax/profile/upload-picture.php', fd);
    if (!r.success) { showToast(r.message, 'warning'); err.textContent = r.errors.image || ''; lock(save, false, 'Save Profile Picture'); return; }
    user.picture_url = r.data.picture_url; cp.setIdentity(user); pending = null; file.value = ''; showToast(r.message, 'success'); lock(save, false, 'Save Profile Picture'); sync();
  });
  rem.addEventListener('click', () => bootstrap.Modal.getOrCreateInstance($('removeModal')).show());
  $('removeConfirm').addEventListener('click', async e => {
    const b = e.currentTarget; if (b.disabled) return; lock(b, true, 'Removing…');
    if (TF.DEMO_MODE) showToast('Demo mode: removed on screen only, nothing was saved.', 'info');
    else { const r = await api.post('ajax/profile/remove-picture.php'); if (!r.success) { showToast(r.message, 'warning'); lock(b, false, 'Remove'); return; } showToast(r.message, 'success'); }
    user.picture_url = null; cp.setIdentity(user); bootstrap.Modal.getInstance($('removeModal'))?.hide(); lock(b, false, 'Remove'); sync();
  });

  /* ---- Details ---- */
  const df = $('detailsForm'); for (const k of ['name', 'email', 'role_title']) df.elements[k].value = user[k] || '';
  df.addEventListener('submit', async e => {
    e.preventDefault(); const b = df.querySelector('[type=submit]'); if (b.disabled) return;
    const { ok, values } = validateForm(df, { name: [V.required('Name'), V.min(2, 'Name'), V.max(120, 'Name')], email: [V.required('Email'), V.email, V.max(160, 'Email')], role_title: [V.required('Role'), V.min(2, 'Role'), V.max(80, 'Role')] });
    if (!ok) return; lock(b, true, 'Saving…');
    if (TF.DEMO_MODE) { Object.assign(user, values); cp.setIdentity(user); showToast('Demo mode: updated on screen only, nothing was saved.', 'info'); lock(b, false, 'Save details'); return; }
    const r = await api.post('ajax/profile/update.php', values);
    if (r.success) { Object.assign(user, r.data.user); cp.setIdentity(user); showToast(r.message, 'success'); } else { showToast(r.message, 'warning'); showErrs(df, r.errors); }
    lock(b, false, 'Save details');
  });

  /* ---- Password ---- */
  const pf = $('passwordForm'), pw = n => pf.elements[n].value;
  $('showPw').addEventListener('change', e => ['current_password', 'new_password', 'confirm_password'].forEach(n => { pf.elements[n].type = e.target.checked ? 'text' : 'password'; }));
  pf.addEventListener('submit', async e => {
    e.preventDefault(); const b = pf.querySelector('[type=submit]'); if (b.disabled) return;
    const { ok } = validateForm(pf, {
      current_password: [v => v ? '' : 'Enter your current password.'],
      new_password: [v => v.length >= 10 ? '' : 'Use at least 10 characters.', v => /[A-Za-z]/.test(v) && /\d/.test(v) ? '' : 'Include letters and numbers.', v => v !== pw('current_password') ? '' : 'Choose a different password.'],
      confirm_password: [v => v === pw('new_password') ? '' : 'Passwords do not match.'] });
    if (!ok) return; lock(b, true, 'Updating…');
    if (TF.DEMO_MODE) { showToast('Demo mode: no password exists to change.', 'info'); pf.reset(); lock(b, false, 'Change password'); return; }
    const r = await api.post('ajax/profile/change-password.php', { current_password: pw('current_password'), new_password: pw('new_password'), confirm_password: pw('confirm_password') });
    if (r.success) { showToast(r.message, 'success'); pf.reset(); } else { showToast(r.message, 'warning'); showErrs(pf, r.errors); }
    lock(b, false, 'Change password');
  });
})();
