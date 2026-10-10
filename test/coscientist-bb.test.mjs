import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

function bb(input, expectExit = 0) {
  const result = spawnSync(process.execPath, ['bin/mithril-coscientist-bb.mjs'], {
    input: JSON.stringify(input), encoding: 'utf8', timeout: 20000,
  });
  const parsed = result.stdout.trim() ? JSON.parse(result.stdout) : null;
  if (expectExit !== undefined) assert.equal(result.status, expectExit, result.stderr);
  return {result, parsed};
}

test('coscientist_bb round normalizes the four-command vocabulary', () => {
  const input = {
    op: 'round',
    goal: 'Identify candidate findings in zendesk/sitemap-generator',
    commands: [
      {ref: 'c1', kind: 'EXPERIMENT', tool: 'mithril_public_repo_review'},
      {ref: 'c2', kind: 'GOOGLE'},
      {ref: 'c3', kind: 'DOCUMENTATION'},
      {ref: 'c4', kind: 'PYTHON'},
    ],
  };
  const a = bb(input).parsed;
  const b = bb(input).parsed;
  assert.equal(a.success, true);
  const commands = a.receipt.round.commands;
  assert.equal(commands.length, 4);
  assert.equal(commands[0].tool, 'mithril_public_repo_review');
  assert.equal(commands[1].tool, 'web_search');
  assert.equal(commands[2].tool, 'web_extract');
  assert.equal(commands[3].tool, 'execute_code');
  assert.equal(a.receipt.round.digest, b.receipt.round.digest, 'identical input must produce identical digest');
});

test('coscientist_bb round rejects unknown kinds, duplicate refs and budget overflow', () => {
  const bad = bb({op: 'round', goal: 'g', commands: [{ref: 'c1', kind: 'BREW'}]}, 1).parsed;
  assert.equal(bad.success, false);
  assert.equal(bad.code, 'unknown_command_kind');
  const dup = bb({op: 'round', goal: 'g', commands: [{ref: 'c1', kind: 'GOOGLE'}, {ref: 'c1', kind: 'GOOGLE'}]}, 1).parsed;
  assert.equal(dup.code, 'duplicate_command_ref');
  const big = bb({
    op: 'round', goal: 'g',
    commands: Array.from({length: 13}, (_, i) => ({ref: 'c' + i, kind: 'GOOGLE'})),
  }, 1).parsed;
  assert.equal(big.code, 'command_budget_exceeded');
  const unknownTool = bb({op: 'round', goal: 'g', commands: [{ref: 'c1', kind: 'EXPERIMENT', tool: 'rm -rf /'}]}, 1).parsed;
  assert.equal(unknownTool.code, 'unknown_experiment_tool');
  const missing = bb({op: 'round', goal: ''}, 1).parsed;
  assert.equal(missing.code, 'input_invalid');
});

test('coscientist_bb observations gate hypothesis evaluation', () => {
  const roundInput = {
    op: 'round',
    goal: 'Check whether the repo review reports a candidate',
    commands: [{ref: 'c1', kind: 'EXPERIMENT', tool: 'mithril_public_repo_review'}],
    observations: {digest: 'sha256:abc123', status: 'complete', observedBytes: 4096},
  };
  const round = bb(roundInput).parsed;
  assert.equal(round.success, true);
  const partial = bb({
    op: 'hypotheses',
    round: {
      tool: 'mithril-coscientist-bb', version: '1.0.0',
      goal: roundInput.goal,
      commands: [{ref: 'c1', kind: 'EXPERIMENT', tool: 'mithril_public_repo_review', mode: 'bound', digest: 'sha256:x'}],
      observations: {digest: 'sha256:abc123', status: 'partial', observedBytes: 4096, digest: 'sha256:y'},
      budget: {},
      digest: 'sha256:z',
    },
    hypotheses: [{hypothesisId: 'h1', statement: 'A candidate exists', experiments: [{commandRef: 'c1', result: 'confirmed'}]}],
  }, 1).parsed;
  assert.equal(partial.code, 'round_incomplete');
  const full = bb({
    op: 'hypotheses',
    round: round.receipt.round,
    hypotheses: [{hypothesisId: 'h1', statement: 'A candidate exists', experiments: [{commandRef: 'c1', result: 'confirmed'}]}],
  }).parsed;
  assert.equal(full.success, true);
  assert.equal(full.receipt.ledger.hypotheses[0].status, 'confirmed');
  const unknownResult = bb({
    op: 'hypotheses',
    round: round.receipt.round,
    hypotheses: [{hypothesisId: 'h1', statement: 's', experiments: [{commandRef: 'c1', result: 'confirmed'}], experiments2: []}],
  }).parsed;
  assert.equal(unknownResult.success, true);
});

test('coscientist_bb report decision is submit_to_human only on confirmation', () => {
  const confirmed = bb({
    op: 'report',
    goal: 'Zendesk public repository lane',
    commands: [{ref: 'c1', kind: 'EXPERIMENT', tool: 'mithril_public_repo_review'}],
    observations: {digest: 'sha256:abc123', status: 'complete', observedBytes: 512},
    hypotheses: [{hypothesisId: 'h1', statement: 'OSV match in lockfile', experiments: [{commandRef: 'c1', result: 'confirmed'}]}],
  }).parsed;
  assert.equal(confirmed.success, true);
  assert.equal(confirmed.receipt.report.decision.action, 'submit_to_human');
  const open = bb({
    op: 'report',
    goal: 'Zendesk public repository lane',
    commands: [{ref: 'c1', kind: 'EXPERIMENT', tool: 'mithril_public_repo_review'}],
    observations: {digest: 'sha256:abc123', status: 'complete', observedBytes: 512},
    hypotheses: [{hypothesisId: 'h1', statement: 'OSV match in lockfile', experiments: [{commandRef: 'c1', result: 'unknown'}]}],
  }).parsed;
  assert.equal(open.receipt.report.decision.action, 'continue');
  const noObs = bb({
    op: 'report',
    goal: 'Zendesk public repository lane',
    commands: [{ref: 'c1', kind: 'EXPERIMENT', tool: 'mithril_public_repo_review'}],
  }).parsed;
  assert.equal(noObs.receipt.report.decision.action, 'observe_more');
  const badOp = bb({op: 'synth', goal: 'g'}, 1).parsed;
  assert.equal(badOp.code, 'unknown_op');
});
