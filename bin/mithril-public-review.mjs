#!/usr/bin/env node
import {reviewPublicRepository} from '../lib/public-code-review.mjs';
try{
 if(process.argv.slice(2).join(' ')!=='--stdin')throw Error();
 let input=Buffer.alloc(0);for await(const c of process.stdin){input=Buffer.concat([input,c]);if(input.length>4096)throw Error();}
 process.stdout.write(JSON.stringify(await reviewPublicRepository(JSON.parse(input.toString('utf8'))))+'\n');
}catch{process.stdout.write(JSON.stringify({ok:false,error:'public_review_refused',retry:false})+'\n');process.exitCode=1;}
