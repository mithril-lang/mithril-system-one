#!/usr/bin/env node
import {taskCatalog,taskSchema,workflowSchema,executeTask,executeWorkflow,safeError} from '../lib/mithril-entry.mjs';
const tools=[
 {name:'mithril_task_list',description:'List the nine bounded Mithril coding tasks; no inference or compilation.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},
 {name:'mithril_task_run',description:'Propose, compile and independently verify one Mithril task. ontology is deterministic; system-one uses one owning-process Mithril API credential. Returns source and actual receipts; never retries.',inputSchema:taskSchema,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:true}},
 {name:'mithril_workflow_run',description:'Execute 1–3 distinct supported tasks sequentially; stop immediately on failure or unknown outcome. No files, Git or publication.',inputSchema:workflowSchema,annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:true}}
];
const reply=x=>process.stdout.write(JSON.stringify(x)+'\n');
const rpcError=(id,code,message)=>reply({jsonrpc:'2.0',id,error:{code,message}});
let state='new';
async function handle(raw){
 let m;try{m=JSON.parse(raw);}catch{return rpcError(null,-32700,'Parse error');}
 if(!m||Array.isArray(m)||m.jsonrpc!=='2.0'||typeof m.method!=='string'||'id' in m&&!['string','number'].includes(typeof m.id))return rpcError(null,-32600,'Invalid request');
 const notification=!Object.hasOwn(m,'id'),id=m.id;
 if(notification){if(m.method==='notifications/initialized'&&state==='initializing')state='ready';return;}
 const result=v=>reply({jsonrpc:'2.0',id,result:v});
 if(m.method==='initialize'){
  if(state!=='new'||typeof m.params?.protocolVersion!=='string'||!m.params?.clientInfo||!m.params?.capabilities)return rpcError(id,-32602,'Invalid initialize');
  state='initializing';return result({protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'mithril-system-one',version:'0.3.0'}});
 }
 if(m.method==='ping')return result({});
 if(state!=='ready')return rpcError(id,-32002,'Initialize first');
 if(m.method==='tools/list')return result({tools});
 if(m.method!=='tools/call')return rpcError(id,-32601,'Method not found');
 const {name,arguments:args={}}=m.params??{};
 if(!tools.some(t=>t.name===name))return rpcError(id,-32602,'Unknown tool');
 try{
  let value;
  if(name==='mithril_task_list'){
   if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)throw Error('invalid_arguments');
   value={tasks:taskCatalog};
  }else value=await (name==='mithril_task_run'?executeTask:executeWorkflow)(args);
  return result({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value,isError:value.row?.success===false});
 }catch(e){return result({content:[{type:'text',text:JSON.stringify({success:false,error:safeError(e),retry:false})}],isError:true});}
}
// Bounded newline-delimited MCP stdio. Requests execute sequentially, so one
// client cannot accumulate unbounded concurrent model/compiler calls.
let pending=Buffer.alloc(0);
try{
 for await(const chunk of process.stdin){
  pending=Buffer.concat([pending,chunk]);let i;
  while((i=pending.indexOf(10))>=0){if(i>32768)throw Error('frame_budget');const line=pending.subarray(0,i).toString('utf8');pending=pending.subarray(i+1);if(line.trim())await handle(line);}
  if(pending.length>32768)throw Error('frame_budget');
 }
 if(pending.length)rpcError(null,-32700,'Incomplete message');
}catch{process.stderr.write('Mithril MCP stopped at input budget.\n');process.exitCode=1;}
