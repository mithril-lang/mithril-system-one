// Opt-in paired diagnostic experiment; no model inference or receipt cache.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadavg,cpus} from 'node:os';
import {createDynamicExecutor} from '../lib/mithril-dynamic.mjs';
import {dataset,ordinaryResult,ns} from './mithril-dynamic-tasks.mjs';
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--run-local')throw Error('Usage: --run-local NEW_OUTPUT_DIR');
const output=resolve(args[1]);await mkdir(output);
const hash=x=>createHash('sha256').update(x).digest('hex');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'');
const {groups}=JSON.parse(await readFile(new URL('./results/runtime-reuse-20261009/comparison-final-2/plan.json',import.meta.url),'utf8'));
const plan={revision:sha,started:new Date().toISOString(),groups,rounds:2,orders:[['split','combined'],['combined','split']],planned:24,policy:'same scoped process reuse, parallel attestations, timed startup handshake in both arms; four or eight fresh Git processes every request',cpu_count:cpus().length,quiet_gate:{preflight_seconds:60,max_load1:8,max_load5:10,abort_load1:12},inference_calls:0,billed_cost_usd:null,human_seconds:null};
plan.hashes=Object.fromEntries(await Promise.all(['lib/mithril-dynamic.mjs','lib/runtime-pin-check.mjs','runtime/mithril-batch.cljk','runtime/empty.edn','runtime/pins.json','bench/pin-attestation-pairs.mjs'].map(async p=>[p,hash(await readFile(new URL('../'+p,import.meta.url)))])));
await writeFile(resolve(output,'plan.json'),JSON.stringify(plan,null,2)+'\n');
const rows=[],sessions=[],loads=[],reference=new Map(),start=performance.now();let stopped=null;
const sample=()=>{const x={timestamp:new Date().toISOString(),load_average:loadavg()};loads.push(x);return x.load_average;};
const persist=()=>writeFile(resolve(output,'rows.json'),JSON.stringify(rows,null,2)+'\n');
const batches=t=>[t.initial,t.source].map(source=>({source,cases:t.states.map(s=>({id:s.id,data:dataset(s.items).replaceAll(ns,t.namespace)}))}));
function verify(t,receipt){
 assert.equal(receipt.results.length,2);const [before,after]=receipt.results;
 const project=r=>({tasks:r.types.filter(x=>x.o===t.namespace+'Task').map(x=>x.s.slice(9)).sort(),done:r.types.filter(x=>x.o===t.namespace+'Done').map(x=>x.s.slice(9)).sort(),violations:r.violations.map(v=>[v.focus.slice(9),v.constraint]).sort(),status:r.status});
 assert.ok(before['graph-digest']&&after['graph-digest']);assert.equal(after.cases.length,t.states.length);
 for(const [i,r] of after.cases.entries()){assert.equal(r.consistent,true);assert.equal(r.id,t.states[i].id);assert.deepEqual(project(r),ordinaryResult(t.states[i].items));}
 if(t.kind==='refactor'){assert.equal(before['graph-digest'],after['graph-digest']);assert.deepEqual(before.cases,after.cases);assert.ok(Buffer.byteLength(t.source)<Buffer.byteLength(t.initial));}
 else assert.ok(before.cases.some((r,i)=>JSON.stringify(project(r))!==JSON.stringify(ordinaryResult(t.states[i].items))));
 if(reference.has(t.id))assert.deepEqual(receipt,reference.get(t.id));else reference.set(t.id,structuredClone(receipt));
}
try{
 // Wait only once, before any compiler launch; decline rather than seek favourable repeats.
 for(let i=0;i<=12;i++){const l=sample();if(l[0]>8||l[1]>10)throw Error('quiet_window_unavailable');if(i<12)await new Promise(r=>setTimeout(r,5000));}
 for(let round=0;round<2;round++)for(const group of groups)for(const arm of plan.orders[round]){
  if(sample()[0]>12)throw Error('shared_load_stopped');
  const timing=[],executor=createDynamicExecutor({pinChecks:arm,onTiming:r=>timing.push(r)}),sessionStart=performance.now();
  try{
   for(const t of group.tasks){
    if(sample()[0]>12)throw Error('shared_load_stopped');
    const taskStart=performance.now(),receipt=await executor.execute(batches(t));verify(t,receipt);
    rows.push({round,partition:group.partition,arm,task:t.id,success:true,seconds:(performance.now()-taskStart)/1000,stages:timing.at(-1),result_cache_hit:false});await persist();
   }
   sessions.push({round,partition:group.partition,arm,seconds:(performance.now()-sessionStart)/1000,...executor.stats});
  }finally{executor.close();}
 }
}catch(e){stopped={error:e.message};}
await persist();
const q=(values,p)=>{const a=values.toSorted((a,b)=>a-b),v=(a.length-1)*p;return a.length?a[Math.floor(v)]+(a[Math.ceil(v)]-a[Math.floor(v)])*(v%1):null;};
const metric=x=>({n:x.length,p50:q(x,.5),p95:q(x,.95)});
const summary={revision:sha,complete:rows.length===24&&!stopped,planned:24,observed:rows.length,missing:24-rows.length,stopped,seconds_including_quiet_gate:(performance.now()-start)/1000,loads,sessions,retries:0,inference_calls:0,billed_cost_usd:null,human_seconds:null,arms:Object.fromEntries(['split','combined'].map(arm=>{const r=rows.filter(x=>x.arm===arm);return [arm,{tasks:metric(r.map(x=>x.seconds)),session:metric(sessions.filter(x=>x.arm===arm).map(x=>x.seconds)),stages:Object.fromEntries(['pin_seconds','startup_seconds','compile_seconds','reason_seconds','transport_wait_seconds','request_seconds'].map(k=>[k,metric(r.map(x=>x.stages[k]))]))}];}))};
await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));if(!summary.complete)process.exitCode=1;
