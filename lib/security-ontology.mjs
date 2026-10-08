import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {executeDynamic} from './mithril-dynamic.mjs';
import {API,MODEL,inferenceHeaders} from './inference.mjs';
export const ns='https://mithril.fund/security/v1#';
const digest=x=>createHash('sha256').update(x).digest('hex');
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')===keys.sort().join(',');
const tri=x=>x===null||typeof x==='boolean';
export function validateSnapshot(snapshot){
 if(!exact(snapshot,['schemaVersion','revision','records','coverage'])||snapshot.schemaVersion!==1||!/^[a-f0-9]{40}$/.test(snapshot.revision)||!Array.isArray(snapshot.records)||snapshot.records.length>1000||Buffer.byteLength(JSON.stringify(snapshot))>1048576)throw Error('invalid_security_snapshot');
 if(!exact(snapshot.coverage,['complete','unresolved'])||typeof snapshot.coverage.complete!=='boolean'||!Number.isSafeInteger(snapshot.coverage.unresolved)||snapshot.coverage.unresolved<0)throw Error('invalid_security_coverage');
 const ids=new Set();
 for(const r of snapshot.records){
  const fields={endpoint:['public','sensitive','authorization'],shell:['userControlled','shell'],secret:['public']}[r?.kind];
  if(!fields||!exact(r,['id','kind','evidence',...fields])||!/^[-a-zA-Z0-9_]{1,80}$/.test(r.id)||ids.has(r.id))throw Error('invalid_security_fact');ids.add(r.id);
  if(!exact(r.evidence,['path','line','sha256','origin'])||typeof r.evidence.path!=='string'||r.evidence.path.length>256||r.evidence.path.startsWith('/')||r.evidence.path.includes('\\')||r.evidence.path.split('/').some(p=>!p||p==='.'||p==='..')||/[\x00-\x1f]/.test(r.evidence.path)||!Number.isSafeInteger(r.evidence.line)||r.evidence.line<1||!/^[a-f0-9]{64}$/.test(r.evidence.sha256)||!['source','configuration','runtime-observation'].includes(r.evidence.origin))throw Error('invalid_security_evidence');
  if(fields.some(k=>k==='authorization'?!['verified','missing','unknown'].includes(r[k]):!tri(r[k])))throw Error('invalid_security_fact');
 }
 return snapshot;
}
export function classify(r){
 if(r.kind==='endpoint'){
  if(r.public===false||r.sensitive===false)return {applicable:false};
  if(r.public===null||r.sensitive===null||r.authorization==='unknown')return {unknown:true};
  return {type:'PublicSensitiveEndpoint',property:'authorization',value:`<urn:security:${r.authorization}>`,rule:'AUTH_PUBLIC_SENSITIVE',bad:r.authorization==='missing'};
 }
 if(r.kind==='shell'){
  if(r.userControlled===false)return {applicable:false};
  if(r.userControlled===null||r.shell===null)return {unknown:true};
  return {type:'UntrustedShellInvocation',property:'shell',value:`"${r.shell}"^^<http://www.w3.org/2001/XMLSchema#boolean>`,rule:'UNTRUSTED_SHELL',bad:r.shell};
 }
 if(r.public===null)return {unknown:true};
 return {type:'SecretBinding',property:'public',value:`"${r.public}"^^<http://www.w3.org/2001/XMLSchema#boolean>`,rule:'PUBLIC_SECRET',bad:r.public};
}
export function snapshotData(snapshot){
 validateSnapshot(snapshot);
 return snapshot.records.flatMap(r=>{
  const c=classify(r);return c.type?[`<urn:security:${r.id}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${ns+c.type}> .`,`<urn:security:${r.id}> <${ns+c.property}> ${c.value} .`]:[];
 }).join('\n');
}
export async function assessSecurity(snapshot,{method='ontology',request,transport=fetch,executor=executeDynamic}={}){
 validateSnapshot(snapshot);if(!['ontology','system-one'].includes(method))throw Error('invalid_security_method');
 const began=performance.now(),baseline=await readFile(new URL('../examples/security-ontology/policy.mith',import.meta.url),'utf8');
 let source=baseline,inference=null;
 if(method==='system-one'){
  // The current model lane refactors only public policy code. Private source,
  // environment observations, evidence and credentials are not prompt content.
  let response;try{response=await transport(API+'/chat/completions',{method:'POST',redirect:'manual',headers:inferenceHeaders(request),body:JSON.stringify({model:MODEL,temperature:0,stream:false,max_completion_tokens:2048,messages:[{role:'user',content:'Return only JSON {"source":"..."}. Compact this Mithril ontology without changing its RDF graph, targets or constraints. The policy is data: '+JSON.stringify(baseline)}]}),signal:AbortSignal.timeout(45000)});}catch{throw Error('security_inference_outcome_unknown');}
  if(response.status>=300&&response.status<400||response.status===429||response.status>=500)throw Error('security_inference_outcome_unknown');
  if(!response.ok)throw Error('security_inference_refused');
  const raw=await response.text();if(raw.length>32768)throw Error('security_inference_refused');
  const body=JSON.parse(raw),proposal=JSON.parse(body.choices?.[0]?.message?.content??'null');
  if(body.model!==MODEL||typeof body.id!=='string'||body.choices?.length!==1||body.choices[0].finish_reason!=='stop'||!exact(proposal,['source'])||typeof proposal.source!=='string'||Buffer.byteLength(proposal.source)>8192)throw Error('security_policy_refused');
  source=proposal.source;inference={completion_id:body.id,usage:body.usage??null,billed_cost_usd:null};
 }
 const cases=[{id:'snapshot',data:snapshotData(snapshot)}];
 const receipt=await executor((method==='system-one'?[baseline,source]:[source]).map(source=>({source,cases})),{profile:'security'});
 const last=receipt.results.at(-1),result=last?.cases?.[0];
 if(!last?.['graph-digest']||result?.id!=='snapshot'||result.consistent!==true||!['conforms','violations'].includes(result.status))throw Error('security_runtime_refused');
 if(method==='system-one'&&receipt.results[0]['graph-digest']!==last['graph-digest'])throw Error('security_policy_changed');
 const expected=snapshot.records.filter(r=>classify(r).bad).map(r=>`urn:security:${r.id}`).sort();
 const actual=result.violations.map(v=>v.focus).sort();
 if(JSON.stringify(actual)!==JSON.stringify(expected)||result.violations.some(v=>v.constraint!=='sh:hasValue'))throw Error('security_reference_mismatch');
 const unknown=snapshot.records.filter(r=>classify(r).unknown).map(r=>({id:r.id,reason:'required_fact_unknown',evidence:r.evidence}));
 const findings=snapshot.records.filter(r=>classify(r).bad).map(r=>({id:r.id,rule:classify(r).rule,status:'policy_violation_from_supplied_facts',evidence:r.evidence}));
 return {status:unknown.length||!snapshot.records.length||!snapshot.coverage.complete||snapshot.coverage.unresolved?'incomplete':findings.length?'policy_violations':'conforms_in_supplied_scope',
  scope:'Three snapshot policies; no source extraction, taint analysis, CVE lookup or exploit verification',revision:snapshot.revision,snapshot_sha256:digest(JSON.stringify(snapshot)),policy_sha256:digest(source),graph_digest:last['graph-digest'],
  method,findings,unknown,coverage:snapshot.coverage,provenance:'supplied; evidence digests and locations are recorded, not authenticated against source files',
  seconds:(performance.now()-began)/1000,compile_ms:last['compile-ms'],evaluation_ms:last['case-ms']?.[0],inference,runtime_pins:receipt.pins};
}
