import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export async function matchDependencyQueries(queries){
 if(!Array.isArray(queries)||queries.length>100||Buffer.byteLength(JSON.stringify({queries}))>1048576)throw Error('dependency_matching_budget');
 const pin=JSON.parse(await readFile(resolve(root,'runtime/dependency-engine-pin.json'),'utf8'));
 const config=JSON.parse(await readFile(resolve(root,'node_modules/mithril-dependency-runtime/config.json'),'utf8'));
 if(JSON.stringify(pin)!==JSON.stringify(config.pin))throw Error('dependency_engine_pin_refused');
 const base=resolve(root,'node_modules/mithril-dynamic-runtime'),pins=JSON.parse(await readFile(resolve(root,'runtime/pins.json'),'utf8'));
 const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const run=(cmd,args,cwd,input)=>new Promise((ok,no)=>{const c=execFile(cmd,args,{cwd,env,timeout:30000,maxBuffer:2e6},(e,out)=>e?no(Error('dependency_engine_failed')):ok(out));c.stdin.on('error',()=>no(Error('dependency_engine_failed')));c.stdin.end(input);});
 for(const [dir,sha] of [[config.root,pin.commit],[resolve(base,'org-babashka-nbb'),pins['org-babashka-nbb'][1]],[resolve(base,'text'),pins.text[1]]])if((await run('git',['rev-parse','HEAD'],dir)).trim()!==sha||(await run('git',['status','--porcelain','--untracked-files=no'],dir)).trim())throw Error('dependency_engine_pin_refused');
 const results=JSON.parse(await run(process.execPath,[resolve(base,'org-babashka-nbb/cli.js'),'--config',resolve(root,'runtime/empty.edn'),'--classpath',[resolve(config.root,'src'),resolve(base,'text/src')].join(':'),resolve(root,'runtime/mithril-dependencies.cljk')],root,JSON.stringify({queries})));
 if(!Array.isArray(results)||results.length!==queries.length)throw Error('dependency_engine_result_refused');
 return {pin,results};
}
