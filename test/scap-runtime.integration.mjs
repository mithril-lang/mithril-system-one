import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {assessScap} from '../lib/scap-assessment.mjs';
const xml=await readFile(new URL('../examples/scap/results.xml',import.meta.url),'utf8');
test('actual Mithril evaluates failed OVAL/XCCDF and retains unknown',async()=>{const r=await assessScap(xml);assert.equal(r.ontology.violations.length,2);assert.equal(r.gaps.length,1);assert.equal(r.execution.host_probes,false);assert.equal(r.execution.inference_calls,0);});
test('unknown-only result never claims complete or remedied',async()=>{const r=await assessScap(xml.replace('result="true"','result="unknown"').replace('<x:result>fail</x:result>','<x:result>unknown</x:result>'));assert.equal(r.ontology.violations.length,0);assert.equal(r.status,'review_incomplete');assert.equal(r.gaps.length,3);});
test('host/entity import refuses before executor',async()=>{await assert.rejects(assessScap('<!DOCTYPE x>'+xml,{executor:()=>{throw Error('must not run');}}),/scap_import_refused/);});
test('MCP dispatches SCAP to real compiler and advertises isolated upgrade effect',async()=>{
 const {execFile}=await import('node:child_process');
 const messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',clientInfo:{name:'qualification',version:'1'},capabilities:{}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'mithril_scap_review',arguments:{xml}}}];
 const out=await new Promise((ok,no)=>{const p=execFile(process.execPath,[new URL('../bin/mithril-public-mcp.mjs',import.meta.url).pathname],{timeout:30000,maxBuffer:2000000},(e,out)=>e?no(e):ok(out));p.stdin.end(messages.map(m=>JSON.stringify(m)).join('\n')+'\n');});
 const r=out.trim().split('\n').map(x=>JSON.parse(x));assert.equal(r[1].result.tools.length,3);assert.equal(r[1].result.tools.find(t=>t.name==='mithril_dependency_upgrade').annotations.readOnlyHint,false);assert.equal(r[2].result.structuredContent.ontology.violations.length,2);
});
