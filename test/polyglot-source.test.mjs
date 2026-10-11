import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {extractPolyglotSource,extractSourceOntology,sourceLanguages} from '../lib/polyglot-source.mjs';
import {extractSource,fetchPublicSnapshot} from '../lib/public-code-review.mjs';

import {samples} from '../examples/source-extraction/cases.mjs';
test('missing parser is an explicit incomplete outcome, not a clean security verdict',()=>{
 const r=extractPolyglotSource('a.py',Buffer.from('pass'),{python:'/missing/python'});
 assert.equal(r.parsed,false);assert.equal(r.reason,'parser_runtime_unavailable');assert.equal(r.coverage.complete,false);
 assert.equal(extractPolyglotSource('a.vb',Buffer.from('Module A')) .reason,'unsupported_language');
 assert.equal(extractPolyglotSource('a.constructor',Buffer.from('not code')).reason,'unsupported_language');
 assert.throws(()=>extractSourceOntology({path:'../a.py',source:'pass'}),/unsafe_source_path/);
 assert.throws(()=>extractSourceOntology({path:'a.py',source:'pass',python:'/tmp/evil'}),/invalid_arguments/);
 assert.equal(extractPolyglotSource('a.py',Buffer.from([255])).reason,'invalid_source_encoding');
});
for(const [path,[source,definition,call]] of Object.entries(samples))test('real pinned parser extracts '+path,()=>{
 assert.ok(process.env.MITHRIL_SOURCE_PYTHON,'Configure MITHRIL_SOURCE_PYTHON to run required parser tests');
 const r=extractSource(path,Buffer.from(source));assert.equal(r.parsed,true,JSON.stringify(r));
 assert.ok(r.facts.some(f=>f.kind==='definition'&&f.spelling===definition),JSON.stringify(r.facts));
 assert.ok(r.facts.some(f=>f.kind==='call'&&f.spelling===call),JSON.stringify(r.facts));
 assert.equal(r.receipt.target_code_executed,false);assert.equal(r.receipt.inference_calls,0);
 assert.equal(r.receipt.pins['tree-sitter-language-pack'],'0.13.0');
 assert.equal(r.ontology['@graph'].length,r.facts.length+1);
 assert.ok(r.facts.every(f=>f.evidence.sha256===createHash('sha256').update(source).digest('hex')));
 assert.ok(r.records.every(f=>f.userControlled===null&&f.shell===null));
});
test('comments, strings, invalid syntax and Unicode locations remain honest',()=>{
 const r=extractSource('a.py',Buffer.from('# subprocess.run(user)\nx="subprocess.run(user)"\ndef run():\n pass\n'));
 assert.equal(r.parsed,true);assert.equal(r.records.length,0);assert.ok(!r.facts.some(f=>f.kind==='call'));
 const invalid=extractSource('a.py',Buffer.from('def broken(:\n'));
 assert.equal(invalid.parsed,false);assert.equal(invalid.reason,'unsupported_syntax');assert.deepEqual(invalid.records,[]);
 const unicode=extractSource('a.py',Buffer.from('def café():\n return str("é")\n'));
 assert.equal(unicode.parsed,true);assert.equal(unicode.facts.find(f=>f.kind==='call').line,2);
 assert.equal(unicode.receipt.column_unit,'utf8_bytes');
 assert.equal(sourceLanguages.length,12);
});
test('all twelve frontends refuse malformed syntax without partial facts',()=>{
 for(const path of Object.keys(samples)){
  const r=extractSource(path,Buffer.from(path.endsWith('.php')?'<?php function broken( {':'}'));
  assert.equal(r.parsed,false,path);assert.equal(r.reason,'unsupported_syntax',path);
  assert.deepEqual(r.facts,[]);assert.deepEqual(r.records,[]);
 }
});
test('a shadowed process spelling remains unknown and cannot assert vulnerability',()=>{
 const r=extractSource('a.py',Buffer.from('def run(subprocess, user):\n subprocess.run(user)\n'));
 assert.equal(r.parsed,true);assert.equal(r.records.length,1);
 assert.equal(r.records[0].userControlled,null);assert.equal(r.records[0].shell,null);
 assert.equal(r.observations[0].resolution,'syntactic_only');
});
test('immutable public acquisition includes polyglot facts and checks blob identities',async()=>{
 const commit='a'.repeat(40),tree='b'.repeat(40),source=samples['python.py'][0];
 const blob=createHash('sha1').update(Buffer.from('blob '+Buffer.byteLength(source)+'\0'+source)).digest('hex');
 const transport=async url=>url.includes('/git/commits/')?Response.json({sha:commit,tree:{sha:tree}}):url.includes('/git/trees/')?Response.json({sha:tree,truncated:false,tree:[{path:'a.py',type:'blob',mode:'100644',size:Buffer.byteLength(source),sha:blob}]}):url.includes('raw.githubusercontent.com')?new Response(source):Response.json({full_name:'example/public',private:false,visibility:'public'});
 const r=await fetchPublicSnapshot({repository:'example/public',commit},{transport});
 assert.equal(r.acquisition.parsed_count,1);assert.equal(r.sourceOntologies.length,1);
 assert.equal(r.snapshot.coverage.complete,false);assert.equal(r.snapshot.coverage.unresolved,1);
 assert.equal(r.sourceOntologies[0].receipt.inference_calls,0);
});
test('MCP exposes extraction and returns actual ontology without executing source',()=>{
 const messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',clientInfo:{name:'test',version:'1'},capabilities:{}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'mithril_source_extract',arguments:{path:'a.py',source:samples['python.py'][0]}}}];
 const r=spawnSync(process.execPath,['bin/mithril-mcp.mjs'],{input:messages.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8'});
 assert.equal(r.status,0);const output=JSON.parse(r.stdout.trim().split('\n').at(-1)).result;
 assert.equal(output.isError,false);assert.equal(output.structuredContent.ok,true);assert.ok(output.structuredContent.mithril.includes('Ontology'));
});
