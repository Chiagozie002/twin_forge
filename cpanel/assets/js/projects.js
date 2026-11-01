/* Admin projects: search + category filter + pagination, edit modal (prefilled), soft-delete confirm. */
(async () => {
  await cp.ready;
  const PER = 8, S = { q: '', cat: '', page: 1 };
  const tbody = document.getElementById('projRows'), pager = document.getElementById('projPager'), catSel = document.getElementById('catFilter');
  const editEl = document.getElementById('editModal'), delEl = document.getElementById('deleteModal'), form = document.getElementById('editForm');
  const tags = cp.tags(form.querySelector('.tag-box')), picker = cp.imagePicker(form.elements.image, document.getElementById('editPreview'), form.querySelector('[data-error-for=image]'), () => !current?.image_url);   // optional while the project already has a picture
  let local = DEMO_PROJECTS.map(p => ({ ...p, status: 'active' })), current = null;   // local = in-memory demo copy only

  /* DATA: demo = local array; live = ajax/projects/list.php?scope=admin */
  async function fetchList() {
    if (TF.DEMO_MODE) {
      let l = local.filter(p => p.status === 'active');
      if (S.q) l = l.filter(p => (p.name + ' ' + p.category).toLowerCase().includes(S.q.toLowerCase()));
      if (S.cat) l = l.filter(p => p.category === S.cat);
      const tp = Math.max(1, Math.ceil(l.length / PER)); S.page = Math.min(S.page, tp);
      return { success: true, data: { items: l.slice((S.page - 1) * PER, S.page * PER), page: S.page, total: l.length, total_pages: tp, categories: [...new Set(local.map(p => p.category))].sort() } };
    }
    return api.get('ajax/projects/list.php', { scope: 'admin', status: 'active', q: S.q, cat: S.cat, page: S.page, per_page: PER });
  }

  /* RENDER */
  const btn = (cls, icon, label, fn) => { const b = cp.el('button', `btn btn-sm ${cls}`); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.append(Object.assign(cp.el('i', icon), {})); b.onclick = fn; return b; };
  function renderRows(items) {
    if (!items.length) { const tr = cp.el('tr'), td = cp.el('td', 'text-center text-muted-tf py-5', 'No projects match your search.'); td.colSpan = 5; tr.append(td); tbody.replaceChildren(tr); return; }
    tbody.replaceChildren(...items.map(p => {
      const tr = cp.el('tr'), th = cp.el('td'), im = cp.el('img', 'thumb'); if (p.image_url) { im.src = cp.img(p.image_url); im.loading = 'lazy'; } im.alt = ''; th.append(im);
      const nm = cp.el('td'); nm.append(cp.el('div', 'fw-semibold', p.name), cp.el('div', 'small text-muted-tf', p.short_description));
      const st = cp.el('td'); st.append(cp.el('span', 'badge-st', 'Active'));
      const ac = cp.el('td', 'text-end text-nowrap'); ac.append(btn('btn-outline-primary me-1', 'fa-solid fa-pen', `Edit ${p.name}`, () => openEdit(p)), btn('btn-outline-danger', 'fa-solid fa-trash', `Delete ${p.name}`, () => openDelete(p)));
      tr.append(th, nm, cp.el('td', null, p.category), st, ac); return tr; }));
  }
  function renderPager(d) {
    pager.replaceChildren(); if (d.total_pages <= 1) return;
    const mk = (t, to, off) => { const b = cp.el('button', 'filter-btn', t); b.type = 'button'; b.disabled = off; b.onclick = () => { S.page = to; load(); }; return b; };
    pager.append(mk('← Prev', d.page - 1, d.page <= 1), cp.el('span', 'align-self-center text-muted-tf small', `Page ${d.page} of ${d.total_pages}`), mk('Next →', d.page + 1, d.page >= d.total_pages));
  }
  async function load() {
    tbody.replaceChildren(...Array.from({ length: 4 }, () => { const tr = cp.el('tr'), td = cp.el('td'); td.colSpan = 5; td.append(cp.el('div', 'skel row-skel')); tr.append(td); return tr; }));
    const r = await fetchList();
    if (!r.success) { const tr = cp.el('tr'), td = cp.el('td', 'text-center py-5'); td.colSpan = 5; const b = cp.el('button', 'btn-wipe', 'Try again'); b.onclick = load; td.append(cp.el('p', 'text-muted-tf', r.message), b); tr.append(td); tbody.replaceChildren(tr); return; }
    const cats = r.data.categories || []; if (catSel.options.length - 1 !== cats.length) catSel.replaceChildren(new Option('All categories', ''), ...cats.map(c => new Option(c, c))); catSel.value = S.cat;
    document.getElementById('catList').replaceChildren(...cats.map(c => new Option(c)));
    renderRows(r.data.items); renderPager(r.data);
  }
  let t; document.getElementById('projSearch').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value.trim(); S.page = 1; load(); }, 300); });
  catSel.addEventListener('change', () => { S.cat = catSel.value; S.page = 1; load(); });

  /* EDIT: prefilled modal, validated, FormData to update.php */
  function openEdit(p) {
    current = p; form.reset(); picker.reset(); form.querySelectorAll('.field-error').forEach(e => e.textContent = ''); form.querySelectorAll('.is-invalid').forEach(e => e.classList.remove('is-invalid'));
    for (const k of ['name', 'category', 'short_description', 'description', 'live_url', 'github_url']) form.elements[k].value = (p[k] && p[k] !== '#') ? p[k] : '';
    tags.set(p.technologies || []); const pv = document.getElementById('editPreview'); if (p.image_url) { pv.src = cp.img(p.image_url); pv.hidden = false; } else pv.hidden = true;
    bootstrap.Modal.getOrCreateInstance(editEl).show();
  }
  form.addEventListener('submit', async e => {
    e.preventDefault(); const sb = form.querySelector('[type=submit]'); if (sb.disabled) return;
    const { ok, values } = validateForm(form, cp.projectRules()); const techs = tags.get(), tOk = techs.length > 0;
    form.querySelector('[data-error-for=technologies]').textContent = tOk ? '' : 'Add at least one technology.';
    const pOk = picker.check();
    if (!ok || !tOk || !pOk) return;
    sb.disabled = true; sb.textContent = 'Saving…';
    if (TF.DEMO_MODE) { Object.assign(current, values, { technologies: techs }); if (form.elements.image.files[0]) current.image_url = URL.createObjectURL(form.elements.image.files[0]); showToast('Demo mode: the change is shown here only and was NOT saved.', 'info'); }
    else {
      const fd = new FormData(); fd.append('id', current.id); Object.entries(values).forEach(([k, v]) => fd.append(k, v)); fd.append('technologies', JSON.stringify(techs));
      if (form.elements.image.files[0]) fd.append('image', form.elements.image.files[0]);
      const r = await api.post('ajax/projects/update.php', fd);
      if (!r.success) { showToast(r.message, 'warning'); Object.entries(r.errors).forEach(([k, m]) => { const s = form.querySelector(`[data-error-for="${k}"]`); if (s) s.textContent = m; }); sb.disabled = false; sb.textContent = 'Save changes'; return; }
      showToast(r.message, 'success');
    }
    bootstrap.Modal.getInstance(editEl).hide(); sb.disabled = false; sb.textContent = 'Save changes'; load();
  });

  /* DELETE: confirm first; soft delete (moves to Trash) */
  function openDelete(p) { current = p; document.getElementById('delName').textContent = p.name; bootstrap.Modal.getOrCreateInstance(delEl).show(); }
  document.getElementById('delConfirm').addEventListener('click', async e => {
    const b = e.currentTarget; if (b.disabled) return; b.disabled = true; b.textContent = 'Deleting…';
    if (TF.DEMO_MODE) { current.status = 'trashed'; showToast('Demo mode: removed from this list only, nothing was saved.', 'info'); }
    else { const r = await api.post('ajax/projects/delete.php', { id: current.id }); if (!r.success) { showToast(r.message, 'warning'); b.disabled = false; b.textContent = 'Move to Trash'; return; } showToast(r.message, 'success'); }
    bootstrap.Modal.getInstance(delEl).hide(); b.disabled = false; b.textContent = 'Move to Trash'; load();
  });
  load();
})();
