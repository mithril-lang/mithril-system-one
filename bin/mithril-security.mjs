#!/usr/bin/env node
import {assessSecurity} from '../lib/security-ontology.mjs';
if(process.argv.slice(2).join(' ')!=='--stdin')throw Error('Use --stdin for a bounded ontology snapshot');
let input=Buffer.alloc(0);
try{
 for await(const chunk of process.stdin){input=Buffer.concat([input,chunk]);if(input.length>1048576)throw Error('snapshot_budget');}
 const result=await assessSecurity(JSON.parse(input.toString('utf8')));
 process.stdout.write(JSON.stringify(result)+'\n');
 // A policy violation is an evaluation result. Incomplete facts fail the gate.
 if(result.status!=='conforms_in_supplied_scope')process.exitCode=2;
}catch{process.stderr.write('Security ontology assessment refused; no retry.\n');process.exitCode=1;}
