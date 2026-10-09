// Opt-in no-inference local comparison. Results never overwrite an earlier run.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {executeDynamic,createDynamicExecutor,verifyDynamicRuntime,applyDynamic} from '../lib/mithril-dynamic.mjs';
import {dynamicTasks,ns,snapshots,dataset,ordinaryResult} from './mithril-dynamic-tasks.mjs';
const args=process.argv.slice(2);
if(args.length!==2||args[0]!=='--run-local')throw Error('Usage: node bench/runtime-reuse.mjs --run-local NEW_OUTPUT_DIR');
const output=resolve(args[1]);await mkdir(output); // Exclusive creation: preserve failures and prior evidence.
const hash=v=>createHash('sha256').update(v).digest('hex');
const started=new Date().toISOString(),wall=performance.now();
const arms=['fresh','reuse-sequential','reuse-parallel','batch-control','warm-cache-control'];
const tasks=dynamicTasks.map(t=>({id:t.id,namespace:ns,states:snapshots(),initial:t.initial,source:applyDynamic(t.initial,t.op),kind:t.kind}));
// Freeze new namespace, UTF-16 strings, changed keys/data and state order before measuring holdout.
const holdout=tasks.map((t,i)=>{const namespace=`https://example.invalid/unseen/${i}/日本語😀#`;return {...t,id:`holdout-${i}`,namespace,initial:t.initial.replaceAll(ns,namespace),source:t.source.replaceAll(ns,namespace),states:t.states.toReversed().map(s=>({id:'unseen-'+s.id,items:s.items.map(x=>({...x,key:'h'+x.key,labels:x.labels.map(v=>typeof v==='string'?'日本語😀é '+v:v)}))}))};});
const groups=[{partition:'development',tasks},{partition:'holdout',tasks:holdout}];
const plan={started,baseline_revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),arms,rounds:3,groups,condition:'same pinned compiler; warm filesystem/dependencies; bounded process cold start included; no model invocation',limits:{planned_measured_tasks:90,planned_cache_prewarms:18,max_requests_per_process:3,automatic_retries:0},unmeasured:{model_generation_seconds:null,human_review_repair_seconds:null,invoiced_cost_usd:null},production_scope:'sequential dynamic workflows <=3; cache and batch controls are not enabled'};
plan.implementation_hashes=Object.fromEntries(await Promise.all(['lib/mithril-dynamic.mjs','lib/mithril-entry.mjs','runtime/mithril-batch.cljk', 'bench/runtime-reuse.mjs'].map(async p=>[p,hash(await readFile(p))])));
await writeFile(resolve(output,'plan.json'),JSON.stringify(plan,null,2)+'\n');
const rows=[],sessions=[],reference=new Map(),prewarms=[];
const input=t=>[t.initial,t.source].map(source=>({source,cases:t.states.map(s=>({id:s.id,data:dataset(s.items).replaceAll(ns,t.namespace)}))}));
function verify(t,receipt){
 assert.equal(receipt.results.length,2);const [before,after]=receipt.results;
 assert.ok(before['graph-digest']);assert.ok(after['graph-digest']);assert.equal(after.cases.length,t.states.length);
 const project=r=>{assert.equal(r.consistent,true);return {tasks:r.types.filter(x=>x.o===t.namespace+'Task').map(x=>x.s.slice(9)).sort(),done:r.types.filter(x=>x.o===t.namespace+'Done').map(x=>x.s.slice(9)).sort(),violations:r.violations.map(v=>[v.focus.slice(9),v.constraint]).sort(),status:r.status};};
 for(const [i,c] of after.cases.entries()){assert.equal(c.id,t.states[i].id);assert.deepEqual(project(c),ordinaryResult(t.states[i].items));}
 if(t.kind==='refactor'){assert.equal(before['graph-digest'],after['graph-digest']);assert.deepEqual(before.cases,after.cases);assert.ok(Buffer.byteLength(t.source)<Buffer.byteLength(t.initial));}
 else assert.ok(before.cases.some((c,i)=>JSON.stringify(project(c))!==JSON.stringify(ordinaryResult(t.states[i].items))));
 const key=t.id;if(reference.has(key))assert.deepEqual(receipt,reference.get(key));else reference.set(key,structuredClone(receipt));
}
let stopped=null;
try{
 for(let round=0;round<3;round++)for(const group of groups){
  // Baseline first in round zero supplies equality oracle; rotate later to reduce ordering effects.
  const order=round===0?arms:[...arms.slice(round),...arms.slice(0,round)];
  for(const arm of order){
   let executor=null,cached=null,identity=null;
   if(arm.startsWith('reuse'))executor=createDynamicExecutor({parallelPins:arm==='reuse-parallel'});
   if(arm==='warm-cache-control'){
    cached=[];identity=(await verifyDynamicRuntime()).identity;
    for(const t of group.tasks){const start=performance.now(),receipt=await executeDynamic(input(t));verify(t,receipt);cached.push(receipt);prewarms.push({round,partition:group.partition,task:t.id,seconds:(performance.now()-start)/1000});}
   }
   const sessionStart=performance.now();
   try{
    if(arm==='batch-control'){
     const start=performance.now();const assembled=group.tasks.flatMap(input),assembly=(performance.now()-start)/1000;
     const compileStart=performance.now(),all=await executeDynamic(assembled),runtime=(performance.now()-compileStart)/1000;
     for(const [i,t] of group.tasks.entries()){const receipt={pins:all.pins,results:all.results.slice(i*2,i*2+2)},v=performance.now();verify(t,receipt);rows.push({round,partition:group.partition,arm,task:t.id,ordinal:i+1,success:true,seconds:(performance.now()-start)/1000,assembly_seconds:assembly,runtime_seconds:runtime,verification_seconds:(performance.now()-v)/1000,result_cache_hit:false});}
    }else for(const [i,t] of group.tasks.entries()){
     const start=performance.now(),batches=input(t),assembly=(performance.now()-start)/1000,compileStart=performance.now();let receipt;
     if(cached){assert.equal((await verifyDynamicRuntime()).identity,identity);receipt=structuredClone(cached[i]);}
     else receipt=await (executor?executor.execute(batches):executeDynamic(batches));
     const runtime=(performance.now()-compileStart)/1000,v=performance.now();verify(t,receipt);
     rows.push({round,partition:group.partition,arm,task:t.id,ordinal:i+1,success:true,seconds:(performance.now()-start)/1000,assembly_seconds:assembly,runtime_seconds:runtime,verification_seconds:(performance.now()-v)/1000,result_cache_hit:!!cached});
    }
    sessions.push({round,partition:group.partition,arm,seconds:(performance.now()-sessionStart)/1000,runtime_processes:executor?.stats.runtime_processes??(arm==='fresh'?3:arm==='batch-control'?1:0)});
   }finally{executor?.close();await writeFile(resolve(output,'rows.json'),JSON.stringify(rows,null,2)+'\n');}
  }
 }
}catch(e){stopped={error:e.message,stack:e.stack};}
const quantile=(xs,p)=>{const a=xs.toSorted((a,b)=>a-b);const pos=(a.length-1)*p;return a.length?a[Math.floor(pos)]+(a[Math.ceil(pos)]-a[Math.floor(pos)])*(pos%1):null;};
const metrics=xs=>({n:xs.length,p50:quantile(xs,.5),p95:quantile(xs,.95)});
const summary={started,finished:new Date().toISOString(),experiment_wall_seconds:(performance.now()-wall)/1000,complete:rows.length===90&&!stopped,planned:90,observed:rows.length,missing:90-rows.length,stopped,successes:rows.filter(r=>r.success).length,retries:0,inference_calls:0,measured_api_tokens:0,billed_cost_usd:null,human_seconds:null,prewarm_seconds:prewarms.reduce((s,r)=>s+r.seconds,0),prewarms,session_rows:sessions,arms:Object.fromEntries(arms.map(arm=>{const r=rows.filter(r=>r.arm===arm);return [arm,{all_task_seconds:metrics(r.map(x=>x.seconds)),development:metrics(r.filter(x=>x.partition==='development').map(x=>x.seconds)),holdout:metrics(r.filter(x=>x.partition==='holdout').map(x=>x.seconds)),warm_request_seconds:metrics(r.filter(x=>x.ordinal>1).map(x=>x.seconds)),three_task_session_seconds:metrics(sessions.filter(x=>x.arm===arm).map(x=>x.seconds)),result_cache_hits:r.filter(x=>x.result_cache_hit).length}];}))};
await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));if(!summary.complete)process.exitCode=1;
