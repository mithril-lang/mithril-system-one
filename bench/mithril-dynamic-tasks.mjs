// Original Todo contract. Input snapshots are rebuilt after each event:
// OWL closure must never leak facts from an earlier snapshot.
export const ns='https://mithril.fund/test/dynamic#';
const q=JSON.stringify;
export const ontology=`(mithril/ontology
 :id "https://mithril.fund/ontology/dynamic-todo-v1"
 :profile ["https://www.w3.org/TR/rdf11-concepts/" "https://www.w3.org/TR/owl2-profiles/#OWL_2_RL" "https://www.w3.org/TR/shacl/"]
 :graph [(owl/class :id "${ns}Task")
 (owl/class :id "${ns}Open" :rdfs/sub-class-of "${ns}Task")
 (owl/class :id "${ns}Done" :rdfs/sub-class-of "${ns}Task")
 (owl/datatype-property :id "${ns}label")
 (shacl/node-shape :id "${ns}TaskShape" :sh/target-class "${ns}Task"
 :sh/property [(shacl/property-shape :sh/path "${ns}label"
 :sh/min-count 1 :sh/max-count 1 :sh/datatype "http://www.w3.org/2001/XMLSchema#string")])])\n`;
export const events=[
 {id:'add',op:'add',key:'a',labels:['Write Mithril'],done:false},
 {id:'complete',op:'toggle',key:'a'},
 {id:'second-task',op:'add',key:'b',labels:['Publish'],done:false},
 {id:'reopen',op:'toggle',key:'a'},
 {id:'delete',op:'remove',key:'b'},
 {id:'missing-label',op:'add',key:'c',labels:[],done:false},
 {id:'duplicate-label',op:'add',key:'d',labels:['one','two'],done:true},
 {id:'wrong-datatype',op:'add',key:'e',labels:[42],done:false},
 {id:'repair-input',op:'replace-labels',key:'c',labels:['Fixed']},
 {id:'remove-invalid-duplicate',op:'remove',key:'d'},
 {id:'remove-invalid-type',op:'remove',key:'e'}
];
export function snapshots(){
 const state=new Map(),out=[];
 for(const event of events){
  if(event.op==='add')state.set(event.key,{key:event.key,labels:[...event.labels],done:event.done});
  else if(event.op==='toggle')state.get(event.key).done=!state.get(event.key).done;
  else if(event.op==='remove')state.delete(event.key);
  else state.get(event.key).labels=[...event.labels];
  out.push({id:event.id,items:structuredClone([...state.values()])});
 }
 return out;
}
export function dataset(items){
 return items.flatMap(({key,labels,done})=>[
  `<urn:todo:${key}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${ns}${done?'Done':'Open'}> .`,
  ...labels.map(value=>`<urn:todo:${key}> <${ns}label> ${typeof value==='string'?q(value):q(String(value))+'^^<http://www.w3.org/2001/XMLSchema#integer>'} .`)
 ]).join('\n');
}
// Independent ordinary implementation: no RDF engine, source parser or inference.
export function ordinaryResult(items){
 const violations=[];
 for(const item of items){
  if(item.labels.length===0)violations.push([item.key,'sh:minCount']);
  if(item.labels.length>1)violations.push([item.key,'sh:maxCount']);
  for(const label of item.labels)if(typeof label!=='string')violations.push([item.key,'sh:datatype']);
 }
 return {tasks:items.map(x=>x.key).sort(),done:items.filter(x=>x.done).map(x=>x.key).sort(),violations:violations.sort(),status:violations.length?'violations':'conforms'};
}
export const dynamicTasks=[
 {id:'dynamic-repair-inheritance',kind:'repair',ordinary:'Completed tasks must still be tasks and receive required label validation.',initial:ontology.replace(`(owl/class :id "${ns}Done" :rdfs/sub-class-of "${ns}Task")`,`(owl/class :id "${ns}Done")`),op:'repair-inheritance'},
 {id:'dynamic-repair-validation',kind:'repair',ordinary:'Reject a task with no label; accept the same task after supplying one label.',initial:ontology.replace(':sh/min-count 1',':sh/min-count 0'),op:'repair-validation'},
 {id:'dynamic-refactor',kind:'refactor',ordinary:'Reduce source bytes without changing inference or validation across all input states.',initial:ontology.replaceAll('\n','\n       '),op:'compact'}
];
export const dynamicTaskById=id=>dynamicTasks.find(t=>t.id===id);
