/* Login page: CSRF bootstrap, validation, show/hide password, AJAX login, safe redirect. */
TF.BASE = '../';   // this page lives in /cpanel, ajax/ is one level up
(() => {
  const form = document.getElementById('loginForm'), btn = form.querySelector('button[type=submit]');

  // 1. Fetch a CSRF token (stored in the PHP session) before any POST. Called again after failures.
  const getToken = async () => { const r = await api.get('ajax/auth/login.php'); if (r.success) TF.csrf = r.data.csrf; return r.success; };
  getToken();

  // 2. Password visibility toggle (keeps focus in the field).
  document.getElementById('pwToggle').addEventListener('click', e => {
    const f = form.elements.password, show = f.type === 'password'; f.type = show ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    e.currentTarget.firstElementChild.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'; f.focus();
  });

  // 3. Submit: validate, lock button, call the endpoint.
  const rules = { email: [V.required('Email'), V.email], password: [V.required('Password'), V.max(200, 'Password')] };
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (btn.disabled) return;
    const { ok, values } = validateForm(form, rules); if (!ok) return;
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'Signing in…';
    if (!TF.csrf) await getToken();
    const res = await api.post('ajax/auth/login.php', values);
    if (res.success) {
      document.getElementById('authOverlay').classList.add('show');
      // Only follow same-site relative paths from the server (blocks open-redirect tampering).
      const to = String(res.data.redirect || ''), safe = /^[\w\-./]+$/.test(to) && !to.startsWith('/') && !to.includes('..');
      setTimeout(() => { location.href = safe ? TF.BASE + to : 'index.html'; }, 1200);
      return;
    }
    showToast(res.message, 'warning'); form.elements.password.value = '';
    btn.disabled = false; btn.textContent = label; getToken();     // tokens are rotated on failure
  });
})();
