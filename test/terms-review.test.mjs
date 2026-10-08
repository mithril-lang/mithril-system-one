import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {reviewTerms,runTermsWorkflow} from '../lib/terms-review.mjs';
const doc = (text, kind='terms') => ({kind,url:'https://example.org/terms',retrievedAt:'2026-10-08T00:00:00Z',language:'en',text,sha256:createHash('sha256').update(text).digest('hex')});
const input = d => ({service:{name:'Fixture only',plan:'sample',jurisdiction:'unknown'},documents:[d]});
test('links candidates to exact source positions without disclosing raw clauses',()=>{
  const d=doc('Overview\nYour subscription will automatically renew.\nNo refunds.');
  const r=reviewTerms(input(d));
  assert.equal(r.findings[0].line,2);
  assert.equal(d.text.slice(r.findings[0].start,r.findings[0].end),'automatically renew');
  assert.equal(r.findings[0].sourceSha256,d.sha256);
  assert.equal(r.honestyScore,null); assert.equal(r.status,'incomplete_requires_review');
  assert.ok(!JSON.stringify(r).includes('Your subscription')); assert.equal(r.publication.autoPublish,false);
});
test('negation, no signals and unsupported language never become safe',()=>{
  for (const d of [doc('We do not sell your data to third parties.'),doc('Welcome'),{...doc('Bonjour'),language:'other'}]) {
    const r=reviewTerms(input(d)); assert.ok(r.trustDimensions.every(x=>x.status==='unknown')); assert.equal(r.legalConclusion,null);
  }
});
test('Japanese rules and whole-document change detection',()=>{
  const before={...doc('利用規約を変更できます。'),language:'ja'};
  const after={...doc('利用規約を変更できます。通知は30日前に行います。'),language:'ja'};
  const r=reviewTerms({...input(after),previous:[before]});
  assert.equal(r.changes[0].status,'changed_requires_review'); assert.equal(r.changes[0].addedSignals.length,0);
  assert.equal(r.findings[0].rule,'unilateral-change');
});
test('tampered hashes, private URL parameters, invalid dates and extra fields refuse',()=>{
  for (const patch of [{sha256:'0'.repeat(64)},{url:'https://example.org/terms?token=secret'},{retrievedAt:'2026-02-30T00:00:00Z'}, {effectiveDate:'2026-02-30'},{instruction:'publish'}]) {
    assert.throws(()=>reviewTerms(input({...doc('Welcome'),...patch})),/terms_review_refused/);
  }
  assert.throws(()=>reviewTerms({...input(doc('Welcome')),documents:[doc('One'),doc('Two')]}));
});
test('contextual risk records must cite the exact imported source span',()=>{
  const d=doc('😀 No refunds.');
  const a={dimension:'billing-exit',risk:'high',rationale:'Refund restriction affects the declared use.',sourceSha256:d.sha256,start:3,end:d.text.length};
  const r=reviewTerms({...input(d),assessments:[a]});
  assert.equal(r.contextualAssessments[0].status,'reviewer_supplied_not_independently_verified');
  assert.equal(d.text.slice(r.findings[0].start,r.findings[0].end),'No refunds');
  for (const patch of [{end:9999},{sourceSha256:'0'.repeat(64)},{risk:'safe'},{start:-1}])
    assert.throws(()=>reviewTerms({...input(d),assessments:[{...a,...patch}]}));
});
test('candidate floods are bounded with an explicit coverage gap',()=>{
  const r=reviewTerms(input(doc('No refunds.\n'.repeat(1100))));
  assert.equal(r.findings.length,1000); assert.equal(r.coverage.candidateLimitReached,true);
});
test('workflow bounds tasks and returns no partial output when a later task refuses',()=>{
  assert.equal(runTermsWorkflow({tasks:[input(doc('Welcome'))]}).published,false);
  assert.throws(()=>runTermsWorkflow({tasks:Array(4).fill(input(doc('Welcome')))}));
  const cli=spawnSync(process.execPath,['bin/mithril-terms-review.mjs','--workflow'],{cwd:new URL('..',import.meta.url),input:JSON.stringify({tasks:[input(doc('Welcome')),input({...doc('private'),sha256:'0'.repeat(64)})]}),encoding:'utf8'});
  assert.equal(cli.status,1); assert.deepEqual(JSON.parse(cli.stdout),{ok:false,error:'terms_review_refused',retry:false});
});
