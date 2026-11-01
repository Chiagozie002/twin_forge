const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..'); const fails=[]; let n=0;
const ok=(c,m)=>{n++; if(!c) fails.push(m)}; const wait=ms=>new Promise(r=>setTimeout(r,ms));
function load(page,scripts){
  const html=fs.readFileSync(path.join(ROOT,'cpanel',page),'utf8').replace(/<script[^>]*src=[^>]*><\/script>/g,'');
  const dom=new JSDOM(html,{url:'http://localhost/cpanel/'+page,runScripts:'outside-only',pretendToBeVisual:true}); const w=dom.window, ctx=dom.getInternalVMContext();
  w.matchMedia=()=>({matches:false}); w.URL.createObjectURL=()=>'blob:x';
  new vm.Script("var bootstrap={Modal:{getOrCreateInstance:()=>({show(){},hide(){}}),getInstance:()=>({hide(){}})}};").runInContext(ctx);
  for(const f of scripts) new vm.Script(fs.readFileSync(path.join(ROOT,f),'utf8'),{filename:f}).runInContext(ctx);
  return {w,d:w.document};
}
const type=(w,el,v)=>{el.value=v; el.dispatchEvent(new w.Event('input',{bubbles:true}))};
const submit=(w,f)=>f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
const pick=(w,input,file)=>{ Object.defineProperty(input,'files',{value:file?[file]:[],configurable:true}); input.dispatchEvent(new w.Event('change',{bubbles:true})); };
const err=(d,sel,name)=>d.querySelector(`${sel} [data-error-for="${name}"]`)?.textContent||'';
const BASE=['assets/js/toast.js','assets/js/api.js','assets/js/validators.js'];
const BIG={name:'big.png',type:'image/png',size:500*1024*1024}, SVG={name:'x.svg',type:'image/svg+xml',size:900}, TXT={name:'a.txt',type:'text/plain',size:10};
(async()=>{
  // ================= PROJECT EDIT / DELETE / SEARCH =================
  let {w,d}=load('projects.html',[...BASE,'assets/js/demo-data.js','cpanel/assets/js/cpanel.js','cpanel/assets/js/projects.js']); await wait(200);
  const rows=()=>[...d.querySelectorAll('#projRows tr')].filter(r=>r.querySelector('.thumb'));
  ok(rows().length===8,'projects: expected 8 rows, got '+rows().length);
  d.querySelector('button[aria-label^="Edit "]').click(); const f=d.getElementById('editForm');
  ok(f.elements.name.value==='Atlas Commerce','edit: name not prefilled ('+f.elements.name.value+')'); ok(f.elements.category.value==='Web Application','edit: category not prefilled');
  ok(f.elements.live_url.value==='' && f.elements.github_url.value==='','edit: "#" placeholder links should show as empty fields');
  ok(f.querySelectorAll('.tag-box .tech-pill').length===3,'edit: technologies not prefilled'); const pv=d.getElementById('editPreview'); ok(!pv.hidden && pv.getAttribute('src').includes('demo-1.svg'),'edit: current image not previewed');
  // validation
  type(w,f.elements.name,''); submit(w,f); await wait(30); ok(err(d,'#editForm','name')!=='','edit: empty name accepted'); ok(!d.querySelector('.tf-toast'),'edit: saved with empty name');
  type(w,f.elements.name,'Atlas Renamed'); type(w,f.elements.live_url,'abc'); submit(w,f); await wait(30); ok(err(d,'#editForm','live_url')!=='','edit: invalid URL accepted');
  type(w,f.elements.live_url,'https://example.com'); [...f.querySelectorAll('.tag-box .tech-pill button')].forEach(b=>b.click()); submit(w,f); await wait(30); ok(err(d,'#editForm','technologies')!=='','edit: saved with no technologies');
  const ti=f.querySelector('[data-tag-input]'); for(const t of ['PHP','php','','  JS  ']){ ti.value=t; ti.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})); }
  ok(f.querySelectorAll('.tag-box .tech-pill').length===2,'edit tags: expected 2 (dedupe + empty ignored), got '+f.querySelectorAll('.tag-box .tech-pill').length);
  // picture rules: optional while it already has one, any size, but must be an image
  ok(err(d,'#editForm','image')==='','edit: image error shown although project has a picture');
  pick(w,f.elements.image,SVG); ok(/real|image file/i.test(err(d,'#editForm','image')),'edit: svg accepted'); ok(pv.hidden,'edit: preview kept for rejected file');
  pick(w,f.elements.image,TXT); ok(err(d,'#editForm','image')!=='','edit: text file accepted');
  pick(w,f.elements.image,BIG); ok(err(d,'#editForm','image')==='','edit: 500MB png rejected (size limit should be gone): '+err(d,'#editForm','image')); ok(!pv.hidden&&pv.getAttribute('src')==='blob:x','edit: new image not previewed');
  submit(w,f); await wait(60); ok(!!d.querySelector('.tf-toast.info'),'edit: no demo toast on valid save'); ok(/not saved/i.test(d.querySelector('.tf-toast p')?.textContent||''),'edit: demo toast should say NOT saved');
  await wait(100); const first=rows()[0]; ok(first.textContent.includes('Atlas Renamed'),'edit: list not refreshed with new name'); ok(first.querySelector('.thumb').getAttribute('src')==='blob:x','edit: list thumbnail not updated');
  // delete (soft)
  d.querySelector('button[aria-label^="Delete "]').click(); ok(d.getElementById('delName').textContent==='Atlas Renamed','delete: modal shows wrong name'); d.getElementById('delConfirm').click(); await wait(200);
  ok(rows().length===7,'delete: expected 7 rows, got '+rows().length);
  // search
  const si=d.getElementById('projSearch'); type(w,si,'pulse'); await wait(450); ok(rows().length===1,'search: expected 1 row for "pulse", got '+rows().length);
  type(w,si,'zzzz'); await wait(450); ok(d.querySelector('#projRows').textContent.includes('No projects match'),'search: no empty state');

  // ================= ADD PROJECT =================
  ({w,d}=load('add-project.html',[...BASE,'assets/js/demo-data.js','cpanel/assets/js/cpanel.js','cpanel/assets/js/add-project.js'])); await wait(100);
  const af=d.getElementById('addForm'); submit(w,af); await wait(30);
  for(const k of ['name','category','short_description','description','technologies']) ok(err(d,'#addForm',k)!=='','add: no error for empty '+k);
  ok(err(d,'#addForm','image')==='Please choose a project image.','add: missing picture message wrong: '+err(d,'#addForm','image'));
  for(const [k,v] of [['name','Orbit Shop'],['category','Website'],['short_description','A short description.'],['description','A long enough full description text.']]) type(w,af.elements[k],v);
  const at=af.querySelector('[data-tag-input]'); at.value='PHP'; at.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  submit(w,af); await wait(30); ok(err(d,'#addForm','image')!=='','add: submitted all valid fields but NO picture (must be blocked)'); ok(!d.querySelector('.tf-toast'),'add: success toast shown without a picture');
  pick(w,af.elements.image,TXT); ok(/image file/i.test(err(d,'#addForm','image')),'add: text file accepted as picture');
  pick(w,af.elements.image,BIG); ok(err(d,'#addForm','image')==='','add: large png rejected'); ok(!d.getElementById('addPreview').hidden,'add: no preview');
  submit(w,af); submit(w,af); await wait(60); ok(d.querySelectorAll('.tf-toast').length===1,'add: double submit created '+d.querySelectorAll('.tf-toast').length+' toasts'); ok(/NOT saved/.test(d.querySelector('.tf-toast p').textContent),'add: demo toast must say NOT saved');
  await wait(50); ok(af.elements.name.value===''&&d.getElementById('addPreview').hidden&&af.querySelectorAll('.tech-pill').length===0,'add: form not reset after success');

  // ================= PROFILE PICTURE: add / change / cancel / remove =================
  ({w,d}=load('profile.html',[...BASE,'cpanel/assets/js/cpanel.js','cpanel/assets/js/profile.js'])); await wait(100);
  const g=id=>d.getElementById(id); ok(g('pfRemove').hidden&&g('pfSave').hidden&&g('pfCancel').hidden,'profile: only the Add button should show at first'); ok(g('pfEditLabel').textContent==='Add picture','profile: label '+g('pfEditLabel').textContent);
  pick(w,g('pfFile'),SVG); ok(g('pfErr').textContent!==''&&g('pfSave').hidden,'profile: svg should be rejected');
  pick(w,g('pfFile'),BIG); ok(g('pfErr').textContent===''&&!g('pfSave').hidden&&!g('pfCancel').hidden,'profile: large image should be accepted for preview'); ok(g('pfNote').textContent.includes('Not saved'),'profile: preview note missing'); ok(g('pfEditLabel').textContent==='Change picture','profile: label should become Change');
  g('pfCancel').click(); ok(g('pfSave').hidden&&g('pfImg').hidden,'profile: cancel should discard the preview');
  pick(w,g('pfFile'),BIG); g('pfSave').click(); await wait(60); ok(!!d.querySelector('.tf-toast.info'),'profile: demo save toast missing');
  ok(!g('pfRemove').hidden&&g('pfSave').hidden,'profile: after save the Remove button should appear'); ok(g('uInitial').style.backgroundImage.includes('blob:x'),'profile: top-bar avatar not updated'); ok(g('uAvatarLg').style.backgroundImage.includes('blob:x'),'profile: dropdown avatar not updated');
  g('pfRemove').click(); g('removeConfirm').click(); await wait(80);
  ok(g('pfRemove').hidden&&g('pfImg').hidden&&g('pfEditLabel').textContent==='Add picture','profile: removal not reflected'); ok(g('uInitial').textContent==='D'&&g('uInitial').style.backgroundImage==='','profile: top-bar avatar should fall back to the initial');
  console.log(`${n} checks, ${fails.length} problem(s)`); fails.forEach(x=>console.log(' -',x)); process.exit(0);
})();
