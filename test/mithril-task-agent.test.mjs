import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {equivalentTasks,ordinaryHtml} from '../bench/mithril-equivalent-tasks.mjs';
import {emitMithril,renderMithril} from '../lib/mithril-language.mjs';
import {inspectSource,ontologyPlan,applyPlan,compactForm,verifyEquivalent,runTask} from '../lib/mithril-task-agent.mjs';
import {API,MODEL} from '../lib/inference.mjs';
const fixture=JSON.parse(await readFile(new URL('./fixtures/mithril-app-compiled.json',import.meta.url)));
function compiled(task){const value=structuredClone(fixture);value.artifact['app-ir'].app={...task.expected,template:'https://mithril.fund/id/template/'+task.expected.template,'data-shape':'https://mithril.fund/id/shape/'+({report:'claim-list',directory:'entity-directory',dashboard:'metric-cards'}[task.expected.template])};return value;}

test('all original task ontology plans preserve content, derive shape and repair approved bindings',()=>{
 for(const task of equivalentTasks){const candidate=applyPlan(task.initial,ontologyPlan(task,task.initial));const state=inspectSource(candidate);assert.deepEqual(state.app,task.expected);const result=compiled(task);assert.deepEqual(verifyEquivalent(task,candidate,result,task.preserve_ir?compiled(task):null).html,ordinaryHtml(task.expected));}
});
test('refactor compacts only whitespace outside strings and preserves escaped text',()=>{
 const fields={name:'Quoted " title',description:'Keep  two spaces',headline:'A \\ B',summary:'Unicode 日本語 < & "',template:'report'};
 const source=emitMithril(fields),candidate=compactForm(source);assert.deepEqual(inspectSource(candidate).app,fields);assert(Buffer.byteLength(candidate)<Buffer.byteLength(source));
});
test('verifier rejects output drift and entire-IR semantic changes during refactor',()=>{
 const task=equivalentTasks.at(-1),source=applyPlan(task.initial,ontologyPlan(task,task.initial)),result=compiled(task),before=compiled(task);
 result.artifact['app-ir'].budget['max-steps']=5;assert.throws(()=>verifyEquivalent(task,source,result,before),/refactor_semantics_failed/);
 const bad=compiled(equivalentTasks[1]);bad.artifact['app-ir'].app.summary='Wrong';assert.throws(()=>verifyEquivalent(equivalentTasks[1],emitMithril(equivalentTasks[1].expected),bad),/task_contract_failed/);
});
test('model operations cannot execute source, unknown tools or extra keys',()=>{
 for(const plan of [[{op:'shell',command:'echo unsafe'}],[{op:'compact',path:'/tmp/a'}],[{op:'restore-bindings',digest:'wrong'}],[],Array(5).fill({op:'compact'})])assert.throws(()=>applyPlan(equivalentTasks[1].initial,plan),/plan_refused/);
});
test('ordinary renderer and Mithril renderer agree on hostile text without scripts',()=>{
 const task={expected:{name:'<script>name</script>',headline:'"hi"',description:'A&B',summary:'日本語',template:'report'}};
 const html=ordinaryHtml(task.expected);assert.equal(html,renderMithril(compiled(task).artifact));assert(!html.includes('<script>'));
});
test('initial authentication refusal cannot count as a successful ontology repair',async()=>{
 const result=await runTask(equivalentTasks[3],{transport:async()=>new Response(JSON.stringify({status:'refused'}),{status:401})});assert.equal(result.row.success,false);assert.equal(result.row.outcome_unknown,true);assert.equal(result.row.compiler_calls,1);
});
test('unknown transport outcome stops loop before applying or resubmitting',async()=>{
 let calls=0;const result=await runTask(equivalentTasks[4],{transport:async()=>{calls++;throw Error('network');}});assert.equal(calls,1);assert.equal(result.row.outcome_unknown,true);assert.equal(result.source,equivalentTasks[4].initial);
});
test('known malformed model proposal retains usage and diagnostics without a second inference call',async()=>{
 let calls=0;const result=await runTask(equivalentTasks[0],{method:'system-one',request:new Request('https://code.mithril.fund'),transport:async url=>{
  assert.equal(url,API+'/chat/completions');calls++;return Response.json({id:'test-id',model:MODEL,usage:{prompt_tokens:20,completion_tokens:9},choices:[{finish_reason:'stop',message:{content:'Not JSON'}}]});
 }});assert.equal(calls,1);assert.equal(result.row.success,false);assert.equal(result.row.input_tokens,20);assert.equal(result.row.output_tokens,9);assert.equal(result.trace.find(t=>t.tool==='model-response').content,'Not JSON');assert.equal(result.row.compiler_calls,0);
});
test('published task pack matches executable contracts and initial sources',async()=>{
 const root=new URL('../bench/task-packs/mithril-v1/',import.meta.url);
 for(const task of equivalentTasks){
  assert.deepEqual(JSON.parse(await readFile(new URL(task.id+'/goal.json',root))),task.goal);
  assert.equal(await readFile(new URL(task.id+'/application.mith',root),'utf8'),task.initial);
  assert.equal(await readFile(new URL(task.id+'/ordinary-reference.html',root),'utf8'),ordinaryHtml(task.expected));
 }
});
