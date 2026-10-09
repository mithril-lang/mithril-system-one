import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emitMithril, compileMithril, generateMithril, COMPILER } from '../lib/mithril-language.mjs';
import { API, MODEL } from '../lib/inference.mjs';
const compiled = () =>
  JSON.parse(readFileSync(new URL('./fixtures/mithril-app-compiled.json', import.meta.url)));
const app = {
  name: 'Mithril Observatory',
  description: 'A bounded ontology application compiled without generated source text.',
  headline: 'Signals become an inspectable graph.',
  summary:
    'OWL closes the component set, SHACL validates the source, SPARQL selects facts, and Web IR renders the admitted result.',
  template: 'dashboard',
};
test('real compiler fixture binds Mithril source, canonical artifact and semantic receipts; auth stays at inference', async () => {
  let calls = 0;
  const result = await generateMithril(
    'Create an ontology dashboard',
    new Request('https://code.mithril.fund', {
      headers: {
        cookie: 'session-private',
        'x-mithril-token': 'mithril-private',
        authorization: 'Bearer github-private',
      },
    }),
    async (url, init) => {
      calls++;
      if (url === API + '/chat/completions') {
        assert.equal(init.headers.authorization, 'Bearer mithril-private');
        assert.ok(!JSON.stringify(init).includes('github-private'));
        return Response.json({
          id: 'chat:language',
          model: MODEL,
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(app) } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        });
      }
      assert.equal(url, COMPILER);
      assert.deepEqual(Object.keys(init.headers).sort(), ['accept', 'content-type']);
      assert.equal(init.body, emitMithril(app));
      return Response.json(compiled());
    },
  );
  assert.equal(calls, 2);
  assert.equal(result.format, 'mithril.language-project/v1');
  assert.ok(result.files['application.mith'].startsWith('(mithril/app-agent'));
  assert.ok(!Object.keys(result.files).some((path) => path.endsWith('.cljk')));
  assert.equal(result.receipt.trace.find((s) => s.id === 'deploy').status, 'not-run');
});
test('unknown choices, extra effects and source injection cannot enter Mithril emission', () => {
  for (const value of [
    { ...app, template: 'terminal' },
    { ...app, shell: 'rm' },
    { ...app, summary: 'x\n(mithril/program)' },
  ])
    assert.throws(() => emitMithril(value));
  const source = emitMithril({ ...app, name: '") (evil) <script>' });
  assert.ok(source.includes(':name "\\\") (evil) <script>"'));
  assert.equal((source.match(/:governor/g) || []).length, 1);
});
test('a missing semantic stage or mismatched graph cannot be claimed as compiled; no fallback or retry', async () => {
  for (const mutate of [
    (v) => v.trace.splice(0, 1),
    (v) => (v.semanticRun['artifact-digest'] = 'sha256:wrong'),
    (v) => (v.status = 'refused'),
    (v) => (v.trace.find((s) => s.id === 'deploy').status = 'executed'),
  ]) {
    const value = compiled();
    mutate(value);
    let count = 0;
    await assert.rejects(
      compileMithril(emitMithril(app), async () => {
        count++;
        return Response.json(value);
      }),
      /mithril_compile_refused/,
    );
    assert.equal(count, 1);
  }
});

test('inference and compiler refuse redirects without following them or retrying', async () => {
  let calls = 0;
  await assert.rejects(generateMithril('A report', new Request('https://code.mithril.fund'), async (_, init) => {
    calls++;
    assert.equal(init.redirect, 'manual');
    return new Response(null, {status: 302, headers: {location: 'https://unapproved.example/'}});
  }), {code: 'mithril_inference_302'});
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(compileMithril(emitMithril(app), async (_, init) => {
    calls++;
    assert.equal(init.redirect, 'manual');
    return new Response(null, {status: 307, headers: {location: 'https://unapproved.example/'}});
  }), {message: 'mithril_compile_refused'});
  assert.equal(calls, 1);
});

test('missing or malformed matching digests and invalid response shapes fail closed', async () => {
  for (const digest of [undefined, null, '', 'same', 'sha256:abc', 42, {}, 'sha256:' + 'g'.repeat(64)]) {
    const value = compiled();
    value.artifact['graph-digest'] = digest;
    value.semanticRun['artifact-digest'] = digest;
    await assert.rejects(compileMithril(emitMithril(app), async () => Response.json(value)),
      {code: 'mithril_compile_refused'});
  }
  for (const value of [null, {...compiled(), trace: {}}])
    await assert.rejects(compileMithril(emitMithril(app), async () => Response.json(value)),
      {code: 'mithril_compile_refused'});
});

test('one-sided missing digests and distinct valid digests cannot bind a receipt', async () => {
  for (const mutate of [
    v => {delete v.artifact['graph-digest'];},
    v => {delete v.semanticRun['artifact-digest'];},
    v => {v.semanticRun['artifact-digest'] = 'sha256:' + '0'.repeat(64);},
  ]) {
    const value = compiled();
    mutate(value);
    let calls = 0;
    await assert.rejects(compileMithril(emitMithril(app), async () => {
      calls++;
      return Response.json(value);
    }), {code: 'mithril_compile_refused'});
    assert.equal(calls, 1);
  }
});
