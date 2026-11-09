"""Contact-form backend tests: validation, spam guards, database row, and the EMAIL that really arrives (PHP mail() via a capturing fake sendmail,
and the built-in SMTP sender against a local SMTP server: plain+AUTH, STARTTLS, SSL). Needs php on PATH; SMTP tests need `pip install aiosmtpd` and openssl.
Uses throw-away SQLite copies of the project, so your MySQL data is never touched.   Run:  python3 tests/contact_test.py"""
import logging, warnings, json, os, re, shutil, socket, sqlite3, ssl, subprocess, sys, tempfile, time, urllib.request, urllib.error, email, email.policy
SRC = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); ROOT = tempfile.mkdtemp(prefix='tf-contact-')
SCHEMA = "CREATE TABLE messages(id INTEGER PRIMARY KEY AUTOINCREMENT,name,email,subject,message,is_read INT DEFAULT 0,created_at TEXT,ip_hash TEXT);"
warnings.filterwarnings('ignore'); logging.getLogger('mail.log').setLevel(logging.CRITICAL)
fails = []; n = 0; procs = []
def chk(name, cond, detail=''):
    global n; n += 1
    if not cond: fails.append(f'{name} {detail}'[:230])
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
def setc(src, name, val):                       # change one `const NAME = ...;` in config.php
    new, k = re.subn(r"const %s(\s*)=\s*[^;]*;" % name, lambda m: f"const {name}{m.group(1)}= {val};", src, count=1); assert k, name; return new
class Site:
    def __init__(s, name, consts=None, db_ok=True, sendmail=None):
        s.dir = f'{ROOT}/{name}'; shutil.copytree(SRC, s.dir, ignore=shutil.ignore_patterns('tests', 'node_modules', '.git')); s.db = f'{ROOT}/{name}.db'; s.mail = f'{ROOT}/{name}-mail'; os.makedirs(s.mail)
        cfg = s.dir + '/ajax/config.php'; c = open(cfg).read()
        c = c.replace('mysql:host=localhost;dbname=twin_forge;charset=utf8mb4', 'sqlite:' + (s.db if db_ok else '/nonexistent-folder/x.db'))
        for k, v in (consts or {}).items(): c = setc(c, k, v)
        open(cfg, 'w').write(c); sqlite3.connect(s.db).executescript(SCHEMA)
        cap = f'{ROOT}/{name}-capture.sh'; open(cap, 'w').write(f'#!/bin/sh\ncat > "{s.mail}/$(date +%s%N).eml"\n'); os.chmod(cap, 0o755)
        s.port = free_port(); s.p = subprocess.Popen(['php', '-d', f'sendmail_path={sendmail or cap}', '-S', f'127.0.0.1:{s.port}', '-t', s.dir], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); procs.append(s.p)
        for _ in range(40):
            try: socket.create_connection(('127.0.0.1', s.port), 0.2).close(); break
            except OSError: time.sleep(0.1)
    def post(s, data, method='POST'):                       # every call = a new visitor (no cookies)
        r = urllib.request.Request(f'http://127.0.0.1:{s.port}/ajax/messages/submit.php', data=json.dumps(data).encode() if method == 'POST' else None, headers={'Content-Type': 'application/json'}, method=method)
        try: x = urllib.request.urlopen(r); st, t = x.status, x.read().decode()
        except urllib.error.HTTPError as e: st, t = e.code, e.read().decode()
        try: return st, json.loads(t), t
        except Exception: return st, {}, t
    def rows(s): c = sqlite3.connect(s.db); c.row_factory = sqlite3.Row; r = [dict(x) for x in c.execute('SELECT * FROM messages ORDER BY id')]; c.close(); return r
    def mails(s, want=1, wait=3.0):
        t = time.time()
        while time.time() - t < wait:
            f = sorted(os.listdir(s.mail))
            if len(f) >= want: break
            time.sleep(0.1)
        return [email.message_from_bytes(open(f'{s.mail}/{x}', 'rb').read(), policy=email.policy.default) for x in sorted(os.listdir(s.mail))]
GOOD = {'name': 'Ann Lee', 'email': 'ann@example.com', 'subject': 'Hello there', 'message': 'This is a long enough message.'}
def body(m): return m.get_body(preferencelist=('plain',)).get_content()

# ================= 1. PHP mail(): what really arrives =================
A = Site('mail', {'MAIL_TO': "'inbox@mysite.test'", 'MAIL_FROM': "'noreply@mysite.test'"})
st, j, _ = A.post(GOOD); chk('valid message accepted (201)', st == 201 and j.get('success')); r = A.rows()
chk('saved to the database', len(r) == 1 and r[0]['name'] == 'Ann Lee' and r[0]['email'] == 'ann@example.com' and r[0]['message'] == GOOD['message'], str(r)[:100])
chk('created_at is a real date-time', bool(re.match(r'\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$', r[0]['created_at'] or '')))
chk('only a hash of the IP is stored', len(r[0]['ip_hash'] or '') == 64 and '127.0.0.1' not in (r[0]['ip_hash'] or ''))
m = A.mails(1); chk('an email was sent', len(m) == 1)
if m:
    m = m[0]; chk('To = MAIL_TO', 'inbox@mysite.test' in str(m['To']), str(m['To'])); chk('From = MAIL_FROM', m['From'].addresses[0].addr_spec == 'noreply@mysite.test', str(m['From']))
    chk('Reply-To = the visitor (press Reply to answer)', m['Reply-To'].addresses[0].addr_spec == 'ann@example.com' and m['Reply-To'].addresses[0].display_name == 'Ann Lee', str(m['Reply-To']))
    chk('subject has the site prefix', str(m['Subject']) == '[Twin Forge] Hello there', str(m['Subject'])); chk('charset is UTF-8', m.get_content_charset() == 'utf-8')
    b = body(m); chk('body contains name, email, subject and message', all(x in b for x in ['Ann Lee', 'ann@example.com', 'Hello there', GOOD['message']]), b[:120])
# unicode: names, currency symbol, emoji, line breaks
U = {'name': 'Chiagozie Ọkafọr', 'email': 'chi@example.com', 'subject': 'Café ₦500 — pricing 🚀', 'message': 'Hello 👋 Nnọọ!\nI need a site for ₦250,000.\n\nLine three: 你好 مرحبا.'}
A2 = Site('mail-unicode', {'MAIL_TO': "'inbox@mysite.test'"}); st, j, _ = A2.post(U); chk('unicode message accepted', st == 201, str(j))
chk('unicode stored exactly', A2.rows() and A2.rows()[0]['message'] == U['message'] and A2.rows()[0]['name'] == U['name'])
m = A2.mails(1)
if m:
    m = m[0]; chk('unicode subject decodes exactly', str(m['Subject']) == '[Twin Forge] ' + U['subject'], str(m['Subject'])); chk('unicode name in Reply-To', m['Reply-To'].addresses[0].display_name == U['name'], str(m['Reply-To']))
    chk('unicode body decodes exactly', U['message'] in body(m).replace('\r\n', '\n'), body(m)[:200])
else: chk('unicode email sent', False)
# header injection must never create hidden recipients
I = Site('mail-inject', {'MAIL_TO': "'inbox@mysite.test'"}); st, j, _ = I.post({'name': 'Ann\r\nBcc: evil1@x.com', 'email': 'ann@example.com', 'subject': 'Hi\r\nBcc: evil2@x.com\r\nX-Evil: 1', 'message': 'A long enough message body here.'})
chk('injection attempt: still handled (201)', st == 201); mm = I.mails(1)
if mm: hk = [k.lower() for k in mm[0].keys()]; chk('no Bcc / injected header exists (the text stays harmlessly inside the subject line)', 'bcc' not in hk and 'x-evil' not in hk and mm[0]['Bcc'] is None, str(hk))
else: chk('injection email sent', False)
st, j, _ = I.post({**GOOD, 'email': 'ann@example.com\r\nBcc: evil@x.com'}); chk('CRLF inside the email field is rejected (422)', st == 422)
# validation + other guards
st, j, _ = A.post({'name': 'A', 'email': 'bad', 'subject': 'x', 'message': 'short'}); chk('invalid input -> 422 with all 4 field errors', st == 422 and set(j['errors']) == {'name', 'email', 'subject', 'message'})
chk('message over 4000 chars -> 422', A.post({**GOOD, 'message': 'x' * 4001})[0] == 422); chk('message of exactly 4000 chars accepted', A.post({**GOOD, 'message': 'y' * 4000})[0] == 201)
chk('GET is refused (405)', A.post({}, method='GET')[0] == 405)
before = len(A.rows()); st, j, _ = A.post({**GOOD, 'website': 'http://spam.example'}); chk('honeypot: fake success, nothing saved or emailed', st == 200 and len(A.rows()) == before)
X = '<script>alert(1)</script> & "quotes" \' ; DROP TABLE messages;--'; st, j, _ = A.post({**GOOD, 'message': X}); chk('script/SQL text is stored as plain text', st == 201 and any(x['message'] == X for x in A.rows()))
st, j, t = A.post({**GOOD, 'name': 'Bob'}); chk('response is clean JSON with the contract keys', set(j) >= {'success', 'message', 'data', 'errors'})

# ================= 2. Email failure must not lose the message =================
F = Site('mail-fails', {'MAIL_TO': "'inbox@mysite.test'"}, sendmail='/bin/false'); st, j, _ = F.post(GOOD)
chk('mail system broken: visitor still gets success', st == 201 and j.get('success')); chk('mail system broken: message is still saved', len(F.rows()) == 1)
# ================= 3. Database down: clean generic error, no leaks =================
D = Site('db-down', db_ok=False); st, j, t = D.post(GOOD)
chk('database down -> 500 JSON', st == 500 and j.get('success') is False); chk('no technical details leaked', not re.search(r'sqlite|pdo|sqlstate|unable to open|nonexistent|stack|\.php', t, re.I), t[:160])
# ================= 4. Per-IP limit =================
P = Site('ip-limit', {'CONTACT_MAX_PER_HOUR': '2'}); codes = [P.post({**GOOD, 'email': f'v{i}@example.com'})[0] for i in range(3)]
chk('per-IP limit: 3rd message in an hour -> 429', codes == [201, 201, 429], str(codes)); chk('per-IP limit: blocked message not saved', len(P.rows()) == 2)
P.post({**GOOD, 'website': 'x'}); chk('honeypot hits do not use up the limit', len(P.rows()) == 2)
# ================= 5. Built-in SMTP sender =================
try:
    from aiosmtpd.controller import Controller
    from aiosmtpd.smtp import AuthResult, LoginPassword
    have = True
except Exception: have = False
if not have or not shutil.which('openssl'): print('SMTP tests skipped (pip install aiosmtpd, and openssl is needed)')
else:
    class H:
        def __init__(s): s.msgs = []
        async def handle_DATA(s, server, session, env): s.msgs.append((env.mail_from, list(env.rcpt_tos), env.content)); return '250 OK'
    def auth(server, session, env, mech, data):
        ok = isinstance(data, LoginPassword) and data.login == b'user' and data.password == b'pass'; return AuthResult(success=ok, handled=ok)
    key, crt = f'{ROOT}/k.pem', f'{ROOT}/c.pem'; subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', crt, '-subj', '/CN=localhost', '-days', '2'], capture_output=True)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER); ctx.load_cert_chain(crt, key)
    def smtp_case(label, secure, ctrl_kw, verify='false', password='pass', to="'one@mysite.test, two@mysite.test'", expect=True, port=None):
        h = H(); port = port or free_port(); c = Controller(h, hostname='127.0.0.1', port=port, authenticator=auth, auth_required=True, **ctrl_kw)
        if expect is not None or ctrl_kw is not None: c.start()
        S = Site('smtp-' + label, {'MAIL_TRANSPORT': "'smtp'", 'SMTP_HOST': "'127.0.0.1'", 'SMTP_PORT': str(port), 'SMTP_SECURE': f"'{secure}'", 'SMTP_USER': "'user'", 'SMTP_PASS': f"'{password}'", 'SMTP_VERIFY_TLS': verify, 'MAIL_TO': to, 'MAIL_FROM': "'noreply@mysite.test'"})
        st, j, _ = S.post(U); time.sleep(0.4); c.stop()
        chk(f'SMTP {label}: visitor gets success and message is saved', st == 201 and len(S.rows()) == 1, f'{st} {j}')
        if expect:
            chk(f'SMTP {label}: email delivered', len(h.msgs) == 1, f'{len(h.msgs)} delivered')
            if h.msgs:
                frm, rcpt, raw = h.msgs[0]; m = email.message_from_bytes(raw, policy=email.policy.default)
                chk(f'SMTP {label}: envelope sender and both recipients', frm == 'noreply@mysite.test' and rcpt == ['one@mysite.test', 'two@mysite.test'], f'{frm} {rcpt}')
                chk(f'SMTP {label}: unicode subject, Reply-To and body intact', str(m['Subject']) == '[Twin Forge] ' + U['subject'] and m['Reply-To'].addresses[0].addr_spec == 'chi@example.com' and U['message'] in body(m).replace('\r\n', '\n'), str(m['Subject']))
                chk(f'SMTP {label}: Date and Message-ID headers present', bool(m['Date']) and bool(m['Message-ID']))
        else: chk(f'SMTP {label}: no email delivered (as expected)', len(h.msgs) == 0, f'{len(h.msgs)} delivered')
    smtp_case('plain+AUTH', '', dict(auth_require_tls=False))
    smtp_case('STARTTLS', 'tls', dict(tls_context=ctx, require_starttls=True, auth_require_tls=True))
    smtp_case('implicit SSL', 'ssl', dict(ssl_context=ctx, auth_require_tls=False))
    smtp_case('wrong password', '', dict(auth_require_tls=False), password='wrong', expect=False)
    smtp_case('self-signed cert is refused when verification is on', 'tls', dict(tls_context=ctx, require_starttls=True, auth_require_tls=True), verify='true', expect=False)
    dead = free_port(); S = Site('smtp-down', {'MAIL_TRANSPORT': "'smtp'", 'SMTP_HOST': "'127.0.0.1'", 'SMTP_PORT': str(dead), 'SMTP_SECURE': "''"}); t0 = time.time(); st, j, _ = S.post(GOOD)
    chk('SMTP server unreachable: visitor still gets success, message saved, fast', st == 201 and len(S.rows()) == 1 and time.time() - t0 < 5, f'{st} {time.time()-t0:.1f}s')
for p in procs: p.terminate()
shutil.rmtree(ROOT, ignore_errors=True)
print(f'{n} checks run, {len(fails)} problem(s)'); [print(' -', f) for f in fails]; sys.exit(1 if fails else 0)
