import test from 'node:test';
import assert from 'node:assert/strict';
import {validateSnapshot,snapshotData,assessSecurity} from '../lib/security-ontology.mjs';
const evidence={path:'src/service.mith',line:1,sha256:'a'.repeat(64),origin:'source'};
const snapshot=()=>({schemaVersion:1,revision:'a'.repeat(40),coverage:{complete:true,unresolved:0},records:[{id:'route',kind:'endpoint',public:true,sensitive:true,authorization:'missing',evidence:structuredClone(evidence)}]});
test('reject malformed or unbounded facts and invented source locations before execution',async()=>{
 for(const change of [s=>s.records[0].evidence.path='../key',s=>s.records[0].evidence.line=0,s=>s.records[0].authorization='approved-by-model',s=>s.records[0].public='true',s=>s.records.push(s.records[0]),s=>s.command='run',s=>s.records[0].rawSecret='forbidden',s=>s.coverage.unresolved=-1]){
  const s=snapshot();change(s);let calls=0;
  await assert.rejects(assessSecurity(s,{executor:()=>{calls++;}}));assert.equal(calls,0);
 }
 assert.throws(()=>validateSnapshot({...snapshot(),records:Array(1001).fill(snapshot().records[0])}));
});
test('unknown facts never become graph evidence of a missing authorization',()=>{
 const s=snapshot();s.records[0].authorization='unknown';assert.equal(snapshotData(s),'');
});
test('inference transport uncertainty stops after one attempt and does not evaluate',async()=>{
 let calls=0,runtime=0;
 await assert.rejects(assessSecurity(snapshot(),{method:'system-one',request:new Request('https://code.mithril.fund',{headers:{'x-mithril-token':'fixture'}}),transport:async()=>{calls++;return new Response('',{status:503});},executor:()=>{runtime++;}}),/outcome_unknown/);
 assert.equal(calls,1);assert.equal(runtime,0);
});
