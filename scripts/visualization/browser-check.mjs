import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// Optional external QA tool, not an app/CI dependency. Never invokes a calculation core.
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/` : import.meta.url);
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = resolve(process.env.ECO_MIRROR_VISUAL_QA_OUTPUT ?? resolve(root, "docs/visualization/screenshots"));
await mkdir(output, { recursive: true });
const server = await createServer({ root, server: { host: "127.0.0.1", port: 5179, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.ECO_MIRROR_BROWSER_PATH || undefined, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  const start = performance.now();
  await page.goto("http://127.0.0.1:5179/dev/network.html");
  await page.locator('[data-network="sample"]').waitFor();
  const paint = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await paint();
  const fixtureBytes = await readFile(resolve(root, "docs/simulation/phase7-verification/half-result.json"));
  const fixture = JSON.parse(fixtureBytes);
  const report = { browser: await browser.version(), input: { dataset_id: fixture.data_identity.dataset_id, result_sha256: createHash("sha256").update(fixtureBytes).digest("hex"), implementation_git_revision: fixture.implementation_git_revision, rate_percent: 50, trial_index: 0 }, desktop: { width: 1800, height: 1200 }, mobile: { width: 390, height: 844 }, interactions: {}, errors };
  report.desktop.load_to_two_frames_ms = Math.round(performance.now() - start);
  report.desktop.dom_elements = await page.locator(".em-network-comparison *").count();
  assert.equal(await page.locator('[data-network="reference"] [data-pair]').count(), 257);
  assert.equal(await page.locator('[data-network="sample"] [data-observed="true"]').count(), 183);
  assert.equal(await page.locator('[data-node-id]').count(), 248);
  const coordinates = () => page.locator('[data-node-id]').evaluateAll(nodes => nodes.map(node => [node.dataset.nodeId, node.dataset.x, node.dataset.y]));
  const positions = await coordinates();
  assert.deepEqual(positions.slice(0, 124), positions.slice(124));
  report.desktop.label_geometry = await page.locator("svg .em-node text").evaluateAll(labels => {
    let overlaps = 0, outside = 0;
    for (const label of labels) {
      const svg = label.ownerSVGElement.getBoundingClientRect(), box = label.getBoundingClientRect();
      if (box.left < svg.left || box.right > svg.right) outside++;
    }
    for (const svg of document.querySelectorAll(".em-diagram svg")) {
      for (const side of ["plant", "visitor"]) {
        const boxes = [...svg.querySelectorAll(`.em-${side} text`)].map(t => t.getBoundingClientRect());
        for (let i = 1; i < boxes.length; i++) if (boxes[i].top < boxes[i - 1].bottom) overlaps++;
      }
    }
    return { labels: labels.length, overlaps, outside };
  });
  assert.equal(report.desktop.label_geometry.overlaps, 0);
  assert.equal(report.desktop.label_geometry.outside, 0);
  report.desktop.page_overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(report.desktop.page_overflow, false);
  // Contrast of single, unselected SVG strokes against the diagram background.
  const contrast = (foreground, alpha) => {
    const background = [255, 254, 250];
    const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const blended = foreground.map((v, i) => v * alpha + background[i] * (1 - alpha));
    return (luminance(background) + .05) / (luminance(blended) + .05);
  };
  const strokes = await page.evaluate(() => {
    const style = selector => { const css = getComputedStyle(document.querySelector(selector)); return { rgb: css.stroke.match(/\d+/g).map(Number), alpha: Number(css.opacity) }; };
    return { observed: style(".em-observed .em-link-line"), missing: style(".em-missing .em-link-line") };
  });
  report.desktop.stroke_contrast = { observed: contrast(strokes.observed.rgb, strokes.observed.alpha), missing: contrast(strokes.missing.rgb, strokes.missing.alpha) };
  assert.ok(report.desktop.stroke_contrast.observed >= 3 && report.desktop.stroke_contrast.missing >= 3);
  await page.screenshot({ path: resolve(output, "desktop.png"), fullPage: true });

  const switchStart = performance.now();
  await page.getByLabel("表示する試行番号").selectOption("1"); await paint();
  report.interactions.trial_switch_to_two_frames_ms = Math.round(performance.now() - switchStart);
  assert.deepEqual(await coordinates(), positions);
  assert.equal(await page.locator('[data-network="sample"] [data-observed="true"]').count(), 182);
  const firstNode = page.locator('[data-network="reference"] [data-node-id]').first();
  await firstNode.focus(); await page.keyboard.press("Enter");
  const details = page.getByRole("region", { name: "選択したノード・リンクの詳細" });
  assert.match(await details.innerText(), /plant:/);
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.focusIndex), "1");
  await page.keyboard.press("End"); await page.keyboard.press("Space");
  assert.match(await details.innerText(), /抽出後の訪花記録数/);
  await page.getByLabel("原ラベルを検索").fill("Bombus");
  assert.ok(await page.locator(".em-match").count() > 0);
  await page.getByRole("combobox", { name: /ノードの詳細を選択/ }).selectOption("0");
  await page.getByLabel("選択ノードに接続する線だけを表示").check();
  assert.ok(await page.locator('[data-pair]').count() < 514);
  assert.equal(await page.locator('[data-node-id]').count(), 248);
  await page.getByRole("button", { name: "表示をリセット" }).click();

  await page.getByLabel("検証する保存済み結果").selectOption("zero");
  assert.equal(await page.locator('[data-network="sample"] .em-missing').count(), 257);
  await page.getByLabel("検証する保存済み結果").selectOption("full");
  assert.equal(await page.locator('[data-network="sample"] .em-missing').count(), 0);
  await page.getByLabel("検証する保存済み結果").selectOption("empty");
  assert.equal(await page.locator('svg').count(), 0);
  assert.match(await page.getByRole("status").innerText(), /empty_scope/);

  await page.getByLabel("検証する保存済み結果").selectOption("half");
  await page.setViewportSize({ width: 390, height: 844 }); await paint();
  assert.deepEqual(await coordinates(), positions);
  report.mobile.page_overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(report.mobile.page_overflow, false);
  await page.getByRole("combobox", { name: /リンクの詳細を選択/ }).selectOption("0");
  assert.match(await details.innerText(), /Agrostemma_githago/);
  const viewport = page.getByRole("region", { name: "左右共通スクロールのネットワーク比較図" });
  report.mobile.scroll = await viewport.evaluate(el => {
    el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight;
    return { client_width: el.clientWidth, scroll_width: el.scrollWidth, x: el.scrollLeft, y: el.scrollTop };
  });
  assert.ok(report.mobile.scroll.x > 0 && report.mobile.scroll.y > 0);
  await viewport.evaluate(el => { el.scrollLeft = 820; el.scrollTop = 0; });
  await page.screenshot({ path: resolve(output, "mobile-sample.png"), fullPage: true });
  await viewport.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
  await page.screenshot({ path: resolve(output, "mobile.png"), fullPage: true });
  report.interactions.keyboard_nodes_and_links = "passed";
  report.interactions.search_filter_reset_trial_and_boundaries = "passed";
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, "browser-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
