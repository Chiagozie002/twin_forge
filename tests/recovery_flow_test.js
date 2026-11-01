const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'); const fails=[]; let n=0;
const ok=(c,m)=>{n++; if(!c) fails.push(m)}; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const mem={}; // shared sessionStorage between "pages"
function load(page,{demo=true,fetchImpl}={}){
  const html=fs.readFileSync(path.join(ROOT,'cpanel',page),'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
  const dom=new JSDOM(html,{url:'http://localhost/cpanel/'+page,runScripts:'outside-only',pretendToBeVisual:true}); const w=dom.window; let nav=null;
  Object.defineProperty(w,'sessionStorage',{value:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v)},removeItem:k=>{delete mem[k]}}});
  w.matchMedia=()=>({matches:false}); if(fetchImpl) w.fetch=fetchImpl;
  const ctx=dom.getInternalVMContext(); const run=f=>new vm.Script(fs.readFileSync(path.join(ROOT,f),'utf8')).runInContext(ctx);
  run('assets/js/toast.js'); run('assets/js/api.js'); run('assets/js/validators.js');
  new vm.Script('TF.DEMO_MODE='+demo+';window.__navs=[];TF.navigate=u=>window.__navs.push(u);').runInContext(ctx);
  run('cpanel/assets/js/recovery.js'); return {w,d:w.document,navs:()=>w.__navs};
}
const type=(w,el,v)=>{el.value=v; el.dispatchEvent(new w.Event('input',{bubbles:true}))};
const submit=(w,f)=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
  // ---------- DEMO MODE: full happy path ----------
  let p=load('forgot-password.html'); ok(!p.d.getElementById('demoNote').hidden,'forgot: demo note not shown');
  let f=p.d.getElementById('forgotForm'); type(p.w,f.elements.email,'bad'); submit(p.w,f); await wait(50);
  ok(p.d.querySelector('[data-error-for=email]').textContent!=='','forgot: invalid email shows no error'); ok(p.navs().length===0,'forgot: navigated with invalid email');
  type(p.w,f.elements.email,'founder@example.com'); submit(p.w,f); submit(p.w,f); await wait(900);
  ok(p.navs().length===1&&p.navs()[0]==='verify-otp.html','forgot: did not go to verify-otp (double submit => '+p.navs()+')'); ok(mem['tf-recovery-email']==='founder@example.com','forgot: email not stored');
  p=load('verify-otp.html'); ok(p.d.getElementById('maskedEmail').textContent==='fo•••@example.com','verify: masked email wrong: '+p.d.getElementById('maskedEmail').textContent);
  ok(p.d.getElementById('resend').disabled,'verify: resend should start disabled'); ok(/60s|59s/.test(p.d.getElementById('cd').textContent),'verify: no countdown');
  let boxes=[...p.d.querySelectorAll('.otp-row input')]; ok(boxes.length===6,'verify: 6 boxes');
  '000000'.split('').forEach((c,i)=>{ boxes[i].focus(); type(p.w,boxes[i],c); }); await wait(900);
  ok(p.d.querySelector('[data-error-for=otp]').textContent.length>0,'verify: wrong code gave no error'); ok(boxes.every(b=>b.value===''),'verify: boxes not cleared after wrong code'); ok(p.navs().length===0,'verify: navigated on wrong code');
  ok(p.d.querySelector('.otp-row').classList.contains('shake'),'verify: no shake');
  // paste the right code
  const ev=new p.w.Event('paste',{bubbles:true,cancelable:true}); ev.clipboardData={getData:()=> '12 34-56'}; boxes[0].dispatchEvent(ev); await wait(900);
  ok(p.navs()[0]==='reset-password.html','verify: paste of 123456 did not advance ('+p.navs()+')'); ok(mem['tf-reset-token']==='demo-token','verify: token not stored'); ok(!('tf-recovery-email' in mem),'verify: email not cleared');
  p=load('reset-password.html'); f=p.d.getElementById('resetForm'); ok(!p.d.getElementById('demoNote').hidden,'reset: demo note');
  type(p.w,f.elements.new_password,'abc'); ok(p.d.getElementById('meterLabel').textContent==='Weak','reset: meter label for weak = '+p.d.getElementById('meterLabel').textContent);
  ok(p.d.querySelectorAll('#rules li.ok').length===1,'reset: checklist should have 1 ok (letter)');
  type(p.w,f.elements.new_password,'Str0ngPassw0rd!x'); ok(p.d.getElementById('meterLabel').textContent==='Strong','reset: strong label = '+p.d.getElementById('meterLabel').textContent); ok(p.d.querySelectorAll('#rules li.ok').length===3,'reset: checklist all 3');
  type(p.w,f.elements.confirm_password,'different'); submit(p.w,f); await wait(50); ok(/match/i.test(p.d.querySelector('[data-error-for=confirm_password]').textContent),'reset: mismatch not reported'); ok(p.navs().length===0,'reset: advanced on mismatch');
  type(p.w,f.elements.confirm_password,'Str0ngPassw0rd!x'); submit(p.w,f); await wait(900);
  ok(!p.d.getElementById('doneBox').hidden&&f.hidden,'reset: done box not shown'); ok(!('tf-reset-token' in mem),'reset: token not cleared'); await wait(3000); ok(p.navs()[0]==='login.html','reset: no redirect to login ('+p.navs()+')');
  // ---------- GUARDS ----------
  p=load('verify-otp.html'); ok(p.navs()[0]==='forgot-password.html','guard: verify without email should redirect');
  p=load('reset-password.html'); ok(p.navs()[0]==='forgot-password.html','guard: reset without token should redirect');
  // ---------- LIVE MODE against the real 501 stub (via fake fetch) ----------
  const calls=[]; const fakeFetch=async(url,o)=>{calls.push([url,o.method,o.headers['X-CSRF-Token']||null]); if(url.includes('login.php')) return {ok:true,status:200,text:async()=>JSON.stringify({success:true,data:{csrf:'tok123'}})}; return {ok:false,status:501,text:async()=>JSON.stringify({success:false,message:'Password recovery is not available yet.',data:{},errors:{}})}};
  p=load('forgot-password.html',{demo:false,fetchImpl:fakeFetch}); await wait(50); f=p.d.getElementById('forgotForm');
  ok(p.d.getElementById('demoNote').hidden,'live: demo note should be hidden'); type(p.w,f.elements.email,'founder@example.com'); submit(p.w,f); await wait(100);
  ok(p.navs().length===0,'live: advanced even though backend returned 501'); const post=calls.find(c=>c[1]==='POST'); ok(post&&post[0]==='../ajax/auth/forgot-password.php','live: wrong endpoint '+JSON.stringify(post)); ok(post&&post[2]==='tok123','live: CSRF header not sent');
  ok(p.d.querySelector('.tf-toast.warning'),'live: no warning toast on 501'); ok(!p.d.querySelector('[type=submit]').disabled,'live: button not re-enabled');
  console.log(`${n} checks, ${fails.length} problem(s)`); fails.forEach(x=>console.log(' -',x)); process.exit(0);
})();
