/** Repeatable, real-result screenshots; no generated or test-only data. */
import { preview } from 'vite';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/` : import.meta.url);
const { chromium } = require('playwright');
const out = resolve('docs/application/qa'); await mkdir(out, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 5184, strictPort: true } });
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.ECO_MIRROR_BROWSER_PATH, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:5184/simulation');
  await page.getByRole('button', { name: 'シミュレーションを実行', exact: true }).click();
  await page.getByRole('heading', { name: '試行 0 の結果', exact: true }).waitFor({ timeout: 120000 });
  const report = { browser: await browser.version(), result: await page.getByLabel('選択中の試行の主要指標').innerText(), verification: await page.locator('.result-toolbar .small-tag').innerText(), screenshots: [] };
  for (const [width, height, name] of [[390,844,'phone'],[768,1024,'tablet-portrait'],[1024,768,'tablet-landscape'],[1440,900,'desktop']]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0,0); });
    await page.screenshot({ path: resolve(out, `results-${name}.png`), fullPage: true });
    await page.screenshot({ path: resolve(out, `results-${name}-viewport.png`) });
    report.screenshots.push({ width, height, path: `results-${name}.png` });
  }
  await page.getByRole('navigation', { name: 'メインナビゲーション' }).getByRole('link', { name: 'シミュレーション' }).click();
  for (const [width,height,name] of [[390,844,'phone'],[1440,900,'desktop']]) {
    await page.setViewportSize({width,height}); await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0,0); });
    await page.screenshot({path:resolve(out,`simulation-${name}.png`),fullPage:true});
  }
  await writeFile(resolve(out, 'screenshot-report.json'), JSON.stringify(report,null,2)+'\n');
} finally { await browser?.close(); if (server?.httpServer) await new Promise(done=>server.httpServer.close(done)); }
