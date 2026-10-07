import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dynamicTasks,ontology,ns,snapshots,dataset} from '../bench/mithril-dynamic-tasks.mjs';
import {runDynamicTask,executeDynamic,verifyDynamic} from '../lib/mithril-dynamic.mjs';
for(const task of dynamicTasks)test(task.id+' executes actual compiler/reasoner over eleven changing inputs',async()=>{
 const result=await runDynamicTask(task);
 assert.equal(result.row.success,true,JSON.stringify(result.row));
 assert.equal(result.projections.length,11);
 assert.equal(result.row.inference_calls,0);
 assert.deepEqual(result.projections[1].done,['a']);
 assert.deepEqual(result.projections[3].done,[],'reopening retracts inferred completion');
 assert.ok(!result.projections[4].tasks.includes('b'),'removed task never leaks');
 assert.deepEqual(result.projections[10].violations,[],'invalid facts disappear after removal/repair');
});
test('independent verifier rejects missing inheritance, weaker validation, stale snapshots and wrong order',async()=>{
 const cases=snapshots().map(x=>({id:x.id,data:dataset(x.items)}));
 const mutations=[ontology.replace(`:rdfs/sub-class-of "${ns}Task"`,''),ontology.replace(':sh/max-count 1',':sh/max-count 2'),ontology.replace(':sh/min-count 1',':sh/min-count 0')];
 const receipts=await executeDynamic([...mutations,ontology].map(source=>({source,cases})));
 for(const bad of receipts.results.slice(0,3))assert.throws(()=>verifyDynamic(bad),/dynamic_equivalence_failed/);
 const good=receipts.results[3];verifyDynamic(good);
 const stale=structuredClone(good);stale.cases[3]={...stale.cases[1],id:stale.cases[3].id};assert.throws(()=>verifyDynamic(stale),/dynamic_equivalence_failed/);
 const reordered=structuredClone(good);reordered.cases.reverse();assert.throws(()=>verifyDynamic(reordered),/dynamic_equivalence_failed/);
});
test('terminal stdio agent exposes real dynamic refactor',()=>{
 const result=spawnSync(process.execPath,['bin/mithril-task.mjs','agent','--stdin'],{input:JSON.stringify({task_id:'dynamic-refactor',method:'ontology'}),encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).row.success,true);
});
