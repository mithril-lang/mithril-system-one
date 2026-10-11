import test from 'node:test';
import assert from 'node:assert/strict';
import {extractSourceOntology} from '../lib/polyglot-source.mjs';
import {executeDynamic} from '../lib/mithril-dynamic.mjs';
import {samples} from '../examples/source-extraction/cases.mjs';

test('all twelve language ontologies compile and reason through the pinned Mithril runtime',async()=>{
 const extractions=Object.entries(samples).map(([path,[source]])=>extractSourceOntology({path,source}));
 assert.ok(extractions.every(r=>r.ok));
 const receipt=await executeDynamic(extractions.map(r=>({source:r.mithril,cases:[{id:r.language,data:'<urn:source:scope> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <https://mithril.fund/source/v1#ReviewScope> .'}]})),{profile:'security'});
 assert.equal(receipt.results.length,12);
 for(const r of receipt.results){
  assert.match(r['graph-digest'],/^sha256:[a-f0-9]{64}$/);
  assert.equal(r.cases[0].status,'conforms');assert.equal(r.cases[0].consistent,true);
  assert.ok(r.cases[0].counts['ontology-triples']>0);
  // No security validation shapes are supplied by a syntax extraction.
  assert.equal(r.cases[0].counts.checks,0);assert.equal(r.cases[0].violations.length,0);
 }
});
