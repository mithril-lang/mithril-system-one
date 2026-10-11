#!/usr/bin/env node
import {extractSourceOntology} from '../lib/polyglot-source.mjs';
try{
 if(process.argv.slice(2).join(' ')!=='--stdin')throw Error('invalid_arguments');
 let input=Buffer.alloc(0);for await(const chunk of process.stdin){input=Buffer.concat([input,chunk]);if(input.length>32768)throw Error('frame_budget');}
 const result=extractSourceOntology(JSON.parse(input.toString('utf8')));
 process.stdout.write(JSON.stringify(result)+'\n');if(!result.ok)process.exitCode=1;
}catch{process.stdout.write(JSON.stringify({ok:false,error:'source_extraction_refused',retry:false})+'\n');process.exitCode=1;}
