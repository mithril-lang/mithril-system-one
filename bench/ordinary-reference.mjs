// Executable ordinary JavaScript reference, sharing no Mithril renderer code.
import {resolve} from 'node:path';
import {taskById,ordinaryHtml} from './mithril-equivalent-tasks.mjs';
export function main(args=process.argv.slice(2)){
 if(args.length!==1)throw Error('task_id_required');
 process.stdout.write(ordinaryHtml(taskById(args[0]).expected));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 try{main();}catch{console.error('ordinary_reference_stopped');process.exitCode=1;}
}
