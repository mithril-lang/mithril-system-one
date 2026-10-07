import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {equivalentTasks,ontologyContract} from './mithril-equivalent-tasks.mjs';
import {runTask} from '../lib/mithril-task-agent.mjs';

export async function main(args=process.argv.slice(2)){
 const get=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
 const methods=get('--methods','ontology').split(','),rounds=Number(get('--rounds',1));
 if(!methods.length||new Set(methods).size!==methods.length||methods.some(m=>!['ontology','system-one'].includes(m))||!Number.isSafeInteger(rounds)||rounds<1||rounds>3)throw Error('invalid_plan');
 const plan={format:'mithril.equivalent-task-suite/v1',scope:'Six original static-document tasks adapted to Mithril; not standard benchmark scores.',methods,rounds,
  max_inference_calls:methods.includes('system-one')?6*rounds:0,max_compiler_calls:9*methods.length*rounds,
  tasks:equivalentTasks.map(t=>({id:t.id,kind:t.kind,ordinary:t.ordinary,ontology:ontologyContract(t)}))};
 if(!args.includes('--live')){console.log(JSON.stringify({mode:'plan_only',...plan},null,2));return;}
 if(!get('--output',null))throw Error('output_required');
 let request;if(methods.includes('system-one')){
  const key=process.env.MITHRIL_API_KEY;if(!key||key.length>1024||/[\r\n]/.test(key))throw Error('mithril_authorization_required');
  request=new Request('https://code.mithril.fund',{headers:{'x-mithril-token':key}});
 }
 const output=resolve(get('--output',null));await mkdir(output,{recursive:false});await writeFile(output+'/plan.json',JSON.stringify(plan,null,2));
 const rows=[];let stopped=null;
 outer:for(let round=1;round<=rounds;round++)for(let i=0;i<equivalentTasks.length;i++){
  const order=(round+i)%2?[...methods].reverse():methods;
  for(const method of order){
   const result=await runTask(equivalentTasks[i],{method,request});result.row.round=round;rows.push(result.row);
   await writeFile(output+`/attempt-${String(rows.length).padStart(3,'0')}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result.row));
   if(result.row.outcome_unknown){stopped=result.row.error;break outer;}
  }
 }
 const summary={...plan,rows,stopped,complete:rows.length===6*methods.length*rounds,
  measurements:methods.map(method=>{const selected=rows.filter(r=>r.method===method),times=selected.map(r=>r.seconds).sort((a,b)=>a-b);return {method,planned:6*rounds,executed:selected.length,passed:selected.filter(r=>r.success).length,missing:6*rounds-selected.length,all_attempt_median_seconds:times.length?times[Math.ceil(times.length/2)-1]:null,billed_cost_usd:null};})};
 await writeFile(output+'/summary.json',JSON.stringify(summary,null,2));
 if(stopped||rows.some(r=>!r.success))process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))main().catch(()=>{console.error('mithril_task_benchmark_stopped');process.exitCode=1;});
