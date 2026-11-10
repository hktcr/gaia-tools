import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
const files=JSON.parse(readFileSync('moten/release-manifest.json','utf8'));
for(const [path,sha] of Object.entries(files)){
 assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim(),sha,'Git blob integrity: '+path);
}
const before=readFileSync('moten/ai-2026-11-11/index.html','utf8');
execFileSync(process.execPath,['moten/build.mjs']);
assert.equal(readFileSync('moten/ai-2026-11-11/index.html','utf8'),before,'First deterministic build');
execFileSync(process.execPath,['moten/build.mjs']);
assert.equal(readFileSync('moten/ai-2026-11-11/index.html','utf8'),before,'Second deterministic build');
const data=JSON.parse(readFileSync('moten/ai-2026-11-11/studies.json','utf8'));
assert.equal(data.studies.length,18);
assert.equal(new Set(data.studies.map(s=>s.id)).size,18);
for(const s of data.studies){assert.ok(s.limit.length>30);assert.ok(s.finding.length>30);assert.equal(new URL(s.url).protocol,'https:');}
const root=resolve('.');
const server=createServer((req,res)=>{try{let path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);return res.end()}if(path.endsWith(sep)||!extname(path))path=resolve(path,'index.html');const body=readFileSync(path);res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(body)}catch{res.writeHead(404);res.end('Not found')}});
await new Promise(r=>server.listen(8765,'127.0.0.1',r));
mkdirSync('moten-test-output',{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const errors=[];
try{
 for(const width of [390,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('http://127.0.0.1:8765/moten/ai-2026-11-11/');
  assert.equal(response.status(),200);
  assert.equal(await page.locator('h1').textContent(),'AI iundervisningen.');
  assert.equal(await page.locator('.study-link').count(),18);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow at '+width);
  const anchors=await page.locator('.study-link').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
  assert.deepEqual(anchors,data.studies.map(s=>s.url).filter(Boolean).sort((a,b)=>anchors.indexOf(a)-anchors.indexOf(b)));
  const image=await context.request.get('http://127.0.0.1:8765/moten/assets/ink-paper.png');assert.equal(image.status(),200);assert.ok((await image.body()).length>100000);
  await page.locator('.more summary').first()[width===390?'tap':'click']();
  assert.ok(await page.locator('#wang').isVisible(),'Details opens');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Expanded overflow '+width);
  await page.screenshot({path:'moten-test-output/'+width+'.png',fullPage:true});
  await page.emulateMedia({colorScheme:'dark',reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'moten-test-output/'+width+'-dark.png',fullPage:true});
  if(width===1440){
   await page.goto('http://127.0.0.1:8765/moten/ai-2026-11-11/');
   await page.keyboard.press('Tab');assert.equal(await page.locator(':focus').textContent(),'Hoppa till innehållet');
   await page.keyboard.press('Enter');assert.equal(await page.locator(':focus').getAttribute('id'),'innehall');
   await page.locator('.more summary').first().focus();await page.keyboard.press('Enter');assert.ok(await page.locator('#wang').isVisible());
   const original=data.studies.find(s=>s.id==='pack').url;
   await page.route(original,route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Original destination</title>'}));
   await page.locator('#pack .study-link').click();await page.waitForURL(original);assert.equal(page.url(),original);
  }
  await context.close();
 }
 const rootPage=await browser.newPage();await rootPage.goto('http://127.0.0.1:8765/moten/');await rootPage.locator('.meeting-link').click();assert.ok(rootPage.url().endsWith('/ai-2026-11-11/'));await rootPage.close();
 assert.deepEqual(errors,[]);
 console.log('PASS: Git blob checks, two identical builds, 18 original links, Chrome 390/768/1024/1440, mouse/touch/keyboard, dark/reduced motion, expandable studies, hub navigation.');
 // Confirm the existing public site and its canonical path before moving main.
 const response=await fetch('https://hktcr.github.io/gaia-tools/?check=ai-2026-11-11',{signal:AbortSignal.timeout(30000)});
 assert.equal(response.status,200,'Existing Pages site is reachable');
 assert.match(await response.text(),/gAIa|GAIA|gaia/i);
 console.log('PASS: canonical public Pages base https://hktcr.github.io/gaia-tools/');
}finally{await browser.close();await new Promise(r=>server.close(r));}
