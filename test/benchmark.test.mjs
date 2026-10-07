import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {API,MODEL} from '../lib/inference.mjs';
import {emitMithril,COMPILER} from '../lib/mithril-language.mjs';
import {attempt,schedule,summarize} from '../bench/compare.mjs';
import {tasks} from '../bench/tasks.mjs';
const task=tasks[0];
const compiler=()=>{
 const value=JSON.parse(readFileSync(new URL('./fixtures/mithril-app-compiled.json',import.meta.url)));
 Object.assign(value.artifact['app-ir'].app,task.expected,{template:'https://mithril.fund/id/template/report','data-shape':'https://mithril.fund/id/shape/claim-list'});
 return value;
};
const request=new Request('https://code.mithril.fund',{headers:{'x-mithril-token':'fixture-credential'}});
const inference=(content)=>Response.json({id:'fixture-only',model:MODEL,choices:[{finish_reason:'stop',message:{content}}],usage:{prompt_tokens:10,completion_tokens:20}});
test('rotates order and preflights identical per-arm task/round counts',()=>{
 const plan=schedule(tasks.slice(0,3),2);assert.equal(plan.length,18);
 for(const task of tasks.slice(0,3))for(const method of ['system-one','llm-source','template'])assert.equal(plan.filter(r=>r.task.id===task.id&&r.method===method).length,2);
 assert.deepEqual(plan.slice(0,3).map(r=>r.method),['system-one','llm-source','template']);assert.deepEqual(plan.slice(3,6).map(r=>r.method),['llm-source','template','system-one']);
 assert.throws(()=>schedule(tasks,0));
});
test('all three arms use the same content and compiler contract; no compiler credentials',async()=>{
 for(const method of ['system-one','llm-source','template']){
  let api=0,compile=0;
  const result=await attempt({task,round:1,method},request,async(url,init)=>{
   if(url===API+'/chat/completions'){
    api++;assert.equal(init.headers.authorization,'Bearer fixture-credential');assert.equal(init.redirect,'manual');
    const body=JSON.parse(init.body);assert.equal(body.model,MODEL);assert.equal(body.temperature,0);assert.equal(body.max_completion_tokens,2048);
    return inference(method==='system-one'?JSON.stringify(task.expected):emitMithril(task.expected));
   }
   assert.equal(url,COMPILER);compile++;assert.equal(init.headers.authorization,undefined);assert.equal(init.headers.cookie,undefined);assert.equal(init.body,emitMithril(task.expected));return Response.json(compiler());
  });
  assert.equal(result.row.success,true);assert.equal(api,method==='template'?0:1);assert.equal(compile,1);assert.equal(result.row.billed_cost_usd,null);assert.equal(result.row.input_tokens,method==='template'?0:10);
 }
});
test('semantically admitted wrong content fails and metered failed proposals are retained',async()=>{
 const value=compiler();value.artifact['app-ir'].app.headline='wrong';
 const result=await attempt({task,round:1,method:'llm-source'},request,async(url)=>url===COMPILER?Response.json(value):inference(emitMithril(task.expected)));
 assert.equal(result.row.success,false);assert.equal(result.row.error,'task_contract_failed');assert.equal(result.row.input_tokens,10);assert.equal(result.artifacts.proposals.length,1);
});
test('uncertain outcome does not retry or echo transport credentials',async()=>{
 let calls=0;const result=await attempt({task,round:1,method:'system-one'},request,async()=>{calls++;throw Error('fixture-credential');});
 assert.equal(calls,1);assert.equal(result.row.outcome_unknown,true);assert.equal(result.row.input_tokens,null);assert.ok(!JSON.stringify(result).includes('fixture-credential'));
});
test('cost remains unknown without invoices and successes never hide failures',()=>{
 const rows=[{method:'system-one',success:true,seconds:2,input_tokens:10,output_tokens:2,billed_cost_usd:null},{method:'system-one',success:false,seconds:20,input_tokens:30,output_tokens:6,billed_cost_usd:null}];
 const x=summarize(rows)[0];assert.equal(x.success_rate,.5);assert.equal(x.input_tokens,40);assert.equal(x.billed_cost_per_success_usd,null);assert.equal(x.successful_p50_seconds,2);
 rows[0].billed_cost_usd=.01;rows[1].billed_cost_usd=.02;assert.equal(summarize(rows)[0].billed_cost_per_success_usd,.03);
});
test('planning is no-network and oversized call budgets stop before credential access',()=>{
 const run=args=>spawnSync(process.execPath,['bench/run.mjs',...args],{encoding:'utf8',env:{...process.env,MITHRIL_API_KEY:''}});
 const plan=run([]);assert.equal(plan.status,0);assert.equal(JSON.parse(plan.stdout).mode,'plan_only');assert.equal(JSON.parse(plan.stdout).required_api_calls,6);
 const refused=run(['--live','--tasks','20','--rounds','10','--max-api-calls','6']);assert.equal(refused.status,1);assert.equal(JSON.parse(refused.stderr).error,'plan_exceeds_api_call_limit');
});

test('optimized fields control is explicit and must consume its own budget',()=>{
 const plan=schedule(tasks.slice(0,3),1,['system-one','llm-source','llm-fields','template']);assert.equal(plan.filter(r=>r.method!=='template').length,9);assert.throws(()=>schedule(tasks,1,['unsupported']));
});
