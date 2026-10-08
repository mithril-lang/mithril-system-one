import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {convertSource} from '../lib/source-to-mithril.mjs';
test('actual pinned Mithril compilation executes toggle and count across all 513 finite-domain cases',async()=>{
 const result=await convertSource({language:'typescript',source:'export const toggle = (x: boolean): boolean => !x;\nexport const remaining = (xs: boolean[]): number => xs.filter(x => !x).length;'});
 assert.equal(result.ok,true);assert.equal(result.artifact.format,'mithril.native-js/artifact-v1');assert.equal(result.receipt.verification.cases,513);assert.equal(result.receipt.verification.status,'passed');assert.equal(result.receipt.inference_calls,0);assert.equal(result.ontology['@graph'].length,7);
});
test('actual JS and conditional refactor share compilation and independent AST reference',async()=>{
 const r=await convertSource({language:'javascript',source:'export function remaining(xs) { return xs.filter(x => x ? false : true).length; }\nexport const choose = (a,b) => a || (b === true);',types:{remaining:['bool[]'],choose:['bool','bool']}});
 assert.equal(r.receipt.verification.cases,515);assert.equal(r.receipt.verification.status,'passed');
});
test('real CLI emits verified Mithril artifact and refuses target execution',()=>{
 const input={language:'typescript',source:'export const f = (x: boolean) => !x;'};
 const result=JSON.parse(execFileSync(process.execPath,['bin/mithril-convert.mjs','--stdin'],{input:JSON.stringify(input),encoding:'utf8'}));assert.equal(result.receipt.verification.cases,2);
 assert.throws(()=>execFileSync(process.execPath,['bin/mithril-convert.mjs','--stdin'],{input:JSON.stringify({...input,source:'process.exit(0); export const f = (x: boolean) => x;'}),encoding:'utf8'}),e=>{assert.equal(JSON.parse(e.stdout).ok,false);return true;});
});

test('actual original/refactor fixtures have identical compiled results; checker and verifier refuse drift',async()=>{
 const {readFileSync}=await import('node:fs');
 const receipts=[];
 for(const fixture of ['todo','refactored']){
  const r=await convertSource({language:'typescript',source:readFileSync('examples/source-conversion/'+fixture+'.ts','utf8')});
  assert.equal(r.receipt.verification.cases,513);receipts.push(r.receipt.verification);
 }
 assert.equal(receipts[0].result_sha256,receipts[1].result_sha256);
 const {compileConvertedModule}=await import('../lib/mithril-module-runtime.mjs');
 await assert.rejects(()=>compileConvertedModule('(mithril/native-js-module :name "bad" :imports [] :exports ["f"] :functions [])'));
 const wrong={source:'export function instantiateMithrilNative(){return {toggle:x=>x}}',cases:[{name:'toggle',args:[true],expected:false}]};
 assert.throws(()=>execFileSync(process.execPath,['runtime/verify-converted.mjs'],{input:JSON.stringify(wrong),encoding:'utf8',stdio:['pipe','pipe','pipe']}));
});
