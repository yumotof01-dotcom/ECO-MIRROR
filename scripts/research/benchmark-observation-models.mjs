#!/usr/bin/env node
/**
 * ECO MIRROR reproducible research benchmark (not ecological future-risk validation).
 * Read-only and dependency-free. The source CSV is verified by SHA-256.
 * node scripts/research/benchmark-observation-models.mjs --self-test
 * node scripts/research/benchmark-observation-models.mjs --check
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source='data/raw/moss-evans-2022-flower-visits-v1/Raw_InteractionData_BothYears.csv';
const sha='c2d7023215fb885070caf6603886bce10e965732e3cc2465111e9d73cad9ab9a';
const names=['Year','Plot','Round','Plant','Specimen_ID','Basic_Type','Treatment'];
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const rootMeanSquare=a=>Math.sqrt(mean(a.map(x=>x*x)));
function expectation(freq,n){
 const N=freq.reduce((s,v)=>s+v,0);
 assert(Number.isInteger(n)&&n>=0&&n<=N,'sample bounds');
 let out=0;
 for(const c of freq){
  let missed=c>N-n?0:1;
  if(missed)for(let k=0;k<c;k++)missed*=(N-n-k)/(N-k);
  out+=1-missed;
 }
 return out;
}
function test(){
 assert(Math.abs(expectation([2,1,1],2)-11/6)<1e-12,'finite sample');
 assert(expectation([2,1,1],0)===0,'empty sample');
 assert(expectation([2,1,1],4)===3,'whole sample');
 assert(Math.abs(.5*.4-.25*.8)<1e-12,'one-survey occupancy ambiguity');
 console.log('PASS: finite sampling boundaries and occupancy ambiguity');
}
if(process.argv.includes('--self-test')){test();process.exit(0);}
const raw=readFileSync(source),digest=createHash('sha256').update(raw).digest('hex');
assert(digest===sha,'mismatched CSV SHA-256');
const lines=raw.toString('utf8').trim().split(/\r?\n/);
assert(JSON.stringify(lines.shift().split(','))===JSON.stringify(names),'unexpected columns');
const rows=lines.map((line,i)=>{
 const f=line.split(',');
 assert(f.length===7,'malformed row '+(i+2));
 return {year:+f[0],plot:+f[1],round:+f[2],pair:f[3]+'|'+f[4],treatment:f[6]};
});
assert(rows.length===3882,'unexpected source count');
const pairList=rows.map(r=>r.pair),freqMap=new Map(),groupsMap=new Map(),treatments=new Map();
for(const r of rows){
 freqMap.set(r.pair,(freqMap.get(r.pair)||0)+1);
 const g=[r.year,r.plot,r.round].join('-');
 if(!groupsMap.has(g))groupsMap.set(g,[]);
 groupsMap.get(g).push(r.pair);treatments.set(r.plot,r.treatment);
}
const pairsByYear=y=>new Set(rows.filter(r=>r.year===y).map(r=>r.pair));
const p14=pairsByYear(2014),p15=pairsByYear(2015);
const countsForYear=y=>Object.fromEntries(Array.from({length:24},(_,i)=>[i+1,rows.filter(r=>r.plot===i+1&&r.year===y).length]));
const x=countsForYear(2014),y=countsForYear(2015),plots=Array.from({length:24},(_,i)=>i+1);
const globalMean=mean(plots.map(p=>x[p]));
const treatmentMean={};
for(const t of ['Control','Heat','Water','Heat+Water']){
 treatmentMean[t]=mean(plots.filter(p=>treatments.get(p)===t).map(p=>x[p]));
}
const forecasts={
 prior_year_persistence:p=>x[p],
 prior_year_global_mean:p=>globalMean,
 prior_year_treatment_mean:p=>treatmentMean[treatments.get(p)],
 fixed_half_shrinkage:p=>(x[p]+treatmentMean[treatments.get(p)])/2
};
const metrics={};
for(const [name,predict] of Object.entries(forecasts)){
 const errors=plots.map(p=>predict(p)-y[p]);
 metrics[name]={mae:mean(errors.map(Math.abs)),rmse:rootMeanSquare(errors),bias:mean(errors)};
}
const xvals=plots.map(p=>x[p]),yvals=plots.map(p=>y[p]),mx=mean(xvals),my=mean(yvals);
const rxy=xvals.reduce((s,v,i)=>s+(v-mx)*(yvals[i]-my),0)/
 Math.sqrt(xvals.reduce((s,v)=>s+(v-mx)**2,0)*yvals.reduce((s,v)=>s+(v-my)**2,0));
let seed=16923921;
function rand(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
function shuffle(values){
 const a=values.slice();
 for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
 return a;
}
const sample={};const groups=[...groupsMap.values()],trials=750,freq=[...freqMap.values()];
const summarize=a=>{a.sort((v,w)=>v-w);return{mean:mean(a),p05:a[Math.floor(trials*.05)],p95:a[Math.floor(trials*.95)]}};
for(const n of [388,1165,1941]){
 const uniform=[],cluster=[];
 for(let t=0;t<trials;t++){
  uniform.push(new Set(shuffle(pairList).slice(0,n)).size);
  let selected=[],total=0;
  for(const group of shuffle(groups)){
   if(total>=n)break;
   if(total+group.length<=n){selected.push(...group);total+=group.length;}
   else{selected.push(...shuffle(group).slice(0,n-total));total=n;}
  }
  assert(total===n,'group sampling size');
  cluster.push(new Set(selected).size);
 }
 sample[n]={expected_uniform:expectation(freq,n),uniform:summarize(uniform),grouped:summarize(cluster)};
}
const result={
 dataset:{doi:'10.25405/data.ncl.17430548.v1',sha256:digest,events:rows.length},
 counts:{observed_pairs:freqMap.size,singletons:freq.filter(c=>c===1).length,at_most_three:freq.filter(c=>c<=3).length,recorded_survey_units:groups.length,shared_year_pairs:[...p14].filter(p=>p15.has(p)).length},
 sampling:{trials,seed:16923921,samples:sample},
 year_out_of_sample_record_count_diagnostic:{plots:24,pearson:rxy,models:metrics,warning:'Original CSV lacks actual survey effort and matched seasonal outcomes. Not future ecological risk validation.'},
 occupancy_single_observation:{examples:[[.5,.4],[.25,.8]],same_detection_probability:.2,identifiable:false},
 ecological_future_risk:'NOT_ESTIMABLE'
};
if(process.argv.includes('--check')){
 assert(result.counts.observed_pairs===257,'pairs');
 assert(result.counts.singletons===118,'singletons');
 assert(result.counts.at_most_three===181,'low-frequency pairs');
 assert(result.counts.recorded_survey_units===321,'recorded groups');
 assert(result.counts.shared_year_pairs===62,'overlap');
 assert(Math.abs(sample[1165].expected_uniform-141.77452599535025)<1e-7,'theory expectation');
 assert(Math.abs(metrics.prior_year_persistence.mae-28.75)<1e-9,'persistence MAE');
 assert(Math.abs(metrics.prior_year_global_mean.mae-23.822916666666657)<1e-8,'global average MAE');
 assert(result.ecological_future_risk==='NOT_ESTIMABLE','unsound future risk');
}
console.log(JSON.stringify(result,null,2));
