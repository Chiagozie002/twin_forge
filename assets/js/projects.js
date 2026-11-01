/* Public portfolio: dynamic category filters, 6-per-page pagination, skeletons, one reusable modal. */
(() => {
  const PER_PAGE = 6, state = { cat: 'all', page: 1, categories: [] };
  const grid = document.getElementById('projectGrid'), filters = document.getElementById('projectFilters'), pager = document.getElementById('projectPager');
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const icon = (cls, label) => { const f = document.createDocumentFragment(), i = el('i', cls); i.setAttribute('aria-hidden', 'true'); f.append(i, ' ' + label); return f; };

  /* ---- DATA: demo mode filters/paginates locally; live mode follows the ajax/projects/list.php contract ---- */
  async function fetchProjects() {
    if (TF.DEMO_MODE) {
      const list = state.cat === 'all' ? DEMO_PROJECTS : DEMO_PROJECTS.filter(p => p.category === state.cat);
      const total_pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
      return { success: true, data: { items: list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE), page: state.page, per_page: PER_PAGE, total: list.length, total_pages, categories: [...new Set(DEMO_PROJECTS.map(p => p.category))].sort() } };
    }
    return api.get('ajax/projects/list.php', { cat: state.cat === 'all' ? '' : state.cat, page: state.page, per_page: PER_PAGE });
  }

  /* ---- RENDER (safe DOM APIs only, never innerHTML with data) ---- */
  function skeletons() { grid.replaceChildren(...Array.from({ length: 3 }, () => { const c = el('div', 'col-md-6 col-lg-4'); c.append(el('div', 'skel')); return c; })); }
  /* Styled action buttons. '#' = placeholder link (does nothing yet); empty = disabled; real URL opens in a new tab. */
  function actionBtn(url, ic, label, kind) {
    const a = el('a', `pbtn pbtn-${kind}`); a.append(icon(ic, label));
    if (!url) { a.setAttribute('aria-disabled', 'true'); a.title = `${label} is not available yet`; return a; }
    a.href = url;
    if (url === '#') a.addEventListener('click', e => e.preventDefault());       // placeholder: do not jump to the top of the page
    else { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    return a;
  }
  const actions = p => [actionBtn(p.live_url, 'fa-solid fa-arrow-up-right-from-square', 'Live Demo', 'live'), actionBtn(p.github_url, 'fa-brands fa-github', 'GitHub', 'git')];

  /* Card: ONLY the image opens the details modal (it is a real button, so keyboard and screen readers work too). */
  function card(p) {
    const col = el('div', 'col-md-6 col-lg-4'), art = el('article', 'pcard');
    const img = el('button', 'pimg'); img.type = 'button'; img.setAttribute('aria-label', `View details for ${p.name}`);
    if (p.image_url) { const i = el('img'); i.src = p.image_url; i.alt = ''; i.loading = 'lazy'; img.append(i); } else img.append(el('i', 'fa-solid fa-layer-group'));
    const over = el('span', 'pimg-over'); over.append(Object.assign(el('span'), {})); over.firstChild.append(icon('fa-solid fa-eye', 'View details')); img.append(over, el('span', 'cat-pill', p.category));
    img.addEventListener('click', () => openModal(p));
    const body = el('div', 'p-3 d-flex flex-column gap-2 flex-grow-1'), acts = el('div', 'd-flex flex-wrap gap-2 mt-auto pt-2');
    acts.append(...actions(p)); body.append(el('h3', 'h5 mb-0', p.name), el('p', 'text-muted-tf small mb-0', p.short_description), acts);
    art.append(img, body); col.append(art); return col;
  }
  function renderFilters() {
    filters.replaceChildren(...['all', ...state.categories].map(c => {
      const b = el('button', 'filter-btn' + (c === state.cat ? ' active' : ''), c === 'all' ? 'All' : c); b.type = 'button';
      b.onclick = () => { state.cat = c; state.page = 1; load(); }; return b; }));   // changing category resets to page 1
  }
  function renderPager(d) {
    pager.replaceChildren(); if (d.total_pages <= 1) return;
    const mk = (t, to, off) => { const b = el('button', 'filter-btn', t); b.type = 'button'; b.disabled = off; b.onclick = () => { state.page = to; load(true); }; return b; };
    pager.append(mk('← Prev', d.page - 1, d.page <= 1), el('span', 'align-self-center text-muted-tf', `Page ${d.page} of ${d.total_pages}`), mk('Next →', d.page + 1, d.page >= d.total_pages));
  }
  async function load(scroll) {
    skeletons(); const res = await fetchProjects();
    if (!res.success) {                                                   // recoverable error state
      const r = el('div', 'col-12 text-center py-5'), b = el('button', 'btn-wipe', 'Try again'); b.type = 'button'; b.onclick = () => load();
      r.append(el('p', 'text-muted-tf', res.message), b); grid.replaceChildren(r); return; }
    const d = res.data; state.categories = d.categories || []; renderFilters(); renderPager(d);
    grid.replaceChildren(...(d.items.length ? d.items.map(card) : [el('p', 'col-12 text-center text-muted-tf py-5', 'No projects in this category yet.')]));
    if (scroll) document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
  }

  /* ---- MODAL: one reusable Bootstrap modal ---- */
  function openModal(p) {
    const m = document.getElementById('projectModal'), set = (id, v) => { m.querySelector(id).textContent = v; };
    set('#pmTitle', p.name); set('#pmCat', p.category); set('#pmDesc', p.description);
    m.querySelector('#pmTech').replaceChildren(...(p.technologies || []).map(t => el('span', 'tech-pill', t)));
    m.querySelector('#pmActions').replaceChildren(...actions(p));
    const im = m.querySelector('#pmImg'), ph = m.querySelector('#pmIcon');          // show the project image in the modal too
    if (p.image_url) { im.src = p.image_url; im.alt = `${p.name} preview`; im.hidden = false; ph.hidden = true; } else { im.hidden = true; ph.hidden = false; }
    bootstrap.Modal.getOrCreateInstance(m).show();
  }
  document.addEventListener('DOMContentLoaded', () => load());
})();
