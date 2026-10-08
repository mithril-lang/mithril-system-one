import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {executeDynamic} from './mithril-dynamic.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function assessScap(xml,{executor=executeDynamic}={}){
 if(typeof xml!=='string'||Buffer.byteLength(xml)>1048576)throw Error('scap_input_budget');
 const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const imported=await new Promise((ok,no)=>{const p=execFile('python3',[new URL('../runtime/scap-import.py',import.meta.url).pathname],{env,timeout:15000,maxBuffer:2e6},(e,out)=>{try{if(e)throw e;ok(JSON.parse(out));}catch{no(Error('scap_import_refused'));}});p.stdin.on('error',()=>no(Error('scap_import_refused')));p.stdin.end(JSON.stringify({xml}));});
 if(imported.sha256!==hash(xml))throw Error('scap_evidence_mismatch');
 const ns='https://mithril.fund/scap/v1#',type='http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
 const data=[`<urn:scap:assessment> <${ns}evidenceDigest> ${JSON.stringify(imported.sha256)} .`];
 const failures=[];
 for(const r of imported.records){const id='urn:scap:result:'+hash(r.kind+':'+r.id);r.focus=id;data.push(`<${id}> <${ns}result> ${JSON.stringify(r.result)} .`,`<${id}> <${ns}evidenceDigest> ${JSON.stringify(imported.sha256)} .`);if(r.failure){failures.push(id);data.push(`<${id}> <${type}> <${ns}FailedControl> .`,`<${id}> <${ns}remediated> "false"^^<http://www.w3.org/2001/XMLSchema#boolean> .`);}}
 const source=await readFile(new URL('../examples/scap/policy.mith',import.meta.url),'utf8');
 const receipt=await executor([{source,cases:[{id:'scap',data:data.join('\n')}]}],{profile:'security'}),r=receipt.results[0],v=r?.cases?.[0];
 if(!r?.['graph-digest']||v?.consistent!==true||v.id!=='scap'||!['conforms','violations'].includes(v.status)||JSON.stringify(v.violations.map(x=>x.focus).sort())!==JSON.stringify(failures.sort())||v.violations.some(x=>x.constraint!=='sh:hasValue'))throw Error('scap_ontology_mismatch');
 return {status:'review_incomplete',...imported,ontology:{source,data:data.join('\n'),policy_sha256:hash(source),graph_digest:r['graph-digest'],violations:v.violations},execution:{host_probes:false,fixes_executed:false,inference_calls:0},pins:receipt.pins};
}
