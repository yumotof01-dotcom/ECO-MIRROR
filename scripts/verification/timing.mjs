/** Isolated Node phase timings; browser responsiveness is measured separately. */
import {createServer} from 'vite';import {writeFile} from 'node:fs/promises';import {readBrowserMetadata} from '../browser/metadata.ts';
const vite=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false,watch:null}});
try{
 const meta=await readBrowserMetadata();if(meta.verification!=='verified')throw Error(meta.reason);
 const {loadObservationData}=await vite.ssrLoadModule('/src/features/data/index.ts');
 const {runSingleTrial}=await vite.ssrLoadModule('/src/features/simulation/core/run.ts');
 const {runRepeatedTrials}=await vite.ssrLoadModule('/src/features/simulation/core/repeated.ts');
 const {validateCompletedResult}=await vite.ssrLoadModule('/src/features/execution/validate.ts');
 const {prepareArtifacts}=await vite.ssrLoadModule('/src/features/execution/export.ts');
 const {sha256Text}=await vite.ssrLoadModule('/src/features/simulation/hash.ts');
 const start=performance.now(),data=await loadObservationData(),load_ms=performance.now()-start;
 const selection={years:[2014,2015],plot_ids:Array.from({length:24},(_,i)=>String(i+1)),treatments:['Control','Heat','Heat+Water','Water'],rounds_by_year:{2014:['1','3','4','5','7','8','9'],2015:['1','2','3','4','5','6','7']}};
 const runs=[];
 for(const R of [1,100,1000]){
  global.gc?.();const input={mode:R===1?'single_trial':'repeated_trials',request:{selection,rate_percent:50,master_seed:42,...(R===1?{}:{repetitions:R})}};
  const t=performance.now();let result=R===1?await runSingleTrial(data,input.request,meta.context,sha256Text):await runRepeatedTrials(data,input.request,meta.context,sha256Text);const core_ms=performance.now()-t;
  const v=performance.now();await validateCompletedResult(result,input,meta.context,sha256Text);const validation_ms=performance.now()-v;
  const e=performance.now();let artifacts=await prepareArtifacts(result,meta,()=>{});const export_total_ms=performance.now()-e;
  runs.push({R,core_ms,validation_ms,export_total_ms,info:artifacts.info,memory:process.memoryUsage(),max_rss_kib:process.resourceUsage().maxRSS});result=null;artifacts=null;global.gc?.();
 }
 await writeFile('docs/verification/node-timing.json',JSON.stringify({node:process.version,platform:process.platform,load_ms,runs,limitations:['Node SSR, not browser timing. load is first call in this process.','Core includes its own mandatory source checks. validation_ms is additional completion validation.','RSS peak is cumulative for this process, not a per-run peak. GC is explicitly requested between runs.']},null,2)+'\n');
 console.log('Node timings saved');
}finally{await vite.close();}
