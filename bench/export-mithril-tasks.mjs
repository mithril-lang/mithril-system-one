import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {equivalentTasks,ontologyContract,ordinaryHtml} from './mithril-equivalent-tasks.mjs';

export async function main(args=process.argv.slice(2)){
 if(args.length!==2||args[0]!=='--output')throw Error('output_required');
 const root=resolve(args[1]);await mkdir(dirname(root),{recursive:true});await mkdir(root,{recursive:false});
 await writeFile(root+'/manifest.json',JSON.stringify({format:'mithril.original-task-pack/v1',license:'Apache-2.0',scope:'Original public static-document adaptations; no standard benchmark task or grader is replaced.',tasks:equivalentTasks.map(({id,kind})=>({id,kind}))},null,2));
 for(const task of equivalentTasks){
  const dir=root+'/'+task.id;await mkdir(dir);
  await writeFile(dir+'/instruction.md',`# ${task.id}\n\n${task.ordinary}\n\nEdit application.mith using the supplied goal and ontology contract. Completion requires actual Mithril compilation and the harness verifier. The ordinary JavaScript reference is executed with: node bench/ordinary-reference.mjs ${task.id}.\n\n${task.kind==='refactor'?'Refactor is format-only: preserve the entire compiled App IR, preserve ordinary HTML bytes and reduce UTF-8 source bytes.':'Match all goal content, template and derived shape. Preserve the approved ontology/library bindings.'}\n`);
  await writeFile(dir+'/application.mith',task.initial);
  await writeFile(dir+'/goal.json',JSON.stringify(task.goal,null,2));
  await writeFile(dir+'/ontology-contract.json',JSON.stringify(ontologyContract(task),null,2));
  await writeFile(dir+'/ordinary-reference.html',ordinaryHtml(task.expected));
 }
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))main().catch(()=>{console.error('mithril_task_export_stopped');process.exitCode=1;});
