import {mkdir,writeFile} from 'node:fs/promises';
import {dynamicTasks,ontology,snapshots,dataset,ordinaryResult} from './mithril-dynamic-tasks.mjs';
for(const task of dynamicTasks){
 const dir=new URL('./task-packs/mithril-dynamic-v1/'+task.id+'/',import.meta.url);
 await mkdir(dir,{recursive:true});
 await writeFile(new URL('initial.mith',dir),task.initial);
 await writeFile(new URL('goal.mith',dir),ontology);
 await writeFile(new URL('task.json',dir),JSON.stringify({id:task.id,kind:task.kind,problem:task.ordinary,states:snapshots().map(s=>({id:s.id,data:dataset(s.items),ordinary_expected:ordinaryResult(s.items)}))},null,2)+'\n');
}
