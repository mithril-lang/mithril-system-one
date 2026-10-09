// Porcelain v2 is a stable machine format. Refuse dirty records or unknown output.
export function cleanPinnedStatus(output,expected){
 if(typeof output!=='string'||!output.endsWith('\n')||! /^[0-9a-f]{40}$/.test(expected))return false;
 const seen=new Set();
 for(const line of output.slice(0,-1).split('\n')){
  const match=/^# branch\.(oid|head|upstream|ab) (.+)$/.exec(line);
  if(!match||seen.has(match[1]))return false;
  const [,key,value]=match;seen.add(key);
  if(key==='oid'&&value!==expected)return false;
  if(key==='ab'&&!/^\+\d+ -\d+$/.test(value))return false;
 }
 return seen.has('oid')&&seen.has('head');
}
