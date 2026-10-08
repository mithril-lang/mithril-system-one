#!/usr/bin/env node
import {convertSource} from '../lib/source-to-mithril.mjs';
try{
 if(process.argv.length!==3||process.argv[2]!=='--stdin')throw Error('usage_refused');
 let input='';for await(const c of process.stdin){input+=c;if(Buffer.byteLength(input)>32768)throw Error('input_budget');}
 console.log(JSON.stringify(await convertSource(JSON.parse(input))));
}catch(e){console.log(JSON.stringify({ok:false,error:e.code??'conversion_refused',location:e.location??null,retry:false}));process.exitCode=1;}
