import {assessDependencies} from './dependency-assessment.mjs';
import {parse} from 'acorn';
import {parse as parseBabel} from '@babel/parser';
import {createHash} from 'node:crypto';
import {assessSecurity} from './security-ontology.mjs';
import {sourceLanguage,extractPolyglotSource} from './polyglot-source.mjs';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export const reviewSchema={type:'object',properties:{repository:{type:'string',pattern:'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'},commit:{type:'string',pattern:'^[a-f0-9]{40}$'}},required:['repository','commit'],additionalProperties:false};
export function validateTarget(x){
 if(!x||Array.isArray(x)||Object.keys(x).sort().join(',')!=='commit,repository'||typeof x.repository!=='string'||!/^[-A-Za-z0-9_.]{1,100}\/[-A-Za-z0-9_.]{1,100}$/.test(x.repository)||x.repository.split('/').some(p=>p==='.'||p==='..')||typeof x.commit!=='string'||!/^([a-f0-9]{40})$/.test(x.commit))throw Error('invalid_public_target');
 return x;
}
function walk(node,visit){if(!node||typeof node!=='object')return;if(node.type)visit(node);for(const [k,v]of Object.entries(node)){if(k==='loc')continue;if(Array.isArray(v))v.forEach(x=>walk(x,visit));else if(v&&typeof v==='object')walk(v,visit);}}
// A file-wide shadow/reassignment guard deliberately sacrifices recall. This
// handles named/namespace ESM, static top-level CommonJS and simple CLI aliases.
export function extractSource(path,bytes){
 if(sourceLanguage(path))return extractPolyglotSource(path,bytes);
 const evidence=line=>({path,line,sha256:sha256(bytes),origin:'source'}),records=[],observations=[];
 const typescript=/\.(?:ts|tsx|mts|cts)$/.test(path),jsx=/\.(?:jsx|tsx)$/.test(path);
 let ast;try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);ast=typescript||jsx?parseBabel(text,{sourceType:'unambiguous',plugins:['estree',...(typescript?['typescript']:[]),...(jsx?['jsx']:[])],errorRecovery:false,attachComment:false}).program:parse(text,{ecmaVersion:2024,sourceType:path.endsWith('.cjs')?'script':'module',locations:true});}catch{return {records,observations,parsed:false,reason:'unsupported_syntax',language:typescript?'typescript':'javascript'};}
 const names=new Map(),bindings=new Map(),mutated=new Set(),definitions=new Set(),cliAliases=new Map();
 const bind=n=>walk(n,x=>{if(x.type==='Identifier')bindings.set(x.name,(bindings.get(x.name)??0)+1);});
 const unsafe=n=>walk(n,x=>{if(x.type==='Identifier')mutated.add(x.name);});
 const commands=['exec','execSync','execFile','execFileSync','spawn','spawnSync'];
 const unwrap=n=>['TSAsExpression','TSTypeAssertion','TSNonNullExpression','TSSatisfiesExpression'].includes(n?.type)?unwrap(n.expression):n;
 const requireChild=n=>n?.type==='CallExpression'&&n.callee?.name==='require'&&n.arguments.length===1&&n.arguments[0].type==='Literal'&&['node:child_process','child_process'].includes(n.arguments[0].value);
 for(const statement of ast.body){
  const n=statement.type==='ExportNamedDeclaration'?statement.declaration:statement;
  if(n?.type==='ImportDeclaration')for(const s of n.specifiers){
   if(n.importKind==='type'||s.importKind==='type'||!['node:child_process','child_process'].includes(n.source.value))continue;
   if(s.type==='ImportSpecifier'&&commands.includes(s.imported.name))names.set(s.local.name,{command:s.imported.name,origin:'esm'});
   if(s.type==='ImportNamespaceSpecifier')names.set(s.local.name,{namespace:true,origin:'esm'});
  }
  if(n?.type==='VariableDeclaration'&&n.kind==='const')for(const d of n.declarations){
   if(requireChild(d.init)){
    if(d.id.type==='Identifier')names.set(d.id.name,{namespace:true,origin:'commonjs'});
    if(d.id.type==='ObjectPattern')for(const p of d.id.properties)if(p.type==='Property'&&!p.computed&&p.value.type==='Identifier'&&commands.includes(p.key.name??p.key.value))names.set(p.value.name,{command:p.key.name??p.key.value,origin:'commonjs'});
   }
   if(d.id.type==='Identifier')cliAliases.set(d.id.name,{expression:unwrap(d.init),start:d.start});
  }
 }
 walk(ast,n=>{
  if(n.type==='VariableDeclarator')bind(n.id);
  if(n.type==='ImportDeclaration')n.specifiers.forEach(s=>bind(s.local));
  if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type)){if(n.id)bind(n.id);n.params.forEach(bind);}
  if(n.type==='CatchClause')bind(n.param);
  if(['ClassDeclaration','ClassExpression'].includes(n.type)&&n.id)bind(n.id);
  if(n.type==='AssignmentExpression'||n.type==='UpdateExpression')unsafe(n.left??n.argument);
  if(n.type==='TSImportEqualsDeclaration')bind(n.id);
 });
 const clean=name=>(bindings.get(name)??0)===1&&!mutated.has(name);
 const globalClean=name=>!bindings.has(name)&&!mutated.has(name);
 const directArg=n=>n?.type==='MemberExpression'&&n.computed&&n.object?.type==='MemberExpression'&&!n.object.computed&&n.object.object?.type==='Identifier'&&n.object.object.name==='process'&&n.object.property?.name==='argv'&&n.property?.type==='Literal'&&Number.isInteger(n.property.value)&&n.property.value>=2&&globalClean('process');
 const input=(value,before,seen=new Set())=>{
  const n=unwrap(value);if(directArg(n))return {known:true,via:'direct_cli_argument'};
  if(n?.type==='Identifier'&&clean(n.name)&&cliAliases.has(n.name)&&!seen.has(n.name)){
   const d=cliAliases.get(n.name);if(d.start>=before)return null;seen.add(n.name);
   const r=input(d.expression,d.start,seen);return r?{known:true,via:'immutable_cli_alias'}:null;
  }
  return null;
 };
 walk(ast,n=>{
  if(n.type!=='CallExpression')return;
  const callee=unwrap(n.callee),name=callee?.type==='Identifier'?callee.name:callee?.type==='MemberExpression'&&!callee.computed&&callee.object?.type==='Identifier'?callee.object.name:null;
  const binding=names.get(name);if(!binding)return;
  const command=binding.namespace?callee.type==='MemberExpression'?callee.property.name:null:callee.type==='Identifier'?binding.command:null;
  if(!commands.includes(command))return;
  const resolved=clean(name)&&(binding.origin!=='commonjs'||globalClean('require'));
  const options=n.arguments.slice(1).find(a=>a.type==='ObjectExpression'),properties=options?.properties??[],shellProp=properties.find(p=>!p.computed&&(p.key?.name??p.key?.value)==='shell');
  const literalOptions=options&&properties.every(p=>p.type==='Property'&&p.kind==='init'&&!p.computed)&&properties.filter(p=>(p.key?.name??p.key?.value)==='shell').length<=1;
  const shell=['exec','execSync'].includes(command)?true:literalOptions&&shellProp?.value?.type==='Literal'&&typeof shellProp.value.value==='boolean'?shellProp.value.value:null;
  const flow=resolved?input(n.arguments[0],n.start):null,id='shell-'+sha256(path+':'+n.start).slice(0,20);
  records.push({id,kind:'shell',userControlled:flow?true:null,shell:resolved?shell:null,evidence:evidence(n.loc.start.line)});
  observations.push({id,call:command,resolution:resolved?'unshadowed_'+binding.origin+'_binding':'unresolved_binding',input:flow?.via??'unknown',evidence:evidence(n.loc.start.line)});
 });
 return {records,observations,parsed:true,language:typescript?'typescript':'javascript'};
}
async function readBounded(response,limit){if(!response.ok)throw Error('public_source_unavailable');let size=0,chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>limit){await response.body.cancel?.().catch(()=>{});throw Error('public_source_budget');}chunks.push(chunk);}return Buffer.concat(chunks);}
export async function fetchPublicSnapshot(target,{transport=fetch}={}){
 validateTarget(target);
 let fetchMs=0,parseMs=0;const acquisitionStart=performance.now();
 const request=async(url,limit)=>{const started=performance.now();const headers={Accept:'application/vnd.github+json','User-Agent':'Mithril-Public-Code-Review/0.1'};if(process.env.GH_TOKEN)headers.Authorization='Bearer '+process.env.GH_TOKEN;const r=await transport(url,{redirect:'error',headers,signal:AbortSignal.timeout(15000)});const bytes=await readBounded(r,limit);fetchMs+=performance.now()-started;return bytes;};
 const api='https://api.github.com/repos/'+target.repository;
 const repo=JSON.parse((await request(api,65536)).toString());
 if(repo.private!==false||repo.visibility!=='public'||repo.full_name?.toLowerCase()!==target.repository.toLowerCase())throw Error('public_repository_required');
 const commit=JSON.parse((await request(api+'/git/commits/'+target.commit,262144)).toString());
 if(commit.sha!==target.commit||!/^[a-f0-9]{40}$/.test(commit.tree?.sha))throw Error('public_commit_mismatch');
 const tree=JSON.parse((await request(api+'/git/trees/'+commit.tree.sha+'?recursive=1',2097152)).toString());
 if(tree.sha!==commit.tree.sha||tree.truncated!==false||!Array.isArray(tree.tree)||tree.tree.length>5000)throw Error('public_tree_budget');
 const inventory=tree.tree.filter(x=>x.type!=='tree');
 for(const x of inventory)if(typeof x.path!=='string'||x.path.length>256||x.path.startsWith('/')||x.path.includes('\\')||/[\x00-\x1f]/.test(x.path)||x.path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('unsafe_source_path');
 const selected=inventory.filter(x=>x.type==='blob'&&['100644','100755'].includes(x.mode)&&(/\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/.test(x.path)||sourceLanguage(x.path)));
 if(selected.length>100||selected.some(x=>!Number.isSafeInteger(x.size)||x.size>262144)||selected.reduce((s,x)=>s+x.size,0)>5242880)throw Error('public_source_budget');
 const records=[],observations=[],files=[],dependencyFiles=[],sourceOntologies=[];
 let sourceFactCount=0;
 const dependencyInventory=inventory.filter(x=>x.type==='blob'&&['100644','100755'].includes(x.mode)&&/(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|requirements[^/]*\.txt|poetry\.lock|Cargo\.lock|go\.sum)$/.test(x.path));
 if(dependencyInventory.length>20||dependencyInventory.some(x=>!Number.isSafeInteger(x.size)||x.size>1048576)||dependencyInventory.reduce((n,x)=>n+x.size,0)>2097152)throw Error('public_dependency_budget');
 for(const x of dependencyInventory){
  const bytes=await request('https://raw.githubusercontent.com/'+target.repository+'/'+target.commit+'/'+x.path.split('/').map(encodeURIComponent).join('/'),1048576);
  if(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex')!==x.sha||bytes.length!==x.size)throw Error('public_blob_mismatch');
  dependencyFiles.push({path:x.path,text:new TextDecoder('utf-8',{fatal:true}).decode(bytes),sha256:sha256(bytes),git_blob:x.sha});
 }
 for(const x of selected.sort((a,b)=>a.path.localeCompare(b.path))){
  const url='https://raw.githubusercontent.com/'+target.repository+'/'+target.commit+'/'+x.path.split('/').map(encodeURIComponent).join('/');
  const bytes=await request(url,262144);
  const gitHash=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(gitHash!==x.sha||bytes.length!==x.size)throw Error('public_blob_mismatch');
  const parseStart=performance.now();const e=extractSource(x.path,bytes);parseMs+=performance.now()-parseStart;records.push(...e.records);observations.push(...e.observations);
  sourceFactCount+=e.facts?.length??0;
  if(sourceFactCount>4000)throw Error('public_source_fact_budget');
  if(e.ontology)sourceOntologies.push({path:x.path,ontology:e.ontology,receipt:e.receipt,coverage:e.coverage});
  if(records.length>1000)throw Error('public_record_budget');
  files.push({path:x.path,sha256:sha256(bytes),git_blob:x.sha,bytes:bytes.length,parsed:e.parsed,language:e.language,...(e.reason?{reason:e.reason}:{})});
 }
 return {dependencyFiles,sourceOntologies,snapshot:{schemaVersion:1,revision:target.commit,records,coverage:{complete:false,unresolved:records.filter(x=>x.userControlled===null||x.shell===null).length}},acquisition:{repository:repo.full_name,commit:target.commit,tree:tree.sha,inventory_count:inventory.length,selected_count:selected.length,excluded_count:inventory.length-selected.length,parsed_count:files.filter(f=>f.parsed).length,unsupported_count:files.filter(f=>!f.parsed).length,timings_ms:{fetch:fetchMs,parse:parseMs,total:performance.now()-acquisitionStart},files},observations};
}
export async function reviewPublicRepository(target,options={}){
 const began=performance.now(),{snapshot,acquisition,observations,dependencyFiles,sourceOntologies}=await fetchPublicSnapshot(target,options);
 const assessment=await assessSecurity(snapshot,{method:'ontology',executor:options.executor});
 const dependencies=await assessDependencies(dependencyFiles,{transport:options.transport,matcher:options.matcher,executor:options.executor});
 dependencies.provenance={repository:acquisition.repository,commit:acquisition.commit,files:dependencyFiles.map(({path,sha256,git_blob})=>({path,sha256,git_blob})),verification:'Git blob SHA-1 and SHA-256 checked at public immutable commit'};
 return {ok:true,status:'review_incomplete',schemaVersion:1,repository:acquisition.repository,commit:target.commit,
  scope:'JavaScript/TypeScript binding-aware child_process subset plus pinned offline concrete-syntax extraction for C, C++, Java, C#, PHP, Ruby, Python, Go, Rust, Kotlin, Swift and Scala. Polyglot process spellings remain unresolved candidates; no taint or equivalence proof. npm locked-version OSV matching and Knowledge enrichment are included. No general taint, authorization, runtime or exploit verification.',
  acquisition,observations,source_ontologies:sourceOntologies,dependencies,assessment:{...assessment,provenance:'Fetched public commit; file SHA-256 and Git blob SHA-1 checked against GitHub tree',findings:assessment.findings.map(f=>({...f,status:'source_policy_candidate_requires_review'}))},
  timings_ms:{acquisition:acquisition.timings_ms.total,fetch:acquisition.timings_ms.fetch,parse:acquisition.timings_ms.parse,assessment:assessment.seconds*1000,compile:assessment.compile_ms,graph:assessment.evaluation_ms},
  execution:{target_code_executed:false,inference:false,github_writes:false},seconds:(performance.now()-began)/1000};
}
