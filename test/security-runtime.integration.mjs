import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assessSecurity,snapshotData} from '../lib/security-ontology.mjs';
import {executeDynamic} from '../lib/mithril-dynamic.mjs';
import {MODEL} from '../lib/inference.mjs';
const original=JSON.parse(await readFile(new URL('../examples/security-ontology/snapshot.json',import.meta.url),'utf8'));
const fixed=()=>{const s=structuredClone(original);s.coverage.complete=true;s.records[0].authorization='verified';s.records[1].shell=false;s.records[2].public=false;return s;};
test('actual Mithril compiler checks policy violations, repair, unknowns and incomplete extraction',async()=>{
 const bad=await assessSecurity(original);assert.deepEqual(bad.findings.map(f=>f.rule),['AUTH_PUBLIC_SENSITIVE','UNTRUSTED_SHELL','PUBLIC_SECRET']);assert.equal(bad.status,'incomplete');
 const repaired=await assessSecurity(fixed());assert.equal(repaired.status,'conforms_in_supplied_scope');assert.deepEqual(repaired.findings,[]);
 const unknown=fixed();unknown.records[0].authorization='unknown';const u=await assessSecurity(unknown);assert.equal(u.status,'incomplete');assert.deepEqual(u.unknown.map(x=>x.id),['admin-api']);
 const unresolved=fixed();unresolved.coverage.unresolved=1;assert.equal((await assessSecurity(unresolved)).status,'incomplete');
});
test('System One lane compiles Mithril and rejects a model policy that weakens a rule',async()=>{
 const source=await readFile(new URL('../examples/security-ontology/policy.mith',import.meta.url),'utf8');
 const request=new Request('https://code.mithril.fund',{headers:{'x-mithril-token':'fixture'}});
 const transport=policy=>async (_url,options)=>{
  assert.ok(!options.body.includes('examples/security-ontology/demo-config.json'),'private evidence never enters model prompt');
  assert.ok(!options.body.includes('admin-api'));
  return Response.json({id:'fixture',model:MODEL,choices:[{finish_reason:'stop',message:{content:JSON.stringify({source:policy})}}]});
 };
 const accepted=await assessSecurity(original,{method:'system-one',request,transport:transport(source)});assert.equal(accepted.findings.length,3);
 await assert.rejects(assessSecurity(original,{method:'system-one',request,transport:transport(source.replace(':sh/has-value false',':sh/has-value true'))}),/policy_changed/);
});
test('compiled policy handles repeated changed inputs without stale violations and records graph-only timings',async()=>{
 const source=await readFile(new URL('../examples/security-ontology/policy.mith',import.meta.url),'utf8');
 const cases=Array.from({length:100},(_,i)=>({id:String(i),data:snapshotData(i%2?fixed():original)}));
 const {results:[r]}=await executeDynamic([{source,cases}],{profile:'security'});
 assert.equal(r.cases.length,100);r.cases.forEach((c,i)=>assert.equal(c.violations.length,i%2?0:3));
 assert.equal(r['case-ms'].length,100);assert.ok(r['compile-ms']>=0);
 console.log(JSON.stringify({benchmark:'security-synthetic-100-three-record-snapshots',compile_ms:r['compile-ms'],mean_graph_evaluation_ms:r['case-ms'].reduce((a,b)=>a+b,0)/100,scope:'No extraction, LLM inference, deployment inventory or exploit checks included'}));
});
