/** Production results for a separate Python oracle. Never used by the app. */
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {readExecutionContext} from '../simulation/context.ts';
import {canonicalJson} from '../../src/features/simulation/core/serialization.ts';
const out=process.argv[2];if(!out)throw Error('Supply a temporary output directory');await mkdir(out,{recursive:true});
const vite=await createServer({configFile:false,appType:'custom',server:{middlewareMode:true,hmr:false,watch:null}});
try{
 const {context}=await readExecutionContext();
 const {loadObservationData}=await vite.ssrLoadModule('/src/features/data/index.ts');
 const {sha256Text}=await vite.ssrLoadModule('/src/features/simulation/hash.ts');
 const {selectScope}=await vite.ssrLoadModule('/src/features/simulation/core/scope.ts');
 const {simulateTrial}=await vite.ssrLoadModule('/src/features/simulation/core/trial.ts');
 const {runRepeatedTrials}=await vite.ssrLoadModule('/src/features/simulation/core/repeated.ts');
 const {createPcg32,boundedUint}=await vite.ssrLoadModule('/src/features/simulation/core/pcg32.ts');
 const data=await loadObservationData();
 const all={years:[2014,2015],plot_ids:Array.from({length:24},(_,i)=>String(i+1)),treatments:['Control','Heat','Heat+Water','Water'],rounds_by_year:{2014:['1','3','4','5','7','8','9'],2015:['1','2','3','4','5','6','7']}};
 const scopes=[all];
 for(const year of all.years){
  const annual={...all,years:[year],rounds_by_year:{[year]:all.rounds_by_year[year]}};scopes.push(annual);
  for(const treatment of all.treatments)scopes.push({...annual,treatments:[treatment]});
  for(const round of all.rounds_by_year[year])scopes.push({...annual,rounds_by_year:{[year]:[round]}});
  for(const plot of all.plot_ids){scopes.push({...annual,plot_ids:[plot]});for(const round of all.rounds_by_year[year])scopes.push({...annual,plot_ids:[plot],rounds_by_year:{[year]:[round]}});}
 }
 const records=[];
 for(const selection of scopes){const s=await selectScope(data.dataset.events,selection,sha256Text);const trials=[];if(s.events.length)for(const p of [0,49,50,100])trials.push({p,...await simulateTrial(s.events,p,42,0,sha256Text)});records.push({selection:s.selection,scope:s.scope,trials});}
 const pcg=[];for(const seed of [0,42,4294967295])for(const t of [0,1,999]){const rng=createPcg32(seed,t),initial=rng.snapshot();pcg.push({seed,t,initial,words:Array.from({length:32},()=>rng.nextUint32()),final:rng.snapshot()});}
 const rejection=[];for(const [bound,values] of [[1,[]],[3,[0,1]],[10,[5,16]],[2147483649,[0,2147483647,2147483648,4294967295]]]){let used=0;const result=boundedUint(bound,()=>values[used++]);rejection.push({bound,values,result,used});}
 await writeFile(`${out}/scopes.json`,JSON.stringify({context,pcg,rejection,records}));
 for(const [name,p,R,seed,selection] of [['all-50-1000',50,1000,42,all],['all-50-100',50,100,42,all],['all-0-2',0,2,0,all],['all-100-1',100,1,4294967295,all],['year-2014',49,3,0,scopes[1]],['empty',50,2,42,{...all,years:[2014],plot_ids:['3'],treatments:['Water'],rounds_by_year:{2014:['1']}}]]){
  const start=performance.now();const result=await runRepeatedTrials(data,{selection,rate_percent:p,master_seed:seed,repetitions:R},context,sha256Text);await writeFile(`${out}/${name}.json`,canonicalJson(result));console.log(name,Math.round(performance.now()-start),'ms');
 }
 console.log('scopes',records.length);
}finally{await vite.close();}
