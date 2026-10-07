import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCore} from '../core.js';
const json = name => JSON.parse(readFileSync(new URL('../'+name,import.meta.url)));
const core = createCore(json('logic.json'));
test('generated toggle and all 511 completion vectors length 0–8', () => {
 assert.equal(core.toggle(false),true); assert.equal(core.toggle(true),false);
 let cases=0;
 for(let n=0;n<=8;n++) for(let bits=0;bits<2**n;bits++) {
  const states=Array.from({length:n},(_,i)=>Boolean(bits & 2**i));
  assert.equal(core.remaining(states),states.filter(x=>!x).length); cases++;
 }
 assert.equal(cases,511);
});
test('rejects malformed completion inputs', () => {
 for(const input of [null,0,'false',[],{}]) assert.throws(()=>core.toggle(input));
 for(const input of [null,false,[1],[false,null],{}]) assert.throws(()=>core.remaining(input));
});
test('standalone runtime assets and policy digest match the recorded generation', () => {
 const metrics=json('metrics.json');
 const bytes=readFileSync(new URL('../policy.wasm',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),metrics.policy.wasm_sha256);
 assert.equal(WebAssembly.validate(bytes),true);
 for(const name of ['app.js','core.js','index.html','base.css','todomvc.css','style.css','logic.json','metrics.json']) assert.ok(readFileSync(new URL('../'+name,import.meta.url)).length);
});
