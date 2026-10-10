#!/usr/bin/env node
// mithril-coscientist-bb — deterministic Coscientist core CLI (stdin JSON -> stdout JSON).
import {runTool} from '../lib/cex-common.mjs';
import * as T from '../lib/coscientist-bb.mjs';
runTool(T.COSCIENTIST_BB_TOOL, T.COSCIENTIST_BB_VERSION, async (input) => {
  const op = input.op ?? 'report';
  if (op === 'round') return T.buildRound(input);
  if (op === 'hypotheses') return T.evaluateHypotheses(input);
  if (op === 'report') return T.buildReport(input);
  throw {code: 'unknown_op', message: `op must be round|hypotheses|report`, detail: {op}};
});
