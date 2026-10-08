#!/usr/bin/env node
import {reviewPublicRepository,reviewSchema} from '../lib/public-code-review.mjs';
import {assessScap} from '../lib/scap-assessment.mjs';
import {remediateDependencies} from '../lib/dependency-remediation.mjs';
const reviewTool={name:'mithril_public_repo_review',description:'Read-only public GitHub commit review. Bounded JavaScript/TypeScript ESM/CommonJS extraction, locked npm OSV matching, Knowledge context and Mithril policies; always incomplete, candidates require review. No target execution or inference.',inputSchema:reviewSchema,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true}};
const tools=[reviewTool,{name:'mithril_scap_review',description:'Import supplied SCAP/ARF OVAL and XCCDF results into actual Mithril evaluation. No host scans or fixes; incomplete.',inputSchema:{type:'object',properties:{xml:{type:'string',maxLength:1048576}},required:['xml'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false}},{name:'mithril_dependency_upgrade',description:'Generate a same-major direct npm dependency patch in isolation, scripts disabled, then recheck OSV/Mithril. Returns files; no project writes, compatibility tests or merge.',inputSchema:{type:'object',properties:{files:{type:'array',minItems:2,maxItems:2,items:{type:'object',properties:{path:{enum:['package.json','package-lock.json']},text:{type:'string',maxLength:1048576},sha256:{type:'string',pattern:'^[a-f0-9]{64}$'}},required:['path','text','sha256'],additionalProperties:false}}},required:['files'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,openWorldHint:true}}];
const reply=x=>process.stdout.write(JSON.stringify(x)+'\n');let state='new';
async function handle(raw){
 let m;try{m=JSON.parse(raw);}catch{return reply({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
 const error=(code,message)=>reply({jsonrpc:'2.0',id:m?.id??null,error:{code,message}}),result=x=>reply({jsonrpc:'2.0',id:m.id,result:x});
 if(!m||Array.isArray(m)||m.jsonrpc!=='2.0'||typeof m.method!=='string'||('id'in m&&!['string','number'].includes(typeof m.id)))return error(-32600,'Invalid request');
 if(!('id'in m)){if(m.method==='notifications/initialized'&&state==='initializing')state='ready';return;}
 if(m.method==='initialize'){
  if(state!=='new'||typeof m.params?.protocolVersion!=='string'||!m.params?.clientInfo||!m.params?.capabilities)return error(-32602,'Invalid initialize');
  state='initializing';return result({protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'mithril-public-review',version:'0.4.0'}});
 }
 if(m.method==='ping')return result({});
 if(state!=='ready')return error(-32002,'Initialize first');
 if(m.method==='tools/list')return result({tools});
 if(m.method!=='tools/call')return error(-32601,'Method not found');
 const name=m.params?.name;if(!tools.some(t=>t.name===name))return error(-32602,'Unknown tool');
 const a=m.params.arguments;if(!a||Array.isArray(a)||typeof a!=='object')return error(-32602,'Invalid arguments');
 if(name==='mithril_scap_review'&&Object.keys(a).join(',')!=='xml'||name==='mithril_dependency_upgrade'&&Object.keys(a).join(',')!=='files')return error(-32602,'Invalid arguments');
 try{const v=name===reviewTool.name?await reviewPublicRepository(a):name==='mithril_scap_review'?await assessScap(a.xml):await remediateDependencies(a.files);return result({content:[{type:'text',text:JSON.stringify(v)}],structuredContent:v,isError:false});}
 catch{return result({content:[{type:'text',text:JSON.stringify({ok:false,error:'public_review_refused',retry:false})}],isError:true});}
}
let pending=Buffer.alloc(0);try{for await(const c of process.stdin){pending=Buffer.concat([pending,c]);let i;while((i=pending.indexOf(10))>=0){if(i>2097152)throw Error();const line=pending.subarray(0,i).toString();pending=pending.subarray(i+1);if(line.trim())await handle(line);}if(pending.length>2097152)throw Error();}if(pending.length)throw Error();}catch{process.stderr.write('Public review MCP input refused.\n');process.exitCode=1;}
