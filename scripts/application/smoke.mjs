import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/` : import.meta.url);
const { chromium } = require('playwright');
const server = await createServer({ server: { host: '127.0.0.1', port: 5181, strictPort: true } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ executablePath: process.env.ECO_MIRROR_BROWSER_PATH, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => console.log('PAGE ERROR', String(error)));
  page.on('console', event => { if(event.type()==='error') console.log('CONSOLE ERROR',event.text()); });
  await page.goto('http://127.0.0.1:5181/');
  await page.getByRole('link', { name: 'シミュレーションを始める' }).click();
  await page.getByLabel('単一試行（1回）').check();
  await page.getByRole('button', { name: 'シミュレーションを実行' }).click();
  await page.getByRole('heading', { name: '試行 0 の結果' }).waitFor({ timeout: 60000 });
  console.log(await page.getByLabel('選択中の試行の主要指標').innerText());
  console.log('STATUS:', await page.locator('.result-toolbar').innerText());
  await page.screenshot({ path:resolve(process.env.ECO_MIRROR_SMOKE_SCREENSHOT ?? 'docs/application/qa/smoke.png'), fullPage:true });
} finally { await browser?.close(); await server.close(); }
