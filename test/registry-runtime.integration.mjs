import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {createInterface} from 'node:readline';import {once} from 'node:events';
import {executeWorkflow} from '../lib/mithril-entry.mjs';
function client(){
 const child=spawn(process.execPath,['bin/mithril-mcp.mjs'],{stdio:['pipe','pipe','pipe']});let sequence=0,stderr='';const waiters=new Map();
 child.stderr.on('data',c=>stderr+=c);createInterface({input:child.stdout}).on('line',line=>{const m=JSON.parse(line);waiters.get(m.id)?.(m);waiters.delete(m.id);});
 const call=(method,params={})=>{const id=++sequence;return new Promise(res=>{waiters.set(id,res);child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});};
 return {child,call,notify:method=>child.stdin.write(JSON.stringify({jsonrpc:'2.0',method})+'\n'),close:async()=>{const exited=once(child,'exit');child.stdin.end();const [code]=await exited;assert.equal(code,0,stderr);}};
}
test('actual MCP lifecycle, catalog, refusal and dynamic compilation',{timeout:30000},async()=>{
 const c=client();try{
  assert.equal((await c.call('tools/list')).error.code,-32002);
  const init=await c.call('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'qualification',version:'1'}});
  assert.equal(init.result.protocolVersion,'2025-06-18');c.notify('notifications/initialized');
  const list=await c.call('tools/list');assert.equal(list.result.tools.length,4);
  const converted=await c.call('tools/call',{name:'mithril_source_convert',arguments:{language:'typescript',source:'export const toggle = (x: boolean) => !x;'}});assert.equal(converted.result.structuredContent.receipt.verification.cases,2);
  const catalog=await c.call('tools/call',{name:'mithril_task_list',arguments:{}});assert.equal(catalog.result.structuredContent.tasks.length,9);
  const refused=await c.call('tools/call',{name:'mithril_task_run',arguments:{task_id:'shell',method:'ontology'}});assert.equal(refused.result.isError,true);
  const run=await c.call('tools/call',{name:'mithril_task_run',arguments:{task_id:'dynamic-refactor',method:'ontology'}});
  assert.equal(run.result.isError,false);assert.equal(run.result.structuredContent.row.success,true);assert.equal(run.result.structuredContent.projections.length,11);
 }finally{await c.close();}
});
test('real workflow shares dynamic compiler and stops only after 3 verified tasks',{timeout:30000},async()=>{
 const r=await executeWorkflow({task_ids:['dynamic-repair-inheritance','dynamic-repair-validation','dynamic-refactor'],method:'ontology'});
 assert.equal(r.row.success,true);assert.equal(r.tasks.length,3);assert.ok(r.tasks.every(t=>t.projections.length===11));
});
