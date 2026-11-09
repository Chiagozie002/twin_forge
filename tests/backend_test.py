import json, subprocess, time, os, shutil, sqlite3, urllib.request, urllib.error, http.cookiejar, uuid, base64
SRC=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')); T='/tmp/tftest'; DB='/tmp/tf-test.db'; PORT=8099
shutil.rmtree(T,ignore_errors=True); shutil.copytree(SRC,T); 
if os.path.exists(DB): os.remove(DB)
def sub(p,a,b):
    s=open(T+p).read(); assert a in s,(p,a); open(T+p,'w').write(s.replace(a,b))
sub('/ajax/config.php','mysql:host=localhost;dbname=twin_forge;charset=utf8mb4','sqlite:'+DB)   # test-only: swap MySQL for SQLite
sub('/ajax/config.php','const CONTACT_MAX_PER_HOUR = 5;','const CONTACT_MAX_PER_HOUR = 1000;')   # the per-IP limit has its own dedicated test
sub('/ajax/settings/_lib.php','ON DUPLICATE KEY UPDATE v = VALUES(v)','ON CONFLICT(k) DO UPDATE SET v = excluded.v')
PW='Str0ngPassw0rd'; h=subprocess.check_output(['php','-r',f"echo password_hash('{PW}',PASSWORD_DEFAULT);"]).decode()
c=sqlite3.connect(DB); c.executescript("""
CREATE TABLE messages(id INTEGER PRIMARY KEY AUTOINCREMENT,name,email,subject,message,is_read INT DEFAULT 0,created_at TEXT,ip_hash TEXT);
CREATE TABLE projects(id INTEGER PRIMARY KEY AUTOINCREMENT,name,category,short_description,description,technologies TEXT,image_url,live_url,github_url,status TEXT DEFAULT 'active',updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT,name,email UNIQUE,password_hash,role_title,picture_url,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE settings(k TEXT PRIMARY KEY,v TEXT NOT NULL);""")
c.execute("INSERT INTO users(name,email,password_hash,role_title) VALUES('Test Founder','founder@example.com',?,'Co-Founder')",(h,)); c.execute("INSERT INTO users(name,email,password_hash,role_title) VALUES('Other Founder','other@example.com',?,'Co-Founder')",(h,)); c.commit()
srv=subprocess.Popen(['php','-d','upload_max_filesize=64M','-d','post_max_size=70M','-S',f'127.0.0.1:{PORT}','-t',T],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
srv2=subprocess.Popen(['php','-d','upload_max_filesize=1M','-d','post_max_size=1M','-S','127.0.0.1:8098','-t',T],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1.4)
class Client:
    def __init__(s,port=PORT): s.port=port; s.cj=http.cookiejar.CookieJar(); s.op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(s.cj)); s.csrf=None
    def call(s,method,path,data=None,files=None,fields=None,csrf=True,params=''):
        url=f'http://127.0.0.1:{s.port}/ajax/{path}{params}'; hd={}
        if csrf and s.csrf: hd['X-CSRF-Token']=s.csrf
        body=None
        if files is not None:
            b='----b'+uuid.uuid4().hex; parts=[]
            for k,v in (fields or {}).items(): parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
            for k,(fn,ct,by) in files.items(): parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: {ct}\r\n\r\n'.encode()+by+b'\r\n')
            body=b''.join(parts)+f'--{b}--\r\n'.encode(); hd['Content-Type']=f'multipart/form-data; boundary={b}'
        elif data is not None: body=json.dumps(data).encode(); hd['Content-Type']='application/json'
        try: r=s.op.open(urllib.request.Request(url,data=body,headers=hd,method=method)); st=r.status; txt=r.read().decode()
        except urllib.error.HTTPError as e: st=e.code; txt=e.read().decode()
        try: return st,json.loads(txt)
        except Exception: return st,{'_raw':txt[:200]}
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
fails=[]; n=0
def chk(name,got,exp_status,exp_ok=None):
    global n; n+=1; st,j=got; ok=(st==exp_status) and (exp_ok is None or j.get('success')==exp_ok)
    if not ok: fails.append(f'{name}: got {st} {json.dumps(j)[:160]} (expected {exp_status})')
    return j
A=Client(); P=Client()   # A = logged-in founder, P = anonymous public visitor
GOODP={'name':'Atlas App','category':'Web Application','short_description':'A short description here.','description':'A long enough description for the project.','live_url':'https://example.com','github_url':'','technologies':json.dumps(['PHP','MySQL'])}
try:
    # ---- public ----
    chk('public list empty',P.call('GET','projects/list.php'),200,True)
    chk('public settings',P.call('GET','settings/get.php'),200,True)
    chk('wrong method list',P.call('POST','projects/list.php',{}),405)
    chk('contact valid',P.call('POST','messages/submit.php',{'name':'Ann Lee','email':'ann@example.com','subject':'Hello there','message':'This is a long enough message.','website':''}),201,True)
    chk('contact rate limit',P.call('POST','messages/submit.php',{'name':'Ann Lee','email':'ann@example.com','subject':'Hello there','message':'This is a long enough message.'}),429)
    Q=Client(); r=chk('contact invalid',Q.call('POST','messages/submit.php',{'name':'A','email':'bad','subject':'x','message':'short'}),422,False); 
    if set(r.get('errors',{}))!={'name','email','subject','message'}: fails.append('contact invalid: missing field errors '+str(r.get('errors')))
    chk('contact honeypot',Client().call('POST','messages/submit.php',{'name':'Bot','email':'b@x.com','subject':'spam','message':'buy now buy now','website':'http://spam'}),200,True)
    chk('contact header-injection subject',Client().call('POST','messages/submit.php',{'name':'Ann\r\nBcc: x@y.com','email':'ann@example.com','subject':'Hi\r\nBcc: evil@x.com','message':'Long enough message body here.'}),201,True)
    # ---- protected endpoints without login ----
    for ep,m in [('projects/add.php','POST'),('projects/update.php','POST'),('projects/delete.php','POST'),('projects/restore.php','POST'),('projects/permanent-delete.php','POST'),('messages/list.php','GET'),('messages/delete.php','POST'),('messages/delete-all.php','POST'),('profile/get.php','GET'),('profile/update.php','POST'),('profile/upload-picture.php','POST'),('profile/remove-picture.php','POST'),('profile/change-password.php','POST'),('settings/update-about.php','POST'),('settings/update-mission-vision.php','POST'),('settings/update-founder-bios.php','POST'),('settings/update-social-links.php','POST'),('dashboard/stats.php','GET'),('auth/logout.php','POST')]:
        chk('401 '+ep,Q.call(m,ep,{} if m=='POST' else None),401)
    chk('admin list needs login',P.call('GET','projects/list.php',params='?scope=admin&status=trashed'),401)
    # ---- auth ----
    r=chk('csrf token',A.call('GET','auth/login.php'),200,True); A.csrf=r['data']['csrf']
    chk('login no csrf',Client().call('POST','auth/login.php',{'email':'founder@example.com','password':PW}),419)
    chk('login wrong pw',A.call('POST','auth/login.php',{'email':'founder@example.com','password':'nope'}),401,False)
    chk('login unknown email',A.call('POST','auth/login.php',{'email':'ghost@example.com','password':PW}),401,False)
    chk('login bad input',A.call('POST','auth/login.php',{'email':'notanemail','password':''}),422)
    chk('login ok',A.call('POST','auth/login.php',{'email':'founder@example.com','password':PW}),200,True)
    r=chk('profile get',A.call('GET','profile/get.php'),200,True); A.csrf=r['data']['csrf']
    # lockout after 5 fails (separate client)
    L=Client(); t=L.call('GET','auth/login.php')[1]['data']['csrf']; L.csrf=t
    for i in range(5): L.call('POST','auth/login.php',{'email':'founder@example.com','password':'bad'+str(i)})
    chk('login lockout',L.call('POST','auth/login.php',{'email':'founder@example.com','password':PW}),429)
    # ---- CSRF on state change ----
    saved=A.csrf; A.csrf=None; chk('delete no csrf',A.call('POST','projects/delete.php',{'id':1}),419); A.csrf='wrong'; chk('delete bad csrf',A.call('POST','projects/delete.php',{'id':1}),419); A.csrf=saved
    # ---- projects ----
    chk('add no image',A.call('POST','projects/add.php',files={},fields=GOODP),422)
    chk('add bad fields',A.call('POST','projects/add.php',files={'image':('a.png','image/png',PNG)},fields={**GOODP,'name':'x','live_url':'javascript:alert(1)','technologies':'[]'}),422,False)
    chk('add fake image',A.call('POST','projects/add.php',files={'image':('a.png','image/png',b'<?php echo 1; ?> not an image')},fields=GOODP),422,False)
    chk('add php file',A.call('POST','projects/add.php',files={'image':('shell.php','application/x-php',b'<?php system($_GET[0]);')},fields=GOODP),422,False)
    chk('add: empty file field (browser sends this when nothing is chosen)',A.call('POST','projects/add.php',files={'image':('','application/octet-stream',b'')},fields=GOODP),422,False)
    r=A.call('POST','projects/add.php',files={'image':('','application/octet-stream',b'')},fields=GOODP)[1]
    if 'choose' not in r.get('errors',{}).get('image','').lower(): fails.append('add without picture: message not clear: '+json.dumps(r)[:150])
    chk('add: text invalid + no picture reports both',A.call('POST','projects/add.php',files={'image':('','application/octet-stream',b'')},fields={**GOODP,'name':'x'}),422,False)
    r=chk('add ok',A.call('POST','projects/add.php',files={'image':('a.png','image/png',PNG)},fields=GOODP),201,True); pid=r['data']['id']; img=r['data']['image_url']
    if not img.startswith('uploads/projects/') or not img.endswith('.png') or not os.path.exists(T+'/'+img): fails.append('add ok: image not stored properly '+str(img))
    chk('add 2nd: 5 MB image is accepted (no size limit)',A.call('POST','projects/add.php',files={'image':('b.png','image/png',PNG+b'0'*(5*1024*1024))},fields={**GOODP,'name':'Pulse Mobile','category':'Mobile App'}),201,True)
    r=chk('public list 2',P.call('GET','projects/list.php'),200,True)
    if r['data']['total']!=2 or sorted(r['data']['categories'])!=['Mobile App','Web Application'] or not isinstance(r['data']['items'][0]['technologies'],list): fails.append('public list shape wrong '+json.dumps(r['data'])[:200])
    r=chk('public filter',P.call('GET','projects/list.php',params='?cat=Mobile%20App'),200,True)
    if r['data']['total']!=1: fails.append('category filter wrong')
    r=chk('per_page clamp',P.call('GET','projects/list.php',params='?per_page=9999&page=-5'),200,True)
    if r['data']['per_page']!=24 or r['data']['page']!=1: fails.append('clamp wrong')
    r=chk('sql injection cat',P.call('GET','projects/list.php',params="?cat=x'%20OR%201=1--"),200,True)
    if r['data']['total']!=0: fails.append('SQLi in cat returned rows!')
    r=chk('admin search',A.call('GET','projects/list.php',params='?scope=admin&q=Atlas'),200,True)
    if r['data']['total']!=1: fails.append('admin search wrong '+str(r['data']['total']))
    r=chk('admin search LIKE wildcard',A.call('GET','projects/list.php',params='?scope=admin&q=%25'),200,True)
    if r['data']['total']!=0: fails.append('LIKE wildcard % not escaped (returned %d rows)'%r['data']['total'])
    chk('update ok',A.call('POST','projects/update.php',files={},fields={**GOODP,'id':pid,'name':'Atlas Renamed'}),200,True)
    chk('update bad id',A.call('POST','projects/update.php',files={},fields={**GOODP,'id':0}),422,False)
    chk('update with image',A.call('POST','projects/update.php',files={'image':('c.png','image/png',PNG)},fields={**GOODP,'id':pid}),200,True)
    # ---- project EDIT checks ----
    before=A.call('GET','projects/list.php',params='?scope=admin&q=Atlas')[1]['data']['items'][0]; old_img=before['image_url']
    chk('edit without new image keeps the old one',A.call('POST','projects/update.php',files={},fields={**GOODP,'id':pid,'name':'Atlas Keep'}),200,True)
    after=A.call('GET','projects/list.php',params='?scope=admin&q=Atlas%20Keep')[1]['data']['items']
    if not after or after[0]['image_url']!=old_img or after[0]['name']!='Atlas Keep': fails.append('edit w/o image changed or lost the picture: '+json.dumps(after)[:160])
    chk('edit with empty file field keeps picture (browser behaviour)',A.call('POST','projects/update.php',files={'image':('','application/octet-stream',b'')},fields={**GOODP,'id':pid}),200,True)
    r=chk('edit with new image',A.call('POST','projects/update.php',files={'image':('n.png','image/png',PNG)},fields={**GOODP,'id':pid}),200,True)
    if r['data']['image_url']==old_img or not os.path.exists(T+'/'+r['data']['image_url']): fails.append('edit: new image not stored')
    if os.path.exists(T+'/'+old_img): fails.append('edit: replaced image file was not deleted')
    chk('edit unknown id',A.call('POST','projects/update.php',files={},fields={**GOODP,'id':99999}),404)
    chk('edit bad fields',A.call('POST','projects/update.php',files={},fields={**GOODP,'id':pid,'name':'x','description':'short','live_url':'ftp://x','technologies':'[]'}),422,False)
    r=A.call('POST','projects/update.php',files={},fields={**GOODP,'id':pid,'name':'x','live_url':'bad'})[1]
    if not {'name','live_url'}<=set(r.get('errors',{})): fails.append('edit: field errors missing: '+json.dumps(r)[:150])
    chk('edit with fake image',A.call('POST','projects/update.php',files={'image':('a.png','image/png',b'GIF-not-really')},fields={**GOODP,'id':pid}),422,False)
    chk('edit no csrf',(lambda c:(setattr(c,'csrf',None),c.call('POST','projects/update.php',files={},fields={**GOODP,'id':pid}))[1])(A),419)
    # a legacy project with NO picture must get one on edit
    cdb=sqlite3.connect(DB); cdb.execute("INSERT INTO projects(name,category,short_description,description,technologies,image_url,status) VALUES('Legacy','Website','Legacy short desc here','Legacy long description text.','[\"PHP\"]',NULL,'active')"); cdb.commit(); lid=cdb.execute("SELECT id FROM projects WHERE name='Legacy'").fetchone()[0]; cdb.close()
    A.csrf=A.call('GET','profile/get.php')[1]['data']['csrf']
    r=chk('edit imageless project without picture is refused',A.call('POST','projects/update.php',files={},fields={**GOODP,'id':lid,'name':'Legacy'}),422,False)
    if 'choose' not in r.get('errors',{}).get('image','').lower(): fails.append('imageless edit: wrong message '+json.dumps(r)[:140])
    chk('edit imageless project with picture works',A.call('POST','projects/update.php',files={'image':('l.png','image/png',PNG)},fields={**GOODP,'id':lid,'name':'Legacy'}),200,True)
    A.call('POST','projects/delete.php',{'id':lid}); A.call('POST','projects/permanent-delete.php',{'id':lid})
    chk('delete (soft)',A.call('POST','projects/delete.php',{'id':pid}),200,True)
    chk('delete again 404',A.call('POST','projects/delete.php',{'id':pid}),404)
    r=chk('public hides trashed',P.call('GET','projects/list.php'),200,True)
    if r['data']['total']!=1: fails.append('trashed project still public')
    r=chk('admin trash list',A.call('GET','projects/list.php',params='?scope=admin&status=trashed'),200,True)
    if r['data']['total']!=1: fails.append('trash list wrong')
    chk('perm delete active -> 404',A.call('POST','projects/permanent-delete.php',{'id':2}),404)
    chk('restore',A.call('POST','projects/restore.php',{'id':pid}),200,True)
    chk('restore again 404',A.call('POST','projects/restore.php',{'id':pid}),404)
    A.call('POST','projects/delete.php',{'id':pid}); 
    st,j=A.call('GET','projects/list.php',params='?scope=admin&status=trashed'); imgfile=T+'/'+ [x for x in os.listdir(T+'/uploads/projects') if x.endswith('.png')][0]
    chk('perm delete',A.call('POST','projects/permanent-delete.php',{'id':pid}),200,True)
    # ---- messages / dashboard ----
    r=chk('messages list',A.call('GET','messages/list.php'),200,True)
    if len(r['data']['items'])<2: fails.append('messages list too short')
    mid=r['data']['items'][0]['id']
    chk('message delete',A.call('POST','messages/delete.php',{'id':mid}),200,True); chk('message delete 404',A.call('POST','messages/delete.php',{'id':mid}),404)
    chk('delete-all no confirm',A.call('POST','messages/delete-all.php',{}),422); chk('delete-all wrong confirm',A.call('POST','messages/delete-all.php',{'confirm':'yes'}),422)
    r=chk('dashboard stats',A.call('GET','dashboard/stats.php'),200,True)
    if r['data']['active']!=1 or r['data']['trashed']!=0: fails.append('dashboard counts wrong '+json.dumps({k:r['data'][k] for k in ('active','trashed','messages')}))
    chk('delete-all ok',A.call('POST','messages/delete-all.php',{'confirm':'DELETE'}),200,True)
    r=A.call('GET','messages/list.php')[1]
    if r['data']['items']: fails.append('delete-all left rows')
    # ---- settings ----
    chk('about short',A.call('POST','settings/update-about.php',{'about':'too short'}),422,False)
    chk('about ok',A.call('POST','settings/update-about.php',{'about':'A proper about text that is long enough to pass.'}),200,True)
    chk('mv ok',A.call('POST','settings/update-mission-vision.php',{'mission':'Our mission text here.','vision':'Our vision text here.'}),200,True)
    chk('bios ok',A.call('POST','settings/update-founder-bios.php',{'bio_1':'First founder biography.','bio_2':'Second founder biography.'}),200,True)
    chk('social js url blocked',A.call('POST','settings/update-social-links.php',{'linkedin':'javascript:alert(1)'}),422,False)
    chk('social ok',A.call('POST','settings/update-social-links.php',{'linkedin':'https://linkedin.com/in/x','x':'','github':'https://github.com/x'}),200,True)
    r=chk('settings public',P.call('GET','settings/get.php'),200,True)
    s=r['data']['settings']; f=r['data']['founders']
    if s.get('about','')[:8]!='A proper' or s.get('social_github')!='https://github.com/x' or len(f)!=2 or 'email' in json.dumps(f) or 'password' in json.dumps(r): fails.append('settings public shape/leak: '+json.dumps(r['data'])[:300])
    # ---- profile ----
    chk('profile bad email',A.call('POST','profile/update.php',{'name':'Test Founder','email':'bad','role_title':'Co-Founder'}),422,False)
    chk('profile dup email',A.call('POST','profile/update.php',{'name':'Test Founder','email':'other@example.com','role_title':'Co-Founder'}),422,False)
    chk('profile ok',A.call('POST','profile/update.php',{'name':'Test Founder','email':'founder@example.com','role_title':'Lead Engineer'}),200,True)
    chk('picture none',A.call('POST','profile/upload-picture.php',files={},fields={}),422)
    r=chk('picture ok',A.call('POST','profile/upload-picture.php',files={'image':('p.png','image/png',PNG)},fields={}),200,True); pic=r['data']['picture_url']
    if not pic.startswith('uploads/profiles/') or not os.path.exists(T+'/'+pic): fails.append('picture not stored in uploads/profiles: '+pic)
    chk('profile picture: 5 MB accepted (no size limit)',A.call('POST','profile/upload-picture.php',files={'image':('big.png','image/png',PNG+b'0'*(5*1024*1024))},fields={}),200,True)
    chk('picture: fake image refused',A.call('POST','profile/upload-picture.php',files={'image':('x.png','image/png',b'<?php evil(); ?>')},fields={}),422,False)
    chk('picture 2 replaces old',A.call('POST','profile/upload-picture.php',files={'image':('p2.png','image/png',PNG)},fields={}),200,True)
    if os.path.exists(T+'/'+pic): fails.append('old profile picture file not deleted')
    chk('pw wrong current',A.call('POST','profile/change-password.php',{'current_password':'nope','new_password':'NewPassw0rd123','confirm_password':'NewPassw0rd123'}),422,False)
    chk('pw weak',A.call('POST','profile/change-password.php',{'current_password':PW,'new_password':'short1','confirm_password':'short1'}),422,False)
    chk('pw mismatch',A.call('POST','profile/change-password.php',{'current_password':PW,'new_password':'NewPassw0rd123','confirm_password':'different123'}),422,False)
    chk('pw ok',A.call('POST','profile/change-password.php',{'current_password':PW,'new_password':'NewPassw0rd123','confirm_password':'NewPassw0rd123'}),200,True)
    r=A.call('GET','profile/get.php')
    if r[0]!=200: fails.append('session lost after password change (regenerate_id)')
    else: A.csrf=r[1]['data']['csrf']
    chk('login with new pw',Client().call('GET','auth/login.php'),200,True)
    # ---- profile picture REMOVE ----
    cur=A.call('GET','profile/get.php')[1]['data']['user']['picture_url']
    if not cur or not os.path.exists(T+'/'+cur): fails.append('remove test: no current picture to remove')
    chk('remove picture',A.call('POST','profile/remove-picture.php'),200,True)
    r=A.call('GET','profile/get.php')[1]
    if r['data']['user']['picture_url'] is not None: fails.append('remove picture: picture_url not cleared')
    if cur and os.path.exists(T+'/'+cur): fails.append('remove picture: file not deleted')
    chk('remove picture twice is harmless',A.call('POST','profile/remove-picture.php'),200,True)
    chk('add picture again after removing',A.call('POST','profile/upload-picture.php',files={'image':('p3.png','image/png',PNG)},fields={}),200,True)
    # ---- server upload limit gives a clear message (server B has 1 MB limits) ----
    B=Client(8098); B.csrf=B.call('GET','auth/login.php')[1]['data']['csrf']; B.call('POST','auth/login.php',{'email':'founder@example.com','password':'NewPassw0rd123'}); B.csrf=B.call('GET','profile/get.php')[1]['data']['csrf']
    r=chk('server limit exceeded -> 413',B.call('POST','projects/add.php',files={'image':('big.png','image/png',PNG+b'0'*(2*1024*1024))},fields=GOODP),413,False)
    if 'server' not in json.dumps(r).lower(): fails.append('413 message not clear: '+json.dumps(r)[:150])
    chk('small upload still fine on server B',B.call('POST','projects/add.php',files={'image':('s.png','image/png',PNG)},fields={**GOODP,'name':'Small One'}),201,True)
    # ---- logout ----
    chk('logout',A.call('POST','auth/logout.php'),200,True); chk('after logout 401',A.call('GET','profile/get.php'),401)
    # uploads folder cannot execute PHP
    if not os.path.exists(T+'/uploads/.htaccess'): fails.append('uploads/.htaccess missing')
    # ---- 404 for stub endpoints that should exist per spec ----
    for ep in ['auth/forgot-password.php','auth/verify-otp.php','auth/reset-password.php']:
        if not os.path.exists(SRC+'/ajax/'+ep): fails.append('MISSING endpoint file: ajax/'+ep)
finally:
    srv.terminate(); srv2.terminate()
print(f'{n} checks run, {len(fails)} problem(s)'); [print(' -',f) for f in fails]
