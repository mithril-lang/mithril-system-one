import test from 'node:test';
import assert from 'node:assert/strict';
import { emitMithril, generateMithril } from '../lib/mithril-language.mjs';
import { applyPlan, inspectSource, modelPlan } from '../lib/mithril-task-agent.mjs';
import { equivalentTasks } from '../bench/mithril-equivalent-tasks.mjs';
import { API, MODEL } from '../lib/inference.mjs';

// Independent compiler oracle; do not derive expected limits from production constants.
const limits = { name: 80, description: 240, headline: 120, summary: 480 };
const app = { name: 'App', description: 'Description', headline: 'Headline', summary: 'Summary', template: 'report' };
const request = new Request('https://code.mithril.fund');
const completion = (proposal) => Response.json({
  id: 'offline:boundary', model: MODEL,
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(proposal) } }],
  usage: { prompt_tokens: 1, completion_tokens: 1 },
});
const exactUnits = (unit, length) => unit.repeat(Math.floor(length / unit.length)) + 'x'.repeat(length % unit.length);

for (const [field, limit] of Object.entries(limits)) {
  test(`${field}: compiler N-1/N/N+1 in ASCII, Japanese, non-BMP and combining text`, () => {
    for (const unit of ['a', '日', '😀', 'e\u0301']) {
      for (const length of [limit - 1, limit, limit + 1]) {
        const value = { ...app, [field]: exactUnits(unit, length) };
        assert.equal(value[field].length, length);
        if (length > limit) {
          assert.throws(() => emitMithril(value), { code: 'mithril_proposal_refused' });
          assert.throws(() => applyPlan('', [{ op: 'set-app', value }]), { code: 'mithril_proposal_refused' });
        } else {
          const source = emitMithril(value);
          assert.deepEqual(inspectSource(source).app, value);
          assert.deepEqual(inspectSource(applyPlan('', [{ op: 'set-app', value }])).app, value);
        }
      }
    }
  });
  test(`${field}: overflowing model proposal stops before compiler, without retry`, async () => {
    let calls = 0;
    await assert.rejects(generateMithril('A report', request, async (url) => {
      calls++;
      assert.equal(url, API + '/chat/completions');
      return completion({ ...app, [field]: 'x'.repeat(limit + 1) });
    }), { code: 'mithril_proposal_refused' });
    assert.equal(calls, 1);
  });
}

test('held-out mixed Unicode, escapes and all simultaneous ceilings preserve exact content', () => {
  const value = { ...app };
  for (const [field, limit] of Object.entries(limits)) {
    const prefix = '日😀e\u0301"\\';
    value[field] = prefix + '界'.repeat(limit - prefix.length);
  }
  const source = emitMithril(value);
  assert.deepEqual(inspectSource(source).app, value);
  // Counts code units, without normalization: equal grapheme count can exceed a ceiling.
  assert.throws(() => emitMithril({ ...app, name: '😀'.repeat(41) }), { code: 'mithril_proposal_refused' });
  assert.throws(() => emitMithril({ ...app, name: 'e\u0301'.repeat(41) }), { code: 'mithril_proposal_refused' });
  for (const template of ['report', 'dashboard', 'directory']) {
    assert.deepEqual(inspectSource(emitMithril({ ...value, template })).app, { ...value, template });
  }
});

test('generation and edit prompts expose the same compiler bounds and UTF-16 unit', async () => {
  const check = (init) => {
    const prompt = JSON.parse(init.body).messages[0].content;
    assert.match(prompt, /UTF-16 code units \(JavaScript string.length\)/);
    for (const [field, limit] of Object.entries(limits)) assert.ok(prompt.includes(`${field} ${limit}`));
    assert.ok(!prompt.includes('500 characters'));
  };
  await assert.rejects(generateMithril('A report', request, async (_, init) => {
    check(init);
    return new Response(null, { status: 403 });
  }), { code: 'mithril_inference_403' });
  const task = equivalentTasks[0];
  const result = await modelPlan(task, task.initial, request, async (_, init) => {
    check(init);
    return completion({ actions: [{ op: 'set-app', value: task.goal }] });
  });
  assert.deepEqual(result.plan, [{ op: 'set-app', value: task.goal }]);
});
