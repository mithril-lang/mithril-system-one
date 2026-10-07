import test from 'node:test';
import assert from 'node:assert/strict';
import {semanticCases,semanticAttempt,main} from '../bench/semantic-loop.mjs';

test('negative cases require the compiler contract refusal, not auth or infrastructure failure',async()=>{
 const negative=semanticCases().find(t=>t.id==='unknown-ontology');
 const refused=await semanticAttempt(negative,1,async()=>Response.json({status:'refused'},{status:422}));
 assert.equal(refused.row.success,true);
 const unauthorized=await semanticAttempt(negative,1,async()=>Response.json({error:'unauthorized'},{status:401}));
 assert.equal(unauthorized.row.success,false);
 const outage=await semanticAttempt(negative,1,async()=>Response.json({status:'refused'},{status:503}));
 assert.equal(outage.row.success,false);
 assert.equal(outage.row.outcome_unknown,true);
});

test('transport uncertainty stays unscored and cannot trigger a retry',async()=>{
 let calls=0;
 const result=await semanticAttempt(semanticCases()[0],1,async()=>{calls++;throw Error('private upstream details');});
 assert.equal(result.row.success,false);
 assert.equal(result.row.outcome_unknown,true);
 assert.equal(calls,1);
 assert.equal(result.row.error,'compiler_outcome_unknown');
 assert.equal(JSON.stringify(result).includes('private upstream details'),false);
});

test('oversized repetition budget is refused before live access',async()=>{
 await assert.rejects(main(['--live','--rounds','4']),/invalid_rounds/);
});
