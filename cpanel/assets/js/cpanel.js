/* Shared admin logic: auth guard, identity, active sidebar link, logout confirm, tag input, image preview, validation rules. */
TF.BASE = '../';                                   // ajax/ lives one level up from /cpanel
const cp = {
  el: (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; },
  date: s => { const d = new Date(String(s).replace(' ', 'T')); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); },
  img: u => u ? (/^(https?:|blob:|data:)/.test(u) ? u : TF.BASE + u) : '',
  /* Shared project-form rules (same checks the PHP re-runs on the server). */
  projectRules: () => ({ name: [V.required('Name'), V.min(2, 'Name'), V.max(120, 'Name')], category: [V.required('Category'), V.max(60, 'Category')],
    short_description: [V.required('Short description'), V.min(10, 'Short description'), V.max(240, 'Short description')],
    description: [V.required('Full description'), V.min(20, 'Full description'), V.max(4000, 'Full description')], live_url: [V.url], github_url: [V.url] }),

  /* Image chooser with instant preview. `required` is a boolean or a function (evaluated at submit time, so the edit form can require
     an image only when the project has none). Only the file TYPE is checked (no size limit). Returns {check, reset}. */
  imagePicker(input, preview, errBox, required) {
    const need = () => typeof required === 'function' ? required() : !!required, MSG = 'Please choose a project image.';
    input.addEventListener('change', () => {
      const f = input.files[0]; const msg = f ? V.image(f) : (need() ? MSG : '');
      errBox.textContent = msg; input.classList.toggle('is-invalid', !!msg);
      if (f && !msg) { preview.src = URL.createObjectURL(f); preview.hidden = false; } else { preview.hidden = true; if (msg) input.value = ''; }
    });
    return { check: () => { const f = input.files[0], m = f ? V.image(f) : (need() ? MSG : ''); errBox.textContent = m; input.classList.toggle('is-invalid', !!m); return !m; },
             reset: () => { input.value = ''; preview.hidden = true; errBox.textContent = ''; input.classList.remove('is-invalid'); } };
  },

  /* Removable technology pills. Enter/comma adds, Backspace removes last, duplicates and empties are ignored. */
  tags(box) {
    const list = box.querySelector('[data-tag-list]'), input = box.querySelector('[data-tag-input]'); let items = [];
    const draw = () => list.replaceChildren(...items.map(t => { const p = cp.el('span', 'tech-pill', t), b = cp.el('button', null, '×'); b.type = 'button'; b.setAttribute('aria-label', `Remove ${t}`); b.onclick = () => { items = items.filter(x => x !== t); draw(); }; p.append(b); return p; }));
    const add = raw => { const t = raw.trim().slice(0, 30); if (t && items.length < 15 && !items.some(x => x.toLowerCase() === t.toLowerCase())) { items.push(t); draw(); } input.value = ''; };
    input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input.value); } else if (e.key === 'Backspace' && !input.value && items.length) { items.pop(); draw(); } });
    input.addEventListener('blur', () => add(input.value));
    return { get: () => { add(input.value); return [...items]; }, set: a => { items = [...a]; draw(); }, clear: () => { items = []; input.value = ''; draw(); } };
  }
};

/* Paints the top-bar identity; profile.js calls it again after a save so the header updates without a reload. */
cp.setIdentity = u => {
  document.getElementById('uName').textContent = u.name; document.getElementById('uEmail').textContent = u.email;
  document.getElementById('uFirst').textContent = u.name.split(' ')[0]; document.getElementById('uRole').textContent = u.role_title || 'Co-Founder';
  const avatars = [document.getElementById('uInitial'), document.getElementById('uAvatarLg'), ...document.querySelectorAll('.js-avatar')].filter(Boolean);   // top bar, dropdown and mobile sidebar
  avatars.forEach(av => { if (u.picture_url) { av.textContent = ''; av.style.backgroundImage = `url("${cp.img(u.picture_url)}")`; } else { av.style.backgroundImage = ''; av.textContent = u.name.charAt(0).toUpperCase(); } });
  document.querySelectorAll('.js-name').forEach(n => { n.textContent = u.name; });
  document.querySelectorAll('.js-role').forEach(n => { n.textContent = u.role_title || 'Co-Founder'; });
};
cp.ready = (async () => {
  // 1. Sidebar active link comes from the URL, so it is right on direct loads too.
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.cp-side .cp-link[href]').forEach(a => { const on = a.getAttribute('href') === here; a.classList.toggle('active', on); if (on) a.setAttribute('aria-current', 'page'); });
  document.title = `${document.getElementById('pageTitle').textContent} - Twin Forge Admin`;

  // 2. Identity + auth guard. Live mode: no session -> back to login. Demo mode: sample identity and an honest banner.
  let user = { name: 'Demo Founder', email: 'demo@example.com', role_title: 'Co-Founder' };
  if (TF.DEMO_MODE) { const b = cp.el('div', 'alert alert-info', 'Demo mode: sample data only. Nothing here is saved. Set TF.DEMO_MODE = false in assets/js/api.js to use the live backend.'); b.setAttribute('role', 'status'); document.querySelector('.cp-content').prepend(b); }
  else { const r = await api.get('ajax/profile/get.php'); if (!r.success) { location.replace('login.html'); return new Promise(() => {}); } user = r.data.user; TF.csrf = r.data.csrf; }
  cp.user = user; cp.setIdentity(user);
})();

// 3. Logout: every entry point opens the confirm modal; nothing happens to the session until "Log Out" is pressed.
document.addEventListener('click', e => { if (e.target.closest('[data-logout]')) bootstrap.Modal.getOrCreateInstance(document.getElementById('logoutModal')).show(); });
document.getElementById('logoutConfirm').addEventListener('click', async e => {
  const b = e.currentTarget; if (b.disabled) return; b.disabled = true; b.textContent = 'Logging out…';
  if (TF.DEMO_MODE) { location.href = 'login.html'; return; }
  const r = await api.post('ajax/auth/logout.php');
  if (r.success) location.href = '../' + (r.data.redirect || 'cpanel/login.html'); else { showToast(r.message, 'warning'); b.disabled = false; b.textContent = 'Log Out'; }
});
