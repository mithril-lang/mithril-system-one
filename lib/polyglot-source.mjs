import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {isAbsolute,resolve} from 'node:path';

const hash=x=>createHash('sha256').update(x).digest('hex');
const extensions={c:'c',h:'c',cc:'cpp',cpp:'cpp',cxx:'cpp',hpp:'cpp',hh:'cpp',hxx:'cpp',java:'java',cs:'csharp',php:'php',rb:'ruby',py:'python',go:'go',rs:'rust',kt:'kotlin',kts:'kotlin',swift:'swift',scala:'scala'};
export const sourceLanguages=Object.freeze([...new Set(Object.values(extensions))]);
export const sourceLanguage=path=>{const extension=typeof path==='string'?path.split('.').at(-1):null;return Object.hasOwn(extensions,extension)?extensions[extension]:null;};
export const sourceExtractSchema={type:'object',additionalProperties:false,required:['path','source'],properties:{path:{type:'string',maxLength:256},source:{type:'string',maxLength:16384}}};
const ns='https://mithril.fund/source/v1#';
export function extractPolyglotSource(path,bytes,{python=process.env.MITHRIL_SOURCE_PYTHON}={}){
 const language=sourceLanguage(path),sha256=hash(bytes);
 const empty=reason=>({parsed:false,language,reason,records:[],observations:[],facts:[],coverage:{complete:false},source_sha256:sha256});
 if(typeof path!=='string'||path.length>256||path.startsWith('/')||path.includes('\\')||/[\x00-\x1f]/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('unsafe_source_path');
 if(!language)return empty('unsupported_language');
 if(bytes.length>262144)return empty('parser_source_budget');
 let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return empty('invalid_source_encoding');}
 // Only an owner-configured absolute interpreter can load the pinned parser.
 if(!python||!isAbsolute(python))return empty('parser_runtime_unavailable');
 const env=Object.fromEntries(['PATH','HOME','TMPDIR','SYSTEMROOT'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const child=spawnSync(python,['-I',resolve(import.meta.dirname,'../runtime/source-parser.py')],{env,input:JSON.stringify({source,language}),timeout:5000,maxBuffer:2_000_000,encoding:'utf8'});
 if(child.error)return empty(child.error.code==='ETIMEDOUT'?'parser_timeout':'parser_runtime_unavailable');
 let result;try{result=JSON.parse(child.stdout);}catch{return empty('parser_runtime_failed');}
 if(child.status!==0||!result.parsed)return empty(result.reason??'parser_runtime_failed');
 const facts=result.facts.map(f=>({...f,id:'urn:source:'+hash(path+':'+sha256+':'+f.kind+':'+f.start_byte),evidence:{path,line:f.line,sha256,origin:'source'}}));
 const owners=new Map(facts.filter(f=>f.kind==='definition').map(f=>[f.start_byte,f.id]));
 const graph=facts.map(f=>({'@id':f.id,'@type':ns+f.kind,'s:language':language,'s:syntax':f.syntax,'s:spelling':f.spelling??'','s:path':path,'s:sourceSha256':sha256,'s:line':f.line,'s:column':f.column,'s:resolution':f.resolution,...(owners.has(f.owner)?{'s:owner':{'@id':owners.get(f.owner)}}:{})}));
 const expanded=graph.map(node=>Object.fromEntries(Object.entries(node).map(([k,v])=>[k.startsWith('s:')?ns+k.slice(2):k,v])));
 const ontology={'@context':'https://mithril.fund/context/v1','@type':'Ontology','@id':'https://mithril.fund/ontology/source/'+hash(path+':'+sha256),profile:['https://www.w3.org/TR/rdf11-concepts/','https://www.w3.org/TR/owl2-profiles/#OWL_2_RL','https://www.w3.org/TR/shacl/'],'@graph':[{'@id':'urn:source:file:'+hash(path+':'+sha256),'@type':ns+'SourceFile',[ns+'path']:path,[ns+'sourceSha256']:sha256},...expanded]};
 // Process API spellings are review candidates, never resolved library bindings.
 const processApis={c:['system','popen','execve','execl'],cpp:['system','std::system','popen','execve'],java:['exec','start'],csharp:['Start'],php:['system','exec','shell_exec','passthru','popen','proc_open'],ruby:['system','exec','spawn','popen'],python:['subprocess.run','subprocess.call','subprocess.Popen','os.system','os.popen'],go:['exec.Command','exec.CommandContext'],rust:['Command::new'],kotlin:['exec','start'],swift:['run'],scala:['exec','start']};
 const candidates=facts.filter(f=>f.kind==='call'&&(processApis[language].includes(f.spelling)||(language==='csharp'&&f.spelling==='System.Diagnostics.Process.Start')));
 const records=candidates.map(f=>({id:'shell-'+hash(f.id).slice(0,20),kind:'shell',userControlled:null,shell:null,evidence:f.evidence}));
 const observations=candidates.map((f,i)=>({id:records[i].id,call:f.spelling,resolution:'syntactic_only',input:'unknown',evidence:f.evidence}));
 const mithril=JSON.stringify(ontology,null,2)+'\n';
 return {format:'mithril.source-ontology/v1',parsed:true,language,source_sha256:sha256,facts,records,observations,ontology,mithril,coverage:{complete:false,scope:'Concrete syntax definitions, imports and calls; symbol resolution, taint and execution equivalence are unverified.'},receipt:{format:'mithril.source-extraction-receipt/v1',parser:'tree-sitter-language-pack',pins:result.pins,source_sha256:sha256,mithril_sha256:hash(mithril),facts_sha256:hash(JSON.stringify(facts)),column_unit:'utf8_bytes',inference_calls:0,target_code_executed:false}};
}
export function extractSourceOntology(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='path,source'||typeof input.path!=='string'||typeof input.source!=='string'||Buffer.byteLength(input.source)>16384)throw Error('invalid_arguments');
 const result=extractPolyglotSource(input.path,Buffer.from(input.source));
 return {ok:result.parsed,...result};
}
