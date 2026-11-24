const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',args:['--no-sandbox']});const url=process.argv[2]??require('node:url').pathToFileURL(require('node:path').join(__dirname,'index.html')).href;
for(const width of [390,768,1024,1440]){
const p=await b.newPage({viewport:{width,height:850},hasTouch:width<=768,isMobile:width<=768,reducedMotion:'reduce',colorScheme:'dark'});
const errs=[];p.on('pageerror',e=>errs.push(String(e)));const response=await p.goto(url,{waitUntil:'domcontentloaded'});assert(!response||response.ok());
const count=async n=>{assert.equal(await p.locator('article:visible').count(),1);assert.equal(await p.locator('#counter').textContent(),n+' / 6');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));};
const click= s=>width<=768?p.locator(s).tap():p.locator(s).click();
await count(1);assert(await p.locator('#prev').isDisabled());
await click('#next');await count(2);await p.keyboard.press('ArrowRight');await count(3);
assert.equal(await p.locator('#toggle').getAttribute('aria-pressed'),'false');await click('#toggle');assert.equal(await p.locator('#toggle').getAttribute('aria-pressed'),'true');assert.match(await p.locator('#circuit').getAttribute('aria-label'),/sluten brytare och tänd lampa/);
await click('#toggle');assert.match(await p.locator('#state').textContent(),/Bruten krets/);
await p.reload();await count(3);assert.equal(await p.locator('#toggle').getAttribute('aria-pressed'),'false');
await click('#next');await count(4);await click('#ord summary');assert(await p.locator('#ord details p').isVisible());await click('#next');await count(5);await click('#next');await count(6);assert(await p.locator('#next').isDisabled());await p.keyboard.press('ArrowLeft');await count(5);
assert.deepEqual(errs,[]);await p.close();
console.log('PASS',width,width<=768?'touch':'mouse','keyboard, direct hash/reload, switch state/accessibility, no overflow, answer reveal');}
const p=await b.newPage({javaScriptEnabled:false,viewport:{width:390,height:850}});await p.goto(url);assert.equal(await p.locator('article:visible').count(),6);console.log('PASS JS disabled: six readable slides');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
