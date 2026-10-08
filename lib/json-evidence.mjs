// Native syntax validation plus bounded structural walk for duplicate JSON keys.
export function parseJsonEvidence(text,prefix='dependency'){
 if(typeof text!=='string'||Buffer.byteLength(text)>1048576)throw Error(prefix+'_json_budget');
 const value=JSON.parse(text),tokens=text.match(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g);
 if(!tokens||tokens.length>50000)throw Error(prefix+'_json_budget');
 let i=0,nodes=0;
 function walk(depth){
  if(depth>64||++nodes>10000)throw Error(prefix+'_json_budget');
  const t=tokens[i++];
  if(t==='{'){const keys=new Set();while(tokens[i]!=='}'){const key=JSON.parse(tokens[i++]);if(keys.has(key))throw Error(prefix+'_duplicate_json_key');keys.add(key);i++;walk(depth+1);if(tokens[i]===',')i++;else break;}i++;}
  else if(t==='['){while(tokens[i]!==']'){walk(depth+1);if(tokens[i]===',')i++;else break;}i++;}
 }
 walk(0);if(i!==tokens.length)throw Error(prefix+'_json_invalid');return value;
}
