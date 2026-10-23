/** Real R=2 Worker runs: keyboard activation and repeated resource lifetime checks. */
import assert from 'node:assert/strict';
import { preview } from 'vite';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/');
const {chromium}=require('playwright');
const server=await preview({preview:{host:'127.0.0.1',port:5189,strictPort:true}});
let browser;
const report={status:'running',cycles:[],keyboard:[],errors:[],limitations:['Desktop Chromium keyboard only, not a screen reader or physical touch device.','Six cycles do not establish long-duration or low-memory safety.']};
try {
 browser=await chromium.launch({executablePath:process.env.ECO_MIRROR_BROWSER_PATH,args:['--no-sandbox']});
 report.browser=await browser.version();
 const p=await browser.newPage({acceptDownloads:true});
 p.on('pageerror',e=>report.errors.push(String(e)));
 await p.addInitScript(()=>{
   window.__resources={workers:0,urls:[]};const W=Worker;
   window.Worker=class extends W {constructor(...a){super(...a);window.__resources.workers++;this.stopped=false;}terminate(){if(!this.stopped){this.stopped=true;window.__resources.workers--;}super.terminate();}};
   const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
   URL.createObjectURL=b=>{const u=create(b);window.__resources.urls.push(u);return u;};
   URL.revokeObjectURL=u=>{window.__resources.urls=window.__resources.urls.filter(x=>x!==u);return revoke(u);};
 });
 async function keyboardActivate(locator,name){
   for(let i=0;i<120;i++){
     if(await locator.evaluate(e=>e===document.activeElement)){await p.keyboard.press('Enter');report.keyboard.push(name);return;}
     await p.keyboard.press('Tab');
   }
   throw Error('Keyboard could not reach '+name);
 }
 await p.goto('http://127.0.0.1:5189/');
 await keyboardActivate(p.getByRole('link',{name:'シミュレーションを始める',exact:true}),'home-to-form');
 const repeats=p.getByLabel('反復回数');
 for(let i=0;i<100 && !(await repeats.evaluate(e=>e===document.activeElement));i++)await p.keyboard.press('Tab');
 assert.equal(await repeats.evaluate(e=>e===document.activeElement),true);
 await p.keyboard.press('ControlOrMeta+A');await p.keyboard.type('2');
 for(let cycle=0;cycle<6;cycle++){
   if(cycle) await p.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:'シミュレーション',exact:true}).click();
   if(!cycle) await keyboardActivate(p.getByRole('button',{name:'シミュレーションを実行',exact:true}),'execute');
   else await p.getByRole('button',{name:'シミュレーションを実行',exact:true}).click();
   await p.getByRole('heading',{name:'試行 0 の結果',exact:true}).waitFor({timeout:120000});
   let state=await p.evaluate(()=>window.__resources);
   assert.equal(state.workers,1);assert.equal(state.urls.length,0);
   if(!cycle){
     const trial=p.getByLabel('表示する試行番号');
     for(let i=0;i<120 && !(await trial.evaluate(e=>e===document.activeElement));i++)await p.keyboard.press('Tab');
     assert.equal(await trial.evaluate(e=>e===document.activeElement),true);
     await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');
     await p.getByRole('heading',{name:'試行 1 の結果',exact:true}).waitFor();report.keyboard.push('trial-selection');
     await keyboardActivate(p.getByRole('button',{name:'保存ファイルを準備',exact:true}),'prepare-export');
   }else await p.getByRole('button',{name:'保存ファイルを準備',exact:true}).click();
   const link=p.getByRole('link',{name:'正式JSONを保存',exact:true});await link.waitFor();
   const waiting=p.waitForEvent('download');
   if(!cycle)await keyboardActivate(link,'download');else await link.click();
   const download=await waiting;assert.equal(await download.failure(),null);
   const sha=createHash('sha256').update(await readFile(await download.path())).digest('hex');
   assert.equal(sha,'2580eecead8d242bc360fdcb7adf2c4dae5748397dd9a2a368e8465775d7827d');
   state=await p.evaluate(()=>window.__resources);assert.equal(state.workers,1);assert.equal(state.urls.length,3);
   report.cycles.push({cycle,sha256:sha,...state,urls:state.urls.length});
 }
 await p.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:'研究情報',exact:true}).click();
 await p.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:'分析結果',exact:true}).click();
 await p.getByRole('heading',{name:'試行 0 の結果',exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>window.__resources.workers),1);
 await p.reload();await p.getByRole('heading',{name:'分析結果はまだありません。',exact:true}).waitFor();
 report.after_reload=await p.evaluate(()=>window.__resources);assert.deepEqual(report.after_reload,{workers:0,urls:[]});
 assert.deepEqual(report.errors,[]);report.status='PASS';
 await writeFile('docs/release/interaction-smoke.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser?.close();await new Promise(done=>server.httpServer.close(done));}
