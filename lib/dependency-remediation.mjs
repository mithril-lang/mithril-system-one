import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseJsonEvidence} from './json-evidence.mjs';
import {assessDependencies} from './dependency-assessment.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const exact=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const name=/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
const file=(path,text)=>({path,text,sha256:hash(text)});
export function planDependencyUpgrades(manifest,before){
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest)||!before?.inventory?.components||!Array.isArray(before.findings)||!Array.isArray(before.unknown)||before.unknown.length)throw Error('upgrade_assessment_incomplete');
 if(['workspaces','overrides','resolutions','optionalDependencies','peerDependencies','bundledDependencies','bundleDependencies'].some(k=>k in manifest))throw Error('upgrade_manifest_scope_refused');
 const updated=structuredClone(manifest),changes=[];
 for(const group of ['dependencies','devDependencies']){
  if(manifest[group]!==undefined&&(!manifest[group]||typeof manifest[group]!=='object'||Array.isArray(manifest[group])))throw Error('upgrade_dependencies_invalid');
  for(const [pkg,spec] of Object.entries(manifest[group]??{})){
   if(!name.test(pkg)||typeof spec!=='string'||!/^\^?\d+\.\d+\.\d+$/.test(spec)&&!/^~\d+\.\d+\.\d+$/.test(spec))throw Error('upgrade_non_registry_spec_refused');
   const root=before.inventory.components.filter(c=>c.name===pkg&&c.evidence.some(e=>e.pointer==='/packages/node_modules/'+pkg));
   if(root.length!==1||!exact.test(root[0].version)||!root[0].version.split('.').every(n=>Number.isSafeInteger(Number(n))))throw Error('upgrade_direct_lock_identity_refused');
   const findings=before.findings.filter(f=>f.component.id===root[0].id);
   if(!findings.length)continue;
   const versions=findings.flatMap(f=>Array.isArray(f.fixed_versions)?f.fixed_versions:[]);
   const major=root[0].version.split('.')[0];
   const candidates=versions.filter(v=>typeof v==='string'&&exact.test(v)&&v.split('.')[0]===major&&v.split('.').every(n=>Number.isSafeInteger(Number(n))));
   if(findings.some(f=>!Array.isArray(f.fixed_versions)||!f.fixed_versions.some(v=>candidates.includes(v))))throw Error('upgrade_no_same_major_fix');
   candidates.sort((a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];});
   const to=candidates.at(-1),from=root[0].version;
   if(!to||to===from||candidates.length>100)throw Error('upgrade_candidate_refused');
   const [x,y]=[from,to].map(v=>v.split('.').map(Number));if(y[0]<x[0]||y[0]===x[0]&&(y[1]<x[1]||y[1]===x[1]&&y[2]<=x[2]))throw Error('upgrade_downgrade_refused');
   updated[group][pkg]=to;changes.push({name:pkg,from,to,group,advisories:findings.map(f=>f.advisory)});
  }
 }
 if(!changes.length)throw Error('upgrade_no_direct_fix');
 return {manifest:updated,changes};
}
async function resolveLock(manifest,lock){
 const dir=await mkdtemp(join(tmpdir(),'mithril-upgrade-'));
 try{
  await writeFile(join(dir,'package.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(dir,'package-lock.json'),lock);
  await writeFile(join(dir,'user.npmrc'),'');await writeFile(join(dir,'global.npmrc'),'');
  const env={PATH:process.env.PATH,HOME:dir,TMPDIR:dir,NPM_CONFIG_USERCONFIG:join(dir,'user.npmrc'),NPM_CONFIG_GLOBALCONFIG:join(dir,'global.npmrc'),NPM_CONFIG_CACHE:join(dir,'cache')};
  await new Promise((ok,no)=>execFile('npm',['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund','--registry=https://registry.npmjs.org/'],{cwd:dir,env,timeout:120000,maxBuffer:1048576},e=>e?no(Error('upgrade_resolution_failed')):ok()));
  return await readFile(join(dir,'package-lock.json'),'utf8');
 }finally{await rm(dir,{recursive:true,force:true});}
}
function validateRegistryLock(text){
 const l=parseJsonEvidence(text,'upgrade');if(!l||typeof l!=='object'||Array.isArray(l)||![2,3].includes(l.lockfileVersion)||!l.packages||typeof l.packages!=='object'||Array.isArray(l.packages)||Object.keys(l.packages).length>2000)throw Error('upgrade_lock_invalid');
 for(const [path,p] of Object.entries(l.packages))if(path){if(p.link||typeof p.version!=='string'||typeof p.resolved!=='string'||!p.resolved.startsWith('https://registry.npmjs.org/')||typeof p.integrity!=='string'||!/^sha512-[A-Za-z0-9+/]+=*$/.test(p.integrity))throw Error('upgrade_non_registry_lock_refused');}
 return l;
}
function validateRoot(manifest,lock){
 const root=lock.packages[''];if(!root||typeof root!=='object'||Array.isArray(root))throw Error('upgrade_root_lock_mismatch');
 for(const k of ['dependencies','devDependencies']){const a=manifest[k]??{},b=root[k]??{};if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)||Array.isArray(b)||JSON.stringify(Object.entries(a).sort())!==JSON.stringify(Object.entries(b).sort()))throw Error('upgrade_root_lock_mismatch');}
}
export async function remediateDependencies(files,{assessor=assessDependencies,resolver=resolveLock}={}){
 if(!Array.isArray(files)||files.length!==2||files.some(f=>!f||typeof f.text!=='string'||Buffer.byteLength(f.text)>1048576||f.sha256!==hash(f.text))||new Set(files.map(f=>f.path)).size!==2)throw Error('upgrade_input_refused');
 const mf=files.find(f=>f.path==='package.json'),lf=files.find(f=>f.path==='package-lock.json');if(!mf||!lf)throw Error('upgrade_root_files_required');
 const manifest=parseJsonEvidence(mf.text,'upgrade'),originalLock=validateRegistryLock(lf.text);validateRoot(manifest,originalLock);
 const before=await assessor([lf]),plan=planDependencyUpgrades(manifest,before);
 // Scripts are retained as project data but never supplied to the resolver.
 const resolving=structuredClone(plan.manifest);delete resolving.scripts;
 const text=await resolver(resolving,lf.text);if(typeof text!=='string'||Buffer.byteLength(text)>1048576)throw Error('upgrade_lock_budget');
 const lock=validateRegistryLock(text);
 for(const c of plan.changes)if(lock.packages['node_modules/'+c.name]?.version!==c.to||lock.packages['']?.[c.group]?.[c.name]!==c.to)throw Error('upgrade_resolved_version_mismatch');
 validateRoot(plan.manifest,lock);
 const after=await assessor([file('package-lock.json',text)]);
 if(!Array.isArray(after.unknown)||after.unknown.length||!Array.isArray(after.findings)||after.findings.length||after.execution?.target_code_executed!==false||after.execution?.inference_calls!==0)throw Error('upgrade_reassessment_failed');
 const delta=[];for(const path of new Set([...Object.keys(originalLock.packages),...Object.keys(lock.packages)])){if(!path)continue;const a=originalLock.packages[path],b=lock.packages[path];if(JSON.stringify(a)!==JSON.stringify(b))delta.push({path,from:a?.version??null,to:b?.version??null,kind:!a?'added':!b?'removed':a.version===b.version?'metadata_changed':'version_changed'});}
 return {status:'verified_dependency_patch',dependency_delta:delta,changes:plan.changes,base:files.map(f=>({path:f.path,sha256:f.sha256})),files:[file('package.json',JSON.stringify(plan.manifest,null,2)+'\n'),file('package-lock.json',text)],before,after,execution:{target_code_executed:false,inference_calls:0,project_files_written:false,lock_resolver:'npm registry only; scripts disabled; isolated HOME/cache/config'},limitations:['dependency advisory scope only','application compatibility and tests not executed','no host remediation or automatic merge']};
}

export {applyDependencyPatch,recoverDependencyTransaction,preflightDependencyApply} from './dependency-transaction.mjs';
