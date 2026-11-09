"""Password-recovery backend tests (ajax/auth/forgot-password.php, verify-otp.php, reset-password.php): the emailed code, one-time use, expiry,
attempt limits, rate limits, no account enumeration (same answer AND same speed), reset, and that the new password really logs in.
Needs php on PATH. Uses throw-away SQLite copies of the project (your MySQL data is never touched).   Run:  python3 tests/recovery_test.py"""
from zoneinfo import ZoneInfo
import json, os, re, shutil, socket, sqlite3, subprocess, sys, tempfile, time, urllib.request, urllib.error, http.cookiejar, email, email.policy
SRC = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')); ROOT = tempfile.mkdtemp(prefix='tf-recovery-')
OLD, NEW = 'OldPassw0rd1', 'BrandNewPassw0rd9'
fails = []; n = 0; procs = []
def chk(name, cond, detail=''):
    global n; n += 1
    if not cond: fails.append(f'{name} {detail}'[:240])
LAGOS = ZoneInfo('Africa/Lagos')   # the app's timezone (APP_TIMEZONE in ajax/config.php)
from datetime import datetime, timedelta
def lagos(offset=0): return (datetime.now(LAGOS) + timedelta(seconds=offset)).strftime('%Y-%m-%d %H:%M:%S')
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
class Site:
    def __init__(s, name, slow_mail=0):
        s.dir = f'{ROOT}/{name}'; shutil.copytree(SRC, s.dir, ignore=shutil.ignore_patterns('tests', 'node_modules')); s.db = f'{ROOT}/{name}.db'; s.mail = f'{ROOT}/{name}-mail'; os.makedirs(s.mail)
        cfg = s.dir + '/ajax/config.php'; txt = open(cfg).read().replace('mysql:host=localhost;dbname=twin_forge;charset=utf8mb4', 'sqlite:' + s.db); open(cfg, 'w').write(txt)
        h = subprocess.check_output(['php', '-r', f"echo password_hash('{OLD}',PASSWORD_DEFAULT);"]).decode(); c = sqlite3.connect(s.db)
        c.executescript("""CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,name,email UNIQUE,password_hash,role_title,picture_url,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE password_resets(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INT NOT NULL,otp_hash TEXT NOT NULL,token_hash TEXT,attempts INT NOT NULL DEFAULT 0,expires_at TEXT NOT NULL,token_expires_at TEXT,used_at TEXT,created_at TEXT NOT NULL);
        CREATE TABLE rate_limits(id INTEGER PRIMARY KEY AUTOINCREMENT,bucket TEXT NOT NULL,created_at TEXT NOT NULL);""")
        c.execute("INSERT INTO users(name,email,password_hash,role_title) VALUES('Test Founder','Founder@Example.com',?,'Co-Founder')", (h,)); c.commit(); c.close()
        cap = f'{ROOT}/{name}-capture.sh'; open(cap, 'w').write(f'#!/bin/sh\nsleep {slow_mail}\ncat > "{s.mail}/$(date +%s%N).eml"\n'); os.chmod(cap, 0o755)
        s.port = free_port(); s.p = subprocess.Popen(['php', '-d', f'sendmail_path={cap}', '-S', f'127.0.0.1:{s.port}', '-t', s.dir], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); procs.append(s.p)
        for _ in range(40):
            try: socket.create_connection(('127.0.0.1', s.port), 0.2).close(); break
            except OSError: time.sleep(0.1)
    def q(s, sql, a=()): c = sqlite3.connect(s.db); c.row_factory = sqlite3.Row; r = [dict(x) for x in c.execute(sql, a)]; c.commit(); c.close(); return r
    def mails(s, want, wait=6.0):
        t = time.time()
        while time.time() - t < wait and len(os.listdir(s.mail)) < want: time.sleep(0.1)
        return [email.message_from_bytes(open(f'{s.mail}/{x}', 'rb').read(), policy=email.policy.default) for x in sorted(os.listdir(s.mail))]
    def code(s, idx=-1): m = s.mails(1)[idx]; return re.search(r'\b(\d{6})\b', m.get_body().get_content()).group(1)
class V:                                                     # one visitor = own cookies/session + own CSRF token
    def __init__(s, site, token=True):
        s.site = site; s.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())); s.csrf = None
        if token: s.csrf = s.call('login', method='GET')[1]['data']['csrf']
    def call(s, ep, data=None, method='POST', csrf=True):
        path = {'login': 'auth/login.php', 'forgot': 'auth/forgot-password.php', 'verify': 'auth/verify-otp.php', 'reset': 'auth/reset-password.php'}[ep]; hd = {'Content-Type': 'application/json'}
        if csrf and s.csrf: hd['X-CSRF-Token'] = s.csrf
        r = urllib.request.Request(f'http://127.0.0.1:{s.site.port}/ajax/{path}', data=json.dumps(data).encode() if method == 'POST' else None, headers=hd, method=method); t0 = time.time()
        try: x = s.op.open(r); st, t = x.status, x.read().decode()
        except urllib.error.HTTPError as e: st, t = e.code, e.read().decode()
        s.last = time.time() - t0
        try: return st, json.loads(t)
        except Exception: return st, {'_raw': t[:200]}
EM = 'founder@example.com'   # the account is stored as Founder@Example.com: lookups must be case-insensitive

# ================= 1. step 1: forgot-password =================
S = Site('main'); v = V(S)
chk('GET refused (405)', v.call('forgot', method='GET')[0] == 405)
chk('no CSRF token -> 419', V(S, token=False).call('forgot', {'email': EM})[0] == 419)
chk('wrong CSRF token -> 419', (lambda c: (setattr(c, 'csrf', 'bad'), c.call('forgot', {'email': EM}))[1])(V(S))[0] == 419)
st, j = v.call('forgot', {'email': 'not-an-email'}); chk('invalid email -> 422', st == 422 and 'email' in j.get('errors', {}))
chk("SQL / CRLF in the email -> 422", V(S).call('forgot', {'email': "x' OR '1'='1"})[0] == 422 and V(S).call('forgot', {'email': EM + '\r\nBcc: evil@x.com'})[0] == 422)
st1, j1 = V(S).call('forgot', {'email': 'ghost@example.com'}); chk('unknown email: generic success, nothing sent, nothing stored', st1 == 200 and j1['success'] and not os.listdir(S.mail) and not S.q('select * from password_resets'))
st2, j2 = V(S).call('forgot', {'email': 'FOUNDER@example.COM'}); chk('known email (any letter case): same status and the SAME JSON as unknown', st2 == st1 and j2 == j1, f'{j1} vs {j2}')
mails = S.mails(1); chk('exactly one code email arrived', len(mails) == 1)
m = mails[0]; b = m.get_body().get_content(); code1 = re.search(r'\b(\d{6})\b', b).group(1)
chk('email goes to the founder with a 6-digit code', EM in str(m['To']).lower() and 'password reset code' in str(m['Subject']).lower() and len(code1) == 6, str(m['To']))
chk('the code is NOT in the JSON response', code1 not in json.dumps(j2))
r = S.q('select * from password_resets')[0]; chk('only a hash of the code is stored (never the code)', code1 not in json.dumps(r) and r['otp_hash'].startswith('$'))
chk('code expires in about 10 minutes', 540 < (datetime.strptime(r['expires_at'], '%Y-%m-%d %H:%M:%S').replace(tzinfo=LAGOS) - datetime.now(LAGOS)).total_seconds() < 660)

# ================= 2. step 2: verify-otp =================
chk('verify: bad formats -> 422', all(V(S).call('verify', {'email': EM, 'otp': o})[0] == 422 for o in ['12345', 'abcdef', '1234567', '', "1' OR '1"]))
wrong = '000000' if code1 != '000000' else '111111'
st, j = V(S).call('verify', {'email': EM, 'otp': wrong}); chk('wrong code -> 422 generic message', st == 422 and 'incorrect or has expired' in j['message'])
st, jg = V(S).call('verify', {'email': 'ghost@example.com', 'otp': wrong}); chk('unknown email gives the SAME answer as a wrong code', st == 422 and jg == j, f'{jg} vs {j}')
chk('attempt counter went up', S.q('select attempts from password_resets')[0]['attempts'] == 1)
# 5 wrong tries kill the code, even if the right one is typed afterwards
S2 = Site('attempts'); V(S2).call('forgot', {'email': EM}); good = S2.code(); bad = '000000' if good != '000000' else '111111'; vv = V(S2)
for _ in range(5): vv.call('verify', {'email': EM, 'otp': bad})
chk('after 5 wrong tries the correct code no longer works', V(S2).call('verify', {'email': EM, 'otp': good})[0] == 422)
chk('...and the code is marked used', S2.q('select used_at from password_resets')[0]['used_at'] is not None)
# expired code
S3 = Site('expired'); V(S3).call('forgot', {'email': EM}); c3 = S3.code(); S3.q("update password_resets set expires_at=?", (lagos(-5),))
chk('expired code is refused', V(S3).call('verify', {'email': EM, 'otp': c3})[0] == 422)
# a new code cancels the older one
S4 = Site('newcode'); V(S4).call('forgot', {'email': EM}); a = S4.code(); V(S4).call('forgot', {'email': EM}); S4.mails(2); bcode = S4.code(-1)
while bcode == a: V(S4).call('forgot', {'email': EM}); S4.mails(3); bcode = S4.code(-1)   # (1 in 900000 chance of a repeat)
chk('requesting a new code cancels the old one', V(S4).call('verify', {'email': EM, 'otp': a})[0] == 422)
chk('...and the new one works', V(S4).call('verify', {'email': EM, 'otp': bcode})[0] == 200)
# correct code
vk = V(S); st, j = vk.call('verify', {'email': EM, 'otp': code1}); chk('correct code -> 200 and a 64-hex reset token', st == 200 and re.fullmatch(r'[a-f0-9]{64}', j.get('data', {}).get('reset_token', '')), str(j)[:120])
token = j['data']['reset_token']; r = S.q('select * from password_resets')[0]
chk('the token is stored only as a hash', token not in json.dumps(r) and len(r['token_hash']) == 64)
chk('the code cannot be used twice', V(S).call('verify', {'email': EM, 'otp': code1})[0] == 422)

# ================= 3. step 3: reset-password =================
chk('reset: malformed token -> 422', V(S).call('reset', {'token': 'abc', 'new_password': NEW, 'confirm_password': NEW})[0] == 422)
st, j = V(S).call('reset', {'token': 'a' * 64, 'new_password': NEW, 'confirm_password': NEW}); chk('reset: unknown token -> 422 "expired"', st == 422 and 'expired' in j['message'])
st, j = V(S).call('reset', {'token': token, 'new_password': 'short1', 'confirm_password': 'short1'}); chk('reset: weak password -> 422 with a field error', st == 422 and 'new_password' in j['errors'])
st, j = V(S).call('reset', {'token': token, 'new_password': NEW, 'confirm_password': 'different12345'}); chk('reset: mismatch -> 422', st == 422 and 'confirm_password' in j['errors'])
chk('reset: the token survived those failed attempts', S.q('select used_at from password_resets')[0]['used_at'] is None)
st, j = V(S).call('reset', {'token': token, 'new_password': NEW, 'confirm_password': NEW}); chk('reset: success', st == 200 and j['success'], str(j))
chk('reset: token cannot be reused', V(S).call('reset', {'token': token, 'new_password': NEW + 'x', 'confirm_password': NEW + 'x'})[0] == 422)
chk('reset: all open resets for the account are closed', all(x['used_at'] for x in S.q('select used_at from password_resets')))
mm = S.mails(2); chk('reset: "password was changed" notice emailed', len(mm) == 2 and 'password was changed' in str(mm[-1]['Subject']).lower())
lg = V(S); chk('the NEW password signs in', lg.call('login', {'email': EM, 'password': NEW})[0] == 200); chk('the OLD password no longer works', V(S).call('login', {'email': EM, 'password': OLD})[0] == 401)
# expired token
S5 = Site('tokexp'); V(S5).call('forgot', {'email': EM}); c5 = S5.code(); t5 = V(S5).call('verify', {'email': EM, 'otp': c5})[1]['data']['reset_token']
S5.q('update password_resets set token_expires_at=?', (lagos(-5),)); chk('reset: expired token refused', V(S5).call('reset', {'token': t5, 'new_password': NEW, 'confirm_password': NEW})[0] == 422)
chk('reset: password unchanged after a refused attempt', V(S5).call('login', {'email': EM, 'password': OLD})[0] == 200)

# ================= 4. limits =================
S6 = Site('limit-email'); codes = [V(S6).call('forgot', {'email': EM})[0] for _ in range(6)]; chk('forgot: 6th request for one email in an hour -> 429', codes == [200] * 5 + [429], str(codes))
S7 = Site('limit-unknown'); codes = [V(S7).call('forgot', {'email': 'ghost@example.com'})[0] for _ in range(6)]; chk('...unknown emails are limited identically (no way to tell them apart)', codes == [200] * 5 + [429], str(codes))
S8 = Site('limit-ip'); codes = [V(S8).call('forgot', {'email': f'u{i}@example.com'})[0] for i in range(11)]; chk('forgot: 11th request from one IP in an hour -> 429', codes == [200] * 10 + [429], str(codes))
S9 = Site('limit-verify'); V(S9).call('forgot', {'email': EM}); codes = [V(S9).call('verify', {'email': EM, 'otp': '123456'})[0] for _ in range(11)]; chk('verify: guessing is capped (429 after 10 tries in an hour)', codes[-1] == 429 and codes[:10].count(429) == 0, str(codes))

# ================= 5. speed: the answer must not wait for the mail server, or reveal the account =================
SL = Site('slow', slow_mail=2); a = V(SL); b = V(SL); a.call('forgot', {'email': 'ghost@example.com'}); ts_unknown = a.last; b.call('forgot', {'email': EM}); ts_known = b.last
chk('response is fast even though the mail server takes 2s', ts_known < 1.2, f'{ts_known:.2f}s'); chk('known and unknown emails answer in about the same time', abs(ts_known - ts_unknown) < 0.6, f'{ts_known:.2f}s vs {ts_unknown:.2f}s')
chk('the email still arrives afterwards', len(SL.mails(1, wait=8)) == 1)
for p in procs: p.terminate()
shutil.rmtree(ROOT, ignore_errors=True)
print(f'{n} checks run, {len(fails)} problem(s)'); [print(' -', f) for f in fails]; sys.exit(1 if fails else 0)
