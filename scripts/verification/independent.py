"""Independent standard-library CSV/Fraction oracle; does not call TypeScript."""
import csv, hashlib, itertools, json, math, sys
from pathlib import Path
from collections import Counter
from fractions import Fraction as F
ROOT=Path(__file__).resolve().parents[2]
OUT=Path(sys.argv[1])
SHA='c2d7023215fb885070caf6603886bce10e965732e3cc2465111e9d73cad9ab9a'
raw=ROOT/'data/raw/moss-evans-2022-flower-visits-v1/Raw_InteractionData_BothYears.csv'
assert len(raw.read_bytes())==254165 and hashlib.sha256(raw.read_bytes()).hexdigest()==SHA
assert hashlib.md5(raw.read_bytes()).hexdigest()=='6f083ca81e9bc14c3bbd5806aecb62e8'
with raw.open(newline='') as f: rows=list(csv.DictReader(f))
normalized=json.loads((ROOT/'data/processed/moss-evans-2022-flower-visits-v1/events.json').read_text())
assert len(rows)==len(normalized['events'])==3882
for i,(r,e) in enumerate(zip(rows,normalized['events']),1):
 assert (e['source_record_number'],e['record_id'])==(i,f'sha256:{SHA}:record:{i}')
 for source,target in [('Plot','plot_id'),('Round','round_label'),('Plant','plant_label_raw'),('Specimen_ID','visitor_label_raw'),('Basic_Type','basic_type_raw'),('Treatment','treatment')]: assert r[source]==e[target]
 assert int(r['Year'])==e['year'] and all(e[k] is None for k in ['observed_at','actual_effort_minutes','block_id'])
 assert e['plant_label_id']=='plant:'+r['Plant'] and e['visitor_label_id']=='visitor:'+r['Specimen_ID']
assert Counter(r['Year'] for r in rows)=={'2014':1687,'2015':2195}
assert len(rows)-len({tuple(r.values()) for r in rows})==1930

def frac(v):
 v=F(v);return dict(numerator=str(v.numerator),denominator=str(v.denominator))
def ids_hash(ids):return hashlib.sha256((json.dumps([f'sha256:{SHA}:record:{i}' for i in ids],separators=(',',':'))+'\n').encode()).hexdigest()
def select(s):return [i for i,r in enumerate(rows,1) if int(r['Year']) in s['years'] and r['Plot'] in s['plot_ids'] and r['Treatment'] in s['treatments'] and r['Round'] in s['rounds_by_year'][r['Year']]]
class PCG:
 def __init__(self,seed,t):
  self.x=0;self.c=2*(54+t)+1;self.used=0;self.next();self.x=(self.x+seed)%(2**64);self.next();self.used=0
 def next(self):
  old=self.x;self.x=(6364136223846793005*old+self.c)%(2**64);z=(((old>>18)^old)>>27)%(2**32);rot=old>>59;self.used+=1
  return ((z>>rot)|(z<<((-rot)%32)))%(2**32)
 def bounded(self,m):
  if m==1:return 0
  while True:
   u=self.next()
   if u>=2**32 % m:return u%m

def network(ids,reference=None):
 pairs=Counter(('plant:'+rows[i-1]['Plant'],'visitor:'+rows[i-1]['Specimen_ID']) for i in ids)
 base=pairs if reference is None else reference
 plants=sorted({p for p,v in base});visitors=sorted({v for p,v in base})
 return dict(event_count=len(ids),plant_label_count=len({p for p,v in pairs}),visitor_label_count=len({v for p,v in pairs}),pair_count=len(pairs),connectance_fixed=frac(F(len(pairs),len(plants)*len(visitors))),plant_partner_counts=[dict(label_id=p,partner_count=sum(a==p for a,b in pairs)) for p in plants],visitor_partner_counts=[dict(label_id=v,partner_count=sum(b==v for a,b in pairs)) for v in visitors],pair_weights=[dict(plant_label_id=p,visitor_label_id=v,record_count=pairs[p,v]) for p,v in sorted(base)],undefined_reasons={})
def check_trial(ids,p,seed,t,actual):
 k=(len(ids)*p+50)//100;positions=list(range(len(ids)));rng=PCG(seed,t)
 if 0<k<len(ids):
  for i in range(k):
   j=i+rng.bounded(len(ids)-i);positions[i],positions[j]=positions[j],positions[i]
 chosen=[ids[i] for i in sorted(positions[:k])];base=Counter(('plant:'+rows[i-1]['Plant'],'visitor:'+rows[i-1]['Specimen_ID']) for i in ids)
 n=network(chosen,base)
 assert actual['sampled_source_record_numbers']==chosen and actual['sampled_ids_sha256']==ids_hash(chosen)
 assert actual['random_word_count']==rng.used and actual['trial_index']==t
 assert actual['initstate_u64_hex']==f'{seed:016x}' and actual['initseq_u64_hex']==f'{54+t:016x}'
 assert actual['sample']==n and actual['lost_pair_count']==len(base)-n['pair_count']
 assert actual['pair_retention_pct']==frac(F(100*n['pair_count'],len(base))) and actual['undefined_reasons']=={}
 return {**{k:n[k] for k in ['event_count','plant_label_count','visitor_label_count','pair_count']},'lost_pair_count':len(base)-n['pair_count'],'pair_retention_pct':F(100*n['pair_count'],len(base)),'connectance_fixed':F(n['pair_count'],len(n['plant_partner_counts'])*len(n['visitor_partner_counts']))}

def summary(values):
 x=list(map(F,values));n=len(x);mean=sum(x)/n;ordered=sorted(x);variance=sum((v-mean)**2 for v in x)/(n-1) if n>1 else None
 qs=[]
 for q in [F(1,40),F(1,2),F(39,40)]:
  h=(n-1)*q;j=h.numerator//h.denominator;v=ordered[j] if j==n-1 else ordered[j]+(h-j)*(ordered[j+1]-ordered[j]);qs.append(dict(probability=frac(q),value=frac(v)))
 return dict(valid_count=n,mean=frac(mean),sample_variance=frac(variance) if variance is not None else None,sample_sd={'radicand':frac(variance)} if variance is not None else None,min=frac(min(x)),max=frac(max(x)),quantiles=qs,undefined_reasons={} if n>1 else {'sample_variance':'insufficient_trials','sample_sd':'insufficient_trials'})

scope_data=json.loads((OUT/'scopes.json').read_text());trial_count=0
for p in scope_data['pcg']:
 rng=PCG(p['seed'],p['t']);assert p['initial']==dict(state_u64_hex=f'{rng.x:016x}',increment_u64_hex=f'{rng.c:016x}',random_word_count=0)
 assert [rng.next() for _ in range(32)]==p['words']
assert [f'{v:08x}' for v in next(p for p in scope_data['pcg'] if p['seed']==42 and p['t']==0)['words'][:6]]==['a15c02b7','7b47f409','ba1d3330','83d2f293','bfa4784b','cbed606e']
for case in scope_data['rejection']:
 accepted=[(i+1,v%case['bound']) for i,v in enumerate(case['values']) if v>=2**32%case['bound']]
 expected=(0,0) if case['bound']==1 else accepted[0];assert (case['used'],case['result'])==expected
for case in scope_data['records']:
 ids=select(case['selection']);assert ids==case['scope']['eligible_source_record_numbers'];assert ids_hash(ids)==case['scope']['eligible_ids_sha256']
 s=case['selection'];missing=[]
 for y in s['years']:
  for p in s['plot_ids']:
   treatment=next(r['Treatment'] for r in rows if int(r['Year'])==y and r['Plot']==p)
   if treatment in s['treatments']:
    for rd in s['rounds_by_year'][str(y)]:
     if not any(int(r['Year'])==y and r['Plot']==p and r['Round']==rd for r in rows):missing.append(dict(year=y,plot_id=p,round_label=rd,status='no_record_effort_unknown'))
 assert case['scope']['no_record_groups']==missing
 for item in case['trials']:
  assert item['reference']==network(ids);check_trial(ids,item['p'],42,0,item['trial']);trial_count+=1
results={}
for path in sorted(OUT.glob('*.json')):
 if path.name=='scopes.json':continue
 result=json.loads(path.read_text());ids=select(result['selection']);assert ids==result['scope']['eligible_source_record_numbers']
 if not ids:
  assert result['status']=='empty_scope' and result['trials']==[] and result['reference'] is None and result['summary'] is None and result['sampling']['sample_record_count'] is None
 else:
  assert result['reference']==network(ids);values=[check_trial(ids,result['sampling']['rate_percent'],result['randomness']['master_seed'],t,tr) for t,tr in enumerate(result['trials'])]
  for key in values[0]:assert summary([v[key] for v in values])==result['summary'][key],(path.name,key)
  trial_count+=len(values)
 results[path.stem]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'trials':len(result['trials'])}
a=json.loads((OUT/'all-50-1000.json').read_text());b=json.loads((OUT/'all-50-100.json').read_text());assert a['trials'][:100]==b['trials']
assert results['all-50-1000']['sha256']=='083873fbd56b8b3a7fb30c876a86c878252d18583b906c4354bfe85286c29ab8'
# Exhaustive combinatorial oracle, deliberately no PRNG distribution assertion.
toy=json.loads((ROOT/'docs/simulation/conformance-fixtures.json').read_text())['toy_records'];freq=Counter((e['plant'],e['visitor']) for e in toy);enumerated=[]
for k in range(11):
 distribution=Counter(len({(toy[i]['plant'],toy[i]['visitor']) for i in sample}) for sample in itertools.combinations(range(10),k))
 mean=F(sum(n*c for n,c in distribution.items()),math.comb(10,k));theory=sum(1-F(math.comb(10-m,k) if k<=10-m else 0,math.comb(10,k)) for m in freq.values());assert mean==theory
 enumerated.append({'k':k,'subsets':math.comb(10,k),'distribution':dict(sorted(distribution.items())),'expected_pairs':frac(mean)})
assert enumerated[5]['expected_pairs']==frac(F(143,36))
assert summary([3,4,5])['quantiles'][0]['value']==frac(F(61,20))
report={'status':'PASS','raw_sha256':SHA,'records':3882,'identical_content_rows_preserved':1930,'selection_scopes':len(scope_data['records']),'fully_compared_trials':trial_count,'pcg_vectors':len(scope_data['pcg']),'rejection_cases':len(scope_data['rejection']),'exhaustive_subsets':sum(v['subsets'] for v in enumerated),'exhaustive':enumerated,'results':results,'limitations':['Python and TypeScript are independent code in this project, not an external expert review.','Uniform subset theory does not assert ecological sampling validity or exact PRNG seed frequencies.']}
(ROOT/'docs/verification/independent-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['exhaustive','results']}))
