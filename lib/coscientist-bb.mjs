// Deterministic Coscientist core for bug-bounty challenge rounds.
// Mirrors the Coscientist (Boiko et al., Nature 2023) command space
// GOOGLE / PYTHON / DOCUMENTATION / EXPERIMENT as a bounded, offline-verifiable
// planner-round ledger. A Planner LLM (owning profile) emits the commands;
// this module validates, normalizes, digests and advances the hypothesis
// ledger. No network, no target execution, no probe, no submission.
import {createHash} from 'node:crypto';

export const COSCIENTIST_BB_VERSION = '1.0.0';
export const COSCIENTIST_BB_TOOL = 'mithril-coscientist-bb';

const BUDGET = {maxCommandsPerRound: 12, maxHypotheses: 32, maxObservationBytes: 262144};

const COMMAND_KINDS = new Set(['GOOGLE', 'PYTHON', 'DOCUMENTATION', 'EXPERIMENT']);
const EXPERIMENT_TOOLS = new Set([
  'mithril_public_repo_review',
  'mithril_public_review',
  'mithril_business_process_review',
  'mithril_scap_review',
  'mithril_dependency_upgrade',
  'web_search',
  'web_extract',
  'terminal',
  'read_file',
  'git_ls_remote',
]);
const COMMAND_TARGET = {
  GOOGLE: {executor: 'owning-planner', tool: 'web_search', mode: 'declarative'},
  PYTHON: {executor: 'owning-agent', tool: 'execute_code', mode: 'declarative'},
  DOCUMENTATION: {executor: 'owning-planner', tool: 'web_extract', mode: 'declarative'},
};

export const digestOf = (value) =>
  'sha256:' + createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(value[k])).join(',') + '}';
}

function fail(code, message, detail = {}) {
  return {code, message, detail};
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const e = fail('input_invalid', `${label} must be a JSON object`);
    e.code = 'input_invalid';
    throw e;
  }
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    const e = fail('input_invalid', `${label} must be a non-empty string`);
    e.code = 'input_invalid';
    throw e;
  }
}

// Normalize and validate one planner round: goal + commands + observations.
// Returns {round, commands, observations, digest, budget}.
export function buildRound(input) {
  assertObject(input, 'input');
  assertString(input.goal, 'goal');
  const commands = input.commands;
  if (!Array.isArray(commands) || commands.length === 0) {
    const e = fail('input_invalid', 'commands must be a non-empty array');
    e.code = 'input_invalid';
    throw e;
  }
  if (commands.length > BUDGET.maxCommandsPerRound) {
    const e = fail('command_budget_exceeded', `at most ${BUDGET.maxCommandsPerRound} commands per round`, {
      max: BUDGET.maxCommandsPerRound, got: commands.length,
    });
    e.code = 'command_budget_exceeded';
    throw e;
  }
  const seenRefs = new Set();
  const normalized = commands.map((cmd, index) => {
    assertObject(cmd, `commands[${index}]`);
    assertString(cmd.ref, `commands[${index}].ref`);
    if (seenRefs.has(cmd.ref)) {
      const e = fail('duplicate_command_ref', `commands[${index}].ref duplicates ${cmd.ref}`);
      e.code = 'duplicate_command_ref';
      throw e;
    }
    seenRefs.add(cmd.ref);
    if (!COMMAND_KINDS.has(cmd.kind)) {
      const e = fail('unknown_command_kind', `commands[${index}].kind must be one of GOOGLE|PYTHON|DOCUMENTATION|EXPERIMENT`, {
        got: cmd.kind,
      });
      e.code = 'unknown_command_kind';
      throw e;
    }
    if (cmd.kind === 'EXPERIMENT') {
      if (typeof cmd.tool !== 'string' || !cmd.tool.length) {
        const e = fail('input_invalid', `commands[${index}].tool is required for EXPERIMENT`);
        e.code = 'input_invalid';
        throw e;
      }
      if (!EXPERIMENT_TOOLS.has(cmd.tool)) {
        const e = fail('unknown_experiment_tool', `commands[${index}].tool is not a registered experiment tool`, {
          got: cmd.tool,
        });
        e.code = 'unknown_experiment_tool';
        throw e;
      }
      return {ref: cmd.ref, kind: 'EXPERIMENT', tool: cmd.tool, mode: 'bound', digest: digestOf({ref: cmd.ref, kind: 'EXPERIMENT', tool: cmd.tool})};
    }
    return {ref: cmd.ref, kind: cmd.kind, mode: 'declarative', ...COMMAND_TARGET[cmd.kind], digest: digestOf({ref: cmd.ref, kind: cmd.kind, tool: COMMAND_TARGET[cmd.kind].tool})};
  });
  const observations = input.observations;
  if (observations !== undefined && observations !== null) {
    assertObject(observations, 'observations');
    assertString(observations.digest, 'observations.digest');
    if (observations.status !== 'complete' && observations.status !== 'partial' && observations.status !== 'error') {
      const e = fail('invalid_observation', 'observations.status must be complete|partial|error');
      e.code = 'invalid_observation';
      throw e;
    }
    if (typeof observations.observedBytes !== 'number' || !Number.isInteger(observations.observedBytes)
        || observations.observedBytes < 0 || observations.observedBytes > BUDGET.maxObservationBytes) {
      const e = fail('invalid_observation', `observations.observedBytes must be an integer in 0..${BUDGET.maxObservationBytes}`);
      e.code = 'invalid_observation';
      throw e;
    }
    const obsDigest = digestOf({digest: observations.digest, status: observations.status, observedBytes: observations.observedBytes});
    const round = {
      tool: COSCIENTIST_BB_TOOL,
      version: COSCIENTIST_BB_VERSION,
      goal: input.goal,
      commands: normalized,
      observations: {digest: observations.digest, status: observations.status, observedBytes: observations.observedBytes, digest: obsDigest},
      budget: BUDGET,
    };
    round.digest = digestOf({goal: round.goal, commands: round.commands, observations: round.observations.digest});
    return {round};
  }
  const round = {
    tool: COSCIENTIST_BB_TOOL,
    version: COSCIENTIST_BB_VERSION,
    goal: input.goal,
    commands: normalized,
    observations: null,
    budget: BUDGET,
  };
  round.digest = digestOf({goal: round.goal, commands: round.commands});
  return {round};
}

const HYPOTHESIS_STATUS = new Set(['open', 'confirmed', 'refuted', 'superseded']);
const EXPERIMENT_RESULT = new Set(['confirmed', 'refuted', 'unknown']);

// Advance the hypothesis ledger against the observations of a completed round.
// confirmation requires >=1 experiment with result 'confirmed';
// refutation requires >=1 experiment with result 'refuted'; otherwise open.
export function evaluateHypotheses(input) {
  assertObject(input, 'input');
  assertObject(input.round, 'round');
  if (!input.round.observations || input.round.observations.status !== 'complete') {
    const e = fail('round_incomplete', 'hypothesis evaluation requires a round with complete observations');
    e.code = 'round_incomplete';
    throw e;
  }
  const hypotheses = input.hypotheses;
  if (!Array.isArray(hypotheses) || hypotheses.length === 0) {
    const e = fail('input_invalid', 'hypotheses must be a non-empty array');
    e.code = 'input_invalid';
    throw e;
  }
  if (hypotheses.length > BUDGET.maxHypotheses) {
    const e = fail('hypothesis_budget_exceeded', `at most ${BUDGET.maxHypotheses} hypotheses`, {max: BUDGET.maxHypotheses});
    e.code = 'hypothesis_budget_exceeded';
    throw e;
  }
  const evaluated = hypotheses.map((h, index) => {
    assertObject(h, `hypotheses[${index}]`);
    assertString(h.hypothesisId, `hypotheses[${index}].hypothesisId`);
    assertString(h.statement, `hypotheses[${index}].statement`);
    const experiments = h.experiments;
    if (!Array.isArray(experiments) || experiments.length === 0) {
      const e = fail('input_invalid', `hypotheses[${index}].experiments must be a non-empty array`);
      e.code = 'input_invalid';
      throw e;
    }
    const results = experiments.map((x, j) => {
      assertObject(x, `hypotheses[${index}].experiments[${j}]`);
      assertString(x.commandRef, `hypotheses[${index}].experiments[${j}].commandRef`);
      if (!input.round.commands.some((c) => c.ref === x.commandRef)) {
        const e = fail('unknown_command_ref', `hypotheses[${index}].experiments[${j}].commandRef ${x.commandRef} is not in the round`);
        e.code = 'unknown_command_ref';
        throw e;
      }
      if (!EXPERIMENT_RESULT.has(x.result)) {
        const e = fail('invalid_experiment_result', `hypotheses[${index}].experiments[${j}].result must be confirmed|refuted|unknown`);
        e.code = 'invalid_experiment_result';
        throw e;
      }
      return {commandRef: x.commandRef, result: x.result};
    });
    const confirmed = results.filter((x) => x.result === 'confirmed').length;
    const refuted = results.filter((x) => x.result === 'refuted').length;
    const status = confirmed > 0 ? 'confirmed' : refuted > 0 ? 'refuted' : 'open';
    return {hypothesisId: h.hypothesisId, statement: h.statement, experiments: results, status, digest: digestOf({hypothesisId: h.hypothesisId, statement: h.statement, experiments: results})};
  });
  const ledger = {
    tool: COSCIENTIST_BB_TOOL,
    version: COSCIENTIST_BB_VERSION,
    roundDigest: input.round.digest,
    observationsDigest: input.round.observations.digest,
    hypotheses: evaluated,
    summary: {
      confirmed: evaluated.filter((h) => h.status === 'confirmed').length,
      refuted: evaluated.filter((h) => h.status === 'refuted').length,
      open: evaluated.filter((h) => h.status === 'open').length,
    },
  };
  ledger.digest = digestOf({roundDigest: ledger.roundDigest, hypotheses: ledger.hypotheses});
  return {ledger};
}

// Synthesize the deterministic challenge report.
// decision: submit_to_human when a confirmed hypothesis exists, otherwise
// continue or observe_more. Human submission is always the gate.
export function buildReport(input) {
  assertObject(input, 'input');
  const {round} = buildRound(input);
  let ledger = null;
  if (input.hypotheses !== undefined && input.hypotheses !== null) {
    ledger = evaluateHypotheses({round, hypotheses: input.hypotheses}).ledger;
  }
  const decision = ledger && ledger.summary.confirmed > 0
    ? {action: 'submit_to_human', reason: 'confirmed hypothesis present; human gate for submission'}
    : ledger
      ? {action: 'continue', reason: 'no confirmed hypothesis; run further planner rounds'}
      : {action: 'observe_more', reason: 'round planned; observations not yet recorded'};
  const report = {
    tool: COSCIENTIST_BB_TOOL,
    version: COSCIENTIST_BB_VERSION,
    goal: round.goal,
    round: {digest: round.digest, commandCount: round.commands.length, observations: round.observations
      ? {status: round.observations.status, digest: round.observations.digest}
      : null},
    hypothesisLedger: ledger ? {digest: ledger.digest, summary: ledger.summary} : null,
    decision,
    limits: BUDGET,
    caveats: [
      'Deterministic planner-round ledger; the Planner LLM is external to this module.',
      'No network access, no target execution, no probing, no submission by this module.',
      'A confirmed hypothesis is a candidate for human review, not a confirmed vulnerability.',
    ],
  };
  report.digest = digestOf({goal: report.goal, roundDigest: report.round.digest, ledgerDigest: report.hypothesisLedger?.digest ?? null, decision: report.decision});
  return {report};
}
