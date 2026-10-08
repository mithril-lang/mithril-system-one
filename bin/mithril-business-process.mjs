#!/usr/bin/env node
import {assessBusinessProcess} from '../lib/business-process.mjs';
import {parseJsonEvidence} from '../lib/json-evidence.mjs';
try{if(process.argv.slice(2).join(' ')!=='--stdin')throw Error();let b=Buffer.alloc(0);for await(const c of process.stdin){b=Buffer.concat([b,c]);if(b.length>2097152)throw Error();}const a=parseJsonEvidence(b.toString(),'bpmn');if(!a||Object.keys(a).join(',')!=='xml')throw Error();console.log(JSON.stringify({ok:true,...await assessBusinessProcess(a.xml)}));}catch{console.log(JSON.stringify({ok:false,error:'business_process_review_refused',retry:false}));process.exitCode=1;}
