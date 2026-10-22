/** Additional engine compatibility and bounded stress checks; not physical-device testing. */
import assert from 'node:assert/strict';
import {preview} from 'vite';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire((process.env.ECO_QA_NODE_MODULES||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES)+'/');
const engine=process.env.ECO_QA_ENGINE||'chromium';
const mode=process.env.ECO_QA_MODE||'compatibility';
assert.ok(['chromium','webkit'].includes(engine));assert.ok(['compatibility','soak','heap-limit'].includes(mode));
assert.ok(engine==='chromium'||mode==='compatibility');
const output=process.env.ECO_QA_REPORT||`docs/release/extended/${engine}-${mode}.json`;
await mkdir(output.slice(0,output.lastIndexOf('/')),{recursive:true});
const report={status:'running',engine,mode,checks:[],errors:[],limitations:['Desktop automated browser, not physical iPad/Safari, VoiceOver or participant testing.','Heap limit constrains V8 heaps, not total device RAM or OS memory pressure.','Bounded repeated use is not a guarantee for indefinite/background operation.']};
const server=await preview({preview:{host:'127.0.0.1',port:5194,strictPort:true}});let browser;
const save=()=>writeFile(output,JSON.stringify(report,null,2)+'\n');
const started=performance.now();
try{
 const args=engine==='chromium'?['--no-sandbox',...(mode==='heap-limit'?['--js-flags=--max-old-space-size=128']:[])]:[];
 browser=await require('playwright')[engine].launch({...(engine==='chromium'&&process.env.ECO_MIRROR_BROWSER_PATH?{executablePath:process.env.ECO_MIRROR_BROWSER_PATH}:{}),args});
 report.browser=await browser.version();report.heap_limit_mib=mode==='heap-limit'?128:null;
 const p=await browser.newPage({viewport:{width:768,height:1024},hasTouch:true,acceptDownloads:true});
 p.setDefaultTimeout(30000);p.on('pageerror',e=>report.errors.push(String(e)));
 await p.addInitScript(()=>{
  const W=Worker;window.__qa={workers:0,urls:[],messages:[],ticks:[]};
  window.Worker=class extends W{constructor(...a){super(...a);window.__qa.workers++;this.stopped=false;this.addEventListener('message',e=>{const m=e.data;if(m.type==='ready')window.__qa.messages.push({type:m.type,verification:m.payload.metadata.verification,revision:m.payload.metadata.application_git_revision,pairs:m.payload.trial?.sample.pair_count});});}terminate(){if(!this.stopped){this.stopped=true;window.__qa.workers--;}super.terminate();}};
  const c=URL.createObjectURL.bind(URL),r=URL.revokeObjectURL.bind(URL);URL.createObjectURL=b=>{const u=c(b);window.__qa.urls.push(u);return u;};URL.revokeObjectURL=u=>{window.__qa.urls=window.__qa.urls.filter(v=>v!==u);return r(u);};
  let last=performance.now();setInterval(()=>{const now=performance.now();window.__qa.ticks.push(now-last);last=now;},50);
 });
 const nav=name=>p.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name,exact:true}).click();
 await p.goto('http://127.0.0.1:5194/');await p.getByRole('link',{name:'シミュレーションを始める',exact:true}).tap();
 async function run(R,rate,cycle){
  await nav('シミュレーション');await p.getByRole('button',{name:'初期値に戻す',exact:true}).click();
  await p.getByLabel('反復回数').fill(String(R));
  const slider=p.getByLabel('観測割合',{exact:true});if(rate===0)await slider.press('Home');else if(rate===100)await slider.press('End');
  const begin=performance.now();await p.getByRole('button',{name:'シミュレーションを実行',exact:true}).tap();
  await p.getByRole('heading',{name:'試行 0 の結果',exact:true}).waitFor({timeout:240000});
  const elapsed=performance.now()-begin;
  assert.equal(await p.evaluate(()=>window.__qa.workers),1);assert.equal(await p.evaluate(()=>window.__qa.urls.length),0);
  const metadata=await p.evaluate(()=>window.__qa.messages.at(-1));assert.equal(metadata.verification,'verified');assert.equal(metadata.pairs,rate===0?0:rate===100?257:183);
  const positions=await p.locator('[data-node-id]').evaluateAll(ns=>ns.map(n=>[n.dataset.nodeId,n.dataset.x,n.dataset.y]));
  if(R>1){await p.getByLabel('表示する試行番号').selectOption(String(R-1));await p.getByRole('heading',{name:`試行 ${R-1} の結果`,exact:true}).waitFor();assert.deepEqual(await p.locator('[data-node-id]').evaluateAll(ns=>ns.map(n=>[n.dataset.nodeId,n.dataset.x,n.dataset.y])),positions);}
  await p.setViewportSize({width:1024,height:768});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.setViewportSize({width:768,height:1024});
  const exportStart=performance.now();await p.getByRole('button',{name:'保存ファイルを準備',exact:true}).tap();
  const link=p.getByRole('link',{name:'正式JSONを保存',exact:true});await link.waitFor({timeout:240000});
  const wait=p.waitForEvent('download');await link.tap();const d=await wait;assert.equal(await d.failure(),null);
  const bytes=await readFile(await d.path()),sha=createHash('sha256').update(bytes).digest('hex');
  const expected=rate===50?{2:'2580eecead8d242bc360fdcb7adf2c4dae5748397dd9a2a368e8465775d7827d',100:'723647a1068328e6b038de381a25b1cb42ba4190d62d9ab374c974e95b2f1880',1000:'083873fbd56b8b3a7fb30c876a86c878252d18583b906c4354bfe85286c29ab8'}[R]:null;
  if(expected)assert.equal(sha,expected);else{const value=JSON.parse(bytes);assert.equal(value.trials.length,R);assert.ok(value.trials.every(t=>t.sample.pair_count===(rate===0?0:257)));}
  assert.equal(await p.evaluate(()=>window.__qa.urls.length),3);
  await nav('研究情報');await nav('分析結果');await p.getByRole('heading',{name:`試行 ${R-1} の結果`,exact:true}).waitFor();
  report.checks.push({cycle,R,rate,click_to_result_ms:elapsed,export_and_download_ms:performance.now()-exportStart,bytes:bytes.length,sha256:sha,metadata,workers:1,urls:3});await save();
 }
 if(mode==='compatibility'){for(const [i,[R,pct]] of [[2,50],[100,50],[2,0],[2,100],[1000,50]].entries())await run(R,pct,i);}
 if(mode==='heap-limit'){await run(100,50,0);await run(1000,50,1);}
 if(mode==='soak'){
  // At least 30 full calculation/export/navigation cycles and ten minutes of real repeated activity.
  let cycle=0;while(cycle<30||performance.now()-started<600000){await run(cycle%10===9?1000:100,50,cycle++);}
 }
 await nav('シミュレーション');await p.getByLabel('反復回数').fill('1000');await p.getByRole('button',{name:'シミュレーションを実行',exact:true}).tap();await p.getByRole('button',{name:'計算を中止',exact:true}).click();await p.getByRole('heading',{name:'処理を中止しました。',exact:true}).waitFor();assert.equal(await p.evaluate(()=>window.__qa.workers),0);assert.equal(await p.evaluate(()=>window.__qa.urls.length),0);
 report.cancelled_resources={workers:0,urls:0};report.max_heartbeat_gap_ms=await p.evaluate(()=>Math.max(...window.__qa.ticks));
 await p.reload();report.after_reload=await p.evaluate(()=>({workers:window.__qa.workers,urls:window.__qa.urls.length}));assert.deepEqual(report.after_reload,{workers:0,urls:0});
 assert.deepEqual(report.errors,[]);report.elapsed_ms=performance.now()-started;report.status='PASS';await save();
}catch(e){report.status='FAIL';report.failure=String(e);report.elapsed_ms=performance.now()-started;await save();throw e;}
finally{await browser?.close();await new Promise(done=>server.httpServer.close(done));console.log('ECO_BROWSER_REPORT_BEGIN\n'+JSON.stringify(report)+'\nECO_BROWSER_REPORT_END');}
