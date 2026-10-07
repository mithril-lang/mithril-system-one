import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateRows} from '../bench/evaluation-summary.mjs';
const plan=[{method:'loop',task_id:'a',round:1},{method:'loop',task_id:'a',round:2},{method:'loop',task_id:'b',round:1}];
const row=(task_id,round,success,seconds=1)=>({method:'loop',task_id,round,success,seconds,billed_cost_usd:null,outcome_unknown:false});

test('equal task weighting differs from pooled attempt success, and costs cannot be guessed',()=>{
 const [result]=evaluateRows([row('a',1,true),row('a',2,false,5),row('b',1,true)],plan);
 assert.equal(result.task_normalized_pass_at_1,.75);
 assert.equal(result.all_attempt_mean_seconds,7/3);
 assert.equal(result.billed_cost_per_task_usd,null);
 assert.equal(result.official_aa_score,null);
});
test('an incomplete task group cannot become a complete benchmark score',()=>{
 const [result]=evaluateRows([row('a',1,true),row('b',1,true)],plan);
 assert.equal(result.missing,1);
 assert.equal(result.complete,false);
 assert.equal(result.task_normalized_pass_at_1,null);
 assert.equal(result.per_task[0].pass_at_1,null);
});
test('known failed deadlines stay in averages and missing invoices prevent cost-per-task claims',()=>{
 const rows=[row('a',1,true),{...row('a',2,false,45),outcome_unknown:true},row('b',1,true)];
 const [result]=evaluateRows(rows,plan);
 assert.equal(result.outcome_unknown,1);
 assert.equal(result.all_attempt_p95_seconds,45);
 assert.equal(result.billed_cost_per_task_usd,null);
});
test('duplicate or foreign attempt identities cannot silently inflate a score',()=>{
 assert.throws(()=>evaluateRows([row('a',1,true),row('a',1,true)],plan),/invalid_attempt_identity/);
 assert.throws(()=>evaluateRows([row('outside',1,true)],plan),/invalid_attempt_identity/);
});
