/* Reusable validation. rules = { field: [(value) => 'error message' | '' , ...] } */
const V = {
  required: label => v => v.trim() ? '' : `${label} is required.`,
  min: (n, label) => v => v.trim().length >= n ? '' : `${label} must be at least ${n} characters.`,
  max: (n, label) => v => v.trim().length <= n ? '' : `${label} must be at most ${n} characters.`,
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address.',
  url: v => { if (!v.trim()) return ''; try { return ['http:', 'https:'].includes(new URL(v).protocol) ? '' : 'Use an http(s) URL.'; } catch { return 'Enter a valid URL.'; } },
  image: file => !file ? 'Please choose an image.' : !/^image\/(jpeg|png|webp|gif)$/.test(file.type) ? 'Please choose an image file (JPG, PNG, WebP or GIF).' : ''   // type only, NO size limit
};
/* Runs rules against a <form>, paints inline errors, returns {ok, values}. */
function validateForm(form, rules) {
  const values = {}; let ok = true, first = null;
  for (const [name, checks] of Object.entries(rules)) {
    const input = form.elements[name]; values[name] = input.value.trim();
    const msg = checks.map(c => c(input.value)).find(Boolean) || '';
    input.classList.toggle('is-invalid', !!msg); input.setAttribute('aria-invalid', String(!!msg));
    form.querySelector(`[data-error-for="${name}"]`).textContent = msg;
    if (msg) { ok = false; first = first || input; }
  }
  if (first) first.focus();
  return { ok, values };
}
