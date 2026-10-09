import {execFile} from 'node:child_process';
import {realpath,stat} from 'node:fs/promises';
import {resolve} from 'node:path';

const fail=code=>{throw Object.assign(Error(code),{code});};
export const graphRequestSchema={type:'object',additionalProperties:false,required:['operation'],properties:{
 operation:{type:'string',enum:['status','search','explore','catalog','content','node','callers','callees','impact','neighbors','path','communities','community']},
 query:{type:'string',minLength:1,maxLength:256},node:{type:'string',maxLength:512},from:{type:'string',maxLength:512},to:{type:'string',maxLength:512},community:{type:'string',maxLength:512},kind:{type:'string',maxLength:256},revision:{type:'string',maxLength:80},
 limit:{type:'integer',minimum:1,maximum:200},depth:{type:'integer',minimum:1,maximum:16},offset:{type:'integer',minimum:0,maximum:67108864}
}};
export const graphContextSchema={type:'object',additionalProperties:false,required:['target','request'],properties:{target:{type:'string',maxLength:240},request:graphRequestSchema}};
export const codegraphToolSchema={type:'object',additionalProperties:false,required:['action'],properties:{action:{type:'string',enum:['query','index','rebuild','reason']},request:graphRequestSchema}};
function object(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))fail('invalid_arguments');}
export function validateGraphRequest(request){
 object(request,Object.keys(graphRequestSchema.properties));
 if(!graphRequestSchema.properties.operation.enum.includes(request.operation))fail('invalid_arguments');
 const specific=['search','explore','content'].includes(request.operation)?['query']:request.operation==='catalog'?['kind']:['node','callers','callees','impact','neighbors'].includes(request.operation)?['node']:request.operation==='path'?['from','to']:request.operation==='community'?['community']:[];
 if(Object.keys(request).some(k=>!['operation','limit','depth','offset','revision',...specific].includes(k)))fail('invalid_arguments');
 if(request.operation!=='catalog'&&specific.some(k=>!Object.hasOwn(request,k)))fail('invalid_arguments');
 for(const [k,v] of Object.entries(request)){
  const s=graphRequestSchema.properties[k];
  if(s.type==='string'&&(typeof v!=='string'||v.length<(s.minLength??1)||v.length>(s.maxLength??80)))fail('invalid_arguments');
  if(s.type==='integer'&&(!Number.isSafeInteger(v)||v<s.minimum||v>s.maximum))fail('invalid_arguments');
 }
 return request;
}
export function validateGraphContext(value){
 object(value,['target','request']);
 if(typeof value.target!=='string'||value.target.length>240||! /^[A-Za-z0-9_][A-Za-z0-9_./-]*\.mith$/.test(value.target)||value.target.split('/').some(p=>['.','..','.git','.mithril-codegraph'].includes(p)))fail('invalid_arguments');
 validateGraphRequest(value.request);return value;
}
export function validateGraphTool(input){
 object(input,['action','request']);
 if(!codegraphToolSchema.properties.action.enum.includes(input.action))fail('invalid_arguments');
 if(input.action==='query')validateGraphRequest(input.request);
 else if('request' in input)fail('invalid_arguments');
 return input;
}
export async function runCodegraph(input,{env=process.env,timeout=300000}={}){
 // Roots and executable are owner configuration, never model/tool arguments.
 if(!env.MITHRIL_CODEGRAPH_RUNTIME_ROOT||!env.MITHRIL_CODEGRAPH_REPOSITORY)fail('codegraph_configuration_required');
 const runtime=await realpath(env.MITHRIL_CODEGRAPH_RUNTIME_ROOT),repo=await realpath(env.MITHRIL_CODEGRAPH_REPOSITORY);
 for(const p of ['scripts/run-sci.mjs','bin/mithril-system-one-graph.cljk'])if(!(await stat(resolve(runtime,p))).isFile())fail('codegraph_runtime_unavailable');
 const payload=JSON.stringify(input);if(Buffer.byteLength(payload)>32768)fail('invalid_arguments');
 const childEnv=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>env[k]).map(k=>[k,env[k]]));
 const value=await new Promise((ok,no)=>{
  const child=execFile(process.execPath,[resolve(runtime,'scripts/run-sci.mjs'),'bin/mithril-system-one-graph.cljk',repo],{cwd:runtime,env:childEnv,timeout,maxBuffer:2_000_000,killSignal:'SIGTERM'},(error,out)=>{
   if(error?.killed||error?.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER')return no(Object.assign(Error('codegraph_outcome_unknown'),{code:'codegraph_outcome_unknown'}));
   let response;try{response=JSON.parse(out);}catch{return no(Error('codegraph_runtime_failed'));}
   if(!response.ok)return no(Object.assign(Error('codegraph_refused'),{code:'codegraph_refused',reason:response.error}));
   if(error||!response.result||typeof response.result!=='object')return no(Error('codegraph_runtime_failed'));
   ok(response.result);
  });
  child.stdin.on('error',()=>{});child.stdin.end(payload);
 });
 return value;
}
export async function executeCodegraph(input,options){validateGraphTool(input);return runCodegraph(input,options);}
