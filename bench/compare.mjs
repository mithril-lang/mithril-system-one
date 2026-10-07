import {API,MODEL,inferenceHeaders} from '../lib/inference.mjs';
import {starter} from '../lib/mithril-starter.mjs';
import {emitMithril,compileMithril,generateMithril,renderMithril} from '../lib/mithril-language.mjs';
import {brief,tasks} from './tasks.mjs';
export const methods=['system-one','llm-source','template'];
export const allMethods=[...methods,'llm-fields'];
const pairs={report:'claim-list',dashboard:'metric-cards',directory:'entity-directory'};
export function validateTask(task,result) {
 const app=result.artifact?.['app-ir']?.app;
 if(!app || !['name','description','headline','summary'].every(k=>app[k]===task.expected[k]) || app.template!=='https://mithril.fund/id/template/'+task.expected.template || app['data-shape']!=='https://mithril.fund/id/shape/'+pairs[task.expected.template])throw Error('task_contract_failed');
 const html=renderMithril(result.artifact);
 if(/<script\b/i.test(html))throw Error('task_contract_failed');
 return html;
}
export function schedule(selected=tasks,rounds=1,arms=methods) {
 if(!Number.isSafeInteger(rounds)||rounds<1||rounds>100)throw Error('invalid_rounds');
 if(!Array.isArray(arms)||!arms.length||new Set(arms).size!==arms.length||arms.some(a=>!allMethods.includes(a)))throw Error('invalid_methods');
 const rows=[];
 for(let round=0;round<rounds;round++)for(let i=0;i<selected.length;i++){
  // Rotate rather than always giving one arm a cold/warm slot advantage.
  const shift=(round+i)%arms.length;
  for(const method of [...arms.slice(shift),...arms.slice(0,shift)])rows.push({task:selected[i],round:round+1,method});
 }
 return rows;
}
export async function attempt({task,round,method},request,transport=fetch) {
 const started=performance.now(); const row={task_id:task.id,round,method,success:false,inference_calls:0,compiler_calls:0,input_tokens:null,output_tokens:null,api_reported_cost_usd:null,billed_cost_usd:null,cost_source:null,completion_ids:[],api_request_ids:[],seconds:null,error:null,outcome_unknown:false};
 const proposals=[];
 const observed=async(url,init)=>{
  if(url===API+'/chat/completions')row.inference_calls++;else row.compiler_calls++;
  let response;
  try{response=await transport(url,init);}catch{row.outcome_unknown=true;throw Error('transport_outcome_unknown');}
  if(url===API+'/chat/completions'){
   if(response.status>=500){row.outcome_unknown=true;throw Error('inference_outcome_unknown');}
   // Record usage even when the known response fails admission. Never persist headers or credentials.
   try{
    const requestId=response.headers.get('x-mithril-request-id');if(requestId)row.api_request_ids.push(requestId);
    const value=await response.clone().json();
    if(value.id)row.completion_ids.push(value.id);
    if(Number.isSafeInteger(value.usage?.prompt_tokens)&&Number.isSafeInteger(value.usage?.completion_tokens)&&value.usage.prompt_tokens>=0&&value.usage.completion_tokens>=0){
     row.input_tokens=(row.input_tokens??0)+value.usage.prompt_tokens;row.output_tokens=(row.output_tokens??0)+value.usage.completion_tokens;
    }
    if(typeof value.usage?.cost==='number'&&Number.isFinite(value.usage.cost)&&value.usage.cost>=0){row.api_reported_cost_usd=(row.api_reported_cost_usd??0)+value.usage.cost;row.cost_source='provider_usage_cost_not_invoice';}
    proposals.push({completion_id:value.id??null,model:value.model??null,usage:value.usage??null,content:value.choices?.[0]?.message?.content??null});
   }catch{row.outcome_unknown=true;throw Error('unreadable_inference_outcome');}
  }
  return response;
 };
 let source,compiled;
 try {
  if(method==='system-one'||method==='llm-fields'){
   // Protocol-equivalent structured-output control; not a new independent algorithm.
   const value=await generateMithril(brief(task),request,observed);source=value.files['application.mith'];compiled=value.receipt;
  }else if(method==='llm-source'){
   const prompt='Return only complete Mithril Form source, beginning (mithril/app-agent. No markdown or explanation. Use the supplied starter unchanged except the five requested app fields and corresponding template/data-shape. Template-to-data-shape mapping: report=claim-list, dashboard=metric-cards, directory=entity-directory. Preserve ontology, import digests, operations, budgets and static-read-only governor. Starter:\n'+starter+'\nTask:\n'+brief(task);
   const response=await observed(API+'/chat/completions',{method:'POST',redirect:'manual',headers:inferenceHeaders(request),body:JSON.stringify({model:MODEL,temperature:0,stream:false,max_completion_tokens:2048,messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(45000)});
   if(!response.ok)throw Error('inference_http_'+response.status);
   const raw=await response.text();if(raw.length>65536)throw Error('response_budget');
   const value=JSON.parse(raw);
   if(value.model!==MODEL||value.choices?.length!==1||value.choices[0].finish_reason!=='stop')throw Error('completion_refused');
   source=value.choices[0].message.content;
   if(typeof source!=='string'||!source.startsWith('(mithril/app-agent'))throw Error('source_refused');
   compiled=await compileMithril(source,observed);
  }else if(method==='template'){
   source=emitMithril(task.expected);compiled=await compileMithril(source,observed);
   row.input_tokens=0;row.output_tokens=0;row.api_reported_cost_usd=0;row.cost_source='no_inference_call';
  }else throw Error('invalid_method');
  const html=validateTask(task,compiled);row.success=true;
  row.graph_digest=compiled.artifact['graph-digest'];
  return {row,artifacts:{source,artifact:compiled.artifact,trace:compiled.trace,html,proposals}};
 }catch(error){
  // Enumerated codes only: no upstream body/URL/credentials in public errors.
  const code=error.code||error.message;
  row.error=/^(task_contract_failed|transport_outcome_unknown|inference_outcome_unknown|unreadable_inference_outcome|inference_http_\d+|mithril_inference_\d+|mithril_compile_refused|mithril_proposal_refused|mithril_source_budget|response_budget|completion_refused|source_refused|invalid_method)$/.test(code)?code:'candidate_refused';
  return {row,artifacts:{source:source??null,proposals}};
 }finally{row.seconds=(performance.now()-started)/1000;}
}
export function summarize(rows){
 const percentile=(xs,p)=>xs.length?xs.toSorted((a,b)=>a-b)[Math.ceil(p*xs.length)-1]:null;
 return allMethods.map(method=>{
  const group=rows.filter(r=>r.method===method),passed=group.filter(r=>r.success),times=passed.map(r=>r.seconds);
  const costs=group.map(r=>r.billed_cost_usd),complete=group.length>0&&costs.every(c=>typeof c==='number'&&Number.isFinite(c)&&c>=0);
  return {method,attempts:group.length,successes:passed.length,success_rate:group.length?passed.length/group.length:null,successful_p50_seconds:percentile(times,.5),successful_p95_seconds:percentile(times,.95),all_attempt_p50_seconds:percentile(group.map(r=>r.seconds),.5),input_tokens:group.length&&group.every(r=>r.input_tokens!==null)?group.reduce((a,r)=>a+r.input_tokens,0):null,output_tokens:group.length&&group.every(r=>r.output_tokens!==null)?group.reduce((a,r)=>a+r.output_tokens,0):null,billed_cost_per_success_usd:complete&&passed.length?costs.reduce((a,c)=>a+c,0)/passed.length:null};
 });
}
