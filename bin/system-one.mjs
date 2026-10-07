#!/usr/bin/env node
import { ready, generate } from '../lib/inference.mjs';
import { generateMithril } from '../lib/mithril-language.mjs';
const args=process.argv.slice(2);
try {
 if (args.length===1 && args[0]==='status') {
  const connected=await ready(); console.log(JSON.stringify({ready:connected,inference:'https://api.mithril.fund/v1/chat/completions',compiler:'https://app.mithril.fund/api/compile',templates:['mithril-app','todo']}));
  if(!connected)process.exitCode=1;
 } else {
  if(args.length!==4 || args[0]!=='run' || args[1]!=='--template' || !['mithril-app','todo'].includes(args[2]) || args[3]!=='--stdin')throw Error('invalid_arguments');
  const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>8192)throw Error('invalid_goal');chunks.push(chunk);}
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(typeof input.goal!=='string'||!input.goal.trim()||input.goal.length>2000)throw Error('invalid_goal');
  const token=process.env.MITHRIL_API_KEY;
  if(typeof token!=='string'||!token.trim()||token.length>1024)throw Error('mithril_authorization_required');
  const request=new Request('https://code.mithril.fund',{headers:{'x-mithril-token':token}});
  const result=await (args[2]==='todo'?generate:generateMithril)(input.goal,request);
  console.log(JSON.stringify(result));
 }
} catch(error) {
 const safe=['invalid_arguments','invalid_goal','mithril_authorization_required','harness_verification_failed','mithril_proposal_refused','mithril_compile_refused','mithril_source_budget','mithril_inference_401','mithril_inference_403','mithril_inference_429'];
 console.error(JSON.stringify({ok:false,error:safe.includes(error.code||error.message)?(error.code||error.message):'run_outcome_unknown',retry:false}));process.exitCode=1;
}
