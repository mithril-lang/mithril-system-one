import test from 'node:test';
import assert from 'node:assert/strict';
import {createDynamicExecutor,executeDynamic} from '../lib/mithril-dynamic.mjs';
import {executeWorkflow} from '../lib/mithril-entry.mjs';
import {ontology,ns,snapshots,dataset,dynamicTasks} from '../bench/mithril-dynamic-tasks.mjs';
const batch=(namespace=ns)=>[{source:ontology.replaceAll(ns,namespace),cases:snapshots().map(s=>({id:s.id,data:dataset(s.items).replaceAll(ns,namespace)}))}];
test('scoped reuse exactly matches fresh compilation across changing namespaces and retracts',{timeout:60000},async()=>{
 const session=createDynamicExecutor();
 try{
  for(const namespace of [ns,'https://example.invalid/holdout/別#',ns]){
   const input=batch(namespace);const expected=await executeDynamic(input);
   assert.deepEqual(await session.execute(input),expected);
  }
  assert.deepEqual(session.stats,{runtime_processes:1,requests:3,result_cache_hits:0});
  await assert.rejects(session.execute(batch()),/dynamic_session_refused/);
 }finally{session.close();}
});
test('compiler refusal closes worker, with no retry or cached fallback',{timeout:30000},async()=>{
 const session=createDynamicExecutor();
 try{
  await session.execute(batch());
  await assert.rejects(session.execute([{source:'not a Mithril ontology',cases:[]}]),/dynamic_runtime_failed/);
  await assert.rejects(session.execute(batch()),/dynamic_session_refused/);
  assert.equal(session.stats.runtime_processes,1);assert.equal(session.stats.requests,2);
 }finally{session.close();}
});
test('closing during attestation never launches a late worker',{timeout:30000},async()=>{
 const session=createDynamicExecutor();const pending=session.execute(batch());session.close();
 await assert.rejects(pending,/dynamic_session_refused/);assert.equal(session.stats.runtime_processes,0);
});
test('workflow shares one real compiler process and preserves per-task gates',{timeout:60000},async()=>{
 const r=await executeWorkflow({task_ids:dynamicTasks.map(t=>t.id),method:'ontology'});
 assert.equal(r.row.success,true);assert.equal(r.row.retry,false);
 assert.deepEqual(r.runtime_reuse,{runtime_processes:1,requests:3,result_cache_hits:0});
 assert.ok(r.tasks.every(t=>t.row.success&&t.projections.length===11));
});
test('request bounds and concurrent calls fail before launching extra processes',async()=>{
 for(const maxRequests of [0,4,1.5])assert.throws(()=>createDynamicExecutor({maxRequests}),/invalid_runtime_limit/);
 const session=createDynamicExecutor();const pending=session.execute(batch());
 await assert.rejects(session.execute(batch()),/dynamic_session_refused/);
 session.close();await assert.rejects(pending,/dynamic_session_refused/);
 assert.equal(session.stats.runtime_processes,0);
});
test('interrupting active compilation closes the process and refuses continuation',{timeout:30000},async()=>{
 const session=createDynamicExecutor();const pending=session.execute(batch());
 const deadline=Date.now()+10000;
 while(session.stats.runtime_processes===0&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));
 assert.equal(session.stats.runtime_processes,1);session.close();
 await assert.rejects(pending,/dynamic_runtime_failed/);
 await assert.rejects(session.execute(batch()),/dynamic_session_refused/);
 assert.equal(session.stats.requests,1);assert.equal(session.stats.result_cache_hits,0);
});
