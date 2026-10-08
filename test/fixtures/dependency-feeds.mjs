import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export const makeFile=(packages,path='package-lock.json')=>{const text=JSON.stringify({lockfileVersion:3,packages});return {path,text,sha256:createHash('sha256').update(text).digest('hex')};};
export const component={id:'fixture',name:'fixture-package',version:'1.0.0',ecosystem:'npm'};
const modified='2026-01-01T00:00:00Z';
export const record={id:'GHSA-fixture-0001',modified,aliases:['CVE-2026-10001'],affected:[{package:{name:'fixture-package',ecosystem:'npm'},ranges:[{type:'SEMVER',events:[{introduced:'0'},{fixed:'1.2.0'}]}]}]};
export function fixture({knowledgeStatus=200,detailStatus=200,changed=false}={}){const manifests=new Map();return async(url,init)=>{
 assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,undefined);
 if(url.endsWith('/querybatch'))return Response.json({results:JSON.parse(init.body).queries.map(()=>({vulns:[{id:record.id,modified}]}))});
 if(url.includes('/vulns/'))return detailStatus===200?Response.json(record):new Response('',{status:detailStatus});
 if(knowledgeStatus!==200)return new Response('',{status:knowledgeStatus});
 if(url.endsWith('/manifest.json')){const dataset=url.split('/').at(-2),count=manifests.get(dataset)??0;manifests.set(dataset,count+1);return Response.json({dataset,name:dataset==='nvd'?'nvd-cve-full':dataset,generatedAt:changed&&count>0?'2026-01-02T00:00:00Z':'2026-01-01T00:00:00Z',files:[{file:'fixture.json',sha256:'a'.repeat(64)}]});}
 const dataset=new URL(url).searchParams.get('dataset');return Response.json({dataset,record:dataset==='kev'?{cveID:'CVE-2026-10001'}:dataset==='epss'?{cve:'CVE-2026-10001',epss:'0.9',date:'2026-01-01'}:{id:'CVE-2026-10001'}});
};}
