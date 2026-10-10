import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink,rename,readdir} from 'node:fs/promises';
import {setTimeout as pause} from 'node:timers/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {runCodegraph} from '../lib/codegraph.mjs';
import {executeTask,executeWorkflow} from '../lib/mithril-entry.mjs';
import {dynamicTaskById} from '../bench/mithril-dynamic-tasks.mjs';
const runtime=process.env.MITHRIL_CODEGRAPH_RUNTIME_ROOT;
test('real System One compiler → candidate delta → saved Mithril OWL/SHACL replay',{skip:!runtime,timeout:180000},async()=>{
 const repo=await mkdtemp(join(tmpdir(),'system-one-graph-'));
 const env={...process.env,MITHRIL_CODEGRAPH_RUNTIME_ROOT:resolve(runtime),MITHRIL_CODEGRAPH_REPOSITORY:repo};
 const graph=input=>runCodegraph(input,{env});
 try{
  execFileSync('git',['init','-q',repo]);
  const initial=dynamicTaskById('dynamic-repair-inheritance').initial;
  await writeFile(join(repo,'policy.mith'),initial);await writeFile(join(repo,'validation.mith'),dynamicTaskById('dynamic-repair-validation').initial);await writeFile(join(repo,'notes.txt'),'たまは猫である。\n');
  const before=await graph({action:'index'});
  const context={target:'policy.mith',request:{operation:'search',query:'Done',limit:5}};
  const result=await executeTask({task_id:'dynamic-repair-inheritance',method:'ontology',codegraph:context},{graph});
  assert.equal(result.row.success,true,JSON.stringify(result.codegraph));assert.equal(result.projections.length,11);
  assert.equal(result.codegraph.context.revision,before['snapshot-digest']);
  const candidate=result.codegraph.candidate;
  assert.deepEqual(candidate.after.changed,['policy.mith']);assert.notEqual(candidate.before['snapshot-digest'],candidate.after['snapshot-digest']);
  assert.equal(candidate.reasoning.status,'conforms');assert.equal(candidate.reasoning.counts.violations,0);
  assert.equal(await readFile(join(repo,'policy.mith'),'utf8'),initial);
  assert.equal(await readFile(candidate['candidate-path'],'utf8'),result.source);
  const saved=await readFile(candidate.reasoning['reasoned-path'],'utf8');assert.match(saved,/rdf\/dataset/);assert.match(saved,/reason-output\/v1\/inferred/);
  const sources=await readFile(join(candidate.reasoning.directory,'sources.mith'),'utf8');assert.match(sources,/たまは猫である。/);
  const after=await graph({action:'query',request:{operation:'status'}});assert.equal(after['snapshot-digest'],before['snapshot-digest']);
  const invalid=await graph({action:'context',target:'policy.mith',request:{operation:'status'}});
  await assert.rejects(graph({action:'candidate',target:'policy.mith',source:'(unknown/eval)',revision:invalid.revision,'source-digest':invalid['source-digest']}),e=>e.reason==='candidate-extraction-failed');
  // Revision-bound candidate verification refuses a concurrent original edit.
  await writeFile(join(repo,'notes.txt'),'changed source\n');
  await assert.rejects(graph({action:'candidate',target:'policy.mith',source:result.source,revision:before['snapshot-digest'],'source-digest':candidate['base-source-digest']}),e=>e.reason==='stale-revision');
  await symlink(repo,join(repo,'.mithril-codegraph/system-one-candidates/escape'));
  await assert.rejects(graph({action:'context',target:'../escape.mith',request:{operation:'status'}}),e=>e.reason==='invalid-target');
  // The existing workflow dispatch also passes the optional context end to end.
  const flow=await executeWorkflow({task_ids:['dynamic-repair-inheritance'],method:'ontology',codegraph:[context]},input=>executeTask(input,{graph}));
  assert.equal(flow.row.success,true);assert.equal(flow.tasks[0].codegraph.candidate['conforms?'],true);
  // Exercise the default workflow entry point: real graph + real reused compiler.
  const previousRuntime=process.env.MITHRIL_CODEGRAPH_RUNTIME_ROOT,previousRepository=process.env.MITHRIL_CODEGRAPH_REPOSITORY;
  process.env.MITHRIL_CODEGRAPH_RUNTIME_ROOT=resolve(runtime);process.env.MITHRIL_CODEGRAPH_REPOSITORY=repo;
  try{
   const reused=await executeWorkflow({task_ids:['dynamic-repair-inheritance','dynamic-repair-validation'],method:'ontology',codegraph:[context,{...context,target:'validation.mith'}]});
   assert.equal(reused.row.success,true);assert.equal(reused.row.completed_tasks,2);
   assert.deepEqual(reused.runtime_reuse,{runtime_processes:1,requests:2,result_cache_hits:0});
   for(const task of reused.tasks){assert.equal(task.projections.length,11);assert.equal(task.codegraph.candidate['conforms?'],true);assert.equal(task.codegraph.candidate.reasoning.status,'conforms');}
   assert.notEqual(reused.tasks[0].codegraph.candidate['candidate-path'],reused.tasks[1].codegraph.candidate['candidate-path']);
   assert.equal(await readFile(join(repo,'policy.mith'),'utf8'),initial);
  }finally{
   if(previousRuntime===undefined)delete process.env.MITHRIL_CODEGRAPH_RUNTIME_ROOT;else process.env.MITHRIL_CODEGRAPH_RUNTIME_ROOT=previousRuntime;
   if(previousRepository===undefined)delete process.env.MITHRIL_CODEGRAPH_REPOSITORY;else process.env.MITHRIL_CODEGRAPH_REPOSITORY=previousRepository;
  }
  // The actual MCP process routes the configured tool to the same saved graph.
  const child=spawn(process.execPath,['bin/mithril-mcp.mjs'],{env,stdio:['pipe','pipe','pipe']});
  const lines=createInterface({input:child.stdout});const responses=lines[Symbol.asyncIterator]();
  const call=async(id,method,params)=>{child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');return JSON.parse((await responses.next()).value);};
  try{
   await call(1,'initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'codegraph-test',version:'1'}});
   child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
   const q=await call(2,'tools/call',{name:'mithril_codegraph',arguments:{action:'query',request:{operation:'search',query:'Done',limit:5}}});
   assert.equal(q.result.isError,false);assert.ok(q.result.structuredContent['snapshot-digest']);
  }finally{const exited=once(child,'exit');child.stdin.end();await exited;lines.close();}
  const fresh=await graph({action:'context',target:'policy.mith',request:{operation:'status'}});
  const parent=join(repo,'.mithril-codegraph/system-one-candidates'),existing=new Set(await readdir(parent));
  const pending=graph({action:'candidate',target:'policy.mith',source:result.source,revision:fresh.revision,'source-digest':fresh['source-digest']}).catch(e=>e);
  const deadline=Date.now()+30000;let staged=false;
  while(Date.now()<deadline){if((await readdir(parent)).some(p=>!existing.has(p))){staged=true;break;}await pause(25);}
  assert.equal(staged,true);await writeFile(join(repo,'notes.txt'),'edited while candidate verification was running\n');
  assert.equal((await pending).reason,'stale-revision');
  const latest=await graph({action:'context',target:'policy.mith',request:{operation:'status'}});
  await rename(parent,parent+'-retained');await symlink(repo,parent);
  await assert.rejects(graph({action:'candidate',target:'policy.mith',source:result.source,revision:latest.revision,'source-digest':latest['source-digest']}),e=>e.reason==='candidate-symlink');
 }finally{await rm(repo,{recursive:true,force:true});}
});
