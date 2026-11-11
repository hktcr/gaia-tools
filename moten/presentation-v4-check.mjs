/** Real-browser acceptance tests. Run ONLY in an authorized GitHub Actions job.
 * npm install --no-save playwright@1.56.1
 * npx playwright install --with-deps chromium
 * node moten/presentation-responsive-check.mjs <repository-relative HTML path>
 * Artifacts: RESPONSIVE_REPORT_DIR (default: responsive-artifacts).
 * The ephemeral server serves the checkout, never remote URLs or credentials.
 */
import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

if (process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('Browser execution is restricted to an authorized GitHub Actions job.');
}
const require = createRequire(import.meta.url);
if (require('playwright/package.json').version !== '1.56.1') throw new Error('Playwright 1.56.1 is required.');
const { chromium } = await import('playwright');
const root = path.resolve(process.cwd());
const target = process.argv[2] || process.env.RESPONSIVE_TARGET || 'moten/ai-2026-11-11/presentation/version-4/index.html';
const targetPath = path.resolve(root, target);
if (!targetPath.startsWith(root + path.sep)) throw new Error('Target must be inside the checkout.');
const output = path.resolve(process.env.RESPONSIVE_REPORT_DIR || 'responsive-artifacts');
await mkdir(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), target, commit: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
  playwright: '1.56.1', sha256: createHash('sha256').update(await readFile(targetPath)).digest('hex'), checks: [], cases: [], errors: [] };
function check(name, pass, detail = {}) { report.checks.push({ name, pass: !!pass, ...detail }); }
const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
    const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '');
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    const type = { '.html': 'text/html; charset=utf-8', '.pdf': 'application/pdf', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }); res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const url = base + '/' + path.relative(root, targetPath).split(path.sep).map(encodeURIComponent).join('/');
let browser;
async function measure(page) {
  return page.evaluate(() => {
    const rect = el => { const r = el.getBoundingClientRect(); const css = getComputedStyle(el); return {
      tag: el.tagName, id: el.id, class: typeof el.className === 'string' ? el.className : el.className.baseVal,
      text: (el.textContent || '').trim().slice(0, 110), x: r.x, y: r.y, left: r.left, right: r.right, top: r.top,
      bottom: r.bottom, width: r.width, height: r.height, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollLeft: el.scrollLeft,
      overflowX: css.overflowX, overflowY: css.overflowY, display: css.display, visibility: css.visibility }; };
    const one = selector => { const el = document.querySelector(selector); return el ? rect(el) : null; };
    return { viewport: { width: innerWidth, height: innerHeight }, document: rect(document.documentElement), body: rect(document.body),
      slide: one('#slide'), plot: one('.cc-plot'), svg: one('.cc-svg'), toolbar: one('.cc-toolbar'), status: one('.cc-status'),
      header: one('header'), dialog: one('#study-sources'),
      controls: [...document.querySelectorAll('header button, .cc-toolbar button')].map(rect),
      blocks: [...document.querySelectorAll('h1,.definition,.intro,.discussion,footer,.buttons,.cc-views,.cc-playback')].map(rect) };
  });
}
async function screenshot(page, name, item) {
  await page.screenshot({ path: path.join(output, name), fullPage: true, animations: 'disabled' });
  (item.screenshots ||= []).push(name);
}
async function openCase(name, viewport, options = {}) {
  const context = await browser.newContext({ viewport, ...options });
  // No third-party navigation, font fetches, analytics or source-site requests.
  await context.route('**/*', route => {
    const u = route.request().url();
    return u.startsWith(base + '/') || u.startsWith('data:') ? route.continue() : route.abort('blockedbyclient');
  });
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  const item = { name, viewport, options, consoleErrors: [], pageErrors: [] }; report.cases.push(item);
  page.on('pageerror', error => item.pageErrors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') item.consoleErrors.push(message.text()); });
  const response = await page.goto(url, { waitUntil: 'load' });
  check(`${name}: HTTP document`, response?.status() === 200, { status: response?.status() });
  await page.locator('.cc-toolbar').waitFor();
  await page.evaluate(() => document.fonts.ready);
  check(`${name}: correct single-slide application`, await page.locator('#slide[data-release="single-svenska-v4-1"]').count() === 1 &&
    await page.locator('.cc-plot .cc-student').count() === 12 && await page.locator('#study-sources').count() === 1);
  return { context, page, item };
}
const transforms = page => page.locator('.cc-student').evaluateAll(nodes => nodes.map(n => n.getAttribute('transform')));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function run(name, fn) {
  try { await fn(); } catch (error) { check(name, false, { error: String(error), stack: error.stack }); }
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  report.browser = browser.version();
  // Produce the v3 reserve from the same source, including sources and discussion.
  // No credentials, remote sources or deployment writes are used by this job.
  {
    const c = await browser.newContext({ viewport: { width: 1122, height: 793 } });
    const p = await c.newPage();
    await p.goto(new URL('reserve-print.html', url).href);
    await p.evaluate(() => document.fonts.ready);
    const opts = { format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true };
    const normalize = buffer => Buffer.from(buffer.toString('latin1').replace(/D:[0-9]{14}/g, 'D:20261111130555'), 'latin1');
    const one = normalize(await p.pdf(opts));
    const two = normalize(await p.pdf(opts));
    check('Reserve PDF two builds identical after fixed metadata', one.equals(two));
    await writeFile(path.join(path.dirname(targetPath), 'AI_och_undervisning_reserv_2026-11-11.pdf'), one);
    await writeFile(path.join(output, 'AI_och_undervisning_reserv_2026-11-11.pdf'), one);
    check('Reserve contains nine planned page sections', await p.locator('.print-cover,.print-page').count() === 9);
    await c.close();
  }

  for (const [width, height] of [[390, 844], [768, 1024], [1024, 768], [1440, 900], [582, 371], [388, 247]]) {
    await run(`viewport ${width}x${height}`, async () => {
      const { context, page, item } = await openCase(`${width}x${height}`, { width, height });
      try {
        item.bounds = await measure(page); const m = item.bounds;
        check(`${item.name}: no document horizontal overflow`, m.document.scrollWidth <= width + 1 && m.body.scrollWidth <= width + 1, { width: m.document.scrollWidth, body: m.body.scrollWidth });
        const overflowing = [...m.controls, ...m.blocks, m.toolbar, m.status].filter(r => r.display !== 'none' && (r.left < -1 || r.right > width + 1 || r.scrollWidth > r.clientWidth + 1));
        check(`${item.name}: header, controls and text fit`, overflowing.length === 0, { overflowing });
        check(`${item.name}: chart overflow is locally contained`, m.plot.right <= width + 1 && m.plot.left >= -1 &&
          (m.svg.width <= m.plot.width + 1 || ['auto', 'scroll'].includes(m.plot.overflowX)), { plot: m.plot, svg: m.svg });
        if (width === 1024 || width === 1440) check(`${item.name}: whole desktop slide fits height`, m.document.scrollHeight <= height + 1 && m.slide.height <= height + 1, { documentHeight: m.document.scrollHeight, slideHeight: m.slide.height });
        check(`${item.name}: v4 wording and whole-number display`,
          (await page.locator('.kicker').textContent()) === 'Fiktivt exempel: skrivbedömning i svenska' &&
          await page.locator('.intro').count() === 0 &&
          !/\d,\d/.test(await page.locator('.cc-status').textContent()) &&
          (await page.locator('[data-view="aggregate"]').textContent()).trim() === 'Modellens slutpoäng');
        await screenshot(page, `${item.name}.png`, item);
        await page.locator('#open-discussion').click();
        check(`${item.name}: discussion opens with five questions`, await page.locator('#discussion-dialog').evaluate(n => n.open) && await page.locator('#discussion-dialog details').count() === 5);
        const q = page.locator('#discussion-dialog details').nth(2);
        await q.locator('summary').click();
        check(`${item.name}: question opens and content is readable`, await q.evaluate(n => n.open) && (await q.locator('.study-copy').textContent()).includes('inte ett matematiskt snitt'));
        const dr = await page.locator('#discussion-dialog').evaluate(n => { const r=n.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,sw:n.scrollWidth,cw:n.clientWidth}; });
        check(`${item.name}: discussion fits viewport`, dr.left>=0 && dr.right<=width+1 && dr.top>=0 && dr.bottom<=height+1 && dr.sw<=dr.cw+1,dr);
        await screenshot(page, `${item.name}-discussion.png`,item);
        await page.keyboard.press('Escape');
        check(`${item.name}: discussion Escape restores focus`, await page.locator('#discussion-dialog').evaluate(n=>!n.open) && await page.locator('#open-discussion').evaluate(n=>n===document.activeElement));
        await page.locator('#open-discussion').click();
        await page.locator('#discussion-dialog button').click();
        check(`${item.name}: discussion close and reopen works`, await page.locator('#discussion-dialog').evaluate(n=>!n.open));
        await page.locator('#open-review').click();
        check(`${item.name}: written review opens`, await page.locator('#review-dialog').evaluate(n=>n.open));
        await page.locator('#review-student').selectOption('12');
        check(`${item.name}: review keeps four qualitative aspects and separate score`, await page.locator('#review-copy dt').count()===4 && (await page.locator('.review-score').textContent()).includes('jämförelseläge 86') && (await page.locator('.review-score').textContent()).includes('tätare scenario 70'));
        const rd = await page.locator('#review-dialog').evaluate(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,sw:n.scrollWidth,cw:n.clientWidth};});
        check(`${item.name}: review dialog fits viewport`, rd.left>=0 && rd.right<=width+1 && rd.top>=0 && rd.bottom<=height+1 && rd.sw<=rd.cw+1,rd);
        await screenshot(page, `${item.name}-review.png`,item);
        await page.keyboard.press('Escape');
        check(`${item.name}: review Escape restores focus`, await page.locator('#review-dialog').evaluate(n=>!n.open) && await page.locator('#open-review').evaluate(n=>n===document.activeElement));

        if (width === 390 || width === 1440 || width === 388) {
          await page.locator('#open-study-sources').click();
          await page.locator('#study-sources details').first().locator('summary').click();
          item.expandedSourceBounds = await measure(page);
          const d = item.expandedSourceBounds.dialog;
          check(`${item.name}: expanded sources fit viewport`, d.left >= -1 && d.right <= width + 1 && d.top >= -1 && d.bottom <= height + 1 && d.scrollWidth <= d.clientWidth + 1, { dialog: d });
          await screenshot(page, `${item.name}-sources-expanded.png`, item);
          await page.keyboard.press('Escape');
          check(`${item.name}: Escape closes sources and restores focus`, await page.locator('#study-sources').evaluate(n => !n.open) && await page.locator('#open-study-sources').evaluate(n => n === document.activeElement));
        }
      } finally { await context.close(); }
    });
  }
  await run('interaction tests', async () => {
    const { context, page, item } = await openCase('interaction', { width: 1440, height: 900 });
    try {
      const model=await page.locator('#compression-chart-model').evaluate(n=>JSON.parse(n.textContent));
      check('Final scores use separate arrays, not a mean', model.aggregate.method==='independent-fictional-series' && model.aggregate.after[11]===70 && model.perspectives.every(p=>p.factor===1) && Math.abs(model.aggregate.after[11]-model.perspectives.reduce((sum,p)=>sum+p.scores[11],0)/4)>10);
      const before = await transforms(page);
      await page.locator('[data-action="play"]').click();
      check('Spela changes to Paus', (await page.locator('[data-action="play"]').textContent()).trim() === 'Paus');
      await page.waitForTimeout(800);
      const moving = await transforms(page);
      check('Spela moves actual SVG points', !equal(before, moving));
      await page.locator('[data-action="play"]').click();
      const paused = await transforms(page); await page.waitForTimeout(250);
      check('Paus freezes actual SVG points', equal(paused, await transforms(page)));
      await page.locator('[data-action="compressed"]').click();
      const after = await transforms(page);
      check('Efter gives a changed endpoint', !equal(before, after) && await page.locator('[data-action="compressed"]').getAttribute('aria-pressed') === 'true');
      await page.locator('[data-action="reference"]').click();
      check('Före restores exact initial points', equal(before, await transforms(page)));
      await page.locator('[data-student="12"]').click();
      await page.locator('[data-view="p2"]').click(); await page.waitForTimeout(3300);
      check('Aspect changes while retaining pupil 12', await page.locator('[data-view="p2"]').getAttribute('aria-pressed') === 'true' && await page.locator('[data-student="12"]').getAttribute('aria-pressed') === 'true' && /Uppsats 12/.test(await page.locator('.cc-status').textContent()));
      check('Aspect interpretation is fixed and playback disabled', await page.locator('[data-action="play"]').isDisabled() && await page.locator('[data-action="compressed"]').isDisabled());
      const frozen = await transforms(page); await page.waitForTimeout(300); check('Aspect points remain fixed',equal(frozen,await transforms(page)));
      item.aspectBounds = await measure(page); await screenshot(page, 'aspect-p2-pupil12.png', item);
      await page.locator('[data-view="aggregate"]').click(); await page.waitForTimeout(3300);
      check('Final score playback re-enables', await page.locator('[data-action="play"]').isEnabled());
      const fullscreenEnabled = await page.evaluate(() => document.fullscreenEnabled);
      item.fullscreen = { enabled: fullscreenEnabled };
      if (fullscreenEnabled) {
        await page.locator('#full').click(); await page.waitForTimeout(300);
        item.fullscreen.entered = await page.evaluate(() => document.fullscreenElement?.id === 'slide');
        check('Fullscreen enters when browser supports it', item.fullscreen.entered);
        if (item.fullscreen.entered) { item.fullscreen.bounds = await measure(page); await screenshot(page, 'fullscreen.png', item); await page.evaluate(() => document.exitFullscreen()); }
      } else check('Unsupported fullscreen is hidden', await page.locator('#full').isHidden());
      const href = await page.locator('footer a').getAttribute('href');
      const pdfUrl = new URL(href, url);
      const local = pdfUrl.origin === base && pdfUrl.pathname.startsWith(new URL('.', url).pathname);
      check('Reserve PDF link is a local sibling', local, { href, pathname: pdfUrl.pathname });
      if (local) {
        const response = await context.request.get(pdfUrl.href);
        const body = await response.body();
        check('Reserve PDF exists and is a PDF', response.status() === 200 && body.subarray(0, 5).toString() === '%PDF-', { status: response.status(), bytes: body.length, contentType: response.headers()['content-type'] });
      }
      // A4 landscape at 96 CSS px/in, matching the generated PDF page.
      await page.setViewportSize({ width: 1122, height: 793 });
      await page.locator('[data-action="reference"]').click();
      await page.locator('[data-action="play"]').click(); await page.waitForTimeout(500);
      await page.emulateMedia({ media: 'print' });
      const motionAtPrintStart = await transforms(page); await page.waitForTimeout(350);
      item.printDuringMotionObservation = {
        animationContinuesUnderEmulatedPrint: !equal(motionAtPrintStart, await transforms(page)),
        blocking: false,
        note: 'Emulated print media is not the browser print dialog. No playback-stop requirement is inferred.'
      };
      // Acceptance is based on an explicitly selected stable endpoint.
      await page.emulateMedia({ media: 'screen' });
      await page.locator('[data-action="compressed"]').click();
      check('Stable Efter endpoint selected before printing', await page.locator('[data-action="compressed"]').getAttribute('aria-pressed') === 'true');
      await page.emulateMedia({ media: 'print' });
      item.printBounds = await measure(page);
      const p = item.printBounds;
      check('Print hides interactive controls', await page.locator('.cc-toolbar').isHidden() && await page.locator('#full').isHidden() && await page.locator('#open-study-sources').isHidden());
      check('Print SVG fits without horizontal overflow', p.svg.width <= p.plot.width + 1 && p.document.scrollWidth <= p.viewport.width + 1, { plot: p.plot, svg: p.svg });
      const printStart = await transforms(page); await page.waitForTimeout(350);
      check('Print from stable Efter remains static', equal(printStart, await transforms(page)));
      item.printSvgContentBounds = await page.locator('.cc-svg').evaluate(svg => {
        const b = svg.getBBox(); const v = svg.viewBox.baseVal;
        return { content: { x: b.x, y: b.y, width: b.width, height: b.height },
          viewBox: { x: v.x, y: v.y, width: v.width, height: v.height } };
      });
      const { content: c, viewBox: v } = item.printSvgContentBounds;
      check('Printed chart content fits SVG viewBox', c.x >= v.x - 1 && c.y >= v.y - 1 && c.x + c.width <= v.x + v.width + 1 && c.y + c.height <= v.y + v.height + 1, item.printSvgContentBounds);
      check('Printed chart fits the A4 landscape page', p.svg.left >= -1 && p.svg.right <= 1123 && p.svg.top >= -1 && p.svg.bottom <= 794, { svg: p.svg });
      await page.pdf({ path: path.join(output, 'presentation-print.pdf'), format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
      check('PDF generation preserves the stable chart', equal(printStart, await transforms(page)));
      item.pdf = 'presentation-print.pdf';
      check('Chromium PDF generated', (await readFile(path.join(output, item.pdf))).subarray(0, 5).toString() === '%PDF-');
      await screenshot(page, 'print-media.png', item);
    } finally { await context.close(); }
  });
  await run('keyboard on scrollable chart', async () => {
    const { context, page, item } = await openCase('keyboard-narrow', { width: 390, height: 844 });
    try {
      await page.locator('.cc-plot').evaluate(n => { n.scrollLeft = 0; });
      const initial = await measure(page);
      const offscreen = await page.locator('[data-student="12"]').boundingBox();
      check('Keyboard test target starts outside visible plot', offscreen.x > initial.plot.right || offscreen.x + offscreen.width > initial.plot.right, { targetBounds: offscreen, plot: initial.plot });
      // Enter the chart using actual Tab navigation, not locator.focus().
      let focused = false;
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        focused = await page.evaluate(() => document.activeElement?.matches('[data-student="1"]'));
        if (focused) break;
      }
      check('Tab reaches first chart point', focused);
      await page.keyboard.press('End');
      item.afterEndBounds = await measure(page);
      const visible = await page.locator('[data-student="12"]').boundingBox();
      check('End selects and focuses pupil 12', await page.locator('[data-student="12"]').evaluate(n => n === document.activeElement && n.getAttribute('aria-pressed') === 'true'));
      check('Keyboard reveals offscreen selected point', visible.x >= item.afterEndBounds.plot.left - 1 && visible.x + visible.width <= item.afterEndBounds.plot.right + 1, { point: visible, plot: item.afterEndBounds.plot });
      await screenshot(page, 'keyboard-offscreen-pupil12.png', item);
      await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
      check('Home and ArrowRight reach pupil 2', await page.locator('[data-student="2"]').evaluate(n => n === document.activeElement && n.getAttribute('aria-pressed') === 'true'));
      await page.keyboard.press('Enter');
      check('Enter toggles selection off', await page.locator('[data-student="2"]').getAttribute('aria-pressed') === 'false');
      await page.keyboard.press('Space');
      check('Space toggles selection on', await page.locator('[data-student="2"]').getAttribute('aria-pressed') === 'true');
    } finally { await context.close(); }
  });
  for (const mode of ['touch', 'reduced-motion', 'dark']) await run(mode, async () => {
    const options = mode === 'touch' ? { hasTouch: true, isMobile: true } : mode === 'dark' ? { colorScheme: 'dark' } : { reducedMotion: 'reduce' };
    const { context, page, item } = await openCase(mode, { width: 390, height: 844 }, options);
    try {
      item.media = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, dark: matchMedia('(prefers-color-scheme: dark)').matches }));
      check(`${mode}: browser media context applied`, mode === 'touch' ? item.media.coarse : mode === 'dark' ? item.media.dark : item.media.reduced);
      if (mode === 'touch') {
        await page.locator('[data-action="compressed"]').tap();
        check('Touch activates Efter', await page.locator('[data-action="compressed"]').getAttribute('aria-pressed') === 'true');
        await page.locator('[data-student="1"]').tap();
        check('Touch selects pupil', await page.locator('[data-student="1"]').getAttribute('aria-pressed') === 'true');
        await page.locator('#open-study-sources').tap();
        check('Touch opens sources', await page.locator('#study-sources').evaluate(n => n.open));
        await page.keyboard.press('Escape');
        await page.locator('#open-discussion').tap();
        check('Touch opens discussion', await page.locator('#discussion-dialog').evaluate(n=>n.open));
        await page.locator('#discussion-dialog summary').first().tap();
        check('Touch expands a discussion question', await page.locator('#discussion-dialog details').first().evaluate(n=>n.open));
        await page.locator('#discussion-dialog button').tap();
      }
      if (mode === 'reduced-motion') {
        await page.locator('[data-action="play"]').click();
        check('Reduced motion completes without playback animation', (await page.locator('[data-action="play"]').textContent()).trim() === 'Spela' && await page.locator('[data-action="compressed"]').getAttribute('aria-pressed') === 'true');
        const points = await transforms(page); await page.waitForTimeout(250);
        check('Reduced-motion points remain stationary', equal(points, await transforms(page)));
        await page.locator('[data-view="p1"]').click();
        check('Reduced-motion aspect change is immediate', await page.locator('[data-view="p1"]').getAttribute('aria-pressed') === 'true');
      }
      item.bounds = await measure(page);
      check(`${mode}: no document horizontal overflow`, item.bounds.document.scrollWidth <= 391);
      await screenshot(page, `${mode}.png`, item);
    } finally { await context.close(); }
  });
} catch (error) { report.errors.push({ message: String(error), stack: error.stack }); }
finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
  for (const item of report.cases) {
    check(`${item.name}: no JavaScript exceptions`, item.pageErrors.length === 0, { errors: item.pageErrors });
    // Keep failed network loads separate from JavaScript exceptions, but fail the suite.
    check(`${item.name}: no browser console errors`, item.consoleErrors.length === 0, { errors: item.consoleErrors });
  }
  report.finishedAt = new Date().toISOString();
  report.passed = report.errors.length === 0 && report.checks.every(c => c.pass);
  report.summary = { passed: report.checks.filter(c => c.pass).length, failed: report.checks.filter(c => !c.pass).length };
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: report.passed, ...report.summary, output, failures: report.checks.filter(c => !c.pass).map(c => c.name) }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
