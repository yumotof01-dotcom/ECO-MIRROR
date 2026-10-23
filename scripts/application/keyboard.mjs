/** Main user flow with actual Tab/keyboard activation only, using real data and Worker. */
import assert from 'node:assert/strict';
import {preview} from 'vite';
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/` : import.meta.url);
const {chromium}=require('playwright');
const server=await preview({preview:{host:'127.0.0.1',port:5185,strictPort:true}});
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.ECO_MIRROR_BROWSER_PATH,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const steps=[];
 const tabTo=async (locator,name)=>{
  for(let i=0;i<160;i++) {
   if(await locator.evaluate(e=>e===document.activeElement)) {
    const visible=await locator.evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {outline:s.outlineStyle,width:s.outlineWidth,top:r.top,bottom:r.bottom,viewport:innerHeight};});
    assert.notEqual(visible.outline,'none');assert.ok(parseFloat(visible.width)>0);assert.ok(visible.top>=0&&visible.bottom<=visible.viewport);
    steps.push({action:'Tab to '+name,tab_count:i,visible_focus:visible});return;
   }
   await page.keyboard.press('Tab');
  }
  throw Error('Keyboard target unreachable: '+name);
 };
 await page.goto('http://127.0.0.1:5185/');await page.getByRole('heading',{level:1}).waitFor();
 await tabTo(page.getByRole('link',{name:'シミュレーションを始める'}),'home CTA');await page.keyboard.press('Enter');
 await page.getByRole('form',{name:'観測条件'}).waitFor();
 await tabTo(page.getByLabel('反復回数'),'repetitions');await page.keyboard.press('Control+A');await page.keyboard.type('2');
 await tabTo(page.getByRole('button',{name:'シミュレーションを実行',exact:true}),'execute');await page.keyboard.press('Enter');
 await page.getByRole('heading',{name:'試行 0 の結果',exact:true}).waitFor({timeout:60000});
 assert.match(await page.getByLabel('選択中の試行の主要指標').innerText(),/183組/);
 await tabTo(page.getByRole('combobox',{name:/表示する試行番号/}),'trial selector');await page.keyboard.press('ArrowDown');
 await page.getByRole('heading',{name:'試行 1 の結果',exact:true}).waitFor();
 await tabTo(page.getByRole('button',{name:'保存ファイルを準備',exact:true}),'prepare export');await page.keyboard.press('Enter');
 const link=page.getByRole('link',{name:'正式JSONを保存',exact:true});await link.waitFor();
 await tabTo(link,'formal JSON download');const pending=page.waitForEvent('download');await page.keyboard.press('Enter');const download=await pending;
 assert.equal(await download.failure(),null);const bytes=await readFile(await download.path());const hash=createHash('sha256').update(bytes).digest('hex');
 assert.equal(hash,'2580eecead8d242bc360fdcb7adf2c4dae5748397dd9a2a368e8465775d7827d');
 const body=JSON.parse(bytes.toString());assert.equal(body.trials.length,2);assert.equal(body.trials[0].sample.pair_count,183);assert.equal(body.trials[1].sample.pair_count,182);
 await writeFile('docs/application/qa/keyboard-report.json',JSON.stringify({browser:await browser.version(),mode:'keyboard only: Tab/Enter/Control+A/type/ArrowDown',steps,result_sha256:hash,trials:2,status:'passed'},null,2)+'\n');
 console.log(JSON.stringify({status:'passed',steps:steps.length,sha256:hash}));
} finally {await browser?.close();if(server?.httpServer)await new Promise(done=>server.httpServer.close(done));}
