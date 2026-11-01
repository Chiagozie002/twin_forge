/* Dashboard: stat cards (count-up) + recent projects/messages as clickable rows, with skeleton, empty and error states. */
(async () => {
  await cp.ready;
  const pBox = document.getElementById('recentProjects'), mBox = document.getElementById('recentMessages');
  const res = TF.DEMO_MODE
    ? { success: true, data: { active: DEMO_PROJECTS.length, trashed: 0, messages: DEMO_MESSAGES.length, recent_projects: DEMO_PROJECTS.slice(0, 5), recent_messages: DEMO_MESSAGES } }
    : await api.get('ajax/dashboard/stats.php');
  const empty = (icon, title, text, href, cta) => { const d = cp.el('div', 'dash-empty'), i = cp.el('i', `fa-solid ${icon}`); const a = cp.el('a', 'dash-link mt-2 d-inline-flex', cta); a.href = href; d.append(i, cp.el('div', 'fw-semibold', title), cp.el('p', 'small mb-2', text), a); return d; };
  if (!res.success) { for (const b of [pBox, mBox]) { const d = cp.el('div', 'dash-empty'), btn = cp.el('button', 'btn-wipe', 'Try again'); btn.onclick = () => location.reload(); d.append(cp.el('i', 'fa-solid fa-triangle-exclamation'), cp.el('p', 'small', res.message), btn); b.replaceChildren(d); } return; }
  const d = res.data;
  [['stActive', d.active], ['stTrashed', d.trashed], ['stMsgs', d.messages]].forEach(([id, v]) => { const n = document.getElementById(id); n.dataset.count = v; countUp(n); });

  /* A row = one link. build(): [leftNode, title, subtitle, rightNodes[]] */
  const row = (href, left, title, sub, right) => { const a = cp.el('a', 'dash-row'); a.href = href; const m = cp.el('div', 'dash-meta'); m.append(cp.el('div', 't', title), cp.el('div', 's', sub)); const s = cp.el('div', 'dash-side'); s.append(...right); a.append(left, m, s); return a; };
  const thumb = u => { const i = cp.el('img', 'dash-thumb'); if (u) { i.src = cp.img(u); i.loading = 'lazy'; } i.alt = ''; return i; };

  pBox.replaceChildren(...(d.recent_projects.length
    ? d.recent_projects.map(p => row('projects.html', thumb(p.image_url), p.name, p.short_description || p.category, [cp.el('span', 'cat-chip', p.category), cp.el('span', 'badge-st', 'Active')]))
    : [empty('fa-folder-plus', 'No projects yet', 'Add your first project to show it on the website.', 'add-project.html', 'Add a project')]));
  mBox.replaceChildren(...(d.recent_messages.length
    ? d.recent_messages.map(m => row('messages.html', cp.el('span', 'dash-av', m.name.charAt(0).toUpperCase()), m.subject, `${m.name} · ${m.email}`, [cp.el('span', 'dash-date', cp.date(m.created_at))]))
    : [empty('fa-inbox', 'No messages yet', 'Messages sent from your contact form will appear here.', '../contact.html', 'View contact page')]));
})();
