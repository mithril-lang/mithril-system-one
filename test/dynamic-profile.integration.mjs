import test from 'node:test';
import assert from 'node:assert/strict';
import {executeDynamic,createDynamicExecutor} from '../lib/mithril-dynamic.mjs';
import {ontology,ns,snapshots,dataset} from '../bench/mithril-dynamic-tasks.mjs';
const input=[{source:ontology,cases:snapshots().map(s=>({id:s.id,data:dataset(s.items)}))}];
test('opt-in stages preserve receipts and production pin policy, with one 30s startup/reply budget',{timeout:60000},async t=>{
 const rows=[],session=createDynamicExecutor({onTiming:r=>rows.push(r)});
 try{
  const reference=await executeDynamic(input);
  for(let i=0;i<3;i++)assert.deepEqual(await session.execute(input),reference);
  assert.equal(rows.length,3);assert.equal(rows[0].startup_seconds>0,true);
  for(const [i,r] of rows.entries()){
   assert.equal(r.pin_processes,4);assert.equal(r.ordinal,i+1);assert.equal(r.pinChecks,'combined');
   for(const k of ['pin_seconds','identity_seconds','startup_seconds','compile_seconds','data_parse_seconds','reason_seconds','reason_engine_seconds','reason_other_seconds','ontology_prepare_seconds','ontology_decode_seconds','entail_seconds','schema_seconds','shacl_seconds','transport_wait_seconds','rpc_seconds','request_seconds'])assert.ok(Number.isFinite(r[k])&&r[k]>=0,k);
   if(i)assert.equal(r.startup_seconds,0);
   assert.ok(Math.abs(r.rpc_seconds-r.compile_seconds-r.reason_seconds-r.transport_wait_seconds)<.001);
   assert.ok(r.request_seconds>=r.startup_seconds+r.rpc_seconds);
   assert.ok(r.reason_seconds>=r.data_parse_seconds+r.reason_engine_seconds);
   assert.ok(r.ontology_decode_seconds<=r.ontology_prepare_seconds+.001);
   assert.ok(Math.abs(r.reason_engine_seconds-r.ontology_prepare_seconds-r.entail_seconds-r.schema_seconds-r.shacl_seconds-r.reason_other_seconds)<.001);
  }
  t.diagnostic('Diagnostic stages only; not an AB speed comparison: '+JSON.stringify(rows));
  assert.deepEqual(session.stats,{runtime_processes:1,requests:3,result_cache_hits:0});
 }finally{session.close();}
});
test('timing split control retains eight fresh checks and exact receipts',{timeout:30000},async()=>{
 const a=[],b=[],split=createDynamicExecutor({maxRequests:1,pinChecks:'split',onTiming:r=>a.push(r)}),combined=createDynamicExecutor({maxRequests:1,onTiming:r=>b.push(r)});
 try{assert.deepEqual(await split.execute(input),await combined.execute(input));assert.equal(a[0].pin_processes,8);assert.equal(b[0].pin_processes,4);}
 finally{split.close();combined.close();}
});

test('batch-local quad reuse preserves every compile, capability/shape preparation and entailment across namespaces',{timeout:60000},async()=>{
 const a=[],b=[],control=createDynamicExecutor({reasonPlan:'baseline',onTiming:r=>a.push(r)}),candidate=createDynamicExecutor({onTiming:r=>b.push(r)});
 try{
  for(const namespace of [ns,'https://example.invalid/holdout/別#',ns]){
   const batches=[ontology,ontology+'\n'].map(source=>({source:source.replaceAll(ns,namespace),cases:snapshots().map(s=>({id:s.id,data:dataset(s.items).replaceAll(ns,namespace)}))}));
   assert.deepEqual(await candidate.execute(batches),await control.execute(batches));
   for(const row of [a.at(-1),b.at(-1)]){
    assert.equal(row.compile_calls,2);assert.equal(row.reason_calls,22);
    assert.equal(row.ontology_prepare_calls,22);assert.equal(row.entail_calls,22);
   }
   assert.equal(a.at(-1).ontology_decode_misses,22);assert.equal(a.at(-1).ontology_decode_hits,0);
   assert.equal(b.at(-1).ontology_decode_misses,2);assert.equal(b.at(-1).ontology_decode_hits,20);
  }
  assert.deepEqual(candidate.stats,{runtime_processes:1,requests:3,result_cache_hits:0});
 }finally{control.close();candidate.close();}
});
test('quad reuse cannot carry a valid artifact past a later compiler refusal',{timeout:30000},async()=>{
 const rows=[],session=createDynamicExecutor({onTiming:r=>rows.push(r)});
 try{
  await session.execute(input);
  await assert.rejects(session.execute([{source:'not a Mithril ontology',cases:[]}]),/dynamic_runtime_failed/);
  await assert.rejects(session.execute(input),/dynamic_session_refused/);
  assert.equal(rows.length,1);assert.equal(rows[0].ontology_decode_misses,1);
  assert.equal(rows[0].ontology_decode_hits,10);assert.equal(session.stats.result_cache_hits,0);
 }finally{session.close();}
});
