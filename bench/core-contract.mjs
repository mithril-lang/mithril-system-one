/** Offline boundary experiment. Fixtures are compiler-response mutations, not live SWE tasks. */
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {emitMithril, compileMithril} from '../lib/mithril-language.mjs';
const output = process.argv[2];
if (!output) throw new Error('Specify a new output path');
const fixture = JSON.parse(readFileSync(new URL('../test/fixtures/mithril-app-compiled.json', import.meta.url)));
const proposal = {name:'Boundary study', description:'Static content', headline:'Evidence', summary:'A static document', template:'report'};
// Frozen before implementation. Development set and a separate validation-only family.
export const cases = [
  ...['dashboard','report','directory'].map(template => ({id:template, split:'fixed', expected:'accepted', proposal:{...proposal,template}})),
  {id:'missing-digests', split:'fixed', mutate:v=>{delete v.artifact['graph-digest']; delete v.semanticRun['artifact-digest'];}},
  {id:'null-digests', split:'fixed', mutate:v=>{v.artifact['graph-digest']=null; v.semanticRun['artifact-digest']=null;}},
  {id:'empty-digests', split:'fixed', mutate:v=>{v.artifact['graph-digest']=''; v.semanticRun['artifact-digest']='';}},
  {id:'matching-invalid-digests', split:'fixed', mutate:v=>{v.artifact['graph-digest']='same'; v.semanticRun['artifact-digest']='same';}},
  {id:'mismatched-digests', split:'fixed', mutate:v=>{v.semanticRun['artifact-digest']='sha256:'+'0'.repeat(64);}},
  {id:'deploy-executed', split:'fixed', mutate:v=>{v.trace.find(s=>s.id==='deploy').status='executed';}},
  {id:'unknown-template', split:'fixed', proposal:{...proposal,template:'shell'}},
  {id:'short-sha256', split:'validation', mutate:v=>{v.artifact['graph-digest']='sha256:abc'; v.semanticRun['artifact-digest']='sha256:abc';}},
  {id:'numeric-digests', split:'validation', mutate:v=>{v.artifact['graph-digest']=42; v.semanticRun['artifact-digest']=42;}},
  {id:'trace-object', split:'validation', mutate:v=>{v.trace={};}},
  {id:'null-response', split:'validation', replace:null},
];
const rows=[];
for(let round=1;round<=3;round++) for(const c of cases) {
  const start=performance.now(); let generationMs=null, validationMs=null, outcome='accepted', error=null, calls=0;
  try {
    const source=emitMithril(c.proposal || proposal); generationMs=performance.now()-start;
    const result=structuredClone(fixture); c.mutate?.(result);
    const validationStart=performance.now();
    try {await compileMithril(source, async()=>{calls++; return Response.json(Object.hasOwn(c,'replace') ? c.replace : result);});}
    finally {validationMs=performance.now()-validationStart;}
  } catch(e) {outcome=e.code==='mithril_compile_refused'||e.code==='mithril_proposal_refused' ? 'refused' : 'error'; error=e.code || e.name;}
  const expected=c.expected || 'refused';
  rows.push({round,id:c.id,split:c.split,expected,outcome,pass:expected===outcome,error,calls,generation_ms:generationMs,validation_ms:validationMs,total_ms:performance.now()-start,save_publish_ms:null,human_intervention_ms:null});
}
const report={format:'mithril.core-boundary-experiment/v1',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,mode:'offline-fixture',planned:42,attempted:rows.length,retries:0,missing:0,inference_calls:0,live_compiler_calls:0,billed_cost_usd:null,rows};
writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({planned:42,attempted:rows.length,passed:rows.filter(r=>r.pass).length,failed:rows.filter(r=>!r.pass).length,output}));
