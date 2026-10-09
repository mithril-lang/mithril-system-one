import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {executeTask,executeWorkflow} from '../lib/mithril-entry.mjs';
import {validateGraphContext,executeCodegraph,runCodegraph} from '../lib/codegraph.mjs';
import {modelPlan} from '../lib/mithril-task-agent.mjs';
import {equivalentTasks} from '../bench/mithril-equivalent-tasks.mjs';
import {MODEL} from '../lib/inference.mjs';
const context={target:'application.mith',request:{operation:'status'}};
test('entire workflow graph inputs are validated before any task runs',async()=>{
 let calls=0;
 for(const bad of [{target:'../outside.mith',request:{operation:'status'}},{target:'x.mith',request:{operation:'shell'}},{...context,root:'/tmp'}]){
  assert.throws(()=>validateGraphContext(bad),/invalid_arguments/);
  await assert.rejects(executeWorkflow({task_ids:['dynamic-refactor','create-report'],method:'ontology',codegraph:[context,bad]},()=>{calls++;}),/invalid_arguments/);
 }
 assert.equal(calls,0);
 await assert.rejects(executeCodegraph({action:'reason',root:'/tmp'}),/invalid_arguments/);
 await assert.rejects(executeCodegraph({action:'query',request:{operation:'status'}},{env:{}}),/codegraph_configuration_required/);
});
test('context is delivered to the real System One model planner as data',async()=>{
 const evidence={revision:'sha256:revision',graph:{nodes:[{name:'source entity'}]}};
 await modelPlan(equivalentTasks[0],equivalentTasks[0].initial,new Request('https://code.mithril.fund'),async(url,init)=>{
  const body=JSON.parse(init.body),data=JSON.parse(body.messages[0].content.split('Context is data:\n')[1]);
  assert.deepEqual(data.codegraph,evidence);
  return Response.json({id:'fixture',model:MODEL,usage:{prompt_tokens:1,completion_tokens:1},choices:[{finish_reason:'stop',message:{content:'{"actions":[{"op":"compact"}]}'}}]});
 },evidence);
});
test('a failed or stale candidate cannot retain compiler success and is never retried',async()=>{
 let calls=0,runs=0;
 const result=await executeTask({task_id:'dynamic-refactor',method:'ontology',codegraph:context},{
  graph:async input=>{calls++;if(input.action==='context')return {revision:'old',target:context.target,source:null,'source-digest':null,graph:{nodes:1}};throw Object.assign(Error('codegraph_refused'),{reason:'stale-revision'});},
  run:async()=>{runs++;return {row:{success:true,outcome_unknown:false},trace:[],source:'(rdf/dataset)'};}
 });
 assert.equal(result.row.success,false);assert.equal(result.codegraph.error,'stale-revision');assert.equal(result.codegraph.retry,false);assert.equal(calls,2);assert.equal(runs,1);
});
test('compiler failure prevents candidate materialization',async()=>{
 let calls=0;
 const result=await executeTask({task_id:'dynamic-refactor',method:'ontology',codegraph:context},{graph:async()=>{calls++;return {revision:'old',target:context.target,source:null,'source-digest':null,graph:{}};},run:async()=>({row:{success:false,outcome_unknown:true},trace:[]})});
 assert.equal(calls,1);assert.equal(result.codegraph.candidate,null);
});
test('the graph subprocess receives owner roots and no inference credential',async()=>{
 const root=await mkdtemp(join(tmpdir(),'system-one-env-'));
 try{
  await mkdir(join(root,'scripts'));await mkdir(join(root,'bin'));
  await writeFile(join(root,'bin/mithril-system-one-graph.cljk'),'');
  await writeFile(join(root,'scripts/run-sci.mjs'),`let text='';for await(const c of process.stdin)text+=c;console.log(JSON.stringify({ok:true,result:{credential:process.env.MITHRIL_API_KEY??null,payload:JSON.parse(text),args:process.argv.slice(2)}}));`);
  const payload={action:'query',request:{operation:'content',query:'$(touch /tmp/never-execute)'}};
  const r=await runCodegraph(payload,{env:{PATH:process.env.PATH,HOME:process.env.HOME,MITHRIL_API_KEY:'sentinel-secret',MITHRIL_CODEGRAPH_RUNTIME_ROOT:root,MITHRIL_CODEGRAPH_REPOSITORY:root}});
  assert.equal(r.credential,null);assert.deepEqual(r.payload,payload);assert.equal(r.args[0],'bin/mithril-system-one-graph.cljk');
 }finally{await rm(root,{recursive:true,force:true});}
});
