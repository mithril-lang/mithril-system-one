import test from 'node:test';import assert from 'node:assert/strict';import {makeFile,record,fixture} from './fixtures/dependency-feeds.mjs';
import {assessDependencies} from '../lib/dependency-assessment.mjs';import {matchDependencyQueries} from '../lib/dependency-engine.mjs';
test('actual private matcher handles vulnerable, fixed boundary, reopened ranges and GIT unknown',async()=>{
 const queries=['1.0.0','1.2.0','1.5.1'].map(version=>({component:{name:'fixture-package',version,ecosystem:'npm'},records:[{...record,affected:[{...record.affected[0],ranges:[{type:'SEMVER',events:[{introduced:'0'},{fixed:'1.2.0'},{introduced:'1.5.0'},{fixed:'1.6.0'}]}]}]}]}));
 const r=await matchDependencyQueries(queries);assert.deepEqual(r.results.map(x=>x.evaluation['advisory/findings'].length),[1,0,1]);
 const unknown=await matchDependencyQueries([{component:queries[0].component,records:[{...record,affected:[{...record.affected[0],ranges:[{type:'GIT',repo:'https://example.invalid/source',events:[{introduced:'abc'},{fixed:'def'}]}]}]}]}]);assert.ok(unknown.results[0].problems.length||unknown.results[0].evaluation['advisory/undecided'].length);
});
test('actual matcher → Mithril OWL/SHACL with Knowledge KEV priority and original evidence',async()=>{
 const r=await assessDependencies([makeFile({'node_modules/fixture-package':{version:'1.0.0'}})],{transport:fixture()});assert.equal(r.status,'review_incomplete');assert.equal(r.findings.length,1);assert.equal(r.findings[0].priority,'known_exploited');assert.equal(r.ontology.violations.length,1);assert.match(r.ontology.data,/KnownExploitedDependency/);assert.equal(r.findings[0].component.evidence[0].path,'package-lock.json');assert.equal(r.execution.inference_calls,0);
});
test('actual Mithril evaluation retains Knowledge outage and OSV detail failure as gaps',async()=>{
 const f=makeFile({'node_modules/fixture-package':{version:'1.0.0'}});
 const r=await assessDependencies([f],{transport:fixture({knowledgeStatus:403})});assert.equal(r.findings.length,1);assert.equal(r.findings[0].knowledge[0].kev,null);assert.ok(r.unknown.length);
 const absent=await assessDependencies([f],{transport:fixture({detailStatus:429})});assert.equal(absent.findings.length,0);assert.equal(absent.status,'review_incomplete');assert.ok(absent.unknown.some(x=>x.reason==='osv_detail_unavailable'));
});
