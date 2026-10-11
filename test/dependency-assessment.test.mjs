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

test('duplicate lockfile keys retain an invalid-inventory gap rather than choosing a version',()=>{const text='{"lockfileVersion":3,"packages":{"node_modules/a":{"version":"1.0.0","\\u0076ersion":"2.0.0"}}}';const r=extractLockedDependencies([{path:'package-lock.json',text,sha256:createHash('sha256').update(text).digest('hex')}]);assert.equal(r.components.length,0);assert.ok(r.gaps.some(g=>g.reason==='invalid_lockfile'));});
const sha=text=>createHash('sha256').update(text).digest('hex');
const hash='a'.repeat(64);
test('go.sum pins module and pseudo versions; h1: and /go.mod lines collapse into one component',()=>{
 const h1='jmXUvGomnU1o3W/V5h2VEradbpJDwGrzugQQvL0POH4=';
 const text=['github.com/stretchr/objx v0.5.3 h1:'+h1,'golang.org/x/net v0.0.0-20220101010101-abcdefabcdef/go.mod h1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=','github.com/stretchr/objx v0.5.3 h1:'+h1].join('\n');
 const r=extractLockedDependencies([{path:'go.sum',text,sha256:sha(text)}]);
 assert.equal(r.components.length,2);
 const g=r.components.find(c=>c.name==='github.com/stretchr/objx');
 assert.equal(g.version,'v0.5.3');assert.equal(g.ecosystem,'go');assert.equal(g.evidence.length,2);assert.match(g.purl,/pkg:golang\/github\.com\/stretchr\/objx@0\.5\.3/);
 const p=r.components.find(c=>c.name==='golang.org/x/net');
 assert.equal(p.version,'v0.0.0-20220101010101-abcdefabcdef');assert.match(p.purl,/abcdef/);
});
test('Cargo.lock pins locked package versions per [[package]] section',()=>{
 const text='[[package]]\nname = "serde"\nversion = "1.0.100"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\n\n[[package]]\nname = "tokio"\nversion = "1.7.0"\n';
 const r=extractLockedDependencies([{path:'Cargo.lock',text,sha256:sha(text)}]);
 assert.equal(r.components.length,2);
 assert.ok(r.components.some(c=>c.name==='tokio'&&c.version==='1.7.0'&&c.ecosystem==='cargo'&&c.purl==='pkg:cargo/tokio@1.7.0'));
});
test('unknown inventory formats and malformed pins stay explicit gaps',()=>{
 const req='requests==2.31.0\n';
 assert.ok(extractLockedDependencies([{path:'requirements.txt',text:req,sha256:sha(req)}]).gaps.some(g=>g.reason==='unsupported_inventory_format'));
 const bad='github.com/x/net v1.2.3.4 '+hash+'\n';
 const r=extractLockedDependencies([{path:'go.sum',text:bad,sha256:sha(bad)}]);
 assert.equal(r.components.length,0);assert.ok(r.gaps.some(g=>g.reason==='package_identity_or_version_unknown'));
});
test('assessDependencies carries go and cargo components through OSV and the engine without npm assumptions',async()=>{
 const goRecord={id:'GHSA-gotest-0001',modified:'2026-01-01T00:00:00Z',aliases:['CVE-2026-42424'],affected:[{package:{name:'golang.org/x/net',ecosystem:'Go'},ranges:[{type:'SEMVER',events:[{introduced:'0'},{fixed:'0.7.0'}]}]}]};
 const cargoRecord={id:'RUSTSEC-2026-0001',modified:'2026-01-01T00:00:00Z',aliases:[],affected:[{package:{name:'tokio',ecosystem:'crates.io'},ranges:[{type:'SEMVER',events:[{introduced:'0'},{fixed:'1.23.1'}]}]}]};
 const transport=async(url,init)=>{
  assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,undefined);
  if(url.endsWith('/querybatch')){const body=JSON.parse(init.body);return Response.json({results:body.queries.map(q=>({vulns:[{id:q.package.ecosystem==='Go'?goRecord.id:cargoRecord.id,modified:'2026-01-01T00:00:00Z'}]}))});}
  if(url.includes('/vulns/'))return Response.json(url.includes(goRecord.id)?goRecord:cargoRecord);
  if(url.endsWith('/manifest.json')){const dataset=url.split('/').at(-2);return Response.json({dataset,name:dataset==='nvd'?'nvd-cve-full':dataset,generatedAt:'2026-01-01T00:00:00Z',files:[{file:dataset+'.json',sha256:sha(dataset)}]});}
  const dataset=new URL(url).searchParams.get('dataset');return Response.json({dataset,record:dataset==='kev'?{cveID:'CVE-2026-42424'}:dataset==='epss'?{cve:'CVE-2026-42424',epss:'0.2',date:'2026-01-01'}:{id:'CVE-2026-42424'}});
 };
 const {assessDependencies}=await import('../lib/dependency-assessment.mjs');
 const goSum='golang.org/x/net v0.5.0 '+hash+'\n';
 const cargoLock='[[package]]\nname = "tokio"\nversion = "1.21.0"\n';
 const r=await assessDependencies([{path:'go.sum',text:goSum,sha256:sha(goSum)},{path:'Cargo.lock',text:cargoLock,sha256:sha(cargoLock)}],{transport});
 assert.equal(r.inventory.components.length,2);
 assert.ok(r.findings.some(f=>f.component.ecosystem==='go'&&f.advisory===goRecord.id&&f.cves.includes('CVE-2026-42424')));
 assert.ok(r.findings.some(f=>f.component.ecosystem==='cargo'&&f.advisory===cargoRecord.id));
 for(const f of r.findings)assert.equal(f.status,'affected_version_candidate_requires_review');
});
