import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../node_modules/mithril-dynamic-runtime');
const pins=JSON.parse(readFileSync(new URL('./pins.json',import.meta.url)));
mkdirSync(root,{recursive:true});
const run=(cmd,args,cwd)=>execFileSync(cmd,args,{cwd,stdio:['ignore','pipe','pipe'],timeout:180000,encoding:'utf8'});
for(const [name,[repo,sha]] of Object.entries(pins)){
 const dir=resolve(root,name);mkdirSync(dir,{recursive:true});
 run('git',['init','--quiet'],dir);
 let head='';try{head=run('git',['rev-parse','HEAD'],dir).trim();}catch{}
 if(head!==sha){run('git',['fetch','--quiet','--depth=1','https://github.com/'+repo+'.git',sha],dir);run('git',['checkout','--quiet','--detach',sha],dir);}
 if(run('git',['status','--porcelain','--untracked-files=no'],dir).trim())throw Error('runtime_dirty');
}
run('npm',['install','--omit=dev','--ignore-scripts','--no-audit','--no-fund','--no-package-lock'],resolve(root,'org-babashka-nbb'));
const engine=resolve(root,'org-babashka-nbb/cli.js');
const cp=execFileSync(process.execPath,[engine,'--classpath',resolve(root,'text/src'),resolve(root,'kotoba/bin/kbb_deps.cljk'),'-Spath'],{cwd:resolve(root,'mithril'),env:{...process.env,KBB_ENGINE:engine},encoding:'utf8',timeout:180000,maxBuffer:2e6});
writeFileSync(resolve(root,'classpath.json'),JSON.stringify({pins,engine,classpath:cp.trim().split(':').map(p=>resolve(root,'mithril',p)).join(':')}));
console.log(JSON.stringify({ready:true,pins}));
