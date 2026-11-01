/* Messages: table, View modal, Delete (confirm), Delete All (separate, stronger confirm). All text via textContent (XSS-safe). */
(async () => {
  await cp.ready;
  const tbody = document.getElementById('msgRows'), delAllBtn = document.getElementById('delAllOpen');
  let local = DEMO_MESSAGES.map(m => ({ ...m })), current = null;                       // demo copy, memory only

  const fetchList = async () => TF.DEMO_MODE ? { success: true, data: { items: local } } : api.get('ajax/messages/list.php');
  const msgRow = nodes => { const tr = cp.el('tr'), td = cp.el('td', 'text-center py-5'); td.colSpan = 6; td.append(...nodes); tr.append(td); tbody.replaceChildren(tr); };
  const btn = (cls, icon, label, fn) => { const b = cp.el('button', `btn btn-sm ${cls}`); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label; b.append(cp.el('i', icon)); b.onclick = fn; return b; };

  async function load() {
    tbody.replaceChildren(...Array.from({ length: 4 }, () => { const tr = cp.el('tr'), td = cp.el('td'); td.colSpan = 6; td.append(cp.el('div', 'skel row-skel')); tr.append(td); return tr; }));
    const r = await fetchList();
    if (!r.success) { const b = cp.el('button', 'btn-wipe', 'Try again'); b.onclick = load; delAllBtn.disabled = true; msgRow([cp.el('p', 'text-muted-tf', r.message), b]); return; }
    const items = r.data.items; delAllBtn.disabled = !items.length;
    if (!items.length) { msgRow([cp.el('i', 'fa-regular fa-envelope-open fs-2 text-muted-tf mb-2 d-block'), cp.el('p', 'text-muted-tf mb-0', 'No messages yet.')]); return; }
    tbody.replaceChildren(...items.map(m => {
      const tr = cp.el('tr'), who = cp.el('td'), prev = cp.el('td', 'text-muted-tf small d-none d-lg-table-cell', m.message.replace(/\s+/g, ' ').slice(0, 70) + (m.message.length > 70 ? '…' : ''));
      who.append(cp.el('div', 'fw-semibold', m.name), cp.el('div', 'small text-muted-tf', m.email));
      const ac = cp.el('td', 'text-end text-nowrap'); ac.append(btn('btn-outline-primary me-1', 'fa-solid fa-eye', `View message from ${m.name}`, () => openView(m)), btn('btn-outline-danger', 'fa-solid fa-trash', `Delete message from ${m.name}`, () => { current = m; document.getElementById('msgDelWho').textContent = m.name; bootstrap.Modal.getOrCreateInstance(document.getElementById('msgDelModal')).show(); }));
      tr.append(who, cp.el('td', null, m.subject), cp.el('td', 'text-nowrap', cp.date(m.created_at)), prev, ac); return tr; }));
  }
  function openView(m) {
    const set = (id, v) => { document.getElementById(id).textContent = v; };
    set('vName', m.name); set('vEmail', m.email); set('vSubject', m.subject); set('vDate', cp.date(m.created_at)); set('vBody', m.message);
    const a = document.getElementById('vReply'); a.href = 'mailto:' + encodeURIComponent(m.email) + '?subject=' + encodeURIComponent('Re: ' + m.subject);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('viewModal')).show();
  }
  /* One confirm helper for both destructive actions: locks the button, calls the API (or the demo), reloads. */
  function confirmAction(btnId, modalId, label, live, demo) {
    document.getElementById(btnId).addEventListener('click', async e => {
      const b = e.currentTarget; if (b.disabled) return; b.disabled = true; b.textContent = 'Deleting…';
      if (TF.DEMO_MODE) { demo(); showToast('Demo mode: shown here only, nothing was saved.', 'info'); }
      else { const r = await live(); if (!r.success) { showToast(r.message, 'warning'); b.disabled = false; b.textContent = label; return; } showToast(r.message, 'success'); }
      bootstrap.Modal.getInstance(document.getElementById(modalId)).hide(); b.disabled = false; b.textContent = label; load();
    });
  }
  confirmAction('msgDelConfirm', 'msgDelModal', 'Delete', () => api.post('ajax/messages/delete.php', { id: current.id }), () => { local = local.filter(x => x !== current); });
  confirmAction('delAllConfirm', 'delAllModal', 'Delete all', () => api.post('ajax/messages/delete-all.php', { confirm: 'DELETE' }), () => { local = []; });
  delAllBtn.addEventListener('click', () => bootstrap.Modal.getOrCreateInstance(document.getElementById('delAllModal')).show());
  load();
})();
