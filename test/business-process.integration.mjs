import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {assessBusinessProcess} from '../lib/business-process.mjs';
const load=name=>readFile(new URL('../examples/business-process/'+name+'.bpmn',import.meta.url),'utf8');
for(const name of ['payment','access','customer-data'])test(name+' actual Mithril before/after',async()=>{
 const before=await assessBusinessProcess(await load(name+'-vulnerable')),after=await assessBusinessProcess(await load(name+'-repaired'));
 assert.deepEqual(before.findings.map(x=>x.rule).sort(),['approval','audited','authorized','separation']);
 assert.equal(before.ontology.violations.length,4);assert.ok(before.findings.find(x=>x.rule==='approval').evidence.bypass_path.includes('merge'));
 assert.equal(after.findings.length,0);assert.equal(after.model_status,'conforms');assert.equal(after.status,'review_incomplete');assert.equal(after.execution.inference_calls,0);
});
test('unknown controls and principals stay gaps',async()=>{
 const xml=(await load('access-repaired')).replace('m:authorized="true"','').replace('m:audited="true"','').replace('m:principal="approver-2"','');
 const r=await assessBusinessProcess(xml);assert.equal(r.findings.length,0);assert.equal(r.gaps.length,4);assert.equal(r.status,'review_incomplete');
});
test('approval for another control cannot authorize this action',async()=>{
 const r=await assessBusinessProcess((await load('payment-repaired')).replace('name="Approve expense" m:operation="approve" m:control="payment"','name="Approve expense" m:operation="approve" m:control="other"'));
 assert.equal(r.findings[0].rule,'approval');
});
test('unsafe or unsupported input refuses before compiler',async()=>{
 const xml=await load('access-repaired');
 for(const bad of ['<!DOCTYPE x>'+xml,xml.replace('exclusiveGateway','parallelGateway'),xml.replace('id="f1"','id="start"'),xml.replace('targetRef="request"','targetRef="absent"'),xml.replace('targetRef="end"','targetRef="request"'),xml.replace('m:authorized="true"','m:authorized="maybe"'),xml.replace('<b:userTask id="approve"','<b:userTask implementation="run" id="approve"')])await assert.rejects(assessBusinessProcess(bad,{executor:()=>{throw Error('compiler_called');}}),/bpmn_import_refused/);
});
test('compiler result mismatch refuses',async()=>{
 await assert.rejects(assessBusinessProcess(await load('access-repaired'),{executor:async()=>({results:[]})}),/bpmn_ontology_mismatch/);
});
test('CLI and MCP evaluate supplied BPMN with real compiler',async()=>{
 const xml=await load('customer-data-vulnerable');
 const run=(entry,input)=>new Promise((ok,no)=>{const p=execFile(process.execPath,[new URL('../bin/'+entry,import.meta.url).pathname,...(entry==='mithril-business-process.mjs'?['--stdin']:[])],{timeout:30000,maxBuffer:2e6},(e,out)=>e?no(e):ok(out));p.stdin.end(input);});
 assert.equal(JSON.parse(await run('mithril-business-process.mjs',JSON.stringify({xml}))).findings.length,4);
 const messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',clientInfo:{name:'test',version:'1'},capabilities:{}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'mithril_business_process_review',arguments:{xml}}}];
 const lines=(await run('mithril-public-mcp.mjs',messages.map(JSON.stringify).join('\n')+'\n')).trim().split('\n').map(JSON.parse);
 assert.equal(lines.at(-1).result.structuredContent.findings.length,4);
});
