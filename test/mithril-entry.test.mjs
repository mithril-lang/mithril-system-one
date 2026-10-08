import test from 'node:test';import assert from 'node:assert/strict';
import {executeWorkflow,validateTask} from '../lib/mithril-entry.mjs';
test('workflow preflights the entire task set before any external effect',async()=>{
 let calls=0;
 for(const task_ids of [['dynamic-refactor','shell'],['dynamic-refactor','dynamic-refactor'],Array(4).fill('dynamic-refactor')])await assert.rejects(executeWorkflow({task_ids,method:'ontology'},()=>{calls++;}),/invalid_arguments/);
 assert.equal(calls,0);assert.throws(()=>validateTask({task_id:'dynamic-refactor',source:42}),/invalid_arguments/);
});
test('failed or unknown task stops workflow and never retries',async()=>{
 for(const outcome_unknown of [true,false]){
  let calls=0;const r=await executeWorkflow({task_ids:['dynamic-refactor','create-report'],method:'ontology'},async()=>{calls++;return {row:{success:false,outcome_unknown}};});
  assert.equal(calls,1);assert.equal(r.row.success,false);assert.equal(r.tasks.length,1);assert.equal(r.row.retry,false);
 }
});
