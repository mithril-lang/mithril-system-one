import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=(args,input='',token='')=>spawnSync(process.execPath,['bin/system-one.mjs',...args],{input,encoding:'utf8',env:{...process.env,MITHRIL_API_KEY:token}});
test('CLI rejects invalid arguments before any network access',()=>{
 const result=run(['run','--template','shell','--stdin']);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(JSON.parse(result.stderr).error,'invalid_arguments');
});
test('CLI rejects oversized or missing goals without echoing input',()=>{
 for(const input of ['{}',JSON.stringify({goal:'x'.repeat(2001)}),'x'.repeat(8193)]) {
  const result=run(['run','--template','mithril-app','--stdin'],input);assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(JSON.parse(result.stderr).error,'invalid_goal');
 }
});
test('CLI requires explicit Mithril credentials and never prints them',()=>{
 const result=run(['run','--template','todo','--stdin'],JSON.stringify({goal:'Todo'}));assert.equal(result.status,1);assert.equal(JSON.parse(result.stderr).error,'mithril_authorization_required');
 const oversized='credential-sentinel-'+ 'x'.repeat(1024);
 const refused=run(['run','--template','mithril-app','--stdin'],JSON.stringify({goal:'Report'}),oversized);assert.equal(refused.status,1);assert.ok(!refused.stderr.includes(oversized));
});
