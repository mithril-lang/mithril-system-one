import {mkdir,writeFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tasks} from './tasks.mjs';
import {schedule,attempt,summarize} from './compare.mjs';
import {MODEL,API} from '../lib/inference.mjs';
const flags=process.argv.slice(2),get=(name,fallback)=>{const i=flags.indexOf(name);return i<0?fallback:flags[i+1];};
try{
 const count=Number(get('--tasks',3)),rounds=Number(get('--rounds',1)),maxCalls=Number(get('--max-api-calls',6));
 if(!Number.isSafeInteger(count)||count<1||count>tasks.length||!Number.isSafeInteger(maxCalls)||maxCalls<0||maxCalls>4000)throw Error('invalid_limits');
 const arms=get('--arms','system-one,llm-source,template').split(',');
 const plan=schedule(tasks.slice(0,count),rounds,arms),required=plan.filter(r=>r.method!=='template').length;
 if(required>maxCalls)throw Error('plan_exceeds_api_call_limit');
 const metadata={format:'mithril.system-one-comparison/v1',model:MODEL,inference:API+'/chat/completions',task_count:count,rounds,arms,max_api_calls:maxCalls,required_api_calls:required,temperature:0,max_completion_tokens:2048,scope:'Public bounded static document parameterization fixtures, not held-out SWE tasks or whole Todo generation. Same expected content, existing starter/catalog, compiler, admission and contract checks. Full-source baseline is not an optimized minimal-patch baseline.',timing_boundary:'Brief dispatch through admitted artifact and exact task validation. Chat, manual review and publication excluded. Compiler service wall time included; invoice and infrastructure costs unavailable.',retry_policy:'none; stop the whole run on unknown outcomes or authorization/quota failure',scheduled:plan.map(r=>({task_id:r.task.id,round:r.round,method:r.method}))};
 if(!flags.includes('--live')){console.log(JSON.stringify({mode:'plan_only',...metadata},null,2));}
 else{
  const token=process.env.MITHRIL_API_KEY;
  if(typeof token!=='string'||!token.trim()||token.length>1024||/[\r\n]/.test(token))throw Error('mithril_authorization_required');
  if(!get('--output',null))throw Error('output_required');
  const output=resolve(get('--output',null));await mkdir(output,{recursive:false});
  const request=new Request('https://code.mithril.fund',{headers:{'x-mithril-token':token}}),rows=[];
  await writeFile(output+'/plan.json',JSON.stringify(metadata,null,2),{flag:'wx'});
  let stopped=null;
  for(let i=0;i<plan.length;i++){
   const result=await attempt(plan[i],request);rows.push(result.row);
   await writeFile(output+`/attempt-${String(i+1).padStart(3,'0')}.json`,JSON.stringify(result,null,2),{flag:'wx'});
   await appendFile(output+'/rows.jsonl',JSON.stringify(result.row)+'\n');
   await writeFile(output+'/summary.json',JSON.stringify({mode:'live',...metadata,rows,summary:summarize(rows),stopped},null,2));
   console.log(JSON.stringify(result.row));
   if(result.row.outcome_unknown||/_(401|403|429)$/.test(result.row.error||'')){stopped=result.row.error;break;}
  }
  await writeFile(output+'/summary.json',JSON.stringify({mode:'live',...metadata,rows,summary:summarize(rows),stopped},null,2));
 }
}catch(error){console.error(JSON.stringify({ok:false,error:['invalid_limits','invalid_rounds','invalid_methods','plan_exceeds_api_call_limit','mithril_authorization_required','output_required'].includes(error.message)?error.message:'benchmark_stopped',retry:false}));process.exitCode=1;}
