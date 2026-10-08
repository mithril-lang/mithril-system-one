import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSourceModule} from '../lib/source-to-mithril.mjs';
const extract=source=>extractSourceModule({language:'typescript',source});
test('typed lowering is deterministic and preserves parameter contracts and source provenance',()=>{
 const source='export function toggle(v: boolean): boolean { return !v; }\nexport const remaining = (xs: boolean[]): number => xs.filter(x => !x).length;';
 const a=extract(source);assert.deepEqual(a,extract(source));assert.equal(a.cases.length,513);assert.equal(a.document.imports.length,0);assert.equal(a.signatures[1].returns,'number');assert.match(a.mithril,/mithril\/native-js-module/);assert.ok(a.facts.every(x=>x.line>0));
});
test('conditional refactor, logical operators, filter captures and parameter shadowing',()=>{
 const a=extract('export const remaining = (xs: boolean[], flag: boolean): number => xs.filter(flag => flag ? false : true).length;\nexport const choose = (x: boolean, y: boolean): boolean => x && (y !== false);');
 assert.equal(a.cases.length,1026);assert.equal(a.cases.find(c=>c.name==='remaining'&&JSON.stringify(c.args)==='[[true,false],true]').expected,1);
});
test('JavaScript requires explicit parameter contracts',()=>{
 assert.throws(()=>extractSourceModule({language:'javascript',source:'export const toggle = v => !v;'}),/parameter_type_required/);
 assert.equal(extractSourceModule({language:'javascript',source:'export const toggle = v => !v;',types:{toggle:['bool']}}).cases.length,2);
});
test('reject side effects, free variables, unsafe calls, unsupported syntax and dishonest contracts',()=>{
 const rejected=[
 'import x from "unsafe"; export const f = (x: boolean) => x;',
 'export const f = (x: boolean) => process.exit();',
 'export const f = (x: boolean) => external;',
 'export function f(x: boolean) { x = false; return x; }',
 'export const f = async (x: boolean) => x;',
 'export const f = (x: boolean = false) => x;',
 'export const f = (...x: boolean[]) => x;',
 'export const f = (x?: boolean) => x;',
 'export const f = (x: boolean) => (x as boolean);',
 'export const f = (x: boolean) => x + 1;',
 'export const f = (x: boolean[]) => x.map(v => !v);',
 'export const f = (x: boolean[]) => x["length"];',
 'export const f = (x: boolean[]) => x.filter(v => external(v)).length;',
 'export const f = (x: boolean[]) => x.filter((v, i) => v).length;',
 'export const f = (x: boolean[]) => x.filter(v => { console.log(v); return v; }).length;',
 'export const f = (x: boolean[]) => x.filter((v): number => !v).length;',
 'export const f = (x: boolean): number => !x;',
 'export const f = <T>(x: boolean) => x;',
 'export function f(x: boolean) { "use strict"; return x; }',
 'export const f = (a: boolean[], b: boolean[]) => a.length;',
 'const f = (x: boolean) => x; export {f};',
 'export const f = (x: string) => x;',
 'export const f = (x: boolean) => f(x);'
 ];
 for(const source of rejected)assert.throws(()=>extract(source),undefined,source);
 assert.throws(()=>extractSourceModule({language:'typescript',source:'export const f = (x: boolean) => x;',types:{f:['bool[]']}}),/type_mismatch/);
 assert.throws(()=>extractSourceModule({language:'typescript',source:'export const f = (x: boolean) => x;',types:{other:['bool']}}),/unknown_contract/);
});
test('source and expression budgets are enforced before compilation',()=>{
 assert.throws(()=>extract(' '.repeat(16385)),/input_refused/);
 assert.throws(()=>extract('export const f = (x: boolean) => '+'!'.repeat(40)+'x;'),/expression_budget/);
});
