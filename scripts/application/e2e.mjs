import assert from 'node:assert/strict';
import { build, preview, createServer } from 'vite';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/` : import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = resolve(process.env.ECO_MIRROR_APPLICATION_QA_OUTPUT ?? resolve(root, 'docs/application/qa'));
const temp = resolve(process.env.ECO_MIRROR_QA_DOWNLOADS ?? '/tmp/eco-mirror-phase9-downloads');
await mkdir(out, { recursive: true }); await mkdir(temp, { recursive: true });
const report = { browser: null, screenshots: [], runs: [], interactions: [], viewports: [], accessibility: [], resource_checks: [], network_origins: [], errors: [], limitations: ['Physical iPad/Safari, touch devices and screen readers were not available.', 'CDP heap readings are point-in-time JS heap values, not whole-browser peak RSS or a guarantee for low-memory devices.'] };
const log = value => console.log(JSON.stringify(value));
const hashFile = async path => { const hash = createHash('sha256'); for await (const part of createReadStream(path)) hash.update(part); return hash.digest('hex'); };
let server, browser;
try {
  await build({ root, logLevel: 'warn' });
  server = await preview({ root, preview: { host: '127.0.0.1', port: 5182, strictPort: true } });
  browser = await chromium.launch({ executablePath: process.env.ECO_MIRROR_BROWSER_PATH || undefined, headless: true, args: ['--no-sandbox'] });
  report.browser = await browser.version();
  const browserCdp = await browser.newBrowserCDPSession();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  context.setDefaultTimeout(15000);
  const origins = new Set();
  context.on('request', request => { const url = new URL(request.url()); if (['http:', 'https:'].includes(url.protocol)) origins.add(url.origin); });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.addInitScript(() => {
    const Original = window.Worker;
    window.__ecoQA = { events: [], active: 0, heartbeats: [], longtasks: [] };
    window.Worker = class extends Original {
      constructor(url, options) {
        super(url, options); window.__ecoQA.active++;
        this.addEventListener('message', event => {
          const m = event.data; const item = { type: m.type, run_id: m.run_id, time: performance.now() };
          if (m.type === 'ready') Object.assign(item, { status: m.payload.header.status, mode: m.payload.header.execution_mode, repetitions: m.payload.header.requested_repetitions, rate: m.payload.header.sampling.rate_percent, calculation_ms: m.payload.calculation_ms, ui_payload_bytes: m.payload.ui_payload_bytes, engine_revision: m.payload.header.implementation_git_revision, application_revision: m.payload.metadata.application_git_revision, verification: m.payload.metadata.verification, trial_pair_count: m.payload.trial?.sample.pair_count });
          if (m.type === 'trial_ready') Object.assign(item, { trial_index: m.trial.trial_index, json_equivalent_bytes: new TextEncoder().encode(JSON.stringify(m.trial)).length });
          if (m.type === 'export_ready') Object.assign(item, m.info);
          if (m.type === 'error') Object.assign(item, { stage: m.stage, message: m.message });
          window.__ecoQA.events.push(item);
        });
      }
      terminate() { window.__ecoQA.active--; super.terminate(); }
    };
    let previous = performance.now();
    setInterval(() => { const now = performance.now(); window.__ecoQA.heartbeats.push({ time: now, gap_ms: now - previous }); previous = now; }, 50);
    try { new PerformanceObserver(list => window.__ecoQA.longtasks.push(...list.getEntries().map(e => ({ time: e.startTime, duration_ms: e.duration })))).observe({ type: 'longtask', buffered: true }); } catch { /* Unsupported metrics are reported separately. */ }
  });
  const cdp = await context.newCDPSession(page);
  const heap = async () => { try { const m = await cdp.send('Runtime.getHeapUsage'); return { used_bytes: m.usedSize, total_bytes: m.totalSize, backing_storage_bytes: m.backingStorageSize ?? null }; } catch (e) { return { unavailable: String(e) }; } };
  const workerHeap = async () => {
    let sessionId;
    try {
      const targets = await browserCdp.send('Target.getTargets');
      const target = targets.targetInfos.find(t => t.type === 'worker' && /worker-/.test(t.url));
      if (!target) return { unavailable: 'No matching worker target' };
      ({ sessionId } = await browserCdp.send('Target.attachToTarget', { targetId: target.targetId, flatten: false }));
      const value = await new Promise(async (resolveMessage, reject) => {
        const timeout = setTimeout(() => { browserCdp.off('Target.receivedMessageFromTarget', listener); reject(Error('worker heap timeout')); }, 3000);
        const listener = event => { if (event.sessionId !== sessionId) return; const m = JSON.parse(event.message); if (m.id === 1) { clearTimeout(timeout); browserCdp.off('Target.receivedMessageFromTarget', listener); m.error ? reject(Error(JSON.stringify(m.error))) : resolveMessage(m.result); } };
        browserCdp.on('Target.receivedMessageFromTarget', listener);
        try { await browserCdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id: 1, method: 'Runtime.getHeapUsage' }) }); } catch (error) { clearTimeout(timeout); browserCdp.off('Target.receivedMessageFromTarget', listener); reject(error); }
      });
      return value;
    } catch (error) { return { unavailable: String(error) }; }
    finally { if (sessionId) await browserCdp.send('Target.detachFromTarget', { sessionId }).catch(() => {}); }
  };
  const records = () => page.getByRole('navigation', { name: '観測モード' }).getByRole('link', { name: '記録', exact: true }).click();
  const nav = async name => { if (await page.getByRole('dialog', { name: '観測条件の詳細設定' }).isVisible()) await page.getByRole('button', { name: '条件設定を閉じる ×' }).click(); await page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('link', { name }).click(); if (name === '分析結果') await records(); };
  const twoFrames = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  const positions = () => page.locator('[data-node-id]').evaluateAll(nodes => nodes.map(n => [n.dataset.nodeId, n.dataset.x, n.dataset.y]));
  const events = () => page.evaluate(() => window.__ecoQA.events);
  const lastReady = async () => (await events()).filter(e => e.type === 'ready').at(-1);
  async function configure({ mode = 'repeated_trials', repetitions = 100, rate = 50, seed = '42' } = {}) {
    await nav('シミュレーション'); await page.getByRole('button', { name: '初期値に戻す' }).click();
    await page.getByLabel(mode === 'single_trial' ? '単一試行（1回）' : '反復試行（R回）').check();
    if (mode === 'repeated_trials') await page.getByLabel('反復回数').fill(String(repetitions));
    await page.getByLabel('乱数シード').fill(seed);
    if (rate === 0) await page.getByLabel('観測割合', { exact: true }).press('Home');
    else if (rate === 100) await page.getByLabel('観測割合', { exact: true }).press('End');
    else assert.equal(rate, 50, 'QA helper uses actual default/Home/End slider input');
  }
  async function runCase(name, { empty = false } = {}) {
    const start = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: 'シミュレーションを実行', exact: true }).click();
    await page.waitForURL(/\/results$/);
    await records();
    await page.getByRole('heading', { name: empty ? '選択範囲に観測記録がありません。' : '試行 0 の結果', exact: true }).waitFor({ timeout: 120000 });
    await twoFrames();
    const item = { name, ...await lastReady(), end_to_two_frames_ms: Math.round(await page.evaluate(() => performance.now()) - start), main_heap: await heap(), worker_heap: await workerHeap() };
    assert.equal(item.verification, 'verified');
    assert.equal(item.engine_revision, 'a55e7e2a86d2c9ac58de23fdbb2a0ae673ddb0b1');
    assert.ok(item.ui_payload_bytes < 300000);
    item.render = await page.evaluate(() => ({ dom_elements: document.querySelectorAll('*').length, logical_nodes: document.querySelectorAll('[data-node-id]').length, svg_links: document.querySelectorAll('[data-pair]').length }));
    item.main_heartbeat_max_gap_ms = await page.evaluate(start => Math.max(0, ...window.__ecoQA.heartbeats.filter(v => v.time >= start).map(v => v.gap_ms)), start);
    item.main_longtasks = await page.evaluate(start => window.__ecoQA.longtasks.filter(v => v.time >= start), start);
    report.runs.push(item); log({ completed: name, calculation_ms: item.calculation_ms, ui_payload_bytes: item.ui_payload_bytes }); return item;
  }
  async function prepareAndSave(name, parse = true) {
    const exportStart = await page.evaluate(() => performance.now());
    await page.getByRole('button', { name: '保存ファイルを準備', exact: true }).click();
    await page.getByRole('link', { name: '正式JSONを保存', exact: true }).waitFor({ timeout: 120000 });
    const metric = (await events()).filter(e => e.type === 'export_ready').at(-1);
    metric.main_heartbeat_max_gap_ms = await page.evaluate(start => Math.max(0, ...window.__ecoQA.heartbeats.filter(v => v.time >= start).map(v => v.gap_ms)), exportStart);
    metric.main_longtasks = await page.evaluate(start => window.__ecoQA.longtasks.filter(v => v.time >= start), exportStart);
    const paths = {};
    for (const [key, label] of [['result', '正式JSONを保存'], ['provenance', '来歴JSONを保存'], ['csv', '試行別CSVを保存']]) {
      const promise = page.waitForEvent('download'); await page.getByRole('link', { name: label, exact: true }).click();
      const download = await promise; assert.equal(await download.failure(), null);
      const path = resolve(temp, `${name}-${download.suggestedFilename()}`); await download.saveAs(path); paths[key] = path;
    }
    const hash = await hashFile(paths.result), provenance = JSON.parse(await readFile(paths.provenance, 'utf8'));
    assert.equal(hash, metric.result_sha256); assert.equal(hash, provenance.result_sha256);
    assert.equal(provenance.application_git_revision, (await lastReady()).application_revision);
    const csv = (await readFile(paths.csv, 'utf8')).split('\r\n').filter(Boolean);
    assert.equal(csv.length, ((await lastReady()).status === 'empty_scope' ? 0 : (await lastReady()).repetitions) + 1);
    const value = parse ? JSON.parse(await readFile(paths.result, 'utf8')) : null;
    if (value) {
      for (let i = 0; i < value.trials.length; i++) {
        const cells = csv[i + 1].split(',').map(v => v.slice(1, -1)); const trial = value.trials[i];
        assert.deepEqual(cells.slice(0, 6).map(Number), [i, trial.sample.event_count, trial.sample.plant_label_count, trial.sample.visitor_label_count, trial.sample.pair_count, trial.lost_pair_count]);
        assert.deepEqual(cells.slice(6, 8), [trial.pair_retention_pct.numerator, trial.pair_retention_pct.denominator]);
        assert.deepEqual(cells.slice(9, 11), [trial.sample.connectance_fixed.numerator, trial.sample.connectance_fixed.denominator]);
      }
    }
    report.runs.at(-1).export = { ...metric, sha256_checked_independently: hash, main_heap: await heap(), worker_heap: await workerHeap() };
    return { paths, value, hash };
  }
  const metricText = () => page.getByLabel('選択中の試行の主要指標').innerText();
  await page.goto('http://127.0.0.1:5182/');
  await page.getByRole('link', { name: 'シミュレーションを始める' }).click();
  await runCase('default-R100-p50');
  assert.match(await metricText(), /1,941件/); assert.match(await metricText(), /183組/); assert.match(await metricText(), /74組/);
  const defaultExport = await prepareAndSave('default-R100');
  assert.equal(defaultExport.value.trials.length, 100);
  assert.equal(defaultExport.value.trials[0].sample.pair_count, 183);
  const summaryBefore = await page.getByRole('region', { name: '全7指標の統計サマリー' }).innerText();
  assert.match(summaryBefore, new RegExp((Number(defaultExport.value.summary.pair_count.mean.numerator) / Number(defaultExport.value.summary.pair_count.mean.denominator)).toFixed(2).replace('.', '\\.')));
  const fixed = await positions(); assert.deepEqual(fixed.slice(0, 124), fixed.slice(124));
  const startEvents = (await events()).filter(e => e.type === 'ready').length;
  const switchStart = performance.now();
  await page.getByRole('combobox', { name: /表示する試行番号/ }).selectOption('99');
  await page.getByRole('heading', { name: '試行 99 の結果', exact: true }).waitFor(); await twoFrames();
  assert.deepEqual(await positions(), fixed);
  assert.equal(await page.getByRole('region', { name: '全7指標の統計サマリー' }).innerText(), summaryBefore);
  assert.equal((await events()).filter(e => e.type === 'ready').length, startEvents);
  const expected99 = defaultExport.value.trials[99].sample.pair_count;
  assert.equal(await page.locator('[data-network="sample"] [data-observed="true"]').count(), expected99);
  report.interactions.push({ name: 'trial-99-without-recalculation', ms: Math.round(performance.now() - switchStart), ...((await events()).filter(e => e.type === 'trial_ready').at(-1)) });
  await nav('研究情報'); await nav('分析結果'); assert.match(await metricText(), new RegExp(`${expected99}組`));
  report.interactions.push({ name: 'navigation-preserves-current-trial-and-result', passed: true });
  await copyFile(defaultExport.paths.provenance, resolve(out, 'browser-run-provenance.json'));
  await copyFile(defaultExport.paths.csv, resolve(out, 'trial-metrics-R100.csv'));

  const node = page.locator('[data-network="reference"] [data-node-id]').first();
  await node.focus(); await page.keyboard.press('Enter');
  assert.notEqual(await page.getByRole('region', { name: '選択したノード・リンクの詳細' }).innerText(), '');
  await page.keyboard.press('ArrowDown');
  const focused = await page.evaluate(() => { const e = document.activeElement, r = e.getBoundingClientRect(), header = document.querySelector('.site-header')?.getBoundingClientRect(); return { node: e.getAttribute('data-node-id'), top: r.top, bottom: r.bottom, header_bottom: header?.bottom ?? 0, viewport_height: innerHeight }; });
  assert.ok(focused.node); assert.ok(focused.top >= focused.header_bottom && focused.bottom <= focused.viewport_height);
  report.interactions.push({ name: 'keyboard-select-node-and-arrow-focus-visible', ...focused });
  const axePath = process.env.ECO_MIRROR_AXE_PATH;
  for (const [width, height, name] of [[390, 844, 'phone'], [768, 1024, 'tablet-portrait'], [1024, 768, 'tablet-landscape'], [1440, 900, 'desktop']]) {
    await page.setViewportSize({ width, height }); await twoFrames();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, `${name}: unintended whole-page overflow`);
    await page.getByRole('combobox', { name: /表示する試行番号/ }).selectOption('0');
    await page.getByRole('heading', { name: '試行 0 の結果', exact: true }).waitFor();
    const screenshot = `results-${name}.png`; await page.screenshot({ path: resolve(out, screenshot), fullPage: true });
    report.screenshots.push(screenshot); report.viewports.push({ width, height, name, whole_page_overflow: overflow, logical_coordinates_match: JSON.stringify(await positions()) === JSON.stringify(fixed) });
    assert.deepEqual(await positions(), fixed);
    if (axePath && name === 'desktop') {
      await page.addScriptTag({ path: axePath }); const audit = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
      report.accessibility.push({ page: 'results', violations: audit.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, failure: n.failureSummary })) })) });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.documentElement.style.fontSize = '200%'); await twoFrames();
  const zoomOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  report.viewports.push({ name: 'results-text-200-percent', whole_page_overflow: zoomOverflow });
  assert.equal(zoomOverflow, false, 'Results text zoom overflow');
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await page.setViewportSize({ width: 1440, height: 900 });

  for (const rate of [0, 100, 50]) {
    await configure({ mode: 'single_trial', rate }); await runCase(`single-p${rate}`);
    const output = await prepareAndSave(`single-p${rate}`);
    assert.equal(output.value.status, 'success');
    assert.equal(output.value.trials[0].sample.event_count, rate === 0 ? 0 : rate === 100 ? 3882 : 1941);
    assert.equal(output.value.trials[0].sample.pair_count, rate === 0 ? 0 : rate === 100 ? 257 : 183);
    assert.equal(output.value.trials[0].lost_pair_count, rate === 0 ? 257 : rate === 100 ? 0 : 74);
    assert.equal(await page.locator('[data-network="sample"] .em-missing').count(), rate === 0 ? 257 : rate === 100 ? 0 : 74);
    if (rate === 50) assert.equal(output.hash, 'c7a9d45480d42834bdee569d94af0441b4e78a95e8d0452b552a63fcfb42fe45');
    if (rate === 100) assert.deepEqual(output.value.reference, output.value.trials[0].sample);
  }
  for (const repetitions of [1, 2]) {
    await configure({ repetitions }); await runCase(`repeated-R${repetitions}`);
    const output = await prepareAndSave(`R${repetitions}`);
    assert.equal(output.value.execution_mode, 'repeated_trials'); assert.equal(output.value.trials.length, repetitions);
    assert.equal(output.value.summary.pair_count.sample_sd === null, repetitions === 1);
    if (repetitions === 1) assert.match(await page.getByRole('region', { name: '全7指標の統計サマリー' }).innerText(), /未定義（1試行）/);
  }
  for (const rate of [0, 100]) {
    await configure({ repetitions: 100, rate }); await runCase(`R100-p${rate}`);
    const output = await prepareAndSave(`R100-p${rate}`);
    assert.equal(output.value.trials.length, 100);
    assert.ok(output.value.trials.every(t => t.sample.pair_count === (rate === 0 ? 0 : 257)));
    assert.deepEqual(output.value.summary.pair_count.sample_variance, { numerator: '0', denominator: '1' });
  }
  await configure({ mode: 'single_trial', rate: 100 });
  await page.getByLabel('2015年', { exact: true }).check();
  await page.getByRole('button', { name: '全区画を解除', exact: true }).click();
  await page.getByLabel('Plot 1', { exact: true }).check();
  await page.getByLabel('Plot 2', { exact: true }).check();
  for (const treatment of ['Heat', 'Heat+Water']) await page.getByLabel(treatment, { exact: true }).uncheck();
  await page.getByRole('button', { name: '2015年の調査回を解除', exact: true }).click();
  for (const round of [1, 2]) await page.getByLabel(`2015年 Round ${round}`, { exact: true }).check();
  await runCase('partial-year-plot-treatment-round');
  const partial = await prepareAndSave('partial');
  const source = JSON.parse(await readFile(resolve(root, 'data/processed/moss-evans-2022-flower-visits-v1/events.json'), 'utf8'));
  const selected = source.events.filter(e => e.year === 2015 && ['1', '2'].includes(e.plot_id) && ['Control', 'Water'].includes(e.treatment) && ['1', '2'].includes(e.round_label));
  assert.ok(selected.length > 0);
  assert.deepEqual(partial.value.scope.eligible_source_record_numbers, selected.map(e => e.source_record_number));
  report.interactions.push({ name: 'year-plot-treatment-round-selection-compared-to-original-normalized-events', event_count: selected.length });
  await configure(); await page.getByLabel('乱数シード').fill('1e2');
  assert.equal(await page.getByLabel('乱数シード').inputValue(), '1e2'); assert.equal(await page.getByRole('button', { name: 'シミュレーションを実行', exact: true }).isDisabled(), true);
  await page.getByLabel('乱数シード').fill(''); assert.equal(await page.getByLabel('乱数シード').inputValue(), '');
  await page.getByRole('button', { name: '初期値に戻す' }).click();
  assert.equal(await page.getByLabel('乱数シード').inputValue(), '42');
  await page.getByRole('button', { name: '全区画を解除', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'シミュレーションを実行', exact: true }).isDisabled(), true);
  report.interactions.push({ name: 'invalid-exponent-empty-seed-empty-plots-and-reset', passed: true });
  await page.getByRole('button', { name: '初期値に戻す' }).click();
  await page.getByLabel('2014年', { exact: true }).check();
  await page.getByRole('button', { name: '全区画を解除', exact: true }).click(); await page.getByLabel('Plot 3', { exact: true }).check();
  for (const label of ['Control', 'Heat', 'Heat+Water']) await page.getByLabel(label, { exact: true }).uncheck();
  await page.getByRole('button', { name: '2014年の調査回を解除', exact: true }).click(); await page.getByLabel('2014年 Round 1', { exact: true }).check();
  await page.getByLabel('反復回数').fill('3'); await runCase('empty-scope', { empty: true });
  assert.equal(await page.locator('[data-network]').count(), 0); assert.equal(await page.getByLabel('選択中の試行の主要指標').count(), 0);
  const emptyExport = await prepareAndSave('empty'); assert.equal(emptyExport.hash, '07ef3917291fe70e2914460f35e4eebff099205aca576e91d2421e0d8abb675f');
  assert.equal(emptyExport.value.trials.length, 0);

  await configure({ repetitions: 1000 });
  await page.getByRole('button', { name: 'シミュレーションを実行', exact: true }).click();
  await page.getByRole('button', { name: '計算を中止', exact: true }).click();
  await page.getByRole('heading', { name: '処理を中止しました。', exact: true }).waitFor();
  assert.equal(await page.locator('[data-network]').count(), 0);
  assert.equal(await page.evaluate(() => window.__ecoQA.active), 0);
  report.resource_checks.push({ name: 'actual-worker-cancel-terminates-and-clears-result', passed: true });

  await configure({ repetitions: 100 }); await runCase('cancel-export-R100');
  await page.getByRole('button', { name: '保存ファイルを準備', exact: true }).click();
  await page.getByRole('button', { name: '準備を中止して結果を破棄', exact: true }).click();
  await page.getByRole('heading', { name: '処理を中止しました。', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: '正式JSONを保存', exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.__ecoQA.active), 0);
  report.resource_checks.push({ name: 'export-cancellation-discards-worker-result-and-urls', passed: true });
  const bigHashes = [];
  for (let repeat = 0; repeat < 2; repeat++) {
    await configure({ repetitions: 1000 }); await runCase(`R1000-p50-run${repeat + 1}`);
    const output = await prepareAndSave(`R1000-run${repeat + 1}`, false);
    assert.equal(output.hash, '083873fbd56b8b3a7fb30c876a86c878252d18583b906c4354bfe85286c29ab8');
    bigHashes.push(output.hash);
    assert.equal(await page.evaluate(() => window.__ecoQA.active), 1);
    await page.getByRole('combobox', { name: /表示する試行番号/ }).selectOption('999');
    await page.getByRole('heading', { name: '試行 999 の結果', exact: true }).waitFor();
  }
  assert.equal(bigHashes[0], bigHashes[1]);
  report.resource_checks.push({ name: 'R1000-full-export-hash-reproduced-twice', sha256: bigHashes[0] });
  await nav('シミュレーション');
  await page.getByLabel('観測割合', { exact: true }).press('End');
  await nav('分析結果'); await page.getByText(/現在表示している結果は、以前の条件/).waitFor();
  await page.getByRole('button', { name: 'この条件で再実行', exact: true }).click();
  await page.getByRole('heading', { name: '試行 0 の結果', exact: true }).waitFor({ timeout: 120000 });
  assert.equal((await lastReady()).rate, 50);
  report.interactions.push({ name: 'stale-result-labelled-and-replay-restores-original-p50', passed: true });
  await page.reload();
  await page.getByRole('heading', { name: '分析結果はまだありません。', exact: true }).waitFor();
  assert.equal(await page.locator('[data-network]').count(), 0);
  report.interactions.push({ name: 'reload-clears-memory-result-with-explanation', passed: true });
  await nav('シミュレーション'); await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(out, 'simulation-phone.png'), fullPage: true }); report.screenshots.push('simulation-phone.png');
  await page.evaluate(() => document.documentElement.style.fontSize = '200%'); await twoFrames();
  const formZoomOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  report.viewports.push({ name: 'form-text-200-percent', whole_page_overflow: formZoomOverflow });
  assert.equal(formZoomOverflow, false, 'Form text zoom overflow');
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: resolve(out, 'simulation-desktop.png'), fullPage: true }); report.screenshots.push('simulation-desktop.png');
  if (axePath) {
    await page.addScriptTag({ path: axePath }); const audit = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
    report.accessibility.push({ page: 'simulation', violations: audit.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, failure: n.failureSummary })) })) });
  }
  // Actual browser network failure, not a fabricated Worker success/error fixture.
  await page.reload();
  await context.route('**/assets/events-*.js', route => route.abort('failed'));
  await page.getByLabel('単一試行（1回）').check();
  await page.getByRole('button', { name: 'シミュレーションを実行', exact: true }).click();
  await page.getByRole('heading', { name: '処理を完了できませんでした。', exact: true }).waitFor();
  assert.equal(await page.locator('[data-network]').count(), 0);
  assert.equal(await page.getByRole('link', { name: '正式JSONを保存', exact: true }).count(), 0);
  report.resource_checks.push({ name: 'blocked-real-data-asset-is-error-without-fabricated-result', passed: true });
  await context.unroute('**/assets/events-*.js');

  report.network_origins = [...origins]; assert.deepEqual(report.network_origins, ['http://127.0.0.1:5182']);
  assert.deepEqual(report.errors, []);
  assert.equal(report.accessibility.reduce((n, a) => n + a.violations.length, 0), 0, 'Automated accessibility audit');
  const attestedPath = resolve(root, 'src/features/execution/application.css');
  const originalBytes = await readFile(attestedPath);
  let dev;
  try {
    await writeFile(attestedPath, Buffer.concat([originalBytes, Buffer.from('\n/* QA-only uncommitted provenance probe */\n')]));
    dev = await createServer({ root, logLevel: 'warn', server: { host: '127.0.0.1', port: 5183, strictPort: true } }); await dev.listen();
    await page.goto('http://127.0.0.1:5183/simulation');
    await page.getByLabel('単一試行（1回）').check();
    await page.getByRole('button', { name: 'シミュレーションを実行', exact: true }).click();
    await records();
    await page.getByRole('heading', { name: '試行 0 の結果', exact: true }).waitFor();
    await page.getByText('開発用 · アプリ来歴未検証', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: '保存ファイルを準備', exact: true }).isDisabled(), true);
    assert.equal((await lastReady()).verification, 'unverified');
    await writeFile(attestedPath, Buffer.concat([originalBytes, Buffer.from('\n/* QA-only second edit: must invalidate HMR attestation */\n')]));
    await page.getByRole('heading', { name: '分析結果はまだありません。', exact: true }).waitFor();
    assert.equal(await page.locator('[data-network]').count(), 0);
    // Wait for the file watcher's document reload, not an already-idle old page.
    const restoredNavigation = page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() });
    await writeFile(attestedPath, originalBytes);
    await restoredNavigation;
    await page.waitForLoadState('networkidle');
    // Reload explicitly after restoration, then verify real committed metadata again.
    await page.reload(); await nav('シミュレーション'); await page.getByLabel('単一試行（1回）').check();
    await page.getByRole('button', { name: 'シミュレーションを実行', exact: true }).click();
    await records();
    await page.getByRole('heading', { name: '試行 0 の結果', exact: true }).waitFor();
    assert.equal((await lastReady()).verification, 'verified');
    report.resource_checks.push({ name: 'dirty-application-formal-export-blocked-HMR-clears-result-restored-commit-verifies', passed: true });
  } finally { await writeFile(attestedPath, originalBytes); await dev?.close(); }
  await writeFile(resolve(out, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  log({ status: 'passed', runs: report.runs.length, accessibility_violations: report.accessibility.reduce((n, a) => n + a.violations.length, 0) });
} catch (error) {
  if (browser) { const p = browser.contexts()[0]?.pages()[0]; if (p) { await p.screenshot({ path: resolve(out, 'failure.png'), fullPage: true }).catch(() => {}); report.failure_text = await p.locator('main').innerText().catch(() => ''); } }
  report.failure = String(error); await writeFile(resolve(out, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n'); throw error;
} finally { await browser?.close(); if (server?.httpServer) await new Promise(done => server.httpServer.close(done)); else await server?.close?.(); }
