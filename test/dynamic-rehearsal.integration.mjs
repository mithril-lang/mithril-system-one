import test from 'node:test';
import assert from 'node:assert/strict';
import {createDynamicExecutor} from '../lib/mithril-dynamic.mjs';
import {ontology,ns,snapshots,dataset,dynamicTaskById} from '../bench/mithril-dynamic-tasks.mjs';
import {executeTask} from '../lib/mithril-entry.mjs';
const valid=dataset(snapshots()[0].items),cases=[{id:'warm1',data:valid},{id:'warm2',data:valid}];
const warm=[{source:ontology,cases}];
test('after quad-cache warming, malformed data fails equally and closes both arms',{timeout:30000},async()=>{
 for(const reasonPlan of ['baseline','ontology-quads']){
  const rows=[],s=createDynamicExecutor({reasonPlan,onTiming:r=>rows.push(r)});
  try{
   await s.execute(warm);assert.equal(rows[0].ontology_decode_hits,reasonPlan==='baseline'?0:1);
   await assert.rejects(s.execute([{source:ontology,cases:[...cases,{id:'bad',data:'not valid N-Quads'}]}]),/dynamic_runtime_failed/);
   await assert.rejects(s.execute(warm),/dynamic_session_refused/);
  }finally{s.close();}
 }
});
test('warm sessions preserve empty-data and unsupported OWL/SHACL refusals exactly',{timeout:60000},async()=>{
 const sources={owl:ontology.replace(':graph [',':graph [(owl/restriction :id "urn:x:R" :owl/on-property "urn:x:p" :owl/max-cardinality 2) '),shacl:ontology.replace(':sh/path "'+ns+'label"',':sh/path "'+ns+'label" :sh/node-kind "urn:x:unsupported"')};
 for(const [kind,source] of Object.entries({empty:ontology,...sources})){
  const receipts=[];
  for(const reasonPlan of ['baseline','ontology-quads']){
   const s=createDynamicExecutor({reasonPlan});
   try{await s.execute(warm);receipts.push(await s.execute([{source,cases:[...cases,{id:'empty',data:''}]}]));}
   finally{s.close();}
  }
  assert.deepEqual(receipts[0],receipts[1]);
  for(const r of receipts[1].results[0].cases)assert.equal(r.status,kind==='empty'&&r.id!=='empty'?'conforms':'refused',kind);
 }
});
test('integration resolution forwards real scoped executor alongside graph context',{timeout:30000},async()=>{
 const s=createDynamicExecutor(),task=dynamicTaskById('dynamic-repair-inheritance');let calls=0;
 const graph=async x=>x.action==='context'?{revision:'fixture',target:'policy.mith',source:task.initial,'source-digest':'fixture',graph:{}}:{'conforms?':true,after:{'snapshot-digest':'candidate'},reasoning:{'reasoned-path':'fixture'}};
 try{
  const r=await executeTask({task_id:task.id,method:'ontology',codegraph:{target:'policy.mith',request:{operation:'status'}}},{graph,executor:async batches=>{calls++;return s.execute(batches);}});
  assert.equal(r.row.success,true);assert.equal(r.codegraph.candidate['conforms?'],true);assert.equal(calls,1);assert.equal(s.stats.runtime_processes,1);
 }finally{s.close();}
});
