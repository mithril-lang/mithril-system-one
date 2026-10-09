#!/usr/bin/env node
// mithril_cex_legal_freeze_decision — deterministic CEX asset-recovery entry point (stdin JSON -> stdout JSON).
import {runTool} from '../lib/cex-common.mjs';
import * as T from '../lib/cex-legal-freeze.mjs';
runTool('mithril_cex_legal_freeze_decision',T.VERSION,async(input)=>T.evaluateLegalFreeze(input));
