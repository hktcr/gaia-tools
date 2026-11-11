import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const folder='moten/ai-2026-11-11/presentation/';
const html=readFileSync(folder+'index.html','utf8');
const manifest=JSON.parse(readFileSync(folder+'release.json','utf8'));
for(const [f,sha] of Object.entries(manifest.sha256))assert.equal(createHash('sha256').update(readFileSync(folder+f)).digest('hex'),sha,'Integrity '+f);
assert.equal((html.match(/class="export-page"/g)||[]).length,18);
assert.equal((html.match(/data:image\/jpeg;base64,/g)||[]).length,1,'One shared artwork');
assert.ok(!/<script[^>]+src=|<link[^>]+stylesheet/.test(html),'Standalone resources');
const root=resolve('.');
const server=createServer((req,res)=>{try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end()}if(!extname(path))path=resolve(path,'index.html');res.setHeader('Content-Type',extname(path)==='.html'?'text/html; charset=utf-8':extname(path)==='.pdf'?'application/pdf':'application/octet-stream');res.end(readFileSync(path))}catch{res.writeHead(404);res.end('Not found')}});
await new Promise(r=>server.listen(8766,'127.0.0.1',r));
const url='http://127.0.0.1:8766/'+folder;
const browser=await chromium.launch({channel:'chrome'});
mkdirSync('presentation-test-output',{recursive:true});
const errors=[],report={release:manifest.release,checks:[],performance:null};
function pass(s){report.checks.push(s);console.log('PASS: '+s)}
const state=p=>p.locator('#presenter').getAttribute('data-motion-state');
const slide=p=>p.locator('#presenter').getAttribute('data-slide');
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 assert.equal((await page.goto(url)).status(),200);await page.evaluate(()=>document.fonts.ready);
 assert.ok(await page.evaluate(()=>document.fonts.check('24px "URW Gothic"')));
 assert.equal(await slide(page),'1');assert.equal(await state(page),'running');
 const text0=await page.locator('.export-page.active svg text').allTextContents();
 assert.ok(text0.join(' ').includes('Vad finns kvar'));
 const count0=await page.evaluate(()=>document.getAnimations().length);assert.ok(count0>500&&count0<600);
 await page.screenshot({path:'presentation-test-output/first-growing.png'});
 const t0=await page.evaluate(()=>document.getAnimations()[0].currentTime);
 await page.keyboard.press('PageUp');await page.waitForTimeout(100);
 assert.ok(await page.evaluate(()=>document.getAnimations()[0].currentTime)>=t0,'Boundary must not restart');
 await page.locator('#pause').click();
 const paused=await page.evaluate(()=>document.getAnimations().map(a=>a.currentTime));
 await page.waitForTimeout(150);assert.deepEqual(await page.evaluate(()=>document.getAnimations().map(a=>a.currentTime)),paused);
 await page.locator('#pause').click();
 report.performance=await page.evaluate(()=>new Promise(done=>{let first=performance.now(),last=first,t=[];function frame(now){t.push(now-last);last=now;if(now-first<2000)requestAnimationFrame(frame);else done({frames:t.length,meanMs:(now-first)/t.length,maxMs:Math.max(...t),over100Ms:t.filter(x=>x>100).length})}requestAnimationFrame(frame)}));
 assert.ok(report.performance.frames>15,'Animation must keep rendering');
 assert.deepEqual(await page.locator('.export-page.active svg text').allTextContents(),text0);
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.export-page.active .branch')].some(el=>getComputedStyle(el).stroke!==el.getAttribute('stroke'))));
 await page.screenshot({path:'presentation-test-output/first-mid-reveal.png'});
 await page.waitForFunction(()=>document.getElementById('presenter').dataset.motionState==='rest',{},{timeout:12000});
 assert.equal(await page.evaluate(()=>document.getAnimations().length),0);
 assert.ok(await page.evaluate(()=>getComputedStyle(document.querySelector('.export-page.active .paint-reveal')).opacity==='1'));
 await page.screenshot({path:'presentation-test-output/first-rest.png'});
 pass('Actual timed reveal, colour motion, pause/resume, boundary, stationary text and final rest');
 await page.locator('#next').click();assert.equal(await slide(page),'2');assert.equal(await state(page),'rest');
 await page.locator('#prev').click();assert.equal(await state(page),'rest');
 await page.locator('#replay').click();assert.equal(await state(page),'running');
 await page.locator('#motion').click();assert.equal(await state(page),'rest');assert.equal(await page.evaluate(()=>document.getAnimations().length),0);assert.ok(await page.locator('#replay').isDisabled());
 await page.reload();assert.ok(await page.locator('#replay').isDisabled());assert.equal(await state(page),'rest');
 await page.locator('#motion').click();assert.equal(await state(page),'rest');await page.locator('#replay').click();assert.equal(await state(page),'running');
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await state(page),'rest');assert.ok(await page.locator('#replay').isDisabled());
 await page.emulateMedia({reducedMotion:'no-preference'});assert.equal(await state(page),'rest');
 pass('Return visits, explicit replay, persisted still mode and live reduced-motion changes');
 await page.locator('#next').focus();await page.keyboard.press('Space');assert.equal(await slide(page),'2');
 await page.keyboard.press('End');assert.equal(await slide(page),'18');assert.equal(await state(page),'rest');assert.ok(await page.locator('#replay').isDisabled());
 const ending=await page.locator('.export-page.active .fractal').innerHTML();
 await page.keyboard.press('Home');assert.equal(await page.locator('.export-page.active .fractal').innerHTML(),ending);
 await page.locator('#notes-toggle').click();assert.ok(await page.locator('#notes').isVisible());assert.ok((await page.locator('#notes-copy').textContent()).length>100);await page.locator('#notes-toggle').click();assert.ok(await page.locator('#notes').isHidden());
 await page.locator('#full').click();assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'presenter');await page.keyboard.press('Escape');
 pass('Keyboard/button semantics, notes, identical still closing motif, fullscreen');
 // All 18 final HTML views, at the same 1280x720 ratio as the PDF.
 await page.emulateMedia({reducedMotion:'reduce'});
 for(let i=1;i<=18;i++){
  if(i>1)await page.keyboard.press('ArrowRight');assert.equal(await slide(page),String(i));assert.equal(await page.locator('.export-page.active').count(),1);
  assert.ok(await page.locator('.export-page.active svg').isVisible());
  const bbox=await page.locator('.export-page.active svg').boundingBox();assert.ok(bbox.width>100&&bbox.height>100);
  await page.locator('.export-page.active svg').screenshot({path:`presentation-test-output/slide-${String(i).padStart(2,'0')}.png`});
 }
 await context.setOffline(true);await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.equal(await slide(page),'2');await page.locator('#notes-toggle').click();assert.ok(await page.locator('#notes').isVisible());
 pass('All 18 HTML views and offline navigation/notes after loading');
 await context.setOffline(false);const pdf=await context.request.get(url+'AI_och_undervisning_backup_2026-11-11.pdf');assert.equal(pdf.status(),200);assert.equal(createHash('sha256').update(await pdf.body()).digest('hex'),manifest.sha256['AI_och_undervisning_backup_2026-11-11.pdf']);
 await context.close();
 for(const width of [390,768,1024,1440]){
  const c=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,reducedMotion:'reduce',colorScheme:'dark'});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.evaluate(()=>document.fonts.ready);
  assert.equal(await state(p),'rest');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.locator('#next')[width===390?'tap':'click']();assert.equal(await slide(p),'2');
  for(const id of ['prev','next','full','notes-toggle']){const b=await p.locator('#'+id).boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=901,id+' in viewport '+width)}
  await p.screenshot({path:`presentation-test-output/responsive-${width}.png`});await c.close();
 }
 pass('Chrome 390/768/1024/1440, touch, dark preference, no horizontal overflow');
 assert.deepEqual(errors,[]);pass('No browser script errors');
 if(process.env.GITHUB_REF==='refs/heads/main'){
  const live='https://hktcr.github.io/gaia-tools/'+folder;
  let actual='';for(let attempt=0;attempt<60;attempt++){const r=await fetch(live+'?release='+process.env.GITHUB_SHA+'&a='+attempt,{signal:AbortSignal.timeout(15000)});actual=await r.text();if(r.ok&&actual===html)break;await new Promise(r=>setTimeout(r,5000))}assert.equal(actual,html,'Live HTML bytes');
  const p=await browser.newPage();await p.goto(live+'?release='+process.env.GITHUB_SHA);assert.equal(await slide(p),'1');await p.locator('#next').click();assert.equal(await slide(p),'2');await p.close();pass('Public Pages exact HTML and navigation');
 }
}finally{writeFileSync('presentation-test-output/report.json',JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r))}
