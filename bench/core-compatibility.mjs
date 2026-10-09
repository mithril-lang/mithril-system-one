/** Follow-up compatibility replay; no inference, credentials, retry or deployment. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {emitMithril,compileMithril,renderMithril,COMPILER} from '../lib/mithril-language.mjs';
import * as baseline from '../../baseline-core/lib/mithril-language.mjs';
import {verifyEquivalent} from '../lib/mithril-task-agent.mjs';
const directory=process.argv[2], live=process.argv.includes('--live');
if(!directory) throw Error('new output directory required');
const base={name:'新規互換性検証 2026-10-09',description:'Public synthetic document; no personal or private data.',headline:'Quoted " heading \\ slash',summary:'日本語 · café · <script>safe text</script> & "quoted"',template:'report'};
// Freeze before any follow-up execution; these content/boundary examples were not used to create the patch.
const cases=[
 {id:'unseen-unicode-report',expected:'accepted',proposal:base},
 {id:'unseen-500-character-dashboard',expected:'accepted',proposal:{...base,template:'dashboard',summary:'x'.repeat(500)}},
 {id:'unseen-escaped-directory',expected:'accepted',proposal:{...base,template:'directory',name:'<img src=x onerror=alert(1)>',headline:'Entities & facts'}},
 {id:'reject-501-character-field',expected:'refused',proposal:{...base,description:'x'.repeat(501)}},
 {id:'reject-extra-effect',expected:'refused',proposal:{...base,effects:['shell']}},
 {id:'reject-unknown-template',expected:'refused',proposal:{...base,template:'interactive-checkout'}},
 {id:'reject-control-character',expected:'refused',proposal:{...base,name:'name\u0000suffix'}},
 {id:'reject-unknown-library',expected:'refused',proposal:base,replace:['https://mithril.fund/lib/app/agent-loop-v1','https://example.invalid/unapproved-library']},
 {id:'reject-invalid-form',expected:'refused',source:'(mithril/arbitrary-shell :command "echo unsupported")\n'},
 {id:'reject-source-byte-budget',expected:'refused',source:'x'.repeat(8193)},
];
if(process.argv.includes('--dashboard-only')) cases.splice(0,cases.length,
 {id:'followup-compatible-dashboard',expected:'accepted',proposal:{...base,template:'dashboard',summary:'Compatible dashboard with a short, new summary.'}});
const sha=s=>createHash('sha256').update(s).digest('hex');
const plan={mode:live?'live-compiler-replay':'plan-only',versions:['1d1b370513ae084e0eb0810e5b4c956fa6631571','ba979db37bec85ff1780f79d4fca6101ff949da2'],endpoint:COMPILER,max_live_compiler_calls:process.argv.includes('--dashboard-only')?1:5,inference_calls:0,retries:0,billed_cost_usd:null,planned_cases:cases.length,planned_version_checks:cases.length*2,cases};
if(!live){console.log(JSON.stringify(plan,null,2));process.exit(0);}
mkdirSync(directory);writeFileSync(directory+'/plan.json',JSON.stringify(plan,null,2)+'\n');
const rows=[];let stopped=false,requests=0;
for(const c of cases){
 const row={id:c.id,expected:c.expected,missing:stopped,compiler_calls:0,source:null,source_sha256:null,generation_ms:null,live_validation_ms:null,save_publish_ms:null,human_intervention_ms:null,billed_cost_usd:null,outcomes:{},checks:{}};
 if(!stopped){
  const start=performance.now();let source=c.source,emissionError=null;
  try{if(!source)source=emitMithril(c.proposal);if(c.replace)source=source.replace(c.replace[0],c.replace[1]);}catch(e){emissionError=e;}
  row.generation_ms=performance.now()-start;row.source=source||null;row.source_sha256=source?sha(source):null;
  let raw=null,status=null,networkError=null;
  // Public compiler transport invoked at most once per case; both versions consume identical fresh response bytes.
  const observed=async(url,init)=>{
   if(raw!==null)return new Response(raw,{status});
   if(requests>=plan.max_live_compiler_calls)throw Error('planned_request_budget');
   requests++;row.compiler_calls++;
   const validationStart=performance.now();
   try{const response=await fetch(url,init);status=response.status;raw=await response.text();row.http_status=status;row.response=raw;
    if(status>=300&&status<400||status===401||status===403||status===429||status>=500){networkError='unknown_or_authorization_outcome';stopped=true;}}
   catch(e){networkError=e.name;stopped=true;throw e;}
   finally{row.live_validation_ms=performance.now()-validationStart;}
   return new Response(raw,{status});
  };
  for(const [version,lib] of [['baseline',baseline],['candidate',{compileMithril,emitMithril,renderMithril}]]){
   try{
    if(emissionError){lib.emitMithril(c.proposal);throw Error('inconsistent_emission');}
    const result=await lib.compileMithril(source,observed);
    if(c.expected==='accepted'){
     const goal=c.proposal;verifyEquivalent({expected:goal,goal},source,result);
     row.checks[version]=['exact-content','shape-binding','approved-bindings','ordinary-html-equivalence','semantic-stages-executed'];
     row.rendered_sha256=sha(lib.renderMithril(result.artifact));
    }
    row.outcomes[version]='accepted';
   }catch(e){row.outcomes[version]=['mithril_proposal_refused','mithril_compile_refused','mithril_source_budget'].includes(e.code)?'refused':'error';row[version+'_error']=e.code||e.name;}
   if(networkError){row.outcome_unknown=true;break;}
  }
  row.pass=!row.outcome_unknown&&Object.values(row.outcomes).length===2&&Object.values(row.outcomes).every(v=>v===c.expected);
 }
 rows.push(row);writeFileSync(directory+`/attempt-${String(rows.length).padStart(2,'0')}.json`,JSON.stringify(row,null,2)+'\n');
}
const summary={...plan,cases:undefined,attempted:rows.filter(r=>!r.missing).length,missing:rows.filter(r=>r.missing).length,compiler_calls:requests,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.missing&&!r.pass).length,rows};
writeFileSync(directory+'/summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({attempted:summary.attempted,missing:summary.missing,compiler_calls:requests,passed:summary.passed,failed:summary.failed}));
