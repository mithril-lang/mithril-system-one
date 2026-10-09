import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {cleanPinnedStatus} from '../lib/runtime-pin-check.mjs';
const sha='a'.repeat(40),clean=`# branch.oid ${sha}\n# branch.head (detached)\n`;
test('combined status requires exact HEAD and refuses all dirty or malformed records',()=>{
 assert.equal(cleanPinnedStatus(clean,sha),true);
 assert.equal(cleanPinnedStatus(clean+'# branch.upstream origin/main\n# branch.ab +0 -1\n',sha),true);
 for(const text of ['',clean.replace(sha,'b'.repeat(40)),clean.replace(sha,'(initial)'),clean+'1 M. dirty\n',clean+'u UU conflict\n',clean+'? untracked\n',clean+'# unknown accepted\n',clean+`# branch.oid ${sha}\n`,clean.replace('# branch.head (detached)\n',''),clean+'\n',clean.slice(0,-1)])assert.equal(cleanPinnedStatus(text,sha),false,text);
});
test('one actual Git status agrees with old HEAD+tracked-clean predicates',async()=>{
 const dir=await mkdtemp(resolve(tmpdir(),'mithril-pin-status-'));
 const git=(...args)=>execFileSync('git',['-c','core.hooksPath=/dev/null',...args],{cwd:dir,encoding:'utf8',stdio:'pipe'});
 try{
  git('init','--quiet');await writeFile(resolve(dir,'tracked'),'original\n');git('add','tracked');git('-c','user.name=fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','fixture');
  const expected=git('rev-parse','HEAD').trim();
  const compare=()=>{const old=git('rev-parse','HEAD').trim()===expected&&git('status','--porcelain','--untracked-files=no').trim()==='';assert.equal(cleanPinnedStatus(git('status','--porcelain=v2','--branch','--untracked-files=no'),expected),old);return old;};
  assert.equal(compare(),true);await writeFile(resolve(dir,'untracked'),'ignored\n');assert.equal(compare(),true);
  await writeFile(resolve(dir,'tracked'),'modified\n');assert.equal(compare(),false);git('add','tracked');assert.equal(compare(),false);
  git('reset','--hard','HEAD');git('checkout','--detach');assert.equal(compare(),true);
  git('mv','tracked','renamed');assert.equal(compare(),false);git('-c','user.name=fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m','changed HEAD');assert.equal(compare(),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
