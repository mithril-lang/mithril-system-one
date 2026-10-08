import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const pin=JSON.parse(readFileSync(new URL('./module-pin.json',import.meta.url)));
const dir=resolve(import.meta.dirname,'../node_modules/mithril-module-runtime');
mkdirSync(dir,{recursive:true});
const run=args=>execFileSync('git',args,{cwd:dir,encoding:'utf8',timeout:180000});
run(['init','--quiet']);
let head='';try{head=run(['rev-parse','HEAD']).trim();}catch{}
if(run(['status','--porcelain','--untracked-files=no']).trim())throw Error('module_runtime_dirty');
if(head!==pin.commit){run(['fetch','--quiet','--depth=1','https://github.com/'+pin.repository+'.git',pin.commit]);run(['checkout','--quiet','--detach',pin.commit]);}
console.log(JSON.stringify({ready:true,pin}));
