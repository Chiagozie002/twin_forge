const {launch,page}=require('./lib.js'); const wait=ms=>new Promise(r=>setTimeout(r,ms)); const U='http://127.0.0.1:8123/';
(async()=>{ const b=await launch();
 // ---------- 1. reset-password: can a person scroll down to the submit button? ----------
 for(const [w,h] of [[360,640],[390,700],[320,560]]){
  const p=await page(b,w,h,false); await p.evaluateOnNewDocument(()=>{try{sessionStorage.setItem('tf-reset-token','demo-token')}catch(e){}});
  await p.goto(U+'cpanel/reset-password.html',{waitUntil:'networkidle0'}); await wait(300);
  const m=await p.evaluate(()=>{const pn=document.querySelector('.auth-panel').getBoundingClientRect(); return {panelTop:Math.round(pn.top),panelBottom:Math.round(pn.bottom),vh:innerHeight,docH:document.documentElement.scrollHeight}});
  await p.mouse.move(w/2,h/2); await p.mouse.wheel({deltaY:2000}); await wait(400);
  const r=await p.evaluate(()=>{const bt=document.querySelector('#resetForm [type=submit]').getBoundingClientRect(); return {scrollY:Math.round(scrollY),btnTop:Math.round(bt.top),btnBottom:Math.round(bt.bottom),vh:innerHeight}});
  console.log(`reset-password ${w}x${h}: panel ${m.panelTop}..${m.panelBottom} (viewport ${m.vh}); after wheel scrollY=${r.scrollY}; submit button ${r.btnTop}..${r.btnBottom} => ${r.btnBottom<=r.vh&&r.btnTop>=0?'REACHABLE':'NOT REACHABLE'}${m.panelTop<0?'  (top of panel cut off!)':''}`); await p.close(); }
 // ---------- 2. public navbar: which link is active where? ----------
 const names=l=>l.map(a=>a.textContent.trim());
 const active=p=>p.evaluate(()=>[...new Set([...document.querySelectorAll('#siteNav .nav-link.active')].map(a=>a.textContent.trim()))].join('|')||'(none)');
 let p=await page(b,1280,800,false); await p.goto(U+'index.html',{waitUntil:'networkidle0'}); await wait(1900);
 console.log('\nDESKTOP nav: at top ->',await active(p));
 for(const id of ['services','projects','about','founders','home']){ await p.evaluate(i=>document.querySelector(`#siteNav .nav-link[data-spy="${i}"]`).click(),id); await wait(1700);
   const y=await p.evaluate(i=>Math.round(document.getElementById(i).getBoundingClientRect().top),id); console.log(`  click ${id.padEnd(9)} -> active: ${(await active(p)).padEnd(14)} | section top at ${y}px (nav is 76px)`); }
 console.log('  manual scroll:');
 for(const id of ['services','projects','about','founders']){ await p.evaluate(i=>window.scrollTo({top:document.getElementById(i).offsetTop-60,behavior:'instant'}),id); await wait(500); console.log(`   scroll to ${id.padEnd(9)} -> ${await active(p)}`); }
 for(const [lab,sel] of [['milestones','.ms-grid'],['CTA','#cta'],['footer','.tf-footer']]){ await p.evaluate(s=>document.querySelector(s).scrollIntoView({block:'center',behavior:'instant'}),sel); await wait(500); console.log(`   scroll to ${lab.padEnd(10)} -> ${await active(p)}`); }
 await p.close();
 // ---------- 3. mobile offcanvas ----------
 p=await page(b,390,800,false); await p.goto(U+'index.html',{waitUntil:'networkidle0'}); await wait(1900);
 await p.click('[data-bs-target="#navMenu"]'); await wait(700);
 const oc=await p.evaluate(()=>{const o=document.getElementById('navMenu').getBoundingClientRect(); return {left:Math.round(o.left),w:Math.round(o.width),show:document.getElementById('navMenu').classList.contains('show'),active:[...document.querySelectorAll('#navMenu .nav-link.active')].map(a=>a.textContent.trim()).join('|')||'(none)'}});
 console.log('\nMOBILE offcanvas open:',JSON.stringify(oc));
 await p.click('#navMenu .nav-link[data-spy="about"]'); await wait(1800);
 console.log('  after tapping About: offcanvas shown?',await p.evaluate(()=>document.getElementById('navMenu').classList.contains('show')),'| section top',await p.evaluate(()=>Math.round(document.getElementById('about').getBoundingClientRect().top)),'| active in menu:',await p.evaluate(()=>[...document.querySelectorAll('#navMenu .nav-link.active')].map(a=>a.textContent.trim()).join('|')||'(none)'),'| body overflow:',await p.evaluate(()=>getComputedStyle(document.body).overflow));
 await b.close(); })();
