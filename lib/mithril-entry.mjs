import {equivalentTasks,taskById} from '../bench/mithril-equivalent-tasks.mjs';
import {dynamicTasks,dynamicTaskById} from '../bench/mithril-dynamic-tasks.mjs';
import {runTask} from './mithril-task-agent.mjs';
import {runDynamicTask,createDynamicExecutor} from './mithril-dynamic.mjs';
import {runCodegraph,validateGraphContext,graphContextSchema} from './codegraph.mjs';
export const taskCatalog=[...equivalentTasks,...dynamicTasks].map(({id,kind,ordinary})=>({id,kind,ordinary}));
export const taskSchema={type:'object',properties:{task_id:{type:'string',enum:taskCatalog.map(t=>t.id)},method:{type:'string',enum:['ontology','system-one']},source:{type:'string',maxLength:8192},codegraph:graphContextSchema},required:['task_id','method'],additionalProperties:false};
export const workflowSchema={type:'object',properties:{task_ids:{type:'array',items:{type:'string',enum:taskCatalog.map(t=>t.id)},minItems:1,maxItems:3,uniqueItems:true},method:taskSchema.properties.method,codegraph:{type:'array',items:graphContextSchema,minItems:1,maxItems:3}},required:['task_ids','method'],additionalProperties:false};
export function validateTask(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['task_id','method','source','codegraph'].includes(k)))throw Error('invalid_arguments');
 if(!taskCatalog.some(t=>t.id===input.task_id)||!['ontology','system-one'].includes(input.method??'ontology'))throw Error('invalid_arguments');
 if('source' in input&&(typeof input.source!=='string'||Buffer.byteLength(input.source)>8192))throw Error('invalid_arguments');
 if('codegraph' in input)validateGraphContext(input.codegraph);
 return input;
}
export async function executeTask(input,{graph=runCodegraph,run,executor}={}){
 const started=performance.now();
 validateTask(input);const task=dynamicTaskById(input.task_id)??taskById(input.task_id),method=input.method??'ontology';let request;
 if(method==='system-one'){
  const key=process.env.MITHRIL_API_KEY;if(!key||key.length>1024||/[\r\n]/.test(key))throw Error('mithril_authorization_required');
  request=new Request('https://code.mithril.fund',{headers:{'x-mithril-token':key}});
 }
 const context=input.codegraph?await graph({action:'context',...input.codegraph}):null;
 if(context&&input.source!==undefined&&context.source!==null&&input.source!==context.source)throw Error('codegraph_source_mismatch');
 const evidence=context?{revision:context.revision,target:context.target,source_digest:context['source-digest'],graph:context.graph}:null;
 if(evidence&&Buffer.byteLength(JSON.stringify(evidence))>16384)throw Error('codegraph_context_budget');
 const result=await (run??(dynamicTaskById(task.id)?runDynamicTask:runTask))(task,{method,request,initial:input.source??context?.source??task.initial,codegraph:evidence,...(executor?{executor}:{})});
 if(context){
  result.codegraph={context:evidence,candidate:null};
  result.trace.unshift({tool:'codegraph-context',revision:context.revision,target:context.target});
  if(result.row.success&&!result.row.outcome_unknown){
   try{
    const candidate=await graph({action:'candidate',target:context.target,source:result.source,revision:context.revision,'source-digest':context['source-digest']});
    result.codegraph.candidate=candidate;
    result.trace.push({tool:'codegraph-candidate',revision:candidate.after?.['snapshot-digest'],conforms:candidate['conforms?'],reasoned_path:candidate.reasoning?.['reasoned-path']});
    if(candidate['conforms?']!==true){result.row.success=false;result.row.error='codegraph_candidate_nonconforming';}
   }catch(e){
    result.row.success=false;result.row.error='codegraph_candidate_stopped';result.row.outcome_unknown=e.code==='codegraph_outcome_unknown';
    result.codegraph.error=e.reason??e.code??'codegraph_runtime_failed';result.codegraph.retry=false;
   }
  }
  result.codegraph.total_seconds=(performance.now()-started)/1000;
 }
 return result;
}
export async function executeWorkflow(input,execute=executeTask){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['method','task_ids','codegraph'].includes(k))||!Object.hasOwn(input,'method')||!Array.isArray(input.task_ids)||input.task_ids.length<1||input.task_ids.length>3||new Set(input.task_ids).size!==input.task_ids.length)throw Error('invalid_arguments');
 if('codegraph' in input&&(!Array.isArray(input.codegraph)||input.codegraph.length!==input.task_ids.length))throw Error('invalid_arguments');
 // Validate the entire workflow before starting inference or compilation.
 for(const [i,task_id] of input.task_ids.entries())validateTask({task_id,method:input.method,...(input.codegraph?{codegraph:input.codegraph[i]}:{})});
 const session=execute===executeTask&&['ontology','system-one'].includes(input.method)&&input.task_ids.every(dynamicTaskById)?createDynamicExecutor({maxRequests:input.task_ids.length}):null;
 const tasks=[];
 try{for(const [i,task_id] of input.task_ids.entries()){const args={task_id,method:input.method,...(input.codegraph?{codegraph:input.codegraph[i]}:{})};const result=session?await executeTask(args,{executor:session.execute}):await execute(args);tasks.push(result);if(!result.row.success||result.row.outcome_unknown)break;}}
 finally{session?.close();}
 const success=tasks.length===input.task_ids.length&&tasks.every(t=>t.row.success&&!t.row.outcome_unknown);
 return {row:{success,method:input.method,requested_tasks:input.task_ids.length,completed_tasks:tasks.filter(t=>t.row.success).length,outcome_unknown:tasks.some(t=>t.row.outcome_unknown),error:success?null:'workflow_stopped',retry:false},tasks,...(session?{runtime_reuse:{...session.stats}}:{})};
}
export function safeError(e){return ['invalid_arguments','mithril_authorization_required','codegraph_configuration_required','codegraph_source_mismatch','codegraph_context_budget','codegraph_refused','codegraph_outcome_unknown'].includes(e.message)?e.message:'mithril_task_stopped';}
