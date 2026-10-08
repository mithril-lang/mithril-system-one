import {parse} from 'acorn';
import {createHash} from 'node:crypto';
import {assessSecurity} from './security-ontology.mjs';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export const reviewSchema={type:'object',properties:{repository:{type:'string',pattern:'^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'},commit:{type:'string',pattern:'^[a-f0-9]{40}$'}},required:['repository','commit'],additionalProperties:false};
export function validateTarget(x){
 if(!x||Array.isArray(x)||Object.keys(x).sort().join(',')!=='commit,repository'||typeof x.repository!=='string'||!/^[-A-Za-z0-9_.]{1,100}\/[-A-Za-z0-9_.]{1,100}$/.test(x.repository)||x.repository.split('/').some(p=>p==='.'||p==='..')||typeof x.commit!=='string'||!/^([a-f0-9]{40})$/.test(x.commit))throw Error('invalid_public_target');
 return x;
}
function walk(node,visit){if(!node||typeof node!=='object')return;if(node.type)visit(node);for(const [k,v]of Object.entries(node)){if(k==='loc')continue;if(Array.isArray(v))v.forEach(x=>walk(x,visit));else if(v&&typeof v==='object')walk(v,visit);}}
// Conservative lexical subset: ESM named child_process imports, no same-name
// binding/reassignment anywhere, direct process.argv input. No code executes.
export function extractSource(path,bytes){
 const evidence=line=>({path,line,sha256:sha256(bytes),origin:'source'}),records=[],observations=[];
 let ast;try{ast=parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{ecmaVersion:2024,sourceType:'module',locations:true});}catch{return {records,observations,parsed:false,reason:'unsupported_syntax'};}
 const imports=new Map(),blocked=new Set();
 for(const n of ast.body)if(n.type==='ImportDeclaration'&&['node:child_process','child_process'].includes(n.source.value))for(const s of n.specifiers)if(s.type==='ImportSpecifier'&&['exec','execSync','execFile','execFileSync','spawn','spawnSync'].includes(s.imported.name))imports.set(s.local.name,s.imported.name);
 const blockPattern=n=>walk(n,x=>{if(x.type==='Identifier')blocked.add(x.name);});
 walk(ast,n=>{
  if(n.type==='VariableDeclarator')blockPattern(n.id);
  if(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(n.type)){if(n.id)blocked.add(n.id.name);n.params.forEach(blockPattern);}
  if(n.type==='CatchClause')blockPattern(n.param);
  if(['ClassDeclaration','ClassExpression'].includes(n.type)&&n.id)blocked.add(n.id.name);
  if(n.type==='ImportDeclaration')n.specifiers.forEach(s=>{if(s.local.name==='process'||!['node:child_process','child_process'].includes(n.source.value)||s.type!=='ImportSpecifier')blocked.add(s.local.name);});
  if(n.type==='AssignmentExpression'||n.type==='UpdateExpression')blockPattern(n.left??n.argument);
 });
 const directArg=n=>n?.type==='MemberExpression'&&n.computed&&n.object?.type==='MemberExpression'&&!n.object.computed&&n.object.object?.name==='process'&&n.object.property?.name==='argv'&&n.property?.type==='Literal'&&Number.isInteger(n.property.value)&&n.property.value>=2&&!blocked.has('process');
 walk(ast,n=>{
  if(n.type!=='CallExpression'||n.callee?.type!=='Identifier'||!imports.has(n.callee.name))return;
  const command=imports.get(n.callee.name),resolved=!blocked.has(n.callee.name),arg=n.arguments[0];
  const options=n.arguments.slice(1).find(a=>a.type==='ObjectExpression');
  const properties=options?.properties??[],shellProp=properties.find(p=>!p.computed&&['shell'].includes(p.key?.name??p.key?.value));
  const literalOptions=options&&properties.every(p=>p.type==='Property'&&p.kind==='init'&&!p.computed)&&properties.filter(p=>(p.key?.name??p.key?.value)==='shell').length<=1;
  const shell=['exec','execSync'].includes(command)?true:literalOptions&&shellProp?.value?.type==='Literal'&&typeof shellProp.value.value==='boolean'?shellProp.value.value:null;
  const known=resolved&&directArg(arg);
  const id='shell-'+sha256(path+':'+n.start).slice(0,20);
  records.push({id,kind:'shell',userControlled:known?true:null,shell:resolved?shell:null,evidence:evidence(n.loc.start.line)});
  observations.push({id,call:command,resolution:resolved?'unshadowed_named_import':'unresolved_binding',input:known?'direct_cli_argument':'unknown',evidence:evidence(n.loc.start.line)});
 });
 return {records,observations,parsed:true};
}
async function readBounded(response,limit){if(!response.ok)throw Error('public_source_unavailable');let size=0,chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>limit){await response.body.cancel?.().catch(()=>{});throw Error('public_source_budget');}chunks.push(chunk);}return Buffer.concat(chunks);}
export async function fetchPublicSnapshot(target,{transport=fetch}={}){
 validateTarget(target);
 const request=async(url,limit)=>{const r=await transport(url,{redirect:'error',headers:{Accept:'application/vnd.github+json','User-Agent':'Mithril-Public-Code-Review/0.1'},signal:AbortSignal.timeout(15000)});return readBounded(r,limit);};
 const api='https://api.github.com/repos/'+target.repository;
 const repo=JSON.parse((await request(api,65536)).toString());
 if(repo.private!==false||repo.visibility!=='public'||repo.full_name?.toLowerCase()!==target.repository.toLowerCase())throw Error('public_repository_required');
 const commit=JSON.parse((await request(api+'/git/commits/'+target.commit,262144)).toString());
 if(commit.sha!==target.commit||!/^[a-f0-9]{40}$/.test(commit.tree?.sha))throw Error('public_commit_mismatch');
 const tree=JSON.parse((await request(api+'/git/trees/'+commit.tree.sha+'?recursive=1',2097152)).toString());
 if(tree.sha!==commit.tree.sha||tree.truncated!==false||!Array.isArray(tree.tree)||tree.tree.length>5000)throw Error('public_tree_budget');
 const inventory=tree.tree.filter(x=>x.type!=='tree');
 for(const x of inventory)if(typeof x.path!=='string'||x.path.length>256||x.path.startsWith('/')||x.path.includes('\\')||/[\x00-\x1f]/.test(x.path)||x.path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('unsafe_source_path');
 const selected=inventory.filter(x=>x.type==='blob'&&['100644','100755'].includes(x.mode)&&/\.(m?js|cjs)$/.test(x.path));
 if(selected.length>100||selected.some(x=>!Number.isSafeInteger(x.size)||x.size>262144)||selected.reduce((s,x)=>s+x.size,0)>5242880)throw Error('public_source_budget');
 const records=[],observations=[],files=[];
 for(const x of selected.sort((a,b)=>a.path.localeCompare(b.path))){
  const url='https://raw.githubusercontent.com/'+target.repository+'/'+target.commit+'/'+x.path.split('/').map(encodeURIComponent).join('/');
  const bytes=await request(url,262144);
  const gitHash=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  if(gitHash!==x.sha||bytes.length!==x.size)throw Error('public_blob_mismatch');
  const e=extractSource(x.path,bytes);records.push(...e.records);observations.push(...e.observations);
  if(records.length>1000)throw Error('public_record_budget');
  files.push({path:x.path,sha256:sha256(bytes),git_blob:x.sha,bytes:bytes.length,parsed:e.parsed,...(e.reason?{reason:e.reason}:{})});
 }
 return {snapshot:{schemaVersion:1,revision:target.commit,records,coverage:{complete:false,unresolved:records.filter(x=>x.userControlled===null||x.shell===null).length}},acquisition:{repository:repo.full_name,commit:target.commit,tree:tree.sha,inventory_count:inventory.length,selected_count:selected.length,excluded_count:inventory.length-selected.length,files},observations};
}
export async function reviewPublicRepository(target,options={}){
 const began=performance.now(),{snapshot,acquisition,observations}=await fetchPublicSnapshot(target,options);
 const assessment=await assessSecurity(snapshot,{method:'ontology',executor:options.executor});
 return {ok:true,status:'review_incomplete',schemaVersion:1,repository:acquisition.repository,commit:target.commit,
  scope:'JavaScript ESM named child_process calls; direct CLI argument subset only. No general taint, authorization, dependency/CVE, runtime or exploit verification.',
  acquisition,observations,assessment:{...assessment,provenance:'Fetched public commit; file SHA-256 and Git blob SHA-1 checked against GitHub tree',findings:assessment.findings.map(f=>({...f,status:'source_policy_candidate_requires_review'}))},
  execution:{target_code_executed:false,inference:false,github_writes:false},seconds:(performance.now()-began)/1000};
}
