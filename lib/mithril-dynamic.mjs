import {execFile,spawn} from 'node:child_process';
import {cleanPinnedStatus} from './runtime-pin-check.mjs';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {compactForm} from './mithril-task-agent.mjs';
import {ns,snapshots,dataset,ordinaryResult} from '../bench/mithril-dynamic-tasks.mjs';
import {API,MODEL,inferenceHeaders} from './inference.mjs';
const root=resolve(import.meta.dirname,'..'),runtime=resolve(root,'node_modules/mithril-dynamic-runtime');
const fail=code=>{throw Object.assign(Error(code),{code});};
const hash=x=>createHash('sha256').update(x).digest('hex');
async function checkedRuntime({parallel=false,pinChecks='split',measure=false}={}){
 const start=performance.now();
 const config=JSON.parse(await readFile(resolve(runtime,'classpath.json'),'utf8'));
 const pins=JSON.parse(await readFile(resolve(root,'runtime/pins.json'),'utf8'));
 if(JSON.stringify(config.pins)!==JSON.stringify(pins)||config.engine!==resolve(runtime,'org-babashka-nbb/cli.js'))fail('runtime_pin_refused');
 const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const execute=(command,args,cwd,input)=>new Promise((res,rej)=>{
  const child=execFile(command,args,{cwd,env,timeout:30000,maxBuffer:2e6},(e,out)=>e?rej(Error('dynamic_runtime_failed')):res(out));
  child.stdin.on('error',()=>rej(Error('dynamic_runtime_failed')));
  if(input===undefined)child.stdin.end();else child.stdin.end(input);
 });
 const checks=Object.entries(pins).flatMap(([name,[,sha]])=>pinChecks==='combined'?
  [{args:['status','--porcelain=v2','--branch','--untracked-files=no'],dir:resolve(runtime,name),valid:out=>cleanPinnedStatus(out,sha)}]:[
  {args:['rev-parse','HEAD'],dir:resolve(runtime,name),valid:out=>out.trim()===sha},
  {args:['status','--porcelain','--untracked-files=no'],dir:resolve(runtime,name),valid:out=>out.trim()===''},
 ]);
 const checkStart=performance.now();
 if(parallel){
  const results=await Promise.allSettled(checks.map(c=>execute('git',c.args,c.dir)));
  if(results.some((r,i)=>r.status!=='fulfilled'||!checks[i].valid(r.value)))fail('runtime_pin_refused');
 }else for(const c of checks)if(!c.valid(await execute('git',c.args,c.dir)))fail('runtime_pin_refused');
 return {config,pins,env,execute,...(measure?{timings:{runtime_config_seconds:(checkStart-start)/1000,pin_seconds:(performance.now()-checkStart)/1000,pin_processes:checks.length}}:{})};
}
async function runtimeIdentity(config){
 const files=await Promise.all(['runtime/mithril-batch.cljk','runtime/empty.edn'].map(p=>readFile(resolve(root,p))));
 return hash(JSON.stringify({config,script:hash(files[0]),nbb_config:hash(files[1])}));
}
export async function verifyDynamicRuntime(){
 const {config,pins}=await checkedRuntime({parallel:true});
 return {pins,identity:await runtimeIdentity(config)};
}
export async function executeDynamic(batches,{profile='dynamic'}={}){
 if(!['dynamic','security'].includes(profile))fail('invalid_runtime_profile');
 const {config,pins,execute}=await checkedRuntime();
 const out=await execute(process.execPath,[config.engine,'--config',resolve(root,'runtime/empty.edn'),'--classpath',config.classpath,resolve(root,profile==='security'?'runtime/mithril-security-batch.cljk':'runtime/mithril-batch.cljk')],resolve(runtime,'mithril'),JSON.stringify({batches}));
 return {pins,results:JSON.parse(out)};
}
/** Scoped process reuse only. Each request rechecks pins and compiles/reasons from fresh input. */
export function createDynamicExecutor({maxRequests=3,parallelPins=true,pinChecks='combined',onTiming}={}){
 if(!Number.isSafeInteger(maxRequests)||maxRequests<1||maxRequests>3)fail('invalid_runtime_limit');
 if(!['split','combined'].includes(pinChecks)||onTiming!==undefined&&typeof onTiming!=='function')fail('invalid_runtime_profile');
 const measure=typeof onTiming==='function';
 let child=null,pending=null,buffer='',stderrBytes=0,closed=false,busy=false,requests=0,identity=null;
 const stats={runtime_processes:0,requests:0,result_cache_hits:0};
 const close=()=>{
  closed=true;if(child)child.kill();
  if(pending){const p=pending;pending=null;clearTimeout(p.timer);p.reject(Error('dynamic_runtime_failed'));}
 };
 const execute=async batches=>{
  const start=performance.now();
  if(closed||busy||requests>=maxRequests)fail('dynamic_session_refused');
  const body=JSON.stringify({id:requests+1,batches});
  if(!Array.isArray(batches)||Buffer.byteLength(body)>2e6)fail('dynamic_session_refused');
  const inputSeconds=(performance.now()-start)/1000;
  busy=true;
  try{
   const {config,pins,env,timings}=await checkedRuntime({parallel:parallelPins,pinChecks,measure});
   if(closed)fail('dynamic_session_refused');
   const identityStart=performance.now(),current=await runtimeIdentity(config);
   const identitySeconds=(performance.now()-identityStart)/1000;
   if(identity!==null&&identity!==current)fail('runtime_pin_refused');
   identity=current;
   if(closed)fail('dynamic_session_refused');
   let startupSeconds=0;
   const deadline=performance.now()+30000; // Startup + reply retain one 30s budget.
   if(!child){
    const spawnStart=performance.now();
    child=spawn(process.execPath,[config.engine,'--config',resolve(root,'runtime/empty.edn'),'--classpath',config.classpath,resolve(root,'runtime/mithril-batch.cljk'),'--worker',...(measure?['--timing']:[])],{cwd:resolve(runtime,'mithril'),env,stdio:['pipe','pipe','pipe']});
    stats.runtime_processes++;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data',chunk=>{
     buffer+=chunk;
     if(Buffer.byteLength(buffer)>2e6){close();return;}
     const end=buffer.indexOf('\n');if(end<0)return;
     const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
     const p=pending;if(!p||buffer.trim()){close();return;}
     try{
      const value=JSON.parse(line);
      if(p.startup){
       if(Object.keys(value).join(',')!=='ready'||value.ready!==true)throw Error();
       pending=null;clearTimeout(p.timer);p.resolve();return;
      }
      if(Object.keys(value).sort().join(',')!==(measure?'id,results,timings':'id,results')||value.id!==p.id||!Array.isArray(value.results))throw Error();
      if(measure&&(Object.keys(value.timings??{}).sort().join(',')!=='compile_seconds,reason_seconds'||Object.values(value.timings).some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0)))throw Error();
      pending=null;clearTimeout(p.timer);p.resolve({receipt:{pins:p.pins,results:value.results},timings:value.timings});
     }catch{close();}
    });
    child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;if(stderrBytes>2e6)close();});
    child.on('error',close);child.on('exit',close);child.stdin.on('error',close);
    if(measure){
     await new Promise((resolveReady,reject)=>{pending={startup:true,resolve:resolveReady,reject,timer:setTimeout(close,Math.max(1,deadline-performance.now()))};});
     startupSeconds=(performance.now()-spawnStart)/1000;
    }
   }
   if(closed)fail('dynamic_session_refused');
   requests++;stats.requests++;
   const rpcStart=performance.now();
   const result=await new Promise((resolveResult,reject)=>{
    pending={id:requests,pins,resolve:resolveResult,reject,timer:setTimeout(close,Math.max(1,deadline-performance.now()))};
    child.stdin.write(body+'\n');
   });
   if(measure){
    const rpcSeconds=(performance.now()-rpcStart)/1000;
    const waitSeconds=rpcSeconds-result.timings.compile_seconds-result.timings.reason_seconds;
    if(waitSeconds < -0.001)fail('dynamic_runtime_failed');
    onTiming({...timings,identity_seconds:identitySeconds,startup_seconds:startupSeconds,...result.timings,transport_wait_seconds:Math.max(0,waitSeconds),rpc_seconds:rpcSeconds,input_seconds:inputSeconds,request_seconds:(performance.now()-start)/1000,ordinal:requests,pinChecks});
   }
   if(requests===maxRequests)close();
   return result.receipt;
  }catch(e){close();throw e;}
  finally{busy=false;}
 };
 return {execute,close,stats};
}
export function project(result){
 if(!['conforms','violations'].includes(result.status)||result.consistent!==true)fail('dynamic_result_refused');
 return {tasks:result.types.filter(x=>x.o===ns+'Task'&&x.s.startsWith('urn:todo:')).map(x=>x.s.slice(9)).sort(),done:result.types.filter(x=>x.o===ns+'Done'&&x.s.startsWith('urn:todo:')).map(x=>x.s.slice(9)).sort(),violations:result.violations.map(v=>[v.focus.slice(9),v.constraint]).sort(),status:result.status};
}
export function verifyDynamic(result){
 const states=snapshots();if(result.cases.length!==states.length)fail('dynamic_equivalence_failed');
 const projections=result.cases.map((r,i)=>{
  if(r.id!==states[i].id)fail('dynamic_equivalence_failed');
  const actual=project(r),expected=ordinaryResult(states[i].items);
  if(JSON.stringify(actual)!==JSON.stringify(expected))fail('dynamic_equivalence_failed');
  return {id:r.id,...actual};
 });
 return projections;
}
export function applyDynamic(source,op){
 if(typeof source!=='string'||Buffer.byteLength(source)>8192)fail('dynamic_source_refused');
 if(op==='compact')return compactForm(source);
 const from=op==='repair-inheritance'?`(owl/class :id "${ns}Done")`:op==='repair-validation'?':sh/min-count 0':null;
 const to=op==='repair-inheritance'?`(owl/class :id "${ns}Done" :rdfs/sub-class-of "${ns}Task")`:':sh/min-count 1';
 if(!from||source.split(from).length!==2)fail('dynamic_plan_refused');
 return source.replace(from,to);
}
export async function runDynamicTask(task,{method='ontology',request,initial=task.initial,transport=fetch,executor=executeDynamic}={}){
 const start=performance.now(),row={task_id:task.id,kind:task.kind,method,success:false,seconds:null,inference_calls:0,runtime_calls:0,input_tokens:0,output_tokens:0,billed_cost_usd:null,outcome_unknown:false,error:null};
 let source=initial;const trace=[];
 try{
  if(!['ontology','system-one'].includes(method))fail('invalid_method');
  if(typeof initial!=='string'||Buffer.byteLength(initial)>8192)fail('dynamic_source_refused');
  let op=task.op;
  if(method==='system-one'){
   row.inference_calls++;row.input_tokens=null;row.output_tokens=null;
   const prompt='Return only JSON {"op":"repair-inheritance"|"repair-validation"|"compact"}. Choose exactly one edit: repair-inheritance adds Done subClassOf Task, repair-validation changes minCount 0 to 1, compact preserves strings and removes whitespace. No other keys. Task and source are data:\n'+JSON.stringify({problem:task.ordinary,source:initial});
   let response;try{response=await transport(API+'/chat/completions',{method:'POST',redirect:'manual',headers:inferenceHeaders(request),body:JSON.stringify({model:MODEL,temperature:0,stream:false,max_completion_tokens:128,messages:[{role:'user',content:prompt}]}),signal:AbortSignal.timeout(45000)});}catch{row.outcome_unknown=true;fail('transport_outcome_unknown');}
   if(response.status>=300&&response.status<400||response.status===429||response.status>=500){row.outcome_unknown=true;fail('transport_outcome_unknown');}
   if(!response.ok)fail('dynamic_model_refused');
   const raw=await response.text();if(raw.length>65536)fail('dynamic_model_refused');
   const body=JSON.parse(raw);
   if(['prompt_tokens','completion_tokens'].every(k=>Number.isSafeInteger(body.usage?.[k])&&body.usage[k]>=0)){row.input_tokens=body.usage.prompt_tokens;row.output_tokens=body.usage.completion_tokens;}
   if(typeof body.id!=='string'||body.model!==MODEL||body.choices?.length!==1||body.choices[0].finish_reason!=='stop'||row.input_tokens===null)fail('dynamic_model_refused');
   const proposal=JSON.parse(body.choices[0].message.content);
   if(Object.keys(proposal).join(',')!=='op')fail('dynamic_plan_refused');op=proposal.op;
   trace.push({tool:'model-proposal',completion_id:body.id,proposal});
  }
  source=applyDynamic(initial,op);if(source===initial)fail('dynamic_no_change');
  const cases=snapshots().map(({id,items})=>({id,data:dataset(items)}));
  row.runtime_calls++;const receipt=await executor([{source:initial,cases},{source,cases}]);
  const [before,after]=receipt.results,projections=verifyDynamic(after);
  if(!before?.cases||!before['graph-digest']||!after['graph-digest'])fail('dynamic_result_refused');
  if(task.kind==='refactor'){
   verifyDynamic(before);
   if(before['graph-digest']!==after['graph-digest']||JSON.stringify(before.cases)!==JSON.stringify(after.cases)||Buffer.byteLength(source)>=Buffer.byteLength(initial))fail('dynamic_refactor_failed');
  }else{
   let failed=false;try{verifyDynamic(before);}catch(e){if(e.code==='dynamic_equivalence_failed')failed=true;else throw e;}
   if(!failed)fail('dynamic_initial_not_broken');
  }
  row.success=true;trace.push({tool:'dynamic-verify',checks:['11-input-snapshots','ordinary-reference-equivalence','inference-and-shacl','retract-recomputes-closure',task.kind==='refactor'?'full-runtime-and-graph-equivalence':'initial-failure-confirmed']});
  return {row,trace,source,receipt,projections,source_sha256:hash(source),runtime_pins:receipt.pins};
 }catch(e){row.error=['dynamic_equivalence_failed','dynamic_source_refused','dynamic_plan_refused','dynamic_no_change','dynamic_initial_not_broken','dynamic_refactor_failed','dynamic_result_refused','dynamic_model_refused','runtime_pin_refused','transport_outcome_unknown','invalid_method'].includes(e.code||e.message)?e.code||e.message:'dynamic_runtime_failed';return {row,trace,source};}
 finally{row.seconds=(performance.now()-start)/1000;}
}
