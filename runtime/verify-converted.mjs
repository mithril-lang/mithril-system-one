import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>2e6)throw Error('verification_budget');}
const {source,cases}=JSON.parse(text);
// Receives ONLY the artifact emitted by the pinned compiler, never input source.
const api=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).instantiateMithrilNative({});
const actual=[];
for(const c of cases){const value=api[c.name](...c.args);assert.deepStrictEqual(value,c.expected);actual.push({name:c.name,args:c.args,value});}
console.log(JSON.stringify({status:'passed',cases:cases.length,reference:'inert-source-AST-interpreter',runtime:'compiled-Mithril-native-js',array_max_length:8,result_sha256:createHash('sha256').update(JSON.stringify(actual)).digest('hex')}));
