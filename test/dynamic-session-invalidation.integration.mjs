import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,symlink,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {ontology} from '../bench/mithril-dynamic-tasks.mjs';
const root=resolve(import.meta.dirname,'..'),runtime=resolve(root,'node_modules/mithril-dynamic-runtime');
// Private test roots isolate edits from the real runtime and concurrent suites.
// Pinned repos are read-only links, except the one local clone used for dirty-source checks.
async function fixture({silent=false,cloneMithril=false}={}){
 const dir=await realpath(await mkdtemp(resolve(tmpdir(),'mithril-session-fixture-')));
 try{
  await mkdir(resolve(dir,'lib'));
  await cp(resolve(root,'lib/mithril-dynamic.mjs'),resolve(dir,'lib/mithril-dynamic.mjs'));
  for(const p of ['mithril-task-agent.mjs','inference.mjs'])await symlink(resolve(root,'lib',p),resolve(dir,'lib',p));
  await mkdir(resolve(dir,'bench'));
  for(const p of ['mithril-dynamic-tasks.mjs','mithril-equivalent-tasks.mjs'])await symlink(resolve(root,'bench',p),resolve(dir,'bench',p));
  await writeFile(resolve(dir,'package.json'),' {"type":"module"}\n');
  await mkdir(resolve(dir,'runtime'));
  for(const p of ['pins.json','empty.edn','mithril-batch.cljk'])await cp(resolve(root,'runtime',p),resolve(dir,'runtime',p));
  const local=resolve(dir,'node_modules/mithril-dynamic-runtime');await mkdir(local,{recursive:true});
  for(const p of ['mithril','org-babashka-nbb','kotoba','text']){
   if(p==='mithril'&&cloneMithril)execFileSync('git',['clone','--quiet','--local','--no-hardlinks',resolve(runtime,p),resolve(local,p)],{stdio:'pipe'});
   else await symlink(resolve(runtime,p),resolve(local,p));
  }
  const config=JSON.parse(await readFile(resolve(runtime,'classpath.json'),'utf8'));
  config.engine=resolve(local,'org-babashka-nbb/cli.js');
  await writeFile(resolve(local,'classpath.json'),JSON.stringify(config));
  if(silent)await writeFile(resolve(dir,'runtime/mithril-batch.cljk'),'(js/setTimeout (fn [] nil) 60000)\n');
  const api=await import(pathToFileURL(resolve(dir,'lib/mithril-dynamic.mjs')).href);
  return {dir,local,api,cleanup:()=>rm(dir,{recursive:true,force:true})};
 }catch(e){await rm(dir,{recursive:true,force:true});throw e;}
}
const batches=[{source:ontology,cases:[]}];
for(const change of ['pins','classpath','script','empty-config','tracked-source'])test(`live session refuses changed ${change} without restart`,{timeout:30000},async()=>{
 const f=await fixture({cloneMithril:change==='tracked-source'}),session=f.api.createDynamicExecutor();
 try{
  await session.execute(batches);
  const before=await f.api.verifyDynamicRuntime();
  if(change==='pins'){
   const p=resolve(f.dir,'runtime/pins.json'),v=JSON.parse(await readFile(p,'utf8'));v.mithril[1]='0'.repeat(40);await writeFile(p,JSON.stringify(v));
  }else if(change==='classpath'){
   const p=resolve(f.local,'classpath.json'),v=JSON.parse(await readFile(p,'utf8'));v.classpath+=':unreviewed';await writeFile(p,JSON.stringify(v));
  }else if(change==='script')await writeFile(resolve(f.dir,'runtime/mithril-batch.cljk'),'; changed script\n');
  else if(change==='empty-config')await writeFile(resolve(f.dir,'runtime/empty.edn'),'{:paths ["unreviewed"]}\n');
  else{
   const tracked=execFileSync('git',['ls-files'],{cwd:resolve(f.local,'mithril'),encoding:'utf8'}).split('\n').find(p=>p.endsWith('.md'));
   assert.ok(tracked);const p=resolve(f.local,'mithril',tracked);await writeFile(p,(await readFile(p,'utf8'))+'\nchanged fixture\n');
  }
  if(['classpath','script','empty-config'].includes(change))assert.notEqual((await f.api.verifyDynamicRuntime()).identity,before.identity);
  await assert.rejects(session.execute(batches),/runtime_pin_refused/);
  await assert.rejects(session.execute(batches),/dynamic_session_refused/);
  assert.deepEqual(session.stats,{runtime_processes:1,requests:1,result_cache_hits:0});
 }finally{session.close();await f.cleanup();}
});
test('real 30-second timeout terminates a silent worker and refuses continuation',{timeout:60000},async()=>{
 const f=await fixture({silent:true}),session=f.api.createDynamicExecutor(),start=performance.now();
 try{
  await assert.rejects(session.execute(batches),/dynamic_runtime_failed/);
  assert.ok(performance.now()-start>=29900,'real timer must expire, without mock clocks or manual close');
  await assert.rejects(session.execute(batches),/dynamic_session_refused/);
  assert.deepEqual(session.stats,{runtime_processes:1,requests:1,result_cache_hits:0});
 }finally{session.close();await f.cleanup();}
});
