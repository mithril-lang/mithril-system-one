import {equivalentTasks,taskById} from '../bench/mithril-equivalent-tasks.mjs';
import {dynamicTasks,dynamicTaskById} from '../bench/mithril-dynamic-tasks.mjs';
import {runTask} from './mithril-task-agent.mjs';
import {runDynamicTask} from './mithril-dynamic.mjs';
export const taskCatalog=[...equivalentTasks,...dynamicTasks].map(({id,kind,ordinary})=>({id,kind,ordinary}));
export const taskSchema={type:'object',properties:{task_id:{type:'string',enum:taskCatalog.map(t=>t.id)},method:{type:'string',enum:['ontology','system-one']},source:{type:'string',maxLength:8192}},required:['task_id','method'],additionalProperties:false};
export const workflowSchema={type:'object',properties:{task_ids:{type:'array',items:{type:'string',enum:taskCatalog.map(t=>t.id)},minItems:1,maxItems:3,uniqueItems:true},method:taskSchema.properties.method},required:['task_ids','method'],additionalProperties:false};
export function validateTask(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['task_id','method','source'].includes(k)))throw Error('invalid_arguments');
 if(!taskCatalog.some(t=>t.id===input.task_id)||!['ontology','system-one'].includes(input.method??'ontology'))throw Error('invalid_arguments');
 if('source' in input&&(typeof input.source!=='string'||Buffer.byteLength(input.source)>8192))throw Error('invalid_arguments');
 return input;
}
export async function executeTask(input){
 validateTask(input);const task=dynamicTaskById(input.task_id)??taskById(input.task_id),method=input.method??'ontology';let request;
 if(method==='system-one'){
  const key=process.env.MITHRIL_API_KEY;if(!key||key.length>1024||/[\r\n]/.test(key))throw Error('mithril_authorization_required');
  request=new Request('https://code.mithril.fund',{headers:{'x-mithril-token':key}});
 }
 return (dynamicTaskById(task.id)?runDynamicTask:runTask)(task,{method,request,initial:input.source??task.initial});
}
export async function executeWorkflow(input,execute=executeTask){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='method,task_ids'||!Array.isArray(input.task_ids)||input.task_ids.length<1||input.task_ids.length>3||new Set(input.task_ids).size!==input.task_ids.length)throw Error('invalid_arguments');
 // Validate the entire workflow before starting inference or compilation.
 for(const task_id of input.task_ids)validateTask({task_id,method:input.method});
 const tasks=[];for(const task_id of input.task_ids){const result=await execute({task_id,method:input.method});tasks.push(result);if(!result.row.success||result.row.outcome_unknown)break;}
 const success=tasks.length===input.task_ids.length&&tasks.every(t=>t.row.success&&!t.row.outcome_unknown);
 return {row:{success,method:input.method,requested_tasks:input.task_ids.length,completed_tasks:tasks.filter(t=>t.row.success).length,outcome_unknown:tasks.some(t=>t.row.outcome_unknown),error:success?null:'workflow_stopped',retry:false},tasks};
}
export function safeError(e){return ['invalid_arguments','mithril_authorization_required'].includes(e.message)?e.message:'mithril_task_stopped';}
