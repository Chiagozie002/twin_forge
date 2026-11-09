const puppeteer=require('puppeteer-core'),fs=require('fs'),path=require('path');
const NM=path.join(__dirname,'node_modules'); const MIME={css:'text/css',js:'application/javascript',woff2:'font/woff2',woff:'font/woff',ttf:'font/ttf'};
exports.launch=async()=>{ const chromium=(await import('@sparticuz/chromium')).default; return puppeteer.launch({executablePath:await chromium.executablePath(),args:[...chromium.args,'--no-sandbox','--disable-gpu'],headless:'shell'}); };
// serve CDN assets from local npm copies (no internet here); drop Google Fonts (fallback fonts are used)
exports.page=async(b,w,h,mobile=true)=>{ const p=await b.newPage(); await p.setViewport({width:w,height:h,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile}); await p.setRequestInterception(true);
  p.on('request',r=>{ const u=r.url(); let f=null;
    if(u.includes('bootstrap.min.css')) f=NM+'/bootstrap/dist/css/bootstrap.min.css'; else if(u.includes('bootstrap.bundle.min.js')) f=NM+'/bootstrap/dist/js/bootstrap.bundle.min.js';
    else if(u.includes('font-awesome')&&u.endsWith('all.min.css')) f=NM+'/@fortawesome/fontawesome-free/css/all.min.css'; else if(u.includes('/webfonts/')) f=NM+'/@fortawesome/fontawesome-free/webfonts/'+u.split('/webfonts/')[1].split('?')[0];
    else if(u.includes('fonts.googleapis.com')) return r.respond({status:200,contentType:'text/css',body:''}); else if(u.includes('fonts.gstatic.com')) return r.abort();
    if(f&&fs.existsSync(f)) return r.respond({status:200,contentType:MIME[f.split('.').pop()]||'application/octet-stream',body:fs.readFileSync(f)});
    if(/^https?:\/\/(cdn|cdnjs|fonts)/.test(u)) return r.abort(); r.continue(); });
  return p; };
// finds elements that stick out of the viewport and are NOT clipped by an ancestor / fixed
exports.overflowReport=(W)=>{ const out=[]; const clip=el=>{ for(let a=el.parentElement;a&&a!==document.body&&a!==document.documentElement;a=a.parentElement){ const s=getComputedStyle(a); if(['hidden','auto','scroll','clip'].includes(s.overflowX)) return true; if(s.position==='fixed') return true; } return false; };
  const label=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).slice(0,3).join('.'):'');
  for(const e of document.querySelectorAll('body *')){ const s=getComputedStyle(e); if(s.display==='none'||s.visibility==='hidden'||s.position==='fixed') continue; const r=e.getBoundingClientRect(); if(!r.width||!r.height) continue;
    if((r.right>W+1||r.left<-1)&&!clip(e)) out.push({el:label(e),left:Math.round(r.left),right:Math.round(r.right),w:Math.round(r.width)}); }
  const body=document.body.style.overflowX; document.body.style.overflowX='visible'; const real=document.documentElement.scrollWidth; document.body.style.overflowX=body;
  return {viewport:W,contentWidth:real,sideways:real>W+1,culprits:out.slice(0,6)}; };
