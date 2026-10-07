// Custom Mithril semantic-loop checks. Not Terminal-Bench or an AA Index.
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {compileMithril,emitMithril} from '../lib/mithril-language.mjs';
import {tasks} from './tasks.mjs';
import {validateTask} from './compare.mjs';

export function semanticCases() {
 const good=tasks.slice(0,3).map(task=>({id:task.id,source:emitMithril(task.expected),admitted:true,task}));
 const source=good[0].source;
 return [...good,
  {id:'incomplete-form',source:source.slice(0,source.lastIndexOf(')')),admitted:false},
  {id:'unknown-ontology',source:source.replace(/:ontology "[^"]*"/,':ontology "'+'0'.repeat(64)+'"'),admitted:false},
  {id:'unknown-library-digest',source:source.replace(/:digest "sha256:[^"]*"/,':digest "sha256:'+'0'.repeat(64)+'"'),admitted:false},
 ];
}

export async function semanticAttempt(test,round,transport=fetch) {
 const started=performance.now();
 const row={case_id:test.id,round,expected_admitted:test.admitted,success:false,http_status:null,compile_status:null,steps:[],seconds:null,inference_calls:0,compiler_calls:0,billed_cost_usd:null,error:null,outcome_unknown:false};
 let responseBody=null;
 const observed=async(url,init)=>{
  row.compiler_calls++;
  let response;
  try {response=await transport(url,init);}catch {row.outcome_unknown=true;throw Error('transport_outcome_unknown');}
  row.http_status=response.status;
  if(response.status>=500||response.status===429||response.status>=300&&response.status<400){row.outcome_unknown=true;throw Error('compiler_outcome_unknown');}
  try {responseBody=await response.clone().json();}catch {row.outcome_unknown=true;throw Error('compiler_outcome_unknown');}
  row.compile_status=responseBody.status??null;
  row.steps=(responseBody.trace??[]).map(({id,status})=>({id,status}));
  return response;
 };
 try {
  const compiled=await compileMithril(test.source,observed);
  if(test.admitted){validateTask(test.task,compiled);row.success=true;}
  else row.error='unexpected_admission';
 }catch(error){
  if(!test.admitted&&!row.outcome_unknown&&row.compiler_calls===1&&row.http_status===422&&row.compile_status==='refused'&&error.code==='mithril_compile_refused')row.success=true;
  else row.error=row.outcome_unknown?'compiler_outcome_unknown':'semantic_check_failed';
 }finally {row.seconds=(performance.now()-started)/1000;}
 return {row,source:test.source,response:responseBody};
}

export async function main(flags=process.argv.slice(2)) {
 const get=(name,fallback)=>{const i=flags.indexOf(name);return i<0?fallback:flags[i+1];};
 const rounds=Number(get('--rounds',3));
 if(!Number.isSafeInteger(rounds)||rounds<1||rounds>3)throw Error('invalid_rounds');
 const plan={format:'mithril.semantic-loop-benchmark/v1',scope:'Custom public positive and rejection contract cases; no model inference, shell workflow or external leaderboard score.',rounds,cases:semanticCases().map(({id,admitted})=>({id,expected_admitted:admitted})),max_compiler_calls:rounds*6,inference_calls:0};
 if(!flags.includes('--live')){console.log(JSON.stringify({mode:'plan_only',...plan},null,2));return;}
 if(!get('--output',null))throw Error('output_required');
 const output=resolve(get('--output',null));await mkdir(output,{recursive:false});
 await writeFile(output+'/plan.json',JSON.stringify(plan,null,2));
 const rows=[];let stopped=null;
 outer:for(let round=1;round<=rounds;round++)for(const test of semanticCases()){
  const attempt=await semanticAttempt(test,round);rows.push(attempt.row);
  await writeFile(output+`/attempt-${String(rows.length).padStart(3,'0')}.json`,JSON.stringify(attempt,null,2));
  console.log(JSON.stringify(attempt.row));
  if(attempt.row.outcome_unknown){stopped=attempt.row.error;break outer;}
 }
 await writeFile(output+'/summary.json',JSON.stringify({mode:'live',...plan,rows,stopped},null,2));
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))main().catch(()=>{console.error('semantic_benchmark_stopped');process.exitCode=1;});
