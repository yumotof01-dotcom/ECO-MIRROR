// ECO MIRROR phase-0: independent, synthetic-only mathematical reference tests.
// No real landscape, ecological observation, or future risk is inferred.
import test from "node:test";
import assert from "node:assert/strict";

function pc(areas, links, area) {
  assert.ok(Number.isFinite(area) && area>0,"area must be positive");
  assert.ok(Array.isArray(areas)&&Array.isArray(links),"source is required");
  const n=areas.length;
  assert.equal(links.length,n,"missing link rows");
  for(const a of areas)assert.ok(Number.isFinite(a)&&a>=0,"invalid patch area");
  assert.ok(areas.reduce((a,b)=>a+b,0)<=area+1e-9,"overallocated patch area");
  const p=links.map((row,i)=>{
    assert.ok(Array.isArray(row)&&row.length===n,"incomplete matrix");
    return row.map((v,j)=>{
      assert.ok(typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=1,"invalid probability");
      if(i===j)assert.equal(v,1,"diagonal must be 1");
      return v;
    });
  });
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    assert.ok(Math.abs(p[i][j]-p[j][i])<=1e-12,"asymmetry outside initial model");
  }
  for(let k=0;k<n;k++)for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    p[i][j]=Math.max(p[i][j],p[i][k]*p[k][j]);
  }
  let numerator=0;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++)numerator+=areas[i]*areas[j]*p[i][j];
  return numerator/area**2;
}
const matrix=(v)=>[[1,v],[v,1]];
function near(a,b){assert.ok(Math.abs(a-b)<1e-12,"expected "+b+", got "+a);}

test("two patches with p=.5 gives PC=.03",()=>near(pc([10,10],matrix(.5),100),.03));
test("p=.1 and p=.8 preserve fixed denominator",()=>{
  near(pc([10,10],matrix(.1),100),.022);
  near(pc([10,10],matrix(.8),100),.036);
});
test("permutation invariance",()=>{
  near(pc([10,20],matrix(.3),100),pc([20,10],matrix(.3),100));
});
test("max-product via intermediate patch",()=>{
  const p=pc([10,10,10],[[1,.9,.4],[.9,1,.8],[.4,.8,1]],100);
  near(p,(300+2*100*(.9+.8+.72))/10000);
});
test("valid zero is not data missing",()=>{
  assert.equal(pc([],[],100),0);
  assert.throws(()=>pc([],[],0));
  assert.throws(()=>pc([10],[],100));
  assert.throws(()=>pc([10],[[Number.NaN]],100));
  assert.throws(()=>pc([40,70],matrix(.4),100));
});
test("invalid and asymmetric probability matrix is rejected",()=>{
  assert.throws(()=>pc([10,10],matrix(1.01),100));
  assert.throws(()=>pc([10,10],[[1,.4],[.7,1]],100));
});
test("100 deterministic study conditions are not forecast probabilities",()=>{
  const l=Array.from({length:10},(_,i)=>i+1);
  const q=Array.from({length:10},(_,i)=>i/10);
  const build=()=>l.flatMap(a=>q.map(b=>({lambda:a,stress:b})));
  assert.equal(build().length,100);
  assert.equal(new Set(build().map(JSON.stringify)).size,100);
  assert.deepEqual(build(),build());
});
test("intervention delta with fixed area",()=>{
  near(pc([10,10],matrix(.8),100)-pc([10,10],matrix(.5),100),.006);
});
