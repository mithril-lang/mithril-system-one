import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {matchDependencyQueries} from './dependency-engine.mjs';
import {executeDynamic} from './mithril-dynamic.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
const cvePattern=/^CVE-\d{4}-\d{4,}$/;
const instant=s=>{const m=typeof s==='string'&&/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(s);return m&&Number.isFinite(Date.parse(s))?{value:m[1]+'.'+(m[2]??'').padEnd(9,'0'),precision:Math.max(6,(m[2]??'').length)}:null;};
// OSV batch timestamps truncate detail nanoseconds to microseconds. Pin the
// detailed bytes and compare at the batch's published timestamp precision.
const sameRevision=(summary,detail)=>{const a=instant(summary),b=instant(detail);return !!a&&!!b&&a.value.slice(0,20+a.precision)===b.value.slice(0,20+a.precision);};
const idPattern=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,119}$/;
const ns='https://mithril.fund/dependency/v1#';
export function extractLockedDependencies(files){
 if(!Array.isArray(files)||files.length>20||files.reduce((n,f)=>n+(typeof f?.text==='string'?Buffer.byteLength(f.text):0),0)>2097152)throw Error('dependency_file_budget');
 const components=[],gaps=[],seen=new Map();
 for(const file of files){
  if(!object(file)||typeof file.path!=='string'||file.path.length>256||file.path.split('/').some(p=>!p||p==='.'||p==='..')||file.path.includes('\\')||/[\x00-\x1f]/.test(file.path)||typeof file.text!=='string'||Buffer.byteLength(file.text)>1048576||file.sha256!==hash(file.text))throw Error('dependency_evidence_refused');
  if(!/(^|\/)package-lock\.json$/.test(file.path)){gaps.push({path:file.path,reason:'unsupported_inventory_format'});continue;}
  let lock;try{lock=JSON.parse(file.text);}catch{gaps.push({path:file.path,reason:'invalid_lockfile'});continue;}
  if(!object(lock)||![2,3].includes(lock.lockfileVersion)||!object(lock.packages)||Object.keys(lock.packages).length>2000){gaps.push({path:file.path,reason:'unsupported_lockfile_schema'});continue;}
  for(const [path,p] of Object.entries(lock.packages)){
   if(path==='')continue;
   const match=/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(path);
   if(!match||!object(p)||p.link===true){gaps.push({path:file.path,pointer:'/packages/'+path,reason:'unresolved_workspace_or_link'});continue;}
   const name=p.name??match[1],version=p.version;
   if(typeof name!=='string'||! /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name)||typeof version!=='string'||version.length>128||!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)){gaps.push({path:file.path,pointer:'/packages/'+path,reason:'package_identity_or_version_unknown'});continue;}
   const evidence={path:file.path,pointer:'/packages/'+path,sha256:file.sha256};
   const key=name+'@'+version;
   if(seen.has(key)){seen.get(key).evidence.push(evidence);continue;}
   if(components.length>=100){gaps.push({path:file.path,reason:'component_budget'});continue;}
   const component={id:hash(key).slice(0,24),name,version,ecosystem:'npm',purl:'pkg:npm/'+(name.startsWith('@')?'%40'+name.slice(1):name)+'@'+version,dev:p.dev===true,evidence:[evidence]};seen.set(key,component);components.push(component);
  }
 }
 if(!files.length)gaps.push({reason:'dependency_inventory_absent'});
 if(!components.length)gaps.push({reason:'no_supported_locked_components'});
 return {components,gaps,scope:'npm package-lock v2/v3 only; no target installation or execution'};
}
async function requestJson(transport,url,{body,limit=1048576}={}){
 const response=await transport(url,{method:body?'POST':'GET',redirect:'error',headers:{Accept:'application/json','User-Agent':'Mithril-Dependency-Review/0.1',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Object.assign(Error('feed_http_error'),{status:response.status});
 if(response.url&&response.url!==url)throw Error('feed_redirect_refused');
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('feed_response_budget');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks),value=JSON.parse(bytes.toString('utf8'));
 return {value,receipt:{url,sha256:hash(bytes),bytes:size,observed_at:new Date().toISOString()}};
}
export async function queryOsv(components,{transport=fetch}={}){
 if(components.length>100)throw Error('component_budget');
 if(!components.length)return {queries:[],gaps:[],receipts:[]};
 const gaps=[],receipts=[],queries=components.map(component=>({component,records:[],complete:true}));
 let batch;
 try{
  const r=await requestJson(transport,'https://api.osv.dev/v1/querybatch',{body:{queries:components.map(c=>({package:{name:c.name,ecosystem:'npm'},version:c.version}))}});receipts.push(r.receipt);batch=r.value;
  if(!Array.isArray(batch.results)||batch.results.length!==components.length)throw Error('osv_batch_invalid');
 }catch(e){return {queries:queries.map(q=>({...q,complete:false})),gaps:[{reason:'osv_query_unavailable',http_status:e.status??null}],receipts};}
 const cache=new Map();
 for(const [i,result] of batch.results.entries()){
  if(!object(result)||result.error||Object.keys(result).some(k=>k!=='vulns')||result.vulns!==undefined&&!Array.isArray(result.vulns)){queries[i].complete=false;gaps.push({component:components[i].id,reason:'osv_result_unknown'});continue;}
  for(const summary of result.vulns??[]){
   if(!object(summary)||!idPattern.test(summary.id??'')||typeof summary.modified!=='string'){queries[i].complete=false;gaps.push({component:components[i].id,reason:'osv_summary_invalid'});continue;}
   if(!cache.has(summary.id)){
    if(cache.size>=40){queries[i].complete=false;gaps.push({component:components[i].id,reason:'advisory_detail_budget'});continue;}
    try{
     const r=await requestJson(transport,'https://api.osv.dev/v1/vulns/'+encodeURIComponent(summary.id),{limit:262144});
     receipts.push(r.receipt);
     if(r.value.id!==summary.id||typeof r.value.modified!=='string'||!r.value.withdrawn&&(!Array.isArray(r.value.affected)||!r.value.affected.length))throw Error('osv_detail_invalid');
     cache.set(summary.id,r.value);
    }catch(e){cache.set(summary.id,null);gaps.push({advisory:summary.id,reason:'osv_detail_unavailable',http_status:e.status??null});}
   }
   const record=cache.get(summary.id);
   if(!record||!sameRevision(summary.modified,record.modified)||!record.withdrawn&&!record.affected.some(a=>a.package?.ecosystem==='npm'&&a.package?.name===components[i].name)){queries[i].complete=false;gaps.push({component:components[i].id,advisory:summary.id,reason:'osv_detail_incomplete_or_changed'});continue;}
   queries[i].records.push(record);
  }
 }
 return {queries,gaps,receipts};
}
export async function enrichKnowledge(cves,{transport=fetch}={}){
 const entries={},gaps=[],receipts=[];
 for(const cve of cves)entries[cve]={kev:null,epss:null,nvd:null};
 try{
  const r=await requestJson(transport,'https://knowledge.mithril.fund/index.json');receipts.push(r.receipt);
  if(!object(r.value.datasets)||['nvd','kev','epss'].some(k=>r.value.datasets[k]?.queryReady!==true))throw Error('knowledge_snapshot_unready');
  const descriptors=Object.fromEntries(['nvd','kev','epss'].map(k=>[k,hash(JSON.stringify(r.value.datasets[k]))]));
  for(const cve of cves.slice(0,20)){
   if(!cvePattern.test(cve))throw Error('invalid_cve');
   for(const dataset of ['nvd','kev','epss']){
    try{
     const r=await requestJson(transport,'https://knowledge.mithril.fund/api/knowledge/search?dataset='+dataset+'&cve='+cve);
     receipts.push(r.receipt);const record=r.value.record;
     if(r.value.dataset!==dataset||!object(record)||(dataset==='kev'?record.cveID:dataset==='nvd'?record.id:record.cve)!==cve)throw Error('knowledge_record_mismatch');
     if(dataset==='epss'){if(!Number.isFinite(Number(record.epss))||Number(record.epss)<0||Number(record.epss)>1||typeof record.date!=='string')throw Error('epss_invalid');entries[cve].epss={score:Number(record.epss),date:record.date};}
     else entries[cve][dataset]=dataset==='kev'?true:{id:record.id};
    }catch(e){if(dataset==='kev'&&e.status===404)entries[cve].kev=false;else gaps.push({cve,dataset,reason:'knowledge_record_unavailable',http_status:e.status??null});}
   }
  }
  if(cves.length>20)gaps.push({reason:'knowledge_cve_budget'});
  // Prevent a changed catalog from making earlier negative membership current.
  const end=await requestJson(transport,'https://knowledge.mithril.fund/index.json');receipts.push(end.receipt);
  if(['nvd','kev','epss'].some(k=>hash(JSON.stringify(end.value.datasets?.[k]))!==descriptors[k]))throw Error('knowledge_snapshot_changed');
  return {status:gaps.length?'partial':'available',entries,gaps,receipts};
 }catch(e){return {status:'unavailable',entries:Object.fromEntries(cves.map(c=>[c,{kev:null,epss:null,nvd:null}])),gaps:[...gaps,{reason:'knowledge_unavailable_or_stale',http_status:e.status??null}],receipts};}
}
export async function assessDependencies(files,{transport=fetch,matcher=matchDependencyQueries,executor=executeDynamic}={}){
 const started=performance.now(),inventory=extractLockedDependencies(files),osv=await queryOsv(inventory.components,{transport});
 let matched;
 const successful=osv.queries.filter(q=>q.records.length||q.complete);
 try{matched=successful.length?await matcher(successful.map(q=>({component:{name:q.component.name,version:q.component.version,ecosystem:'npm'},records:q.records.map(r=>r.withdrawn?r:{...r,affected:r.affected.filter(a=>a.package?.ecosystem==='npm'&&a.package?.name===q.component.name)})}))):{pin:null,results:[]};}
 catch{matched={pin:null,results:[]};inventory.gaps.push({reason:'matching_engine_unavailable'});}
 const candidates=[],unknown=[];
 for(const [i,result] of matched.results.entries()){
  const q=successful[i];if(!q||result.component?.name!==q.component.name||result.component?.version!==q.component.version||!object(result.evaluation))throw Error('dependency_result_mismatch');
  const evaluation=result.evaluation;
  if(result.problems?.length||evaluation['advisory/undecided']?.length||evaluation['advisory/unorderable']?.length||evaluation['advisory/decided?']!==true)unknown.push({component:q.component.id,reason:'unorderable_or_unsupported_advisory',details:result.problems??[]});
  for(const f of evaluation['advisory/findings']??[]){
   const record=q.records.find(r=>r.id===f['advisory/id']);if(!record||f['match/verdict']!=='affected'||f['package/name']!==q.component.name||f['package/version']!==q.component.version||f['package/ecosystem']!=='npm')throw Error('dependency_result_mismatch');
   const cves=[record.id,...(record.aliases??[])].filter(x=>typeof x==='string'&&cvePattern.test(x));
   candidates.push({id:hash(q.component.id+record.id).slice(0,24),component:q.component,advisory:record.id,cves:[...new Set(cves)],severity:f['advisory/severity'],fixed_versions:f['advisory/fixed-in'],status:'affected_version_candidate_requires_review',feed_sha256:hash(JSON.stringify(record)),feed_modified:record.modified});
  }
 }
 if(matched.results.length!==successful.length)unknown.push({reason:'matching_engine_incomplete'});
 const cves=[...new Set(candidates.flatMap(c=>c.cves))],knowledge=await enrichKnowledge(cves,{transport});
 for(const c of candidates){c.knowledge=c.cves.map(id=>({cve:id,...knowledge.entries[id]}));c.priority=c.knowledge.some(x=>x.kev===true)?'known_exploited':c.knowledge.some(x=>x.epss?.score>=0.1)?'elevated_epss':c.severity==='critical'||c.severity==='high'?'high':'review';}
 const triple=(s,p,o)=>`<${s}> <${p}> ${o} .`,literal=x=>JSON.stringify(String(x));
 const data=[triple('urn:dependency:assessment',ns+'inventoryObserved',literal(files.length>0)),triple('urn:dependency:assessment',ns+'coverageComplete',literal(false))];
 for(const c of inventory.components){const s='urn:dependency:package:'+c.id;data.push(triple(s,ns+'name',literal(c.name)),triple(s,ns+'version',literal(c.version)),triple(s,ns+'purl',literal(c.purl)));for(const e of c.evidence)data.push(triple(s,ns+'evidenceDigest',literal(e.sha256)));}
 for(const c of candidates){const s='urn:dependency:finding:'+c.id;data.push(triple(s,'http://www.w3.org/1999/02/22-rdf-syntax-ns#type','<'+ns+(c.priority==='known_exploited'?'KnownExploitedDependency':'AffectedDependency')+'>'),triple(s,ns+'remediated','"false"^^<http://www.w3.org/2001/XMLSchema#boolean>'),triple(s,ns+'component','<urn:dependency:package:'+c.component.id+'>'),triple(s,ns+'advisory',literal(c.advisory)),triple(s,ns+'feedDigest',literal(c.feed_sha256)));for(const cve of c.cves)data.push(triple(s,ns+'cve',literal(cve)));}
 for(const [cve,entry] of Object.entries(knowledge.entries)){const s='urn:dependency:cve:'+cve;if(entry.kev!==null)data.push(triple(s,ns+'knownExploited','"'+entry.kev+'"^^<http://www.w3.org/2001/XMLSchema#boolean>'));if(entry.epss){data.push(triple(s,ns+'epss','"'+entry.epss.score+'"^^<http://www.w3.org/2001/XMLSchema#double>'),triple(s,ns+'epssDate',literal(entry.epss.date)));}}
 const source=await readFile(new URL('../examples/dependency-ontology/policy.mith',import.meta.url),'utf8');
 const receipt=await executor([{source,cases:[{id:'dependencies',data:data.join('\n')}]}],{profile:'security'}),r=receipt.results[0],result=r?.cases?.[0];
 if(!r?.['graph-digest']||result?.consistent!==true||result?.id!=='dependencies'||!['conforms','violations'].includes(result.status)||JSON.stringify(result.violations.map(v=>v.focus).sort())!==JSON.stringify(candidates.map(c=>'urn:dependency:finding:'+c.id).sort())||result.violations.some(v=>v.constraint!=='sh:hasValue'))throw Error('dependency_ontology_mismatch');
 return {status:'review_incomplete',scope:inventory.scope+'; known affected versions are candidates, not reachable-exploit proof; no automatic upgrades',inventory,findings:candidates,unknown:[...inventory.gaps,...osv.gaps,...unknown,...knowledge.gaps],knowledge,ontology:{source,data:data.join('\n'),policy_sha256:hash(source),data_sha256:hash(data.join('\n')),graph_digest:r['graph-digest'],violations:result.violations},receipts:{osv:osv.receipts,matching_engine:matched.pin,mithril:receipt.pins},execution:{target_code_executed:false,inference_calls:0},seconds:(performance.now()-started)/1000};
}
