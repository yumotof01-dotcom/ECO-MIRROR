/** Real Worker/Blob lifetime checks; counts are not a whole-browser memory claim. */
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/` : import.meta.url);
const { chromium } = require('playwright');
const server = await preview({preview:{host:'127.0.0.1',port:5186,strictPort:true}});
let browser;
const report = { scenarios:[], limitations:['Linux Chromium only; not physical Safari/iPad.', 'Worker and Blob URL lifetimes are measured, not peak RSS or low-memory device safety.'] };
try {
 browser=await chromium.launch({executablePath:process.env.ECO_MIRROR_BROWSER_PATH,args:['--no-sandbox']});
 report.browser=await browser.version();
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{
  const Original=window.Worker, active=new Set(), urls=new Set();
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  window.__lifetime={active,urls,ready:[],phase:null};
  window.Worker=class extends Original {
   constructor(...args){super(...args);active.add(this);window.__lifetime.phase=null;this.addEventListener('message',({data})=>{if(data.type==='phase')window.__lifetime.phase=data.phase;if(data.type==='ready')window.__lifetime.ready.push({run_id:data.run_id,verification:data.payload.metadata.verification,pairs:data.payload.trial?.sample.pair_count,revision:data.payload.metadata.application_git_revision});});}
   terminate(){active.delete(this);super.terminate();}
  };
  URL.createObjectURL=blob=>{const u=create(blob);urls.add(u);return u;};
  URL.revokeObjectURL=u=>{urls.delete(u);revoke(u);};
 });
 const snapshot=()=>page.evaluate(()=>({workers:window.__lifetime.active.size,urls:window.__lifetime.urls.size,ready:window.__lifetime.ready.at(-1)}));
 await page.goto('http://127.0.0.1:5186/simulation');
 for(let cycle=0;cycle<6;cycle++){
  if(cycle)await page.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:'シミュレーション'}).click();
  await page.getByRole('button',{name:'シミュレーションを実行',exact:true}).click();
  await page.getByRole('heading',{name:'試行 0 の結果',exact:true}).waitFor({timeout:120000});
  const ready=await snapshot();assert.equal(ready.workers,1);assert.equal(ready.urls,0);assert.equal(ready.ready.verification,'verified');assert.equal(ready.ready.pairs,183);
  await page.getByRole('button',{name:'保存ファイルを準備',exact:true}).click();
  await page.getByRole('link',{name:'正式JSONを保存',exact:true}).waitFor({timeout:120000});
  const exported=await snapshot();assert.equal(exported.workers,1);assert.equal(exported.urls,3);
  await page.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:'研究情報'}).click();
  assert.equal((await snapshot()).urls,3);
  await page.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:'分析結果'}).click();
  await page.getByRole('link',{name:'正式JSONを保存',exact:true}).waitFor();
  report.scenarios.push({cycle,ready,exported,navigation:'preserved'});
 }
 await page.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:'シミュレーション'}).click();
 await page.getByLabel('反復回数').fill('1000');
 await page.getByRole('button',{name:'シミュレーションを実行',exact:true}).click();
 await page.waitForFunction(()=>window.__lifetime.phase==='running');
 await page.getByRole('button',{name:/中止/}).click();
 assert.equal((await snapshot()).workers,0);assert.equal((await snapshot()).urls,0);
 await page.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:'シミュレーション'}).click();
 await page.getByLabel('反復回数').fill('2');
 await page.getByRole('button',{name:'シミュレーションを実行',exact:true}).click();
 await page.getByRole('heading',{name:'試行 0 の結果',exact:true}).waitFor({timeout:60000});
 assert.equal((await snapshot()).workers,1);assert.equal((await snapshot()).urls,0);
 report.recovery=await snapshot();assert.deepEqual(errors,[]);
 report.status='passed';
 await writeFile('docs/application/qa/lifecycle-report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,cycles:report.scenarios.length,recovery:report.recovery}));
}finally{await browser?.close();await new Promise(done=>server.httpServer.close(done));}
