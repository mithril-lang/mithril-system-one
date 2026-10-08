import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {planDependencyUpgrades,remediateDependencies} from '../lib/dependency-remediation.mjs';
const manifest={name:'fixture',version:'1.0.0',scripts:{postinstall:'touch /tmp/MUST_NOT_RUN'},dependencies:{lodash:'4.17.20'}};
const before={inventory:{components:[{id:'a',name:'lodash',version:'4.17.20',evidence:[{pointer:'/packages/node_modules/lodash'}]}]},findings:[{component:{id:'a'},advisory:'test',fixed_versions:['4.17.21']}],unknown:[]};
const clean={unknown:[],findings:[],execution:{target_code_executed:false,inference_calls:0}};
const lock=v=>JSON.stringify({lockfileVersion:3,packages:{'':{dependencies:{lodash:v}},'node_modules/lodash':{version:v,resolved:'https://registry.npmjs.org/lodash/-/lodash-'+v+'.tgz',integrity:'sha512-YQ=='}}});
const f=(path,text)=>({path,text,sha256:createHash('sha256').update(text).digest('hex')});
const files=[f('package.json',JSON.stringify(manifest)),f('package-lock.json',lock('4.17.20'))];
test('same-major fixed hints selected and script never supplied to resolver',async()=>{let calls=0;const r=await remediateDependencies(files,{assessor:async()=>++calls===1?before:clean,resolver:async m=>{assert.equal(m.scripts,undefined);assert.equal(m.dependencies.lodash,'4.17.21');return lock('4.17.21');}});assert.equal(r.status,'verified_dependency_patch');assert.equal(JSON.parse(r.files[0].text).scripts.postinstall,manifest.scripts.postinstall);assert.equal(r.execution.project_files_written,false);});
test('major jumps, incomplete assessment, transitive-only and custom dependency sources refuse',()=>{
 for(const [m,b] of [[manifest,{...before,unknown:[{}]}],[manifest,{...before,findings:[{...before.findings[0],fixed_versions:['5.0.0']}]}],[{...manifest,dependencies:{lodash:'file:../secret'}},before],[{...manifest,workspaces:['*']},before],[manifest,{...before,inventory:{components:[]}}]])assert.throws(()=>planDependencyUpgrades(m,b),/upgrade_/);
});
test('hash mismatch and registry bypass rejected',async()=>{await assert.rejects(remediateDependencies([{...files[0],sha256:'bad'},files[1]]),/upgrade_input/);await assert.rejects(remediateDependencies([files[0],f('package-lock.json',lock('4.17.20').replace('https://registry.npmjs.org/','https://evil.invalid/'))]),/non_registry/);});
test('resolved mismatch or new findings blocks patch output',async()=>{await assert.rejects(remediateDependencies(files,{assessor:async()=>before,resolver:async()=>lock('4.17.20')}),/resolved_version/);let n=0;await assert.rejects(remediateDependencies(files,{assessor:async()=>++n===1?before:{...clean,findings:[{}]},resolver:async()=>lock('4.17.21')}),/reassessment/);});

test('local apply requires clean Git files and matching base, writes two files without commit',async()=>{
 const {mkdtemp,writeFile,readFile,rm,realpath}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {execFileSync}=await import('node:child_process');const {applyDependencyPatch}=await import('../lib/dependency-remediation.mjs');
 const dir=await realpath(await mkdtemp(join(tmpdir(),'mithril-apply-test-')));
 try{
  for(const f of files)await writeFile(join(dir,f.path),f.text);
  const git=args=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});git(['init']);git(['add','package.json','package-lock.json']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture']);
  const patch={status:'verified_dependency_patch',base:files.map(f=>({path:f.path,sha256:f.sha256})),files:[f('package.json',JSON.stringify({...manifest,dependencies:{lodash:'4.17.21'}})),f('package-lock.json',lock('4.17.21'))]};
  await assert.rejects(applyDependencyPatch(dir,{...patch,base:patch.base.map(x=>({...x,sha256:'b'.repeat(64)}))}),/stale_base/);
  const head=git(['rev-parse','HEAD']).toString();const r=await applyDependencyPatch(dir,patch);assert.equal(r.status,'dependency_patch_applied');assert.equal(await readFile(join(dir,'package-lock.json'),'utf8'),lock('4.17.21'));assert.equal(git(['rev-parse','HEAD']).toString(),head);
  await assert.rejects(applyDependencyPatch(dir,patch),/clean_project/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
