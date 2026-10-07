#!/usr/bin/env node
import {mkdir,writeFile,readFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {taskById,equivalentTasks,ontologyContract,ordinaryHtml} from '../bench/mithril-equivalent-tasks.mjs';
import {runTask,verifyEquivalent} from '../lib/mithril-task-agent.mjs';
import {dynamicTaskById,dynamicTasks} from '../bench/mithril-dynamic-tasks.mjs';
import {runDynamicTask} from '../lib/mithril-dynamic.mjs';
import {compileMithril} from '../lib/mithril-language.mjs';

async function regular(path){const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)throw Error('workspace_file_refused');return readFile(path,'utf8');}
export async function main(args=process.argv.slice(2)){
 if(args.length===1&&args[0]==='list'){console.log(JSON.stringify([...equivalentTasks,...dynamicTasks].map(({id,kind,ordinary})=>({id,kind,ordinary})),null,2));return;}
 if(args.length===2&&args[0]==='agent'&&args[1]==='--stdin'){
  const chunks=[];let bytes=0;for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>16384)throw Error('invalid_arguments');chunks.push(chunk);}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['task_id','method','source'].includes(k)))throw Error('invalid_arguments');
  const task=dynamicTaskById(input.task_id)??taskById(input.task_id),method=input.method??'ontology';let request;
  if(method==='system-one'){
   const key=process.env.MITHRIL_API_KEY;if(!key||key.length>1024||/[\r\n]/.test(key))throw Error('mithril_authorization_required');
   request=new Request('https://code.mithril.fund',{headers:{'x-mithril-token':key}});
  }
  const result=await (dynamicTaskById(task.id)?runDynamicTask:runTask)(task,{method,request,initial:input.source??task.initial});
  console.log(JSON.stringify(result));if(!result.row.success)process.exitCode=1;return;
 }
 const [command,id,path,method='ontology']=args;
 if(!['init','run','check'].includes(command)||!id||!path||args.length>(command==='init'?3:4)||command==='check'&&args.length===4&&method!=='--candidate')throw Error('invalid_arguments');
 const task=taskById(id),workspace=resolve(path);
 if(command==='init'){
  await mkdir(workspace,{recursive:false});
  await writeFile(workspace+'/application.mith',task.initial,{flag:'wx'});
  await writeFile(workspace+'/task.json',JSON.stringify({id,kind:task.kind,problem:task.ordinary,goal:task.goal,ontology:ontologyContract(task)},null,2),{flag:'wx'});
  await writeFile(workspace+'/ordinary-reference.html',ordinaryHtml(task.expected),{flag:'wx'});
  console.log(JSON.stringify({initialized:true,task_id:id,workspace}));return;
 }
 const stat=await lstat(workspace);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('workspace_file_refused');
 const source=await regular(workspace+(command==='check'&&method==='--candidate'?'/candidate.mith':'/application.mith'));
 if(command==='check'){
  const compiled=await compileMithril(source),before=task.preserve_ir?await compileMithril(task.initial):null;
  const checked=verifyEquivalent(task,source,compiled,before);
  console.log(JSON.stringify({success:true,task_id:id,checks:checked.checks}));return;
 }
 // Single-shot terminal adapter. Source edits are bounded data operations;
 // no model-authored command or arbitrary process is executed.
 let request;
 if(method==='system-one'){
  const key=process.env.MITHRIL_API_KEY;if(!key||key.length>1024||/[\r\n]/.test(key))throw Error('mithril_authorization_required');
  request=new Request('https://code.mithril.fund',{headers:{'x-mithril-token':key}});
 }
 const result=await runTask(task,{method,request,initial:source});
 const record=workspace+'/attempt-'+Date.now()+'.json';
 await writeFile(record,JSON.stringify(result,null,2),{flag:'wx'});
 if(result.row.success){
  // Keep input intact; check the new file explicitly before choosing to replace it.
  await writeFile(workspace+'/candidate.mith',result.source,{flag:'wx'});
  await writeFile(workspace+'/index.html',result.html,{flag:'wx'});
  await writeFile(workspace+'/artifact.json',JSON.stringify(result.compiled.artifact,null,2),{flag:'wx'});
 }
 console.log(JSON.stringify({...result.row,record,candidate:result.row.success?workspace+'/candidate.mith':null}));
 if(!result.row.success)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))main().catch(e=>{
 const safe=['invalid_arguments','unknown_task','invalid_method','workspace_file_refused','mithril_authorization_required','task_contract_failed','output_equivalence_failed','no_change','refactor_size_failed','refactor_semantics_failed','mithril_compile_refused'];
 console.error(JSON.stringify({success:false,error:safe.includes(e.code||e.message)?e.code||e.message:'terminal_task_stopped',retry:false}));process.exitCode=1;
});
