import {parse} from '@babel/parser';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {resolve} from 'node:path';
import {compileConvertedModule} from './mithril-module-runtime.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const refuse=(code,node)=>{throw Object.assign(Error(code),{code,location:node?.loc?.start?{line:node.loc.start.line,column:node.loc.start.column}:null});};
const name=n=>{if(typeof n!=='string'||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)||['eval','arguments','undefined'].includes(n))refuse('identifier_refused');return n;};
const literal=value=>({'@type':'Literal',datatype:'js-value',value});
const local=n=>({'@type':'Local',name:n});
const typeOfAnnotation=a=>{
 if(!a)return null;
 const t=a.typeAnnotation;
 if(t?.type==='TSBooleanKeyword')return 'bool';
 if(t?.type==='TSNumberKeyword')return 'number';
 if(t?.type==='TSArrayType'&&t.elementType.type==='TSBooleanKeyword')return 'bool[]';
 refuse('type_annotation_refused',a);
};
const body=f=>{
 if(f.async||f.generator||f.typeParameters)refuse('function_refused',f);
 if(f.body.type!=='BlockStatement')return f.body;
 if(f.body.directives?.length||f.body.body.length!==1||f.body.body[0].type!=='ReturnStatement'||!f.body.body[0].argument)refuse('statements_refused',f.body);
 return f.body.body[0].argument;
};
const same=(a,b,n)=>{if(a!==b)refuse('type_mismatch',n);};
// Independent reference path evaluates only admitted original AST expressions,
// never eval/import/execute the submitted JavaScript or TypeScript text.
function reference(n,env){
 switch(n.type){
 case 'Identifier':return env.get(n.name);
 case 'BooleanLiteral':return n.value;
 case 'UnaryExpression':return !reference(n.argument,env);
 case 'ConditionalExpression':return reference(n.test,env)?reference(n.consequent,env):reference(n.alternate,env);
 case 'LogicalExpression':{const a=reference(n.left,env);return n.operator==='&&'?(a&&reference(n.right,env)):(a||reference(n.right,env));}
 case 'BinaryExpression':{const a=reference(n.left,env),b=reference(n.right,env);return n.operator==='==='?a===b:a!==b;}
 case 'MemberExpression':return reference(n.object,env).length;
 case 'CallExpression':{const values=reference(n.callee.object,env),cb=n.arguments[0],out=[];for(const item of values){const scope=new Map(env);scope.set(cb.params[0].name,item);if(reference(body(cb),scope))out.push(item);}return out;}
 default:refuse('reference_refused',n);
 }
}
function form(x){
 if(Array.isArray(x))return '['+x.map(form).join(' ')+']';
 if(x&&typeof x==='object'){
  const tags={NativeJsModule:'mithril/native-js-module',Function:'mithril/function',Local:'mithril/local',Literal:'mithril/literal',HostUnary:'mithril/host-unary',HostBinary:'mithril/host-binary',HostLogical:'mithril/host-logical',HostGet:'mithril/host-get',HostMethod:'mithril/host-method',NativeLambda:'mithril/native-lambda',If:'mithril/if'};
  const tag=x['@type']?tags[x['@type']]:'rdf/node';if(!tag)refuse('form_refused');
  return '('+tag+Object.entries(x).filter(([k])=>!['@type','@context'].includes(k)).map(([k,v])=>' :'+k+' '+form(v)).join('')+')';
 }
 return JSON.stringify(x);
}
const domain=t=>t==='bool'?[false,true]:Array.from({length:511},(_,i)=>{const length=Math.floor(Math.log2(i+1)),offset=i-(2**length-1);return Array.from({length},(_,bit)=>Boolean(offset&(1<<bit)));});
export function extractSourceModule(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['source','language','types'].includes(k))||typeof input.source!=='string'||Buffer.byteLength(input.source)>16384||!['javascript','typescript'].includes(input.language))refuse('input_refused');
 const types=input.types===undefined?{}:input.types;
 if(!types||typeof types!=='object'||Array.isArray(types))refuse('contracts_refused');
 let ast;try{ast=parse(input.source,{sourceType:'module',plugins:input.language==='typescript'?['typescript']:[]});}catch{refuse('parse_refused');}
 if(ast.program.directives.length||ast.program.body.length<1||ast.program.body.length>8)refuse('module_refused');
 let nodes=0;const facts=[],cases=[],functions=[],signatures=[],names=new Set();
 for(const statement of ast.program.body){
  if(statement.type!=='ExportNamedDeclaration'||statement.source||statement.specifiers.length||!statement.declaration||statement.exportKind==='type')refuse('exports_refused',statement);
  const d=statement.declaration;
  let f,n;
  if(d.type==='FunctionDeclaration'){f=d;n=d.id?.name;}
  else if(d.type==='VariableDeclaration'&&d.kind==='const'&&d.declarations.length===1&&d.declarations[0].id.type==='Identifier'&&d.declarations[0].init?.type==='ArrowFunctionExpression'){f=d.declarations[0].init;n=d.declarations[0].id.name;}
  else refuse('declaration_refused',d);
  name(n);if(names.has(n))refuse('duplicate_function',d);names.add(n);
  if(f.params.length>4)refuse('parameter_budget',f);
  const declared=Object.hasOwn(types,n)?types[n]:undefined;
  if(declared!==undefined&&(!Array.isArray(declared)||declared.length!==f.params.length||declared.some(t=>!['bool','bool[]'].includes(t))))refuse('contracts_refused',f);
  const scope=new Map();const params=f.params.map((p,i)=>{
   if(p.type!=='Identifier'||p.optional||p.decorators?.length)refuse('parameter_refused',p);
   name(p.name);if(scope.has(p.name))refuse('duplicate_parameter',p);
   const annotated=typeOfAnnotation(p.typeAnnotation),t=declared?.[i]??annotated;
   if(!['bool','bool[]'].includes(t))refuse('parameter_type_required',p);
   if(annotated)same(annotated,t,p);scope.set(p.name,t);return {name:p.name,type:t};
  });
  function expression(e,env,depth=0){
   if(depth>32||++nodes>512)refuse('expression_budget',e);
   const recurse=x=>expression(x,env,depth+1);
   let result;
   switch(e.type){
   case 'Identifier':if(!env.has(e.name))refuse('free_variable_refused',e);result=[local(e.name),env.get(e.name)];break;
   case 'BooleanLiteral':result=[literal(e.value),'bool'];break;
   case 'UnaryExpression':{if(e.operator!=='!'||!e.prefix)refuse('operator_refused',e);const [v,t]=recurse(e.argument);same(t,'bool',e);result=[{'@type':'HostUnary',operator:'!',value:v},'bool'];break;}
   case 'LogicalExpression':case 'BinaryExpression':{if(!['&&','||','===','!=='].includes(e.operator))refuse('operator_refused',e);const [a,ta]=recurse(e.left),[b,tb]=recurse(e.right);same(ta,'bool',e);same(tb,'bool',e);result=[{'@type':e.type==='LogicalExpression'?'HostLogical':'HostBinary',operator:e.operator,left:a,right:b},'bool'];break;}
   case 'ConditionalExpression':{const [condition,t]=recurse(e.test),[a,ta]=recurse(e.consequent),[b,tb]=recurse(e.alternate);same(t,'bool',e);same(ta,tb,e);result=[{'@type':'If',condition,then:a,else:b},ta];break;}
   case 'MemberExpression':{if(e.computed||e.optional||e.property.type!=='Identifier'||e.property.name!=='length')refuse('property_refused',e);const [o,t]=recurse(e.object);same(t,'bool[]',e);result=[{'@type':'HostGet',object:o,key:literal('length')},'number'];break;}
   case 'CallExpression':{
    const c=e.callee,cb=e.arguments[0];
    if(e.optional||e.typeParameters||e.typeArguments||c.type!=='MemberExpression'||c.computed||c.optional||c.property.name!=='filter'||e.arguments.length!==1||cb?.type!=='ArrowFunctionExpression'||cb.params.length!==1||cb.params[0].type!=='Identifier'||cb.params[0].optional)refuse('call_refused',e);
    const [o,t]=recurse(c.object);same(t,'bool[]',e);
    const p=cb.params[0];name(p.name);if(p.typeAnnotation)same(typeOfAnnotation(p.typeAnnotation),'bool',p);
    const inner=new Map(env);inner.set(p.name,'bool');const [v,vt]=expression(body(cb),inner,depth+1);same(vt,'bool',cb);if(cb.returnType)same(typeOfAnnotation(cb.returnType),'bool',cb);
    result=[{'@type':'HostMethod',object:o,key:literal('filter'),args:[{'@type':'NativeLambda',params:[p.name],body:v}]},'bool[]'];break;
   }
   default:refuse('syntax_refused',e);
   }
   facts.push({function:n,syntax:e.type,type:result[1],line:e.loc.start.line,column:e.loc.start.column});return result;
  }
  const original=body(f),[lowered,returns]=expression(original,scope),annotation=typeOfAnnotation(f.returnType);
  if(annotation)same(annotation,returns,f);
  signatures.push({name:n,params,returns});
  functions.push({'@type':'Function',name:n,params:params.map(p=>({name:p.name,datatype:'js-value'})),returns:'js-value',body:lowered});
  let inputs=[[]];for(const p of params){if(inputs.length*domain(p.type).length>4096)refuse('equivalence_budget',f);inputs=inputs.flatMap(a=>domain(p.type).map(v=>[...a,v]));}
  if(cases.length+inputs.length>8192)refuse('equivalence_budget',f);
  for(const args of inputs)cases.push({name:n,args,expected:reference(original,new Map(params.map((p,i)=>[p.name,args[i]])))});
 }
 if(Object.keys(types).some(k=>!names.has(k)))refuse('unknown_contract');
 const document={'@context':'https://mithril.fund/context/native-js-module/v1','@type':'NativeJsModule',name:'source.converted',imports:[],exports:[...names],functions};
 return {format:'mithril.source-ir/v1',source_sha256:hash(input.source),document,facts,signatures,mithril:form(document)+'\n',cases};
}
export async function convertSource(input){
 const started=performance.now(),ir=extractSourceModule(input),compiled=await compileConvertedModule(ir.mithril);
 const env=Object.fromEntries(['PATH','HOME','TMPDIR'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 const report=await new Promise((ok,no)=>{const c=execFile(process.execPath,[resolve(import.meta.dirname,'../runtime/verify-converted.mjs')],{env,timeout:10000,maxBuffer:2e6},(e,out)=>e?no(Error('equivalence_failed')):ok(JSON.parse(out)));c.stdin.on('error',()=>no(Error('equivalence_failed')));c.stdin.end(JSON.stringify({source:compiled.artifact.source,cases:ir.cases}));});
 return {ok:true,format:ir.format,source_sha256:ir.source_sha256,mithril:ir.mithril,document:ir.document,signatures:ir.signatures,source_facts:ir.facts,ontology:{'@context':{s:'https://mithril.fund/source/v1#'},'@graph':ir.facts.map((f,i)=>({'@id':'urn:source:'+ir.source_sha256+':'+i,'@type':'s:Expression','s:function':f.function,'s:syntax':f.syntax,'s:datatype':f.type,'s:line':f.line,'s:column':f.column}))},artifact:compiled.artifact,receipt:{compiler:compiled.pin,engine:compiled.engine_pin,mithril_sha256:hash(ir.mithril),artifact_sha256:hash(compiled.artifact.source),verification:report,seconds:(performance.now()-started)/1000,inference_calls:0,scope:'Boolean inputs and dense plain Boolean arrays of length 0–8; bounded exhaustive equivalence to admitted source AST. Not a proof for arbitrary JS values or full programs.'}};
}
