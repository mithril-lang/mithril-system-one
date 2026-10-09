import test from 'node:test';
import assert from 'node:assert/strict';
import {executeDynamic,createDynamicExecutor} from '../lib/mithril-dynamic.mjs';
import {ontology,snapshots,dataset} from '../bench/mithril-dynamic-tasks.mjs';
const input=[{source:ontology,cases:snapshots().map(s=>({id:s.id,data:dataset(s.items)}))}];
test('opt-in stages preserve receipts and production pin policy, with one 30s startup/reply budget',{timeout:60000},async t=>{
 const rows=[],session=createDynamicExecutor({onTiming:r=>rows.push(r)});
 try{
  const reference=await executeDynamic(input);
  for(let i=0;i<3;i++)assert.deepEqual(await session.execute(input),reference);
  assert.equal(rows.length,3);assert.equal(rows[0].startup_seconds>0,true);
  for(const [i,r] of rows.entries()){
   assert.equal(r.pin_processes,4);assert.equal(r.ordinal,i+1);assert.equal(r.pinChecks,'combined');
   for(const k of ['pin_seconds','identity_seconds','startup_seconds','compile_seconds','reason_seconds','transport_wait_seconds','rpc_seconds','request_seconds'])assert.ok(Number.isFinite(r[k])&&r[k]>=0,k);
   if(i)assert.equal(r.startup_seconds,0);
   assert.ok(Math.abs(r.rpc_seconds-r.compile_seconds-r.reason_seconds-r.transport_wait_seconds)<.001);
   assert.ok(r.request_seconds>=r.startup_seconds+r.rpc_seconds);
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
