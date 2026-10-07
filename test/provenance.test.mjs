import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('reviewed source manifest binds every extracted file to published bytes',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../provenance.json',import.meta.url)));
 const paths=new Set();
 for(const f of manifest.files){
  assert.ok(!paths.has(f.path));paths.add(f.path);
  assert.ok(!f.path.split('/').some(x=>x==='..'||x==='.git'||x==='.env'));
  assert.match(f.revision,/^[a-f0-9]{40}$/);
  const bytes=readFileSync(new URL('../'+f.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),f.published_sha256,f.path);
 }
});
