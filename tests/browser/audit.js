const {launch,page,overflowReport}=require('./lib.js');
const PAGES=['index.html','contact.html','404.html','cpanel/login.html','cpanel/forgot-password.html','cpanel/verify-otp.html','cpanel/reset-password.html','cpanel/index.html','cpanel/projects.html','cpanel/add-project.html','cpanel/trash.html','cpanel/messages.html','cpanel/profile.html','cpanel/settings.html'];
const WIDTHS=(process.env.W||'320,360,390,430,768,1024').split(',').map(Number);
(async()=>{ const b=await launch(); let bad=0;
  for(const w of WIDTHS){ const p=await page(b,w,800,false);
    for(const pg of PAGES){
      // reset page needs a token in sessionStorage, otherwise it redirects away
      await p.evaluateOnNewDocument(()=>{ try{sessionStorage.setItem('tf-reset-token','demo-token');sessionStorage.setItem('tf-recovery-email','founder@example.com');}catch(e){} });
      await p.goto('http://127.0.0.1:8123/'+pg,{waitUntil:'networkidle0',timeout:20000}).catch(e=>console.log('NAV FAIL',pg,String(e).slice(0,80))); await new Promise(r=>setTimeout(r,pg.includes('/')?400:1900));
      const r=await p.evaluate(overflowReport,w); if(r.sideways||r.culprits.length){ bad++; console.log(`[${w}px] ${pg}: content ${r.contentWidth}px > viewport ${r.viewport}px ${r.sideways?'SIDEWAYS':''}`); r.culprits.slice(0,4).forEach(c=>console.log('      ',c.el,'left',c.left,'right',c.right)); }
    } await p.close(); }
  console.log(bad?`\n${bad} page/width combos overflow`:'\nNO sideways overflow on any page at any width'); await b.close(); })();
