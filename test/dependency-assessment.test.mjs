import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {extractLockedDependencies,queryOsv,enrichKnowledge} from '../lib/dependency-assessment.mjs';
import {makeFile,record,fixture,component} from './fixtures/dependency-feeds.mjs';
test('lockfile extraction uses exact locked versions, scoped names, duplicates and evidence',()=>{
 const f=makeFile({'':{},'node_modules/fixture-package':{version:'1.0.0'},'node_modules/outer/node_modules/fixture-package':{version:'1.0.0'},'node_modules/@scope/pkg':{version:'2.0.0',dev:true},'packages/workspace':{version:'1.0.0'},'node_modules/linked':{link:true}});
 const r=extractLockedDependencies([f]);assert.equal(r.components.length,2);assert.equal(r.components[0].evidence.length,2);assert.match(r.components[1].purl,/%40scope/);assert.equal(r.gaps.length,2);
 assert.throws(()=>extractLockedDependencies([{...f,sha256:'b'.repeat(64)}]));assert.throws(()=>extractLockedDependencies([{...f,path:'../package-lock.json'}]));
 const unknown=extractLockedDependencies([makeFile({'node_modules/a':{version:'git+https://example/a'}})]);assert.equal(unknown.components.length,0);assert.ok(unknown.gaps.length);
});
test('OSV summaries are resolved to full details and 429 never becomes empty success',async()=>{
 const r=await queryOsv([component],{transport:fixture()});assert.equal(r.queries[0].records[0].affected.length,1);assert.equal(r.receipts.length,2);
 const bad=await queryOsv([component],{transport:fixture({detailStatus:429})});assert.equal(bad.queries[0].complete,false);assert.equal(bad.queries[0].records.length,0);assert.ok(bad.gaps.length);
 const failed=await queryOsv([component],{transport:async()=>new Response('',{status:503})});assert.equal(failed.queries[0].complete,false);
 const empty=await queryOsv([component],{transport:async()=>Response.json({results:[{}]})});assert.equal(empty.queries[0].complete,true);assert.equal(empty.queries[0].records.length,0);
});
test('Knowledge KEV/EPSS/CVE identity and stable snapshot are checked; outages retain unknown',async()=>{
 const r=await enrichKnowledge(['CVE-2026-10001'],{transport:fixture()});assert.equal(r.entries['CVE-2026-10001'].kev,true);assert.equal(r.entries['CVE-2026-10001'].epss.score,.9);
 for(const transport of [fixture({knowledgeStatus:403}),fixture({changed:true})]){const unknown=await enrichKnowledge(['CVE-2026-10001'],{transport});assert.equal(unknown.status,'unavailable');assert.equal(unknown.entries['CVE-2026-10001'].kev,null);}
});

test('OSV microsecond summary can pin nanosecond detail but changed revisions stay unknown',async()=>{
 const summary='2026-01-01T00:00:00.123456Z',detail='2026-01-01T00:00:00.123456789Z';
 const transport=changed=>async(url)=>url.endsWith('/querybatch')?Response.json({results:[{vulns:[{id:record.id,modified:summary}]}]}):Response.json({...record,modified:changed?'2026-01-01T00:00:01.123456789Z':detail});
 const good=await queryOsv([component],{transport:transport(false)});assert.equal(good.queries[0].complete,true);
 const bad=await queryOsv([component],{transport:transport(true)});assert.equal(bad.queries[0].complete,false);assert.equal(bad.queries[0].records.length,0);
});

test('dataset pins preserve independent data; unverified 404 and identity mismatch stay unknown',async()=>{
 const cve='CVE-2026-10001';
 let base=fixture();
 const partial=await enrichKnowledge([cve],{transport:async(url,init)=>url.endsWith('/nvd/manifest.json')?new Response('',{status:503}):base(url,init)});
 assert.equal(partial.status,'partial');assert.equal(partial.entries[cve].nvd,null);assert.equal(partial.entries[cve].kev,true);assert.equal(partial.entries[cve].epss.score,.9);
 for(const response of [()=>new Response('<html>not found</html>',{status:404}),()=>Response.json({dataset:'kev',record:{cveID:'CVE-2026-99999'}})]){
  base=fixture();const r=await enrichKnowledge([cve],{transport:async(url,init)=>url.includes('dataset=kev')?response():base(url,init)});assert.equal(r.entries[cve].kev,null);assert.ok(r.gaps.length);
 }
 base=fixture();const absent=await enrichKnowledge([cve],{transport:async(url,init)=>url.includes('dataset=kev')?Response.json({error:'not-found'},{status:404}):base(url,init)});assert.equal(absent.entries[cve].kev,false);assert.equal(absent.status,'available');
});
