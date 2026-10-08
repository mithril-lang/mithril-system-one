#!/usr/bin/env node
import {assessScap} from '../lib/scap-assessment.mjs';
try{if(process.argv.slice(2).join(' ')!=='--stdin')throw Error();let b=Buffer.alloc(0);for await(const c of process.stdin){b=Buffer.concat([b,c]);if(b.length>2097152)throw Error();}const a=JSON.parse(b.toString());if(!a||Object.keys(a).join(',')!=='xml')throw Error();console.log(JSON.stringify({ok:true,...await assessScap(a.xml)}));}catch{console.log(JSON.stringify({ok:false,error:'scap_review_refused',retry:false}));process.exitCode=1;}
