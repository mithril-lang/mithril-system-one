#!/usr/bin/env node
import {executeWorkflow,safeError} from '../lib/mithril-entry.mjs';
try{
 if(process.argv.slice(2).join(' ')!=='--stdin')throw Error('invalid_arguments');
 const chunks=[];let bytes=0;for await(const c of process.stdin){bytes+=c.length;if(bytes>16384)throw Error('invalid_arguments');chunks.push(c);}
 const result=await executeWorkflow(JSON.parse(Buffer.concat(chunks).toString('utf8')));console.log(JSON.stringify(result));if(!result.row.success)process.exitCode=1;
}catch(e){console.log(JSON.stringify({row:{success:false,error:safeError(e),retry:false}}));process.exitCode=1;}
