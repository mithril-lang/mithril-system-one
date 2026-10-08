import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {extractSource,fetchPublicSnapshot,validateTarget,reviewPublicRepository} from '../lib/public-code-review.mjs';
const commit='a'.repeat(40),tree='b'.repeat(40);
const source="import {exec as run} from 'node:child_process';\nrun(process.argv[2]);\nrun(command);\n";
const blob=s=>createHash('sha1').update(Buffer.from('blob '+Buffer.byteLength(s)+'\0')).update(s).digest('hex');
function fixture({privateRepo=false,badHash=false,truncated=false}={}){
 return async(url,options)=>{
  assert.equal(options.redirect,'error');assert.ok(!('Authorization' in options.headers));
  if(url.endsWith('/git/commits/'+commit))return Response.json({sha:commit,tree:{sha:tree}});
  if(url.includes('/git/trees/'))return Response.json({sha:tree,truncated,tree:[{path:'src/main.mjs',type:'blob',mode:'100644',size:Buffer.byteLength(source),sha:badHash?'c'.repeat(40):blob(source)},{path:'package.json',type:'blob',mode:'100644',size:2,sha:blob('{}')}]});
  if(url.includes('raw.githubusercontent.com'))return new Response(source);
  return Response.json({full_name:'example/public',private:privateRepo,visibility:privateRepo?'private':'public'});
 };
}
test('actual Mithril policy evaluates extracted public source and preserves incomplete scope',async()=>{
 const r=await reviewPublicRepository({repository:'example/public',commit},{transport:fixture()});assert.equal(r.ok,true);assert.equal(r.status,'review_incomplete');assert.equal(r.assessment.findings.length,1);assert.equal(r.assessment.findings[0].status,'source_policy_candidate_requires_review');assert.equal(r.execution.target_code_executed,false);assert.equal(r.assessment.unknown.length,1);assert.ok(r.assessment.graph_digest);
});

test('all-unknown and empty extracted facts produce actual compiler receipts, never clean status',async()=>{
 const {assessSecurity}=await import('../lib/security-ontology.mjs');
 for(const records of [[],[{id:'unknown',kind:'shell',userControlled:null,shell:true,evidence:{path:'a.js',line:1,sha256:'a'.repeat(64),origin:'source'}}]]){const r=await assessSecurity({schemaVersion:1,revision:commit,records,coverage:{complete:false,unresolved:records.length}});assert.equal(r.status,'incomplete');assert.equal(r.findings.length,0);assert.ok(r.graph_digest);}
});
