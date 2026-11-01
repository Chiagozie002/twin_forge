/* Central API helper. Always resolves to {success, message, data, errors} - never throws. */
window.TF = {
  DEMO_MODE: true,   // true = projects come from demo-data.js. Set false once PHP + MySQL are live.
  BASE: ''           // prefix for ajax paths (use '../' from inside /cpanel pages)
};
const api = {
  async request(path, { method = 'GET', params, body } = {}) {
    let url = TF.BASE + path;
    if (params) url += '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null));
    const opts = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
    if (body instanceof FormData) opts.body = body;                       // file uploads
    else if (body) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    if (TF.csrf) opts.headers['X-CSRF-Token'] = TF.csrf;   // token issued by ajax/auth/login.php (GET)
    try {
      const res = await fetch(url, opts);
      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { return { success: false, message: `Server returned an invalid response (HTTP ${res.status}). Is the PHP backend running?`, data: {}, errors: {} }; }
      return { success: !!json.success && res.ok, message: json.message || (res.ok ? 'Done.' : 'Request failed.'), data: json.data || {}, errors: json.errors || {} };
    } catch { return { success: false, message: 'Network error. Check your connection or that the server is running.', data: {}, errors: {} }; }
  },
  get: (p, params) => api.request(p, { params }),
  post: (p, body) => api.request(p, { method: 'POST', body })
};
