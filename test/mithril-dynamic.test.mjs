import test from 'node:test';import assert from 'node:assert/strict';
import {dynamicTasks,ordinaryResult,snapshots} from '../bench/mithril-dynamic-tasks.mjs';
import {applyDynamic,runDynamicTask} from '../lib/mithril-dynamic.mjs';
import {MODEL} from '../lib/inference.mjs';
test('invalid source and edit instructions stop before external execution',async()=>{
 assert.throws(()=>applyDynamic(dynamicTasks[0].initial,'shell'),/dynamic_plan_refused/);
 let calls=0;const r=await runDynamicTask(dynamicTasks[0],{initial:42,method:'system-one',transport:()=>{calls++;},executor:()=>{calls++;}});
 assert.equal(r.row.error,'dynamic_source_refused');assert.equal(calls,0);
});
test('ordinary reference detects invalid inputs and recovers after removal',()=>{
 const states=snapshots();assert.equal(ordinaryResult(states[5].items).status,'violations');assert.equal(ordinaryResult(states.at(-1).items).status,'conforms');
});
test('model proposal is not retried or silently replaced by catalog planner',async()=>{
 let executions=0,calls=0;
 const transport=async()=>{calls++;return Response.json({id:"bounded-test",model:MODEL,usage:{prompt_tokens:10,completion_tokens:5},choices:[{finish_reason:'stop',message:{content:'{"op":"shell"}'}}]});};
 const r=await runDynamicTask(dynamicTasks[0],{method:'system-one',request:new Request('https://code.mithril.fund',{headers:{'x-mithril-token':'test-key'}}),transport,executor:()=>{executions++;}});
 assert.equal(r.row.error,'dynamic_plan_refused');assert.equal(calls,1);assert.equal(executions,0);assert.equal(r.row.input_tokens,10);
});
