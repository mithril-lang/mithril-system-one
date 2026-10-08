import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
export async function compileConvertedModule(source){
 const pin=JSON.parse(await readFile(resolve(root,'runtime/module-pin.json'),'utf8'));
 const base=resolve(root,'node_modules/mithril-dynamic-runtime'), dir=resolve(root,'node_modules/mithril-module-runtime');
 const pins=JSON.parse(await readFile(resolve(root,'runtime/pins.json'),'utf8'));
 const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const run=(cmd,args,cwd,input)=>new Promise((ok,no)=>{const c=execFile(cmd,args,{cwd,env,timeout:30000,maxBuffer:2e6},(e,out)=>e?no(Error('module_runtime_failed')):ok(out));c.stdin.on('error',()=>no(Error('module_runtime_failed')));c.stdin.end(input);});
 // Only the standalone pinned reader/compiler and nbb engine are required.
 for(const [where,sha] of [[dir,pin.commit],[resolve(base,'org-babashka-nbb'),pins['org-babashka-nbb'][1]]]){
  if((await run('git',['rev-parse','HEAD'],where)).trim()!==sha||(await run('git',['status','--porcelain','--untracked-files=no'],where)).trim())throw Error('module_runtime_pin_refused');
 }
 const artifact=JSON.parse(await run(process.execPath,[resolve(base,'org-babashka-nbb/cli.js'),'--config',resolve(root,'runtime/empty.edn'),'--classpath',resolve(dir,'src'),resolve(root,'runtime/mithril-module.cljk')],root,JSON.stringify({source})));
 if(artifact.format!=='mithril.native-js/artifact-v1'||artifact['required-imports'].length||artifact.runtime!=='native-js')throw Error('module_artifact_refused');
 return {artifact,pin,engine_pin:pins['org-babashka-nbb']};
}
