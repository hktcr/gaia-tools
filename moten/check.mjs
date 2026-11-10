import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const files=JSON.parse(readFileSync('moten/release-manifest.json','utf8'));
for(const [path,sha] of Object.entries(files)) assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim(),sha,'Git blob integrity: '+path);
const before=readFileSync('moten/ai-2026-11-11/index.html','utf8');
for(let i=0;i<2;i++){
 execFileSync(process.execPath,['moten/build.mjs']);
 assert.equal(readFileSync('moten/ai-2026-11-11/index.html','utf8'),before,'Deterministic build '+(i+1));
}
execFileSync(process.execPath,['--check','moten/assets/article-reader.js']);
const data=JSON.parse(readFileSync('moten/ai-2026-11-11/studies.json','utf8'));
assert.equal(data.studies.length,18);assert.equal(new Set(data.studies.map(s=>s.id)).size,18);
for(const s of data.studies){assert.ok(s.limit.length>30);assert.ok(s.finding.length>30);assert.equal(new URL(s.url).protocol,'https:');}
const root=resolve('.');
const server=createServer((req,res)=>{try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end()}if(path.endsWith(sep)||!extname(path))path=resolve(path,'index.html');const body=readFileSync(path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.webp':'image/webp','.ttf':'font/ttf','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(body)}catch{res.writeHead(404);res.end('Not found')}});
await new Promise(r=>server.listen(8765,'127.0.0.1',r));
mkdirSync('moten-test-output',{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const errors=[];
const local='http://127.0.0.1:8765/moten/ai-2026-11-11/';
const publicUrl='https://hktcr.github.io/gaia-tools/moten/ai-2026-11-11/';
const sample=data.studies.find(s=>s.id==='pack').url;
const stub='<title>Original destination</title><h1>Original article</h1><a href="#section">Article section</a><p id="section">Publisher content</p>';
async function mockOriginals(context,siteUrl){
 const origin=new URL(siteUrl).origin;
 await context.route('https://**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.fulfill({status:200,contentType:'text/html',body:stub}));
}
async function readerCheck(page,width,keyboard=false){
 const link=page.locator('#pack .study-link');
 await link.scrollIntoViewIfNeeded();
 const scroll=await page.evaluate(()=>scrollY),url=page.url(),history=await page.evaluate(()=>window.history.length);
 if(keyboard){await link.focus();await page.keyboard.press('Enter');}else await link[width===390?'tap':'click']();
 assert.ok(await page.locator('#article-reader').isVisible());
 assert.equal(await page.locator('#reader-close').evaluate(e=>e===document.activeElement),true,'Initial dialog focus');
 assert.equal(await page.locator('#reader-viewport iframe').getAttribute('src'),sample);
 await page.frameLocator('#reader-viewport iframe').getByText('Original article',{exact:true}).waitFor({state:'visible'});
 assert.ok(await page.frameLocator('#reader-viewport iframe').getByText('Original article',{exact:true}).isVisible(),'Original frame content rendered');
 assert.equal(page.url(),url,'The meeting page stays open');
 assert.equal(await page.evaluate(()=>window.history.length),history,'No extra history entry');
 assert.equal(await page.locator('#reader-external').getAttribute('href'),sample);
 assert.equal(await page.locator('#reader-external').getAttribute('rel'),'noopener noreferrer');
 assert.ok(await page.locator('#reader-help').isVisible(),'Embedding limitation always visible');
 const bounds=await page.locator('#article-reader').boundingBox();
 assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,'Dialog within viewport');
 assert.ok(parseFloat(await page.locator('#article-reader').evaluate(e=>getComputedStyle(e).borderRadius))>=16);
 await page.screenshot({path:'moten-test-output/reader-'+width+'.png'});
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#article-reader').isVisible(),false);
 assert.equal(await page.locator('#reader-viewport iframe').count(),0);
 assert.ok(await link.evaluate(e=>e===document.activeElement),'Focus restored');
 assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<2,'Scroll position preserved');
 // Repeated opening, another source, and explicit close.
 await link.click();await page.locator('#reader-close').click();
 await page.locator('#learnlm-uk .study-link').click();
 assert.ok((await page.locator('#reader-viewport iframe').getAttribute('src')).endsWith('.pdf'));
 assert.equal(await page.locator('#reader-viewport iframe').getAttribute('sandbox'),null,'Native PDF viewer not sandboxed');
 await page.locator('#reader-close').click();
 await link.click();
 const popupPromise=page.waitForEvent('popup');await page.locator('#reader-external').click();const popup=await popupPromise;await popup.waitForLoadState();
 assert.equal(popup.url(),sample);assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();
 assert.ok(await page.locator('#article-reader').isVisible());await page.locator('#reader-close').click();
}
try{
 for(const width of [390,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390});
  await mockOriginals(context,local);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  assert.equal((await page.goto(local)).status(),200);await page.evaluate(()=>document.fonts.ready);
  assert.ok(await page.evaluate(()=>document.fonts.check('17px "Liberation Sans"')));
  assert.equal(await page.locator('h1').textContent(),'AI i undervisningen');
  assert.equal(await page.locator('.study:visible').count(),7);
  assert.ok((await page.locator('.meeting-header').boundingBox()).height<350);
  await page.locator('#learnlm-uk summary')[width===390?'tap':'click']();assert.ok(await page.locator('#learnlm-uk .notes-body').isVisible());await page.locator('#learnlm-uk summary').click();
  assert.equal(await page.locator('.study-link').count(),18);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow '+width);
  const anchors=await page.locator('.study-link').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
  assert.deepEqual([...anchors].sort(),data.studies.map(s=>s.url).sort());
  const image=await context.request.get('http://127.0.0.1:8765/moten/assets/academic-futures.webp');assert.equal(image.status(),200);assert.ok((await image.body()).length>50000);
  await page.screenshot({path:'moten-test-output/'+width+'.png'});
  await readerCheck(page,width,width===1024);
  await page.locator('#extra-studies > summary')[width===390?'tap':'click']();assert.equal(await page.locator('.study:visible').count(),18);
  await page.locator('#remiss-excerpts > summary')[width===390?'tap':'click']();assert.equal(await page.locator('.quotes q:visible').count(),6);
  // Every original, including PDF page fragments, is preserved in both modal and fallback.
  const links=page.locator('main a[href^="https://"]');assert.equal(await links.count(),25);
  for(let i=0;i<await links.count();i++){
   const link=links.nth(i),href=await link.getAttribute('href');await link.click();
   assert.equal(await page.locator('#reader-viewport iframe').getAttribute('src'),new URL(href).href);
   assert.equal(await page.locator('#reader-external').getAttribute('href'),new URL(href).href);
   await page.locator('#reader-close').click();
  }
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'moten-test-output/'+width+'-dark.png'});
  await page.locator('#pack .study-link').click();await page.screenshot({path:'moten-test-output/reader-'+width+'-dark.png'});await page.locator('#reader-close').click();
  if(width===1440){
   await page.goto(local);await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Hoppa till innehållet');await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'innehall');
   await page.locator('#pack .study-link').focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').getAttribute('id'),'reader-external');
   await page.keyboard.press('Tab');await page.keyboard.press('Tab');
   // Native dialogs may cycle through browser chrome. They must not focus the inert page.
   for(let i=0;i<8;i++){
    assert.ok(await page.evaluate(()=>document.querySelector('#article-reader').matches(':modal')&&!document.activeElement.closest('.page')),'Keyboard cannot reach the page behind the dialog');
    await page.keyboard.press('Tab');
   }
   await page.locator('#reader-close').click();
   await page.locator('#pack .study-link').click();await page.mouse.click(4,4);assert.equal(await page.locator('#article-reader').isVisible(),false,'Backdrop closes');
   // Explicit publisher framing denial: no attempt to strip or bypass the policy.
   await page.route(sample,route=>route.fulfill({status:200,headers:{'Content-Type':'text/html','X-Frame-Options':'DENY','Content-Security-Policy':"frame-ancestors 'none'"},body:stub}));
   await page.locator('#pack .study-link').click();assert.ok(await page.locator('#reader-external').isVisible());
   const p=page.waitForEvent('popup');await page.locator('#reader-external').click();const tab=await p;await tab.waitForLoadState();assert.equal(tab.url(),sample);await tab.close();await page.locator('#reader-close').click();
   // A short viewport (landscape/zoom) must leave controls reachable by scrolling.
   await page.setViewportSize({width:640,height:280});await page.locator('#pack .study-link').click();
   await page.locator('#reader-external').scrollIntoViewIfNeeded();assert.ok(await page.locator('#reader-external').isVisible());
   const rect=await page.locator('#reader-external').boundingBox();assert.ok(rect.y>=0&&rect.y+rect.height<=280);
   await page.screenshot({path:'moten-test-output/reader-short-viewport.png'});await page.locator('#reader-close').click();
  }
  await context.close();console.log('PASS: Chrome '+width+' layout, originals, reader, close/reopen, fallback, dark/reduced motion');
 }
 const noJs=await browser.newContext({javaScriptEnabled:false});await mockOriginals(noJs,local);const noJsPage=await noJs.newPage();await noJsPage.goto(local);await noJsPage.locator('#pack .study-link').click();await noJsPage.waitForURL(sample);assert.equal(noJsPage.url(),sample);await noJs.close();
 const modified=await browser.newContext();await mockOriginals(modified,local);const mp=await modified.newPage();await mp.goto(local);
 // A native middle-click emits auxclick; headless Chrome does not consistently open a background tab.
 // Verify that the enhancement leaves both auxiliary and modified clicks uncancelled.
 await mp.evaluate(()=>{document.addEventListener('click',e=>{if(e.ctrlKey)window.modifiedPrevented=e.defaultPrevented});document.addEventListener('auxclick',e=>{window.auxPrevented=e.defaultPrevented});});
 await mp.locator('#pack .study-link').click({button:'middle'});assert.equal(await mp.evaluate(()=>window.auxPrevented),false);assert.equal(await mp.locator('#article-reader').isVisible(),false);
 await mp.locator('#pack .study-link').click({modifiers:['Control']});assert.equal(await mp.evaluate(()=>window.modifiedPrevented),false);assert.equal(await mp.locator('#article-reader').isVisible(),false);await modified.close();
 const rootPage=await browser.newPage();await rootPage.goto('http://127.0.0.1:8765/moten/');await rootPage.locator('.meeting-link').click();assert.ok(rootPage.url().endsWith('/ai-2026-11-11/'));await rootPage.close();
 assert.deepEqual(errors,[]);
 console.log('PASS: Git blob integrity, two identical builds, syntax, 18 studies/25 source links, keyboard, mouse/touch, denied frames, no-JS/middle-click, short viewport, hub navigation.');
 const response=await fetch('https://hktcr.github.io/gaia-tools/?check=ai-2026-11-11',{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);assert.match(await response.text(),/gAIa|GAIA|gaia/i);
 console.log('PASS: canonical public Pages base');
 if(process.env.GITHUB_REF==='refs/heads/main'){
  let live='';
  for(let attempt=0;attempt<60;attempt++){
   const response=await fetch(publicUrl+'?release='+process.env.GITHUB_SHA+'&attempt='+attempt,{signal:AbortSignal.timeout(15000)});live=await response.text();if(response.ok&&live===before)break;await new Promise(r=>setTimeout(r,5000));
  }
  assert.equal(live,before,'Published HTML equals tested HTML');
  for(const path of Object.keys(files).filter(p=>p.startsWith('moten/assets/')&&!p.endsWith('.txt'))){
   const response=await fetch('https://hktcr.github.io/gaia-tools/'+path+'?release='+process.env.GITHUB_SHA,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,'Published asset '+path);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),files[path],'Published asset integrity '+path);
  }
  for(const width of [390,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390});await mockOriginals(context,publicUrl);const page=await context.newPage();await page.goto(publicUrl+'?release='+process.env.GITHUB_SHA);await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('.study-link').count(),18);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await readerCheck(page,width,width===1024);await context.close();
  }
  console.log('PASS: public HTML/assets equal release, public Chrome 390/768/1024/1440 mouse/touch/keyboard, modal content and fallback.');
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
