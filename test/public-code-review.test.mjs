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
test('AST extractor keeps direct CLI inputs, unknown flows and shadowed imports distinct',()=>{
 const r=extractSource('src/main.mjs',Buffer.from(source));assert.equal(r.records.length,2);assert.equal(r.records[0].userControlled,true);assert.equal(r.records[1].userControlled,null);assert.equal(r.records[0].shell,true);assert.equal(r.records[0].evidence.line,2);
 const shadow=extractSource('a.js',Buffer.from(source+'function f(run) { run(process.argv[2]); }'));
 assert.ok(shadow.records.every(r=>r.userControlled===null));
 const processShadow=extractSource('a.js',Buffer.from(source+'const process = {};'));
 assert.ok(processShadow.records.every(r=>r.userControlled===null));
 const spread=extractSource('a.js',Buffer.from("import {spawn} from 'child_process';spawn(process.argv[2],[],{shell:true,...opts});"));assert.equal(spread.records[0].shell,null);
 assert.equal(extractSource('a.js',Buffer.from('not valid JS {}')).parsed,false);
 assert.equal(extractSource('a.js',Buffer.from('// exec(process.argv[2])')).records.length,0);
});
test('public acquisition verifies visibility, immutable commit and each blob without executing source',async()=>{
 const r=await fetchPublicSnapshot({repository:'example/public',commit},{transport:fixture()});assert.equal(r.acquisition.excluded_count,1);assert.equal(r.snapshot.coverage.complete,false);assert.equal(r.snapshot.coverage.unresolved,1);
 for(const options of [{privateRepo:true},{badHash:true},{truncated:true}])await assert.rejects(fetchPublicSnapshot({repository:'example/public',commit},{transport:fixture(options)}));
 for(const x of [{repository:'../private',commit},{repository:'example/public',commit:'main'},{repository:'example/public',commit,command:'ls'}])assert.throws(()=>validateTarget(x));
});

test('MCP native handshake lists the review tool and refuses unsupported arguments',async()=>{
 const {spawnSync}=await import('node:child_process');
 const msgs=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'mithril_public_repo_review',arguments:{repository:'../private',commit:'main'}}}];
 const r=spawnSync(process.execPath,['bin/mithril-public-mcp.mjs'],{cwd:new URL('..',import.meta.url),input:msgs.map(JSON.stringify).join('\n')+'\n',encoding:'utf8',timeout:5000});assert.equal(r.status,0);const out=r.stdout.trim().split('\n').map(x=>JSON.parse(x));assert.equal(out[0].result.protocolVersion,'2025-06-18');assert.equal(out[1].result.tools[0].name,'mithril_public_repo_review');assert.equal(out[2].result.isError,true);
});
