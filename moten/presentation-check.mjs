/**
 * Integration QA for the self-contained compression presentation.
 * Run only in GitHub Actions: node presentation-check.mjs
 * Optional: PRESENTATION_HTML, PRESENTATION_CHECK_OUTPUT, CI_BROWSER_TIMEOUT_MS.
 * Uses Node built-ins and playwright 1.56.1. Never launches a local browser.
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

const startedAt = new Date().toISOString();
const target = path.resolve(process.env.PRESENTATION_HTML || process.argv[2] || 'moten/ai-2026-11-11/presentation/index.html');
const output = path.resolve(process.env.PRESENTATION_CHECK_OUTPUT || 'presentation-test-output');
const timeout = Number(process.env.CI_BROWSER_TIMEOUT_MS || 10000);
const report = {
  schemaVersion: 1, startedAt, finishedAt: null, status: 'running',
  environment: { node: process.version, githubActions: process.env.GITHUB_ACTIONS === 'true', repository: process.env.GITHUB_REPOSITORY || null, commit: process.env.GITHUB_SHA || null, runId: process.env.GITHUB_RUN_ID || null, target },
  checks: [], screenshots: [], console: [], pageErrors: [], requests: [], failedRequests: [], responses: [], performance: {}, coverage: {},
  limitations: ['Automated Chromium CI checks do not replace human review of the exported PDF or factual review of slide claims.'],
};
let browser, server, context, page, phase = 'initialization', fatal = null;
await fs.mkdir(output, { recursive: true });
const errorObject = error => ({ name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack || null });
const saveReport = () => fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const near = (actual, expected, message, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) <= epsilon, `${message}: ${actual} versus ${expected}`);
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const safeName = value => value.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();

async function screenshot(name, currentPage = page) {
  if (!currentPage || currentPage.isClosed()) return null;
  const filename = safeName(name) + '.png';
  await currentPage.screenshot({ path: path.join(output, filename), fullPage: true, animations: 'disabled', timeout });
  report.screenshots.push({ name, file: filename, phase, viewport: currentPage.viewportSize(), capturedAt: new Date().toISOString() });
  return filename;
}
async function check(name, fn) {
  phase = name;
  const start = performance.now();
  const item = { name, status: 'running', durationMs: null };
  report.checks.push(item);
  try {
    const detail = await fn();
    item.status = 'passed';
    if (detail !== undefined) item.detail = detail;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    item.status = 'failed'; item.error = errorObject(error);
    process.stderr.write(`FAIL ${name}: ${error.message}\n`);
    try { item.failureScreenshot = await screenshot('failure-' + name); } catch (captureError) { item.screenshotError = errorObject(captureError); }
  } finally {
    item.durationMs = Math.round(performance.now() - start);
    await saveReport();
  }
}

// Instrumentation is installed before application scripts. It observes callbacks and
// preserves the actual component/controller/DOM objects. It does not drive animation.
function installInstrumentation() {
  const state = window.__presentationQA = {
    controllers: [], activeFrames: new Set(), requests: 0, callbacks: 0, cancellations: 0,
    maxPending: 0, frameTimes: [], callbackDurations: [], mountCount: 0,
  };
  const raf = window.requestAnimationFrame.bind(window);
  const caf = window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => {
    state.requests += 1;
    let id;
    id = raf(time => {
      state.activeFrames.delete(id); state.callbacks += 1; state.frameTimes.push(time);
      const start = performance.now();
      try { callback(time); } finally { state.callbackDurations.push(performance.now() - start); }
    });
    state.activeFrames.add(id); state.maxPending = Math.max(state.maxPending, state.activeFrames.size);
    return id;
  };
  window.cancelAnimationFrame = id => { state.cancellations += 1; state.activeFrames.delete(id); return caf(id); };
  let api;
  Object.defineProperty(window, 'CompressionCharts', {
    configurable: true,
    get: () => api,
    set: value => {
      api = value;
      if (!api || typeof api.mount !== 'function' || api.__qaWrapped) return;
      const mount = api.mount;
      api.mount = function (container, options) {
        const controller = mount.call(this, container, options);
        state.mountCount += 1;
        state.controllers.push({ container, controller, mode: options?.mode, nodes: [...container.querySelectorAll('[data-student]')] });
        return controller;
      };
      Object.defineProperty(api, '__qaWrapped', { value: true });
    },
  });
}
function watchPage(currentPage, label) {
  currentPage.on('console', message => {
    if (['warning', 'error'].includes(message.type())) report.console.push({ page: label, phase, type: message.type(), text: message.text(), location: message.location() });
  });
  currentPage.on('pageerror', error => report.pageErrors.push({ page: label, phase, ...errorObject(error) }));
  currentPage.on('request', request => report.requests.push({ page: label, phase, url: request.url(), method: request.method(), resourceType: request.resourceType() }));
  currentPage.on('requestfailed', request => report.failedRequests.push({ page: label, phase, url: request.url(), error: request.failure()?.errorText || null }));
  currentPage.on('response', response => { if (response.status() >= 400) report.responses.push({ page: label, phase, url: response.url(), status: response.status() }); });
}
async function currentSlide(currentPage = page) { return Number(await currentPage.locator('#presenter').getAttribute('data-slide')); }
async function closeDrawers(currentPage = page) {
  for (const id of ['notes', 'sources']) {
    if (await currentPage.locator('#' + id).isVisible()) await currentPage.locator(`#${id} .close-drawer`).click();
  }
}
async function goTo(number, currentPage = page) {
  await closeDrawers(currentPage);
  let current = await currentSlide(currentPage);
  for (let guard = 0; current !== number && guard < 12; guard++) {
    await currentPage.locator(current < number ? '#next' : '#prev').click();
    await currentPage.waitForFunction(expected => Number(document.querySelector('#presenter').dataset.slide) === expected, current + (current < number ? 1 : -1), { timeout });
    current = await currentSlide(currentPage);
  }
  assert.equal(current, number, 'Slide navigation reached the requested slide');
  await currentPage.evaluate(() => document.fonts.ready);
  await currentPage.waitForTimeout(60);
}
async function activeState(currentPage = page) {
  return currentPage.evaluate(() => {
    const slot = document.querySelector('.slide.active .diagram-slot');
    const entry = window.__presentationQA.controllers.find(record => record.container === slot);
    if (!entry) throw new Error('No controller for the active diagram');
    return entry.controller.getState();
  });
}
async function callController(method, args = [], currentPage = page) {
  return currentPage.evaluate(({ method, args }) => {
    const slot = document.querySelector('.slide.active .diagram-slot');
    const entry = window.__presentationQA.controllers.find(record => record.container === slot);
    if (!entry) throw new Error('No controller for the active diagram');
    return entry.controller[method](...args);
  }, { method, args });
}
async function rafState(currentPage = page) {
  return currentPage.evaluate(() => {
    const q = window.__presentationQA;
    return { requests: q.requests, callbacks: q.callbacks, cancellations: q.cancellations, active: q.activeFrames.size, maxPending: q.maxPending };
  });
}
async function setStill(value, currentPage = page) {
  const pressed = await currentPage.locator('#motion').getAttribute('aria-pressed') === 'true';
  if (pressed !== value) await currentPage.locator('#motion').click();
  await currentPage.waitForTimeout(30);
}
async function diagramGeometry(currentPage = page) {
  return currentPage.evaluate(() => {
    const slot = document.querySelector('.slide.active .diagram-slot');
    const entry = window.__presentationQA.controllers.find(record => record.container === slot);
    const nodes = [...slot.querySelectorAll('[data-student]')];
    const circles = nodes.map(node => {
      const matrix = node.transform.baseVal.consolidate().matrix;
      const circle = node.querySelector('circle:not(.cc-focus-ring)');
      return { id: Number(node.dataset.student), x: matrix.e, y: matrix.f, radius: Number(circle.getAttribute('r')), color: circle.getAttribute('fill'), sameNode: entry.nodes.find(original => original.dataset.student === node.dataset.student) === node };
    });
    const paths = [...slot.querySelectorAll('.cc-curve-current,.cc-curve-reference')].map(node => node.getAttribute('d'));
    return { circles, paths, viewBox: slot.querySelector('svg').getAttribute('viewBox') };
  });
}
function assertGeometry(geometry, label) {
  assert.deepEqual(geometry.circles.map(c => c.id), Array.from({ length: 12 }, (_, i) => i + 1), `${label}: twelve stable IDs`);
  assert.equal(new Set(geometry.circles.map(c => c.color)).size, 12, `${label}: twelve colors`);
  for (const c of geometry.circles) {
    assert.ok(c.sameNode, `${label}: student ${c.id} kept its original DOM node`);
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y), `${label}: finite position`);
    assert.ok(c.x >= 36 - .01 && c.x <= 1116 + .01, `${label}: horizontal score bounds`);
    assert.ok(c.y - c.radius >= 157 && c.y + c.radius < 334, `${label}: dot band bounds`);
  }
  for (let i = 0; i < geometry.circles.length; i++) for (let j = 0; j < i; j++) {
    const a = geometry.circles[i], b = geometry.circles[j];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius - .02, `${label}: students ${a.id} and ${b.id} overlap`);
  }
  for (const d of geometry.paths) {
    assert.ok(!/NaN|Infinity|undefined/.test(d), `${label}: valid SVG path`);
    for (const match of d.matchAll(/[ML]([\d.]+),([\d.]+)/g)) {
      const x = Number(match[1]), y = Number(match[2]);
      assert.ok(x >= 35.99 && x <= 1116.01 && y >= 33.9 && y <= 104.01, `${label}: bounded curve`);
    }
  }
}
async function assertNoOverflow(label) {
  const dimensions = await page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const visible = [...document.querySelectorAll('#bar button,#help a,.slide.active .cc-toolbar button,.slide.active .cc-status')]
      .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
      .map(el => { const r = el.getBoundingClientRect(); return { label: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
    return { viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, body: { width: document.body.scrollWidth }, stage: rect('#stage'), slide: rect('.slide.active .slide-frame'), controls: visible };
  });
  const { viewport, document: documentSize, stage, slide } = dimensions;
  assert.ok(documentSize.width <= viewport.width + 2 && dimensions.body.width <= viewport.width + 2, `${label}: horizontal page overflow`);
  assert.ok(documentSize.height <= viewport.height + 2, `${label}: vertical page overflow`);
  assert.ok(slide.left >= stage.left - 2 && slide.right <= stage.right + 2, `${label}: slide clipped horizontally`);
  assert.ok(slide.top >= stage.top - 2 && slide.bottom <= stage.bottom + 2, `${label}: slide clipped vertically`);
  for (const c of dimensions.controls) assert.ok(c.left >= -2 && c.right <= viewport.width + 2 && c.top >= -2 && c.bottom <= viewport.height + 2, `${label}: control outside viewport: ${c.label}`);
  return dimensions;
}

try {
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Browser execution is allowed only inside the approved GitHub Actions run. No browser was launched. Use node --check for local syntax validation.');
  const html = await fs.readFile(target);
  report.environment.htmlSha256 = crypto.createHash('sha256').update(html).digest('hex');
  report.environment.htmlBytes = html.length;
  const rootDir = path.dirname(target);
  const mime = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript', '.pdf': 'application/pdf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
  server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const file = path.resolve(rootDir, relative || path.basename(target));
      if (file !== rootDir && !file.startsWith(rootDir + path.sep)) { response.writeHead(403); response.end('Forbidden'); return; }
      const body = await fs.readFile(file);
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(body);
    } catch (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end('Unavailable'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const url = base + '/' + encodeURIComponent(path.basename(target));
  report.environment.url = url;
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
  report.environment.browser = browser.version();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference', locale: 'sv-SE' });
  await context.addInitScript(installInstrumentation);
  await context.route('**/*', route => {
    const requestUrl = route.request().url();
    if (requestUrl.startsWith(base + '/') || /^(data|blob):/.test(requestUrl)) return route.continue();
    report.requests.push({ phase, blockedExternal: true, url: requestUrl });
    return route.abort('blockedbyclient');
  });
  page = await context.newPage(); page.setDefaultTimeout(timeout); watchPage(page, 'main');
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  let slideModes = [];

  await check('structure-and-eight-slide-screenshots', async () => {
    assert.equal(await page.locator('.slide').count(), 8);
    assert.equal(await page.locator('.diagram-slot').count(), 3);
    assert.equal(await currentSlide(), 1);
    slideModes = await page.locator('.slide').evaluateAll(slides => slides.flatMap((slide, i) => { const slot = slide.querySelector('.diagram-slot'); return slot ? [{ slide: i + 1, mode: slot.dataset.mode }] : []; }));
    assert.deepEqual(slideModes.map(x => x.mode).sort(), ['aggregate', 'compression', 'criteria']);
    report.coverage.diagrams = slideModes;
    const notes = [];
    for (let n = 1; n <= 8; n++) {
      await goTo(n); notes.push(await page.locator('#notes-copy').textContent());
      assert.equal(await page.locator('.slide.active').count(), 1);
      assert.equal(await page.locator('.slide[aria-hidden="false"]').count(), 1);
      assert.equal(await page.locator('#count').textContent(), `${n} / 8`);
      await assertNoOverflow('slide ' + n);
      if (await page.locator('.slide.active .diagram-slot').count()) { assertGeometry(await diagramGeometry(), 'slide ' + n); assert.equal((await activeState()).running, false, 'no autoplay'); }
      await screenshot(`slide-${String(n).padStart(2, '0')}`);
    }
    assert.equal(new Set(notes).size, 8); notes.forEach(note => assert.ok(note.trim().length > 80, 'substantial per-slide speaker notes'));
    const instances = await page.evaluate(() => window.__presentationQA.mountCount);
    assert.equal(instances, 3, 'exactly three lazy-mounted controllers');
    const duplicateIds = await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(n => n.id); return ids.filter((id, i) => ids.indexOf(id) !== i); });
    assert.deepEqual(duplicateIds, [], 'globally unique DOM IDs');
    report.coverage.slideCount = 8; report.coverage.diagramCount = 3;
    return { slideModes, speakerNoteLengths: notes.map(n => n.length), mountCount: instances };
  });
  // Recover the map even if an earlier visual assertion failed.
  if (!slideModes.length) slideModes = await page.locator('.slide').evaluateAll(slides => slides.flatMap((slide, i) => { const slot = slide.querySelector('.diagram-slot'); return slot ? [{ slide: i + 1, mode: slot.dataset.mode }] : []; }));
  const diagramSlide = mode => { const match = slideModes.find(x => x.mode === mode); assert.ok(match, `missing ${mode} diagram`); return match.slide; };

  await check('global-keyboard-navigation', async () => {
    await closeDrawers(); await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Home'); assert.equal(await currentSlide(), 1);
    await page.keyboard.press('ArrowRight'); assert.equal(await currentSlide(), 2);
    await page.keyboard.press('PageDown'); assert.equal(await currentSlide(), 3);
    await page.keyboard.press('ArrowLeft'); assert.equal(await currentSlide(), 2);
    await page.keyboard.press('PageUp'); assert.equal(await currentSlide(), 1);
    await page.keyboard.press('End'); assert.equal(await currentSlide(), 8);
    assert.equal(await page.locator('#next').isDisabled(), true);
    await page.keyboard.press('Home'); assert.equal(await page.locator('#prev').isDisabled(), true);
  });

  await check('student-keyboard-focus-and-stable-identities', async () => {
    await goTo(diagramSlide('criteria')); await setStill(false); await callController('reset');
    const initial = await currentSlide(), student = page.locator('.slide.active [data-student="1"]');
    await student.focus(); await page.keyboard.press('Enter');
    assert.equal((await activeState()).selectedId, 1);
    await page.keyboard.press('ArrowRight'); assert.equal((await activeState()).selectedId, 2);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.student), '2');
    assert.equal(await currentSlide(), initial, 'student arrow must not navigate slides');
    await page.keyboard.press('ArrowLeft'); assert.equal((await activeState()).selectedId, 1);
    await page.keyboard.press('End'); assert.equal((await activeState()).selectedId, 12);
    await page.keyboard.press('Home'); assert.equal((await activeState()).selectedId, 1);
    await page.keyboard.press('Space'); assert.equal(await currentSlide(), initial);
    const focus = await page.evaluate(() => { const el = document.activeElement; const circle = el.querySelector('.cc-focus-ring'); return { student: el.dataset.student, opacity: getComputedStyle(circle).opacity, focusVisible: el.matches(':focus-visible') }; });
    assert.equal(focus.student, '1'); assert.equal(Number(focus.opacity), 1); assert.equal(focus.focusVisible, true);
    assertGeometry(await diagramGeometry(), 'keyboard selected');
    assert.match(await page.locator('.slide.active .cc-status').textContent(), /Elev 1/);
    await screenshot('critical-student-keyboard-focus');
    await page.locator('#notes-toggle').focus(); await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'sources-toggle');
    const outline = await page.locator('#sources-toggle').evaluate(el => ({ width: getComputedStyle(el).outlineWidth, style: getComputedStyle(el).outlineStyle }));
    assert.ok(parseFloat(outline.width) > 0 && outline.style !== 'none', 'native controls show keyboard focus');
    return { focus, outline };
  });

  await check('compression-endpoint-data-and-exact-aggregate', async () => {
    await goTo(diagramSlide('compression')); await callController('reset');
    const expected = [20, 30, 40, 48, 54, 58, 62, 66, 72, 80, 90, 100];
    const before = (await activeState()).scores;
    assert.deepEqual(before, expected); near(average(before), 60, 'reference mean');
    await screenshot('critical-compression-reference');
    await page.locator('.slide.active [data-action="compressed"]').click();
    const after = (await activeState()).scores;
    after.forEach((score, i) => near(score, 60 + .4 * (before[i] - 60), 'transformed score'));
    near(average(after), 60, 'compressed mean'); near(Math.min(...after), 44, 'minimum'); near(Math.max(...after), 76, 'maximum');
    after.forEach((score, i) => { if (i) assert.ok(score > after[i - 1], 'rank preserved'); });
    assertGeometry(await diagramGeometry(), 'compressed endpoint'); await screenshot('critical-compression-compressed');
    const data = await page.evaluate(() => {
      const model = JSON.parse(document.querySelector('#compression-chart-model').textContent);
      return { model, aggregate: CompressionCharts.dataset(model, 'aggregate'), scales: ['compression', 'p1', 'p2', 'p3', 'p4', 'aggregate'].map(view => CompressionCharts.frameFor({ mode: view === 'compression' ? 'compression' : 'criteria', view, progress: 1 }).maxDensity) };
    });
    for (let i = 0; i < 12; i++) {
      const source = data.model.perspectives.map(p => p.scores[i]);
      const compressed = data.model.perspectives.map(p => data.model.center + p.factor * (p.scores[i] - data.model.center));
      assert.equal(data.aggregate.before[i], average(source)); assert.equal(data.aggregate.after[i], average(compressed));
    }
    data.scales.forEach(scale => assert.equal(scale, data.model.curveScaleMax, 'same curve y scale across views'));
    near(average(data.aggregate.before), 60, 'aggregate mean'); near(Math.max(...data.aggregate.before) - Math.min(...data.aggregate.before), 51, 'aggregation-only range');
    await goTo(diagramSlide('aggregate')); await callController('reset');
    assert.deepEqual((await activeState()).scores, data.aggregate.before); await screenshot('critical-aggregate-reference');
    await page.locator('.slide.active [data-action="compressed"]').click();
    assert.deepEqual((await activeState()).scores, data.aggregate.after); await screenshot('critical-aggregate-compressed');
    return { before, after, aggregateBefore: data.aggregate.before, aggregateAfter: data.aggregate.after, sharedDensityScale: data.model.curveScaleMax };
  });

  await check('play-pause-resume-reset-and-two-second-performance', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await goTo(diagramSlide('compression')); await setStill(false); await callController('reset');
    const baseline = await page.evaluate(() => ({ count: __presentationQA.callbacks, times: __presentationQA.frameTimes.length, durations: __presentationQA.callbackDurations.length, clock: performance.now() }));
    await page.locator('.slide.active [data-action="play"]').click();
    await page.waitForFunction(() => __presentationQA.controllers.find(x => x.container.closest('.slide.active'))?.controller.getState().running, null, { timeout });
    await page.waitForTimeout(2000);
    const sample = await page.evaluate(base => {
      const times = __presentationQA.frameTimes.slice(base.times), durations = __presentationQA.callbackDurations.slice(base.durations);
      return { frames: __presentationQA.callbacks - base.count, wallTimeMs: performance.now() - base.clock, frameIntervalsMs: times.slice(1).map((t, i) => t - times[i]), callbackDurationsMs: durations, maxPending: __presentationQA.maxPending, active: __presentationQA.activeFrames.size };
    }, baseline);
    assert.ok(sample.frames >= 20, `at least 20 frames in two seconds, got ${sample.frames}`);
    assert.ok(sample.maxPending <= 1, 'only one animation loop is pending');
    const running = await activeState(); assert.equal(running.running, true); assert.ok(running.progress > 0 && running.progress < 1);
    await page.locator('.slide.active [data-action="play"]').click();
    const paused = await activeState(), rafPaused = await rafState();
    assert.equal(paused.running, false); assert.equal(paused.pendingAnimationFrame, false); assert.equal(rafPaused.active, 0);
    await page.waitForTimeout(300); assert.deepEqual((await activeState()).scores, paused.scores); assert.equal((await rafState()).callbacks, rafPaused.callbacks);
    await screenshot('critical-compression-paused');
    await page.locator('.slide.active [data-action="play"]').click();
    await page.waitForFunction(() => { const s = __presentationQA.controllers.find(x => x.container.closest('.slide.active'))?.controller.getState(); return s && !s.running && s.progress === 1; }, null, { timeout: 6000 });
    await page.locator('.slide.active [data-action="reset"]').click();
    const reset = await activeState(); assert.equal(reset.progress, 0); assert.equal(reset.running, false); assert.equal((await rafState()).active, 0);
    report.performance = { ...sample, approximateFps: sample.frames / sample.wallTimeMs * 1000, maxCallbackMs: Math.max(...sample.callbackDurationsMs), meanCallbackMs: average(sample.callbackDurationsMs), note: 'Measured with the actual chart animation; no synthetic animation loop was added.' };
    return { frames: sample.frames, approximateFps: report.performance.approximateFps, maxCallbackMs: report.performance.maxCallbackMs };
  });

  await check('repeated-perspective-changes-preserve-selected-student', async () => {
    await goTo(diagramSlide('criteria')); await setStill(false); await callController('reset');
    await page.locator('.slide.active [data-student="7"]').click();
    const sequence = ['p2', 'p3', 'aggregate', 'p4', 'p1', 'p3', 'p2', 'aggregate'];
    const samples = [];
    for (const view of sequence) {
      await page.locator(`.slide.active [data-view="${view}"]`).click();
      await page.waitForTimeout(180);
      const state = await activeState(); assert.equal(state.selectedId, 7);
      assertGeometry(await diagramGeometry(), 'rapid view ' + view);
      samples.push({ target: view, state });
      assert.ok((await rafState()).active <= 1);
    }
    await page.waitForFunction(() => !__presentationQA.controllers.find(x => x.container.closest('.slide.active'))?.controller.getState().running, null, { timeout: 6000 });
    assert.equal((await activeState()).view, 'aggregate'); assert.equal((await activeState()).selectedId, 7);
    assertGeometry(await diagramGeometry(), 'settled aggregate'); await screenshot('critical-selected-student-across-perspectives');
    await page.locator('.slide.active [data-view="p4"]').click(); await page.waitForTimeout(450);
    await page.locator('.slide.active [data-action="reset"]').click();
    assert.equal((await activeState()).running, false); assert.equal((await activeState()).selectedId, 7); assert.equal((await rafState()).active, 0);
    assertGeometry(await diagramGeometry(), 'reset after interrupted perspective');
    return { sequence, samples };
  });

  await check('selected-student-persists-across-diagram-slides', async () => {
    await goTo(diagramSlide('criteria'));
    await page.locator('.slide.active [data-student="9"]').click();
    const visited = [];
    for (const mode of ['aggregate', 'compression', 'criteria', 'aggregate']) {
      await goTo(diagramSlide(mode));
      const state = await activeState();
      assert.equal(state.selectedId, 9, 'selected student must follow navigation to ' + mode);
      assert.equal(await page.locator('.slide.active [data-student="9"]').getAttribute('aria-pressed'), 'true');
      assertGeometry(await diagramGeometry(), 'student 9 in ' + mode);
      visited.push({ mode, selectedId: state.selectedId });
    }
    await screenshot('critical-student-selection-across-slides');
    return { visited };
  });

  await check('stop-on-slide-exit-and-no-background-frames', async () => {
    await goTo(diagramSlide('compression')); await setStill(false); await callController('reset');
    await page.locator('.slide.active [data-action="play"]').click(); await page.waitForTimeout(220);
    assert.equal((await activeState()).running, true);
    await page.locator('#next').click();
    const departed = await page.evaluate(() => __presentationQA.controllers.find(x => x.mode === 'compression').controller.getState());
    assert.equal(departed.running, false); assert.equal(departed.pendingAnimationFrame, false);
    const before = await rafState(); assert.equal(before.active, 0);
    await page.waitForTimeout(350);
    const later = await page.evaluate(() => __presentationQA.controllers.find(x => x.mode === 'compression').controller.getState());
    assert.deepEqual(later.scores, departed.scores); assert.equal((await rafState()).callbacks, before.callbacks);
    await goTo(diagramSlide('compression')); assert.equal((await activeState()).running, false, 'returning does not autoplay');
    return { departedProgress: departed.progress, callbacksAfterExit: before.callbacks };
  });

  await check('still-image-override-survives-os-changes', async () => {
    await goTo(diagramSlide('criteria')); await page.emulateMedia({ reducedMotion: 'no-preference' }); await setStill(true);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(100);
    assert.equal(await page.locator('#motion').getAttribute('aria-pressed'), 'true'); assert.equal((await activeState()).reducedMotion, true);
    await callController('reset'); const before = await rafState();
    await page.locator('.slide.active [data-action="play"]').click();
    assert.equal((await activeState()).progress, 1); assert.equal((await activeState()).running, false);
    const after = await rafState(); assert.equal(after.requests, before.requests); assert.equal(after.active, 0);
    await screenshot('critical-host-still-image');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await setStill(false); await page.waitForTimeout(100);
    assert.equal((await activeState()).reducedMotion, true, 'releasing host override still respects OS');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(100);
    assert.equal((await activeState()).reducedMotion, false, 'normal motion returns only after both flags are false');
    return { requestsBeforePlay: before.requests, requestsAfterPlay: after.requests };
  });

  await check('reduced-motion-from-first-load-has-no-animation-frames', async () => {
    const reducedContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'sv-SE' });
    try {
      await reducedContext.addInitScript(installInstrumentation);
      const reducedPage = await reducedContext.newPage(); reducedPage.setDefaultTimeout(timeout); watchPage(reducedPage, 'reduced-motion');
      await reducedPage.goto(url, { waitUntil: 'load' }); await goTo(diagramSlide('compression'), reducedPage);
      const initial = await rafState(reducedPage); assert.equal(initial.requests, 0, 'no autoplay/rAF on first load');
      assert.equal((await activeState(reducedPage)).reducedMotion, true);
      await reducedPage.locator('.slide.active [data-action="play"]').click(); await reducedPage.waitForTimeout(100);
      assert.equal((await activeState(reducedPage)).progress, 1); assert.equal((await activeState(reducedPage)).running, false); assert.equal((await rafState(reducedPage)).requests, 0);
      await goTo(diagramSlide('criteria'), reducedPage); await reducedPage.locator('.slide.active [data-view="p4"]').click();
      assert.equal((await activeState(reducedPage)).view, 'p4'); assert.equal((await activeState(reducedPage)).running, false); assert.equal((await rafState(reducedPage)).requests, 0);
      await screenshot('critical-os-reduced-motion', reducedPage);
      return { state: await activeState(reducedPage), frames: await rafState(reducedPage) };
    } finally { await reducedContext.close(); }
  });

  await check('notes-sources-drawers-links-and-focus-return', async () => {
    await goTo(3); await page.locator('#notes-toggle').click();
    assert.equal(await page.locator('#notes').isVisible(), true); assert.equal(await page.locator('#notes-toggle').getAttribute('aria-expanded'), 'true');
    assert.ok((await page.locator('#notes-copy').textContent()).length > 100); await screenshot('critical-speaker-notes');
    await page.locator('#sources-toggle').click();
    assert.equal(await page.locator('#notes').isVisible(), false); assert.equal(await page.locator('#notes-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('#sources').isVisible(), true);
    const links = await page.locator('#sources a').evaluateAll(nodes => nodes.map(a => ({ text: a.textContent, href: a.href, target: a.target, rel: a.rel })));
    assert.equal(links.length, 4); links.forEach(link => { assert.ok(link.href.startsWith('https://')); assert.equal(link.target, '_blank'); assert.ok(link.rel.includes('noopener')); });
    const sourceText = await page.locator('#sources').textContent(); assert.match(sourceText, /konstruerade exempel/); assert.match(sourceText, /inte verkliga elevers utveckling/);
    await screenshot('critical-source-drawer'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#sources').isVisible(), false); assert.equal(await page.evaluate(() => document.activeElement.id), 'sources-toggle');
    await page.locator('#notes-toggle').click(); await page.locator('#notes .close-drawer').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'notes-toggle');
    const backup = await page.locator('#help a').first().getAttribute('href'); assert.match(backup, /\.pdf$/i);
    report.coverage.sourceLinks = links;
    return { links, backupHref: backup };
  });

  await check('offline-after-load-navigation-and-diagrams', async () => {
    await closeDrawers(); await context.setOffline(true);
    try {
      const blocked = await page.evaluate(async baseUrl => { try { await fetch(baseUrl + '/index.html?offline-probe=' + Date.now(), { cache: 'no-store' }); return false; } catch { return true; } }, base);
      assert.equal(blocked, true, 'network is genuinely offline');
      await goTo(diagramSlide('aggregate')); await setStill(true); await callController('reset');
      await page.locator('.slide.active [data-view="p2"]').click(); assert.equal((await activeState()).view, 'p2');
      await page.locator('.slide.active [data-action="compressed"]').click(); assert.equal((await activeState()).progress, 1);
      await page.locator('.slide.active [data-student="4"]').click(); assert.equal((await activeState()).selectedId, 4);
      assertGeometry(await diagramGeometry(), 'offline diagram'); await screenshot('critical-offline-diagram');
      await goTo(8); await page.locator('#notes-toggle').click(); assert.equal(await page.locator('#notes').isVisible(), true); await closeDrawers();
      return { networkProbeFailedAsExpected: true, stillInteractive: true };
    } finally { await context.setOffline(false); await setStill(false); }
  });

  await check('responsive-390-768-1024-1440-no-overflow', async () => {
    const results = [];
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(120);
      for (let slide = 1; slide <= 8; slide++) {
        await goTo(slide);
        const dimensions = await assertNoOverflow(`${viewport.width}px slide ${slide}`);
        results.push({ viewport, slide, dimensions });
        if (slideModes.some(d => d.slide === slide)) { assertGeometry(await diagramGeometry(), `responsive ${viewport.width}/${slide}`); await screenshot(`responsive-${viewport.width}-slide-${slide}`); }
      }
    }
    report.coverage.responsive = results;
    return { viewportWidths: [390, 768, 1024, 1440], slideViewportCombinations: results.length };
  });

  await check('fullscreen-entry-exit-and-resize', async () => {
    await page.setViewportSize({ width: 1440, height: 900 }); await goTo(diagramSlide('compression')); await closeDrawers();
    assert.equal(await page.evaluate(() => document.fullscreenEnabled), true);
    await page.locator('#full').click();
    await page.waitForFunction(() => document.fullscreenElement?.id === 'presenter', null, { timeout: 5000 });
    await page.waitForTimeout(150); await assertNoOverflow('fullscreen'); await screenshot('critical-fullscreen');
    await page.locator('#full').click(); await page.waitForFunction(() => !document.fullscreenElement, null, { timeout: 5000 });
    await page.waitForTimeout(150); await assertNoOverflow('after fullscreen');
    return { fullscreenEnabled: true, enteredAndExited: true };
  });

  await check('no-runtime-errors-or-unexpected-network-dependencies', async () => {
    assert.deepEqual(report.pageErrors, [], 'no uncaught browser exceptions');
    const external = report.requests.filter(request => request.blockedExternal || (/^https?:/.test(request.url) && !request.url.startsWith(base + '/')));
    assert.deepEqual(external, [], 'self-contained deck needs no external network request');
    const unexpectedFailures = report.failedRequests.filter(request => request.phase !== 'offline-after-load-navigation-and-diagrams' && !request.url.endsWith('/favicon.ico'));
    assert.deepEqual(unexpectedFailures, [], 'no unexpected resource failures');
    const consoleErrors = report.console.filter(message => message.type === 'error' && message.phase !== 'offline-after-load-navigation-and-diagrams');
    assert.deepEqual(consoleErrors, [], 'no unexpected console errors');
    assert.deepEqual(report.responses, [], 'no HTTP 4xx/5xx responses');
    assert.equal((await rafState()).active, 0, 'no pending animation at completion');
    const final = await page.evaluate(() => ({ mounts: __presentationQA.mountCount, controllers: __presentationQA.controllers.map(c => ({ mode: c.mode, state: c.controller.getState() })) }));
    assert.equal(final.mounts, 3, 'navigation never remounts diagram identities');
    return final;
  });
} catch (error) {
  fatal = errorObject(error); report.fatal = fatal;
  process.stderr.write(`FATAL ${error.message}\n`);
} finally {
  if (page && !page.isClosed()) {
    try { report.finalBrowserState = { url: page.url(), slide: await currentSlide(), frames: await rafState() }; } catch {}
  }
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
  report.finishedAt = new Date().toISOString();
  report.summary = { passed: report.checks.filter(check => check.status === 'passed').length, failed: report.checks.filter(check => check.status === 'failed').length, screenshotCount: report.screenshots.length, fatal: !!fatal };
  report.status = fatal || report.summary.failed ? 'failed' : 'passed';
  await saveReport();
  process.stdout.write(JSON.stringify({ status: report.status, ...report.summary, report: path.join(output, 'report.json') }) + '\n');
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
