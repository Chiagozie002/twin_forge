/* Trash: list soft-deleted projects, Restore (confirm) and Delete forever (separate, stronger confirm). */
(async () => {
  await cp.ready;
  const PER = 8, S = { page: 1 }, tbody = document.getElementById('trashRows'), pager = document.getElementById('trashPager');
  let local = DEMO_PROJECTS.slice(-2).map(p => ({ ...p, status: 'trashed' })), current = null;     // demo copy, memory only

  async function fetchList() {
    if (TF.DEMO_MODE) { const l = local.filter(p => p.status === 'trashed'), tp = Math.max(1, Math.ceil(l.length / PER)); S.page = Math.min(S.page, tp);
      return { success: true, data: { items: l.slice((S.page - 1) * PER, S.page * PER), page: S.page, total_pages: tp } }; }
    return api.get('ajax/projects/list.php', { scope: 'admin', status: 'trashed', page: S.page, per_page: PER });
  }
  const btn = (cls, icon, label, fn) => { const b = cp.el('button', `btn btn-sm ${cls}`); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.append(cp.el('i', icon)); b.onclick = fn; return b; };
  const msgRow = (node) => { const tr = cp.el('tr'), td = cp.el('td', 'text-center py-5'); td.colSpan = 4; td.append(...node); tr.append(td); tbody.replaceChildren(tr); };
  async function load() {
    tbody.replaceChildren(...Array.from({ length: 3 }, () => { const tr = cp.el('tr'), td = cp.el('td'); td.colSpan = 4; td.append(cp.el('div', 'skel row-skel')); tr.append(td); return tr; }));
    const r = await fetchList();
    if (!r.success) { const b = cp.el('button', 'btn-wipe', 'Try again'); b.onclick = load; msgRow([cp.el('p', 'text-muted-tf', r.message), b]); return; }
    const items = r.data.items; pager.replaceChildren();
    if (!items.length) { msgRow([cp.el('i', 'fa-regular fa-trash-can fs-2 text-muted-tf mb-2 d-block'), cp.el('p', 'text-muted-tf mb-0', 'Trash is empty.')]); return; }
    tbody.replaceChildren(...items.map(p => {
      const tr = cp.el('tr'), th = cp.el('td'), im = cp.el('img', 'thumb'); if (p.image_url) { im.src = cp.img(p.image_url); im.loading = 'lazy'; } im.alt = ''; th.append(im);
      const nm = cp.el('td'); nm.append(cp.el('div', 'fw-semibold', p.name), cp.el('div', 'small text-muted-tf', p.short_description));
      const ac = cp.el('td', 'text-end text-nowrap');
      ac.append(btn('btn-outline-success me-1', 'fa-solid fa-rotate-left', `Restore ${p.name}`, () => ask('restore', p)), btn('btn-outline-danger', 'fa-solid fa-ban', `Delete ${p.name} forever`, () => ask('perm', p)));
      tr.append(th, nm, cp.el('td', null, p.category), ac); return tr; }));
    if (r.data.total_pages > 1) { const mk = (t, to, off) => { const b = cp.el('button', 'filter-btn', t); b.type = 'button'; b.disabled = off; b.onclick = () => { S.page = to; load(); }; return b; };
      pager.append(mk('← Prev', S.page - 1, S.page <= 1), cp.el('span', 'align-self-center text-muted-tf small', `Page ${r.data.page} of ${r.data.total_pages}`), mk('Next →', S.page + 1, S.page >= r.data.total_pages)); }
  }
  const M = { restore: { el: 'restoreModal', name: 'restoreName', btn: 'restoreConfirm', url: 'ajax/projects/restore.php', label: 'Restore', demo: p => { p.status = 'active'; } },
              perm: { el: 'permModal', name: 'permName', btn: 'permConfirm', url: 'ajax/projects/permanent-delete.php', label: 'Delete forever', demo: p => { local = local.filter(x => x !== p); } } };
  function ask(kind, p) { current = p; document.getElementById(M[kind].name).textContent = p.name; bootstrap.Modal.getOrCreateInstance(document.getElementById(M[kind].el)).show(); }
  for (const [kind, m] of Object.entries(M)) document.getElementById(m.btn).addEventListener('click', async e => {
    const b = e.currentTarget; if (b.disabled) return; b.disabled = true; b.textContent = 'Working…';
    if (TF.DEMO_MODE) { m.demo(current); showToast('Demo mode: shown here only, nothing was saved.', 'info'); }
    else { const r = await api.post(m.url, { id: current.id }); if (!r.success) { showToast(r.message, 'warning'); b.disabled = false; b.textContent = m.label; return; } showToast(r.message, 'success'); }
    bootstrap.Modal.getInstance(document.getElementById(m.el)).hide(); b.disabled = false; b.textContent = m.label; load();
  });
  load();
})();
