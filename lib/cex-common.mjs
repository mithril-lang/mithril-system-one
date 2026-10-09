// Deterministic CEX asset-recovery tooling (common helpers).
// Every tool reads JSON from stdin and writes a single JSON document to stdout.
// All tools are offline-verifiable: live endpoints are declared, never called.
import {createHash} from 'node:crypto';
export const CEX_TOOL_VERSION = '1.0.0';

export function readStdinJson(){
  return new Promise((resolve,reject)=>{
    let data='';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data',c=>{data+=c;});
    process.stdin.on('end',()=>{
      try{resolve(data.trim()?JSON.parse(data):{});}catch(err){reject(new Error(`input_json_invalid: ${err.message}`));}
    });
    process.stdin.on('error',err=>reject(err));
  });
}

export function emit(receipt){
  process.stdout.write(JSON.stringify(receipt,null,1)+'\n');
}

export function toolFailure(code,message,detail={}){
  return {tool:'mithril-cex',version:CEX_TOOL_VERSION,success:false,code,message,detail,receipt:null};
}

export function requireFields(input,fields){
  const missing=fields.filter(f=>input[f]===undefined||input[f]===null||input[f]==='');
  if(missing.length)throw {code:'input_missing_fields',message:'missing required fields: '+missing.join(', '),detail:{missing}};
}

export function assertAddress(value,label){
  if(typeof value!=='string'||!/^[A-Za-z0-9]{20,64}$/.test(value))
    throw {code:'invalid_address',message:`${label} is not a valid chain address`,detail:{label,value}};
}

export function assertPositiveNumber(value,label){
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)
    throw {code:'invalid_amount',message:`${label} must be a positive finite number`,detail:{label,value}};
}

export function assertIsoTimestamp(value,label){
  if(typeof value!=='string'||Number.isNaN(Date.parse(value)))
    throw {code:'invalid_timestamp',message:`${label} is not an ISO-8601 timestamp`,detail:{label,value}};
}

export function assertString(value,label){
  if(typeof value!=='string'||!value.length)
    throw {code:'invalid_string',message:`${label} must be a non-empty string`,detail:{label}};
}

// Canonical, deterministic JSON string used for receipts and digests.
export function canonicalize(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonicalize).join(',')+']';
  const keys=Object.keys(value).sort();
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonicalize(value[k])).join(',')+'}';
}

export function sha256Hex(text){
  return createHash('sha256').update(text,'utf8').digest('hex');
}

export function digestOf(value){
  return sha256Hex(canonicalize(value));
}

// Wrap a tool body: catches {code,message,detail} validation errors and generic failures.
export async function runTool(tool,version,body){
  let input;
  try{input=await readStdinJson();}
  catch(err){emit(toolFailure(err.message.split(':')[0]||'input_error',err.message));process.exitCode=1;return;}
  try{
    const receipt=await body(input);
    emit({tool,version:version||CEX_TOOL_VERSION,success:true,receipt});
  }catch(err){
    const e=err&&err.code?err:{code:'tool_error',message:String(err&&err.message||err)};
    emit(toolFailure(e.code,e.message,e.detail||{}));
    process.exitCode=1;
  }
}
