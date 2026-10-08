import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {executeDynamic} from './mithril-dynamic.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function assessBusinessProcess(xml,{executor=executeDynamic}={}){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>1048576)throw Error('bpmn_input_budget');
 const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const imported=await new Promise((ok,no)=>{const p=execFile('python3',[new URL('../runtime/bpmn-import.py',import.meta.url).pathname],{env,timeout:15000,maxBuffer:2e6},(e,out)=>{try{if(e)throw e;ok(JSON.parse(out));}catch{no(Error('bpmn_import_refused'));}});p.stdin.on('error',()=>no(Error('bpmn_import_refused')));p.stdin.end(JSON.stringify({xml}));});
 if(imported.sha256!==hash(xml))throw Error('bpmn_evidence_mismatch');
 const {nodes,flows}=imported,by=new Map(nodes.map(n=>[n.id,n])),adj=new Map(nodes.map(n=>[n.id,[]]));
 for(const f of flows)adj.get(f.source).push(f.target);
 // Existential structural path, with optional blocked approvals. No conditions execute.
 function path(start,target,blocked=new Set()){
  const q=[[start]],seen=new Set();
  while(q.length){const p=q.shift(),i=p.at(-1);if(blocked.has(i)||seen.has(i))continue;seen.add(i);if(i===target)return p;for(const j of adj.get(i))q.push([...p,j]);}return null;
 }
 const start=nodes.find(n=>n.kind==='startEvent').id,checks=[],gaps=[{code:'operational_evidence_unverified',detail:'Principals and controls are caller declarations, not IAM, transaction or audit-log attestation.'}];
 const add=(node,rule,value,evidence)=>checks.push({node:node.id,rule,value,evidence,focus:'urn:business:check:'+hash(node.id+':'+rule)});
 for(const action of nodes.filter(n=>n.operation==='execute')){
  const approvals=nodes.filter(n=>n.operation==='approve'&&n.control===action.control&&path(n.id,action.id));
  const bypass=path(start,action.id,new Set(approvals.map(n=>n.id)));
  add(action,'approval',!bypass,{control:action.control,bypass_path:bypass,approvals:approvals.map(n=>n.id)});
  for(const key of ['authorized','audited'])if(typeof action[key]==='boolean')add(action,key,action[key],{declared:true});else gaps.push({node:action.id,code:key+'_unknown'});
 }
 for(const approval of nodes.filter(n=>n.operation==='approve')){
  const requests=nodes.filter(n=>n.operation==='request'&&n.control===approval.control&&path(n.id,approval.id));
  if(!requests.length||!approval.principal||requests.some(n=>!n.principal)){gaps.push({node:approval.id,code:'principal_separation_unknown'});continue;}
  add(approval,'separation',requests.every(n=>n.principal!==approval.principal),{requesters:requests.map(n=>({node:n.id,principal:n.principal})),approver:approval.principal});
 }
 const ns='https://mithril.fund/business-process/v1#',type='http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
 const data=[`<urn:business:assessment> <${ns}evidenceDigest> ${JSON.stringify(imported.sha256)} .`];
 // Keep the normalized BPMN graph in the ontology as well as evaluated control facts.
 for(const n of nodes){const id='urn:business:node:'+hash(n.id);data.push(`<${id}> <${ns}nodeId> ${JSON.stringify(n.id)} .`,`<${id}> <${ns}kind> ${JSON.stringify(n.kind)} .`);for(const key of ['control','principal','operation'])if(n[key])data.push(`<${id}> <${ns}${key}> ${JSON.stringify(n[key])} .`);}
 for(const f of flows)data.push(`<urn:business:node:${hash(f.source)}> <${ns}flowsTo> <urn:business:node:${hash(f.target)}> .`);
 for(const c of checks)data.push(`<${c.focus}> <${type}> <${ns}RequiredControl> .`,`<${c.focus}> <${ns}rule> ${JSON.stringify(c.rule)} .`,`<${c.focus}> <${ns}satisfied> "${c.value}"^^<http://www.w3.org/2001/XMLSchema#boolean> .`);
 const source=await readFile(new URL('../examples/business-process/policy.mith',import.meta.url),'utf8');
 const receipt=await executor([{source,cases:[{id:'business-process',data:data.join('\n')}]}],{profile:'security'}),r=receipt.results?.[0],v=r?.cases?.[0],failures=checks.filter(c=>!c.value).map(c=>c.focus).sort();
 if(!r?.['graph-digest']||v?.consistent!==true||v.id!=='business-process'||!['conforms','violations'].includes(v.status)||JSON.stringify(v.violations.map(x=>x.focus).sort())!==JSON.stringify(failures)||v.violations.some(x=>x.constraint!=='sh:hasValue')||v.status!==(failures.length?'violations':'conforms'))throw Error('bpmn_ontology_mismatch');
 return {status:'review_incomplete',model_status:failures.length?'policy_violations':'conforms',...imported,checks,findings:checks.filter(c=>!c.value),gaps,scope:'Acyclic single-process structural paths; all exclusive branches considered feasible. No token simulation or condition execution.',ontology:{source,data:data.join('\n'),policy_sha256:hash(source),graph_digest:r['graph-digest'],violations:v.violations},execution:{process_executed:false,inference_calls:0},pins:receipt.pins};
}
