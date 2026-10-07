import test from 'node:test';import assert from 'node:assert/strict';import {assemble,generate,MODEL,API} from '../lib/inference.mjs';
import {bodies,completion} from './fixtures/mithril-completion.mjs';
test('typed proposal is independently checked, emitted deterministically and records actual Mithril identity',async()=>{const result=await generate('Todo',new Request('https://code.mithril.fund',{headers:{'x-mithril-token':'mithril-token',authorization:'Bearer github-token'}}),async(url,init)=>{assert.equal(url,API+'/chat/completions');assert.equal(init.headers.authorization,'Bearer mithril-token');assert.ok(!JSON.stringify(init).includes('github-token'));return completion();});assert.equal(result.verified_state_vectors,511);assert.equal(result.metrics['jev-controller-used'],false);assert.equal(result.metrics.cost['api-amount'],null);assert.match(result.files['src/todo/summary.cljk'],/\(count \(filterv todo.interaction\/toggle states\)\)/);});
test('wrong semantics, extra keys, code injection, recursive calls and excessive depth cannot become verified source',()=>{for(const value of [{...bodies,toggle:{kind:'argument','argument-index':0}},{...bodies,remaining:{kind:'operation',id:'count-vector-bool',children:[{kind:'argument','argument-index':0}]}},{...bodies,toggle:{...bodies.toggle,source:'evil'}},{...bodies,remaining:{kind:'reference','function-ref':'remaining'}},{...bodies,toggle:{kind:'operation',id:'eval',children:[]}}])assert.throws(()=>assemble(value));let deep=bodies.toggle;for(let n=0;n<10;n++)deep={kind:'operation',id:'if-:bool',children:[deep,{kind:'literal',value:false},{kind:'literal',value:true}]};assert.throws(()=>assemble({...bodies,toggle:deep}));});
test('upstream failure never retries, substitutes templates or echoes credentials',async()=>{let calls=0;await assert.rejects(generate('Todo',new Request('https://code.mithril.fund',{headers:{'x-mithril-token':'secret'}}),async()=>{calls++;return Response.json({error:'secret'},{status:429});}),/mithril_inference_429/);assert.equal(calls,1);});

test('failed proposal has a bounded caller receipt, without credentials or a verified fallback',async()=>{
 const value=await completion().json();value.choices[0].message.content='```json\n'+JSON.stringify(bodies)+'\n```';
 await assert.rejects(generate('Todo',new Request('https://code.mithril.fund',{headers:{cookie:'session-secret','x-mithril-token':'token-secret'}}),async()=>Response.json(value)),e=>{
  assert.equal(e.code,'harness_verification_failed');assert.equal(e.receipt.validation_stage,'json');
  assert.match(e.receipt.proposal,/^```json/);assert.doesNotMatch(JSON.stringify(e.receipt),/session-secret|token-secret/);return true;
 });
});

test('task states callable predicate grammar in both token and server-owned session contexts',async()=>{
 for(const headers of [{'x-mithril-token':'test'}, {cookie:'session'}])await generate('Todo',new Request('https://code.mithril.fund',{headers}),async(_,init)=>{
  const text=JSON.parse(init.body).messages.map(m=>m.content).join('\n');
  assert.match(text,/predicate := reference\(toggle\)/);assert.match(text,/NEVER a bool value or a condition/);
  assert.match(text,/In remaining, if-:bool and literal nodes are forbidden everywhere/);return completion();
 });
 // Real rejected output placed a conditional expression where a callable was required.
 assert.throws(()=>assemble({...bodies,remaining:{kind:'operation',id:'count-vector-bool',children:[{kind:'operation',id:'filter-vector-bool',children:[{kind:'operation',id:'if-:bool',children:[{kind:'reference','function-ref':'toggle'},{kind:'literal',value:true},{kind:'literal',value:false}]},{kind:'argument','argument-index':0}]}]}}));
});
