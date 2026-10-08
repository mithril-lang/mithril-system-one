#!/usr/bin/env node
import {reviewPublicRepository,reviewSchema} from '../lib/public-code-review.mjs';
const tool={name:'mithril_public_repo_review',description:'Read-only public GitHub commit review. Bounded JavaScript/TypeScript ESM/CommonJS extraction, locked npm OSV matching, Knowledge context and Mithril policies; always incomplete, candidates require review. No target execution or inference.',inputSchema:reviewSchema,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true}};
const reply=x=>process.stdout.write(JSON.stringify(x)+'\n');let state='new';
async function handle(raw){
 let m;try{m=JSON.parse(raw);}catch{return reply({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
 const error=(code,message)=>reply({jsonrpc:'2.0',id:m?.id??null,error:{code,message}}),result=x=>reply({jsonrpc:'2.0',id:m.id,result:x});
 if(!m||Array.isArray(m)||m.jsonrpc!=='2.0'||typeof m.method!=='string'||('id'in m&&!['string','number'].includes(typeof m.id)))return error(-32600,'Invalid request');
 if(!('id'in m)){if(m.method==='notifications/initialized'&&state==='initializing')state='ready';return;}
 if(m.method==='initialize'){
  if(state!=='new'||typeof m.params?.protocolVersion!=='string'||!m.params?.clientInfo||!m.params?.capabilities)return error(-32602,'Invalid initialize');
  state='initializing';return result({protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'mithril-public-review',version:'0.3.0'}});
 }
 if(m.method==='ping')return result({});
 if(state!=='ready')return error(-32002,'Initialize first');
 if(m.method==='tools/list')return result({tools:[tool]});
 if(m.method!=='tools/call')return error(-32601,'Method not found');
 if(m.params?.name!==tool.name)return error(-32602,'Unknown tool');
 try{const v=await reviewPublicRepository(m.params.arguments);return result({content:[{type:'text',text:JSON.stringify(v)}],structuredContent:v,isError:false});}
 catch{return result({content:[{type:'text',text:JSON.stringify({ok:false,error:'public_review_refused',retry:false})}],isError:true});}
}
let pending=Buffer.alloc(0);try{for await(const c of process.stdin){pending=Buffer.concat([pending,c]);let i;while((i=pending.indexOf(10))>=0){if(i>8192)throw Error();const line=pending.subarray(0,i).toString();pending=pending.subarray(i+1);if(line.trim())await handle(line);}if(pending.length>8192)throw Error();}if(pending.length)throw Error();}catch{process.stderr.write('Public review MCP input refused.\n');process.exitCode=1;}
