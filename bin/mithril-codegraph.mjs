#!/usr/bin/env node
import {executeCodegraph} from '../lib/codegraph.mjs';
import {safeError} from '../lib/mithril-entry.mjs';
try{
 if(process.argv.slice(2).join(' ')!=='--stdin')throw Error('invalid_arguments');
 const chunks=[];let bytes=0;for await(const c of process.stdin){bytes+=c.length;if(bytes>16384)throw Error('invalid_arguments');chunks.push(c);}
 const result=await executeCodegraph(JSON.parse(Buffer.concat(chunks).toString('utf8')));
 console.log(JSON.stringify({ok:!result.status||result.status==='conforms',result}));
 if(result.status&&result.status!=='conforms')process.exitCode=1;
}catch(e){console.log(JSON.stringify({ok:false,error:safeError(e),reason:e.reason??null,retry:false}));process.exitCode=1;}
