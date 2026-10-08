#!/usr/bin/env node
import {reviewTerms,runTermsWorkflow} from '../lib/terms-review.mjs';
try {
  const mode=process.argv.slice(2).join(' ');
  if (!['--stdin','--workflow'].includes(mode)) throw Error();
  const chunks=[]; let size=0;
  for await (const chunk of process.stdin) { size+=chunk.length; if(size>4718592) throw Error(); chunks.push(chunk); }
  const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  process.stdout.write(JSON.stringify(mode==='--workflow'?runTermsWorkflow(input):reviewTerms(input))+'\n');
} catch { process.stdout.write(JSON.stringify({ok:false,error:'terms_review_refused',retry:false})+'\n'); process.exitCode=1; }
