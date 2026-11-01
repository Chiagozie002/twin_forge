/* Password recovery: forgot-password -> verify-otp -> reset-password.
   Real mode talks to ajax/auth/{forgot-password,verify-otp,reset-password}.php. Demo mode (TF.DEMO_MODE) simulates the flow with the code 123456 and says so on screen.
   The email and the reset token live in sessionStorage only (never in the URL) and are removed when the flow finishes. */
TF.BASE = '../';
TF.navigate = TF.navigate || (u => { location.href = u; });
(() => {
  const KEY = { email: 'tf-recovery-email', token: 'tf-reset-token' }, DEMO_CODE = '123456';
  const store = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* storage blocked */ } }, del: k => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } } };
  const $ = id => document.getElementById(id), pause = ms => new Promise(r => setTimeout(r, ms));
  const label = (b, on, text) => { b.disabled = on; b.querySelector('.btn-label').textContent = text; };
  const note = t => { const n = $('demoNote'); if (TF.DEMO_MODE && n) { n.textContent = t; n.hidden = false; } };
  const csrf = async () => { if (!TF.DEMO_MODE) { const r = await api.get('ajax/auth/login.php'); if (r.success) TF.csrf = r.data.csrf; } };   // same token source as the login page

  /* ---------- STEP 1: email ---------- */
  function forgot() {
    const form = $('forgotForm'), btn = form.querySelector('[type=submit]'); csrf();
    note('Demo mode: no email is sent. On the next screen enter the code ' + DEMO_CODE + '.');
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (btn.disabled) return;
      const { ok, values } = validateForm(form, { email: [V.required('Email'), V.email, V.max(160, 'Email')] }); if (!ok) return;
      label(btn, true, 'Sending…');
      const r = TF.DEMO_MODE ? (await pause(700), { success: true }) : await api.post('ajax/auth/forgot-password.php', { email: values.email });
      if (r.success) { store.set(KEY.email, values.email); TF.navigate('verify-otp.html'); return; }   // the server answers the same whether or not the account exists
      showToast(r.message, 'warning'); label(btn, false, 'Send code'); csrf();
    });
  }

  /* ---------- STEP 2: 6-digit code ---------- */
  function verify() {
    const email = store.get(KEY.email); if (!email) { TF.navigate('forgot-password.html'); return; }
    const form = $('otpForm'), row = form.querySelector('.otp-row'), boxes = [...row.querySelectorAll('input')], btn = form.querySelector('[type=submit]'), err = form.querySelector('[data-error-for=otp]');
    $('maskedEmail').textContent = email.replace(/^(.{1,2}).*(@.*)$/, '$1•••$2'); csrf();
    note('Demo mode: no email was sent. Enter the code ' + DEMO_CODE + '.');
    const code = () => boxes.map(b => b.value).join('');

    // Code boxes: digits only, auto-advance, backspace goes back, paste fills all six, auto-submit on the sixth digit.
    boxes.forEach((b, i) => {
      b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); err.textContent = ''; if (b.value && i < 5) boxes[i + 1].focus(); if (code().length === 6) form.requestSubmit(); });
      b.addEventListener('keydown', e => { if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); } else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus(); else if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus(); });
      b.addEventListener('paste', e => { e.preventDefault(); const d = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6); [...d].forEach((c, k) => { boxes[k].value = c; }); boxes[Math.min(d.length, 5)].focus(); if (d.length === 6) form.requestSubmit(); });
    });
    const fail = msg => { err.textContent = msg; row.classList.add('shake'); setTimeout(() => row.classList.remove('shake'), 450); boxes.forEach(b => { b.value = ''; }); boxes[0].focus(); };

    form.addEventListener('submit', async e => {
      e.preventDefault(); if (btn.disabled) return;
      if (code().length < 6) { err.textContent = 'Enter all 6 digits.'; return; }
      label(btn, true, 'Verifying…');
      let r;
      if (TF.DEMO_MODE) { await pause(600); r = code() === DEMO_CODE ? { success: true, data: { reset_token: 'demo-token' } } : { success: false, message: 'That code is not correct.' }; }
      else r = await api.post('ajax/auth/verify-otp.php', { email, otp: code() });
      if (r.success && r.data.reset_token) { store.set(KEY.token, r.data.reset_token); store.del(KEY.email); TF.navigate('reset-password.html'); return; }
      label(btn, false, 'Verify code'); fail(r.message || 'That code is not correct.'); csrf();
    });

    // Resend with a 60s cooldown
    const rs = $('resend'), cd = $('cd'); let left = 0, timer;
    const tick = () => { if (left <= 0) { clearInterval(timer); rs.disabled = false; cd.textContent = ''; return; } cd.textContent = `(${left}s)`; left--; };
    const cooldown = () => { left = 60; rs.disabled = true; clearInterval(timer); tick(); timer = setInterval(tick, 1000); };
    cooldown();
    rs.addEventListener('click', async () => {
      if (rs.disabled) return; rs.disabled = true;
      const r = TF.DEMO_MODE ? { success: true } : await api.post('ajax/auth/forgot-password.php', { email });
      showToast(r.success ? 'A new code has been requested. Check your inbox.' : r.message, r.success ? 'info' : 'warning'); cooldown();
    });
  }

  /* ---------- STEP 3: new password ---------- */
  function reset() {
    const token = store.get(KEY.token); if (!token) { TF.navigate('forgot-password.html'); return; }
    const form = $('resetForm'), btn = form.querySelector('[type=submit]'), pw = form.elements.new_password, cf = form.elements.confirm_password; csrf();
    note('Demo mode: nothing is changed on any account.');
    $('pwToggle').addEventListener('click', e => { const show = pw.type === 'password'; pw.type = cf.type = show ? 'text' : 'password'; e.currentTarget.firstElementChild.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'; e.currentTarget.setAttribute('aria-label', show ? 'Hide passwords' : 'Show passwords'); });

    // Live strength meter + requirement checklist (the server enforces the same rules)
    const RULES = { len: v => v.length >= 10, letter: v => /[A-Za-z]/.test(v), num: v => /\d/.test(v) };
    const fill = $('meterFill'), word = $('meterLabel'), COLORS = ['#2c2650', '#ef4444', '#ef4444', '#f59e0b', '#22d3ee', '#22c55e'], WORDS = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const paint = () => {
      const v = pw.value; let met = 0;
      document.querySelectorAll('#rules li').forEach(li => { const ok = RULES[li.dataset.rule](v); li.classList.toggle('ok', ok); li.firstElementChild.className = ok ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle'; if (ok) met++; });
      const score = v ? Math.min(5, met + (v.length >= 14 ? 1 : 0) + (/[a-z]/.test(v) && /[A-Z]/.test(v) && /[^A-Za-z0-9]/.test(v) ? 1 : 0)) : 0;
      fill.style.width = score * 20 + '%'; fill.style.background = COLORS[score]; word.textContent = WORDS[score];
    };
    pw.addEventListener('input', paint);

    form.addEventListener('submit', async e => {
      e.preventDefault(); if (btn.disabled) return;
      const { ok } = validateForm(form, {
        new_password: [v => v.length >= 10 ? '' : 'Use at least 10 characters.', v => RULES.letter(v) && RULES.num(v) ? '' : 'Include letters and numbers.'],
        confirm_password: [v => v === pw.value ? '' : 'Passwords do not match.'] });
      if (!ok) return; label(btn, true, 'Updating…');
      const r = TF.DEMO_MODE ? (await pause(700), { success: true }) : await api.post('ajax/auth/reset-password.php', { token, new_password: pw.value, confirm_password: cf.value });
      if (!r.success) { showToast(r.message, 'warning'); Object.entries(r.errors || {}).forEach(([k, m]) => { const s = form.querySelector(`[data-error-for="${k}"]`); if (s) s.textContent = m; }); label(btn, false, 'Reset password'); csrf(); return; }
      store.del(KEY.token); form.hidden = true; $('stepsBox').hidden = true; $('doneBox').hidden = false;
      setTimeout(() => TF.navigate('login.html'), 2800);
    });
  }
  ({ forgot, verify, reset })[document.body.dataset.page]?.();
})();
