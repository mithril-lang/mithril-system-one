#!/usr/bin/env node
import {assessDependencies} from '../lib/dependency-assessment.mjs';
try{
 if(process.argv.slice(2).join(' ')!=='--stdin')throw Error('usage_refused');
 let input=Buffer.alloc(0);for await(const c of process.stdin){input=Buffer.concat([input,c]);if(input.length>2097152)throw Error('input_budget');}
 const args=JSON.parse(input.toString());if(!args||Object.keys(args).join(',')!=='files')throw Error('input_refused');
 console.log(JSON.stringify({ok:true,...await assessDependencies(args.files)}));
}catch{console.log(JSON.stringify({ok:false,error:'dependency_review_refused',retry:false}));process.exitCode=1;}
