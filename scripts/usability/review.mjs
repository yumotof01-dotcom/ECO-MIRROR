import assert from 'node:assert/strict';
import {preview} from 'vite';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
const require=createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/`);
const {chromium}=require('playwright');
const output=process.env.ECO_USABILITY_OUTPUT||'docs/usability';await mkdir(output,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:5187,strictPort:true}});let browser;
const report={checks:[],violations:[],errors:[],limitations:['Chromium desktop emulation, not physical iPad/Safari or screen-reader review.','CSS text enlargement is not OS/browser zoom.','No low-memory guarantee.']};
try{
 browser=await chromium.launch({executablePath:process.env.ECO_MIRROR_BROWSER_PATH,args:['--no-sandbox']});report.browser=await browser.version();
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});page.on('pageerror',e=>report.errors.push(String(e)));
 const settle=()=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 const inspect=async(name)=>{
  await settle();await page.addScriptTag({path:process.env.ECO_AXE_PATH||'/tmp/eco-qa-tools/node_modules/axe-core/axe.min.js'});
  const a=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
  report.violations.push(...a.violations.map(v=>({name,id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)})));
  const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,height:innerHeight,offenders:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('.table-scroll,.em-network-viewport,.distribution-chart')).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width}))}));
  report.checks.push({name,...size,overflow:size.scroll>size.width+1,axe_violations:a.violations.length});
 };
 const nav=async title=>{await page.getByRole('navigation',{name:'メインナビゲーション'}).getByRole('link',{name:title,exact:true}).click();await settle();};
 await page.goto('http://127.0.0.1:5187/simulation');await page.getByLabel('反復回数').fill('2');await page.getByRole('button',{name:'シミュレーションを実行',exact:true}).click();await page.getByRole('heading',{name:'試行 0 の結果',exact:true}).waitFor({timeout:120000});
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height});
  for(const title of ['分析結果','シミュレーション','研究情報','ホーム']){
   await nav(title);await inspect(`${width}x${height}:${title}`);
   if(title==='分析結果'&&[390,768,1440].includes(width))await page.screenshot({path:`${output}/results-${width}.png`,fullPage:false});
  }
 }
 await page.setViewportSize({width:1280,height:900});
 for(const scale of [2,4]){
  await page.evaluate(s=>document.documentElement.style.fontSize=`${s*100}%`,scale);
  for(const title of ['シミュレーション','分析結果']){await nav(title);await inspect(`text-${scale*100}%:${title}`);}
 }
 report.status=report.errors.length||report.violations.length||report.checks.some(c=>c.overflow)?'FAIL':'PASS';
 await writeFile(`${output}/responsive-report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,checks:report.checks.length,violations:report.violations.length,overflow:report.checks.filter(c=>c.overflow)}));
 assert.equal(report.status,'PASS');
}finally{await browser?.close();await new Promise(done=>server.httpServer.close(done));}
