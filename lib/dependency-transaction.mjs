import {mkdir,open,readFile,lstat,rename,rm,unlink} from 'node:fs/promises';
import {resolve,dirname,isAbsolute,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
const hash=x=>createHash('sha256').update(x).digest('hex');
const paths=['package.json','package-lock.json'];
const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
const git=(cwd,args)=>new Promise((ok,no)=>execFile('git',args,{cwd,env,timeout:10000,maxBuffer:65536},(e,out)=>e?no(Error('upgrade_git_scope_refused')):ok(out.trim())));
async function noLinks(path){for(let p=path;;p=dirname(p)){if((await lstat(p)).isSymbolicLink())throw Error('upgrade_symlink_refused');if(dirname(p)===p)break;}}
async function context(directory){
 if(typeof directory!=='string'||!isAbsolute(directory))throw Error('upgrade_apply_refused');
 const dir=resolve(directory);await noLinks(dir);
 if(await git(dir,['rev-parse','--show-toplevel'])!==dir)throw Error('upgrade_git_scope_refused');
 await git(dir,['ls-files','--error-unmatch','--',...paths]);
 const gitdir=await git(dir,['rev-parse','--absolute-git-dir']);await noLinks(gitdir);
 return {dir,lock:join(gitdir,'mithril-dependency-transaction'),head:await git(dir,['rev-parse','HEAD'])};
}
async function durable(path,text,mode=0o600){const h=await open(path,'wx',mode);try{await h.writeFile(text);await h.sync();}finally{await h.close();}}
async function regular(path){const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw Error('upgrade_apply_evidence_refused');return s;}
async function current(dir,entry){await regular(join(dir,entry.path));return await readFile(join(dir,entry.path),'utf8');}
function validateJournal(j,c){
 if(j?.version!==1||j.directory!==c.dir||j.head!==c.head||!Array.isArray(j.files)||j.files.length!==2)throw Error('upgrade_recovery_scope_refused');
 for(const [i,e] of j.files.entries())if(e.path!==paths[i]||typeof e.previous!=='string'||typeof e.next!=='string'||Buffer.byteLength(e.previous)>1048576||Buffer.byteLength(e.next)>1048576||hash(e.previous)!==e.before_sha256||hash(e.next)!==e.after_sha256||!Number.isInteger(e.mode)||e.mode<0||e.mode>0o777||!/^\.mithril-upgrade-[a-f0-9-]{36}$/.test(e.temp))throw Error('upgrade_recovery_evidence_refused');
}
async function rollback(c,j){
 validateJournal(j,c);if(await git(c.dir,['rev-parse','HEAD'])!==j.head)throw Error('upgrade_recovery_scope_refused');
 // Check the whole pair before touching either file; operator edits stay intact.
 for(const e of j.files){const v=await current(c.dir,e);if(v!==e.previous&&v!==e.next)throw Error('upgrade_transaction_recovery_required');}
 let restored=0;
 for(const e of j.files){
  const path=join(c.dir,e.path),v=await current(c.dir,e);
  if(v===e.next&&v!==e.previous){const temp=join(c.dir,'.mithril-upgrade-'+randomUUID());try{await durable(temp,e.previous,e.mode);if(await current(c.dir,e)!==v)throw Error('upgrade_transaction_recovery_required');await rename(temp,path);restored++;}finally{await unlink(temp).catch(()=>{});}}
  else if(v!==e.previous)throw Error('upgrade_transaction_recovery_required');
 }
 for(const e of j.files)await unlink(join(c.dir,e.temp)).catch(e=>{if(e.code!=='ENOENT')throw e;});
 await rm(c.lock,{recursive:true});return restored;
}
export async function applyDependencyPatch(directory,patch){
 if(patch?.status!=='verified_dependency_patch'||patch.base?.length!==2||patch.files?.length!==2)throw Error('upgrade_apply_refused');
 const c=await context(directory);
 try{await mkdir(c.lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw Error('upgrade_transaction_pending');throw e;}
 let j;
 try{
  await durable(join(c.lock,'owner.json'),JSON.stringify({pid:process.pid,created_at:new Date().toISOString()}));
  if(await git(c.dir,['status','--porcelain','--',...paths]))throw Error('upgrade_clean_project_required');
  const entries=[];
  for(const path of paths){
   const old=patch.base.find(f=>f.path===path),next=patch.files.find(f=>f.path===path),stat=await regular(join(c.dir,path));
   if(!old||!next||typeof next.text!=='string'||Buffer.byteLength(next.text)>1048576||hash(next.text)!==next.sha256)throw Error('upgrade_apply_evidence_refused');
   const previous=await readFile(join(c.dir,path),'utf8');if(Buffer.byteLength(previous)>1048576||hash(previous)!==old.sha256)throw Error('upgrade_apply_stale_base');
   entries.push({path,previous,next:next.text,before_sha256:hash(previous),after_sha256:next.sha256,mode:stat.mode&0o777,temp:'.mithril-upgrade-'+randomUUID()});
  }
  const prepared={version:1,directory:c.dir,head:c.head,files:entries};
  await durable(join(c.lock,'journal.json'),JSON.stringify(prepared));j=prepared;
  for(const e of entries)await durable(join(c.dir,e.temp),e.next,e.mode);
  if(await git(c.dir,['rev-parse','HEAD'])!==c.head)throw Error('upgrade_recovery_scope_refused');
  for(const e of entries){if(await current(c.dir,e)!==e.previous)throw Error('upgrade_apply_stale_base');await rename(join(c.dir,e.temp),join(c.dir,e.path));}
  for(const e of entries)if(await current(c.dir,e)!==e.next)throw Error('upgrade_transaction_recovery_required');
  await rm(c.lock,{recursive:true});j=null;
  return {status:'dependency_patch_applied',directory:c.dir,files:patch.files.map(f=>({path:f.path,sha256:f.sha256})),compatibility_tests_executed:false,git_commit_created:false,transaction:{exclusive:true,recovery_journal:true}};
 }catch(e){
  if(j){try{await rollback(c,j);}catch{throw Error('upgrade_transaction_recovery_required');}}
  else await rm(c.lock,{recursive:true});
  throw e;
 }
}
export async function recoverDependencyTransaction(directory){
 const c=await context(directory);await noLinks(c.lock);
 const recovery=join(c.lock,'recovery');try{await mkdir(recovery,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw Error('upgrade_transaction_active');throw e;}
 try{
 if((await regular(join(c.lock,'owner.json'))).size>4096)throw Error('upgrade_recovery_owner_refused');const owner=JSON.parse(await readFile(join(c.lock,'owner.json'),'utf8'));
 if(!Number.isInteger(owner.pid)||owner.pid<1)throw Error('upgrade_recovery_owner_refused');
 try{process.kill(owner.pid,0);throw Error('upgrade_transaction_active');}catch(e){if(e.code!=='ESRCH')throw Error('upgrade_transaction_active');}
 const jp=join(c.lock,'journal.json');
 try{await regular(jp);}catch(e){if(e.code==='ENOENT'){await rm(c.lock,{recursive:true});return {status:'dependency_transaction_recovered',restored_files:0};}throw e;}
 if((await lstat(jp)).size>12582912)throw Error('upgrade_recovery_evidence_refused');
 const j=JSON.parse(await readFile(jp,'utf8'));const restored=await rollback(c,j);
 return {status:'dependency_transaction_recovered',checked_files:2,restored_files:restored,git_commit_created:false,application_tests_executed:false};
 }finally{await rm(recovery,{recursive:true,force:true});}
}
export async function preflightDependencyApply(directory,files){
 if(!Array.isArray(files)||files.length!==2||new Set(files.map(f=>f?.path)).size!==2)throw Error('upgrade_input_refused');
 const c=await context(directory);
 try{await lstat(c.lock);throw Error('upgrade_transaction_pending');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(await git(c.dir,['status','--porcelain','--',...paths]))throw Error('upgrade_clean_project_required');
 for(const path of paths){const f=files.find(f=>f?.path===path);await regular(join(c.dir,path));if(!f||hash(await readFile(join(c.dir,path),'utf8'))!==f.sha256)throw Error('upgrade_apply_stale_base');}
 return {status:'dependency_apply_ready',git_head:c.head};
}
