#!/usr/bin/env node
// mithril_cex_automatic_freeze_execution — deterministic CEX asset-recovery entry point (stdin JSON -> stdout JSON).
import {runTool} from '../lib/cex-common.mjs';
import * as T from '../lib/cex-freeze-execution.mjs';
runTool('mithril_cex_automatic_freeze_execution',T.VERSION,async(input)=>T.evaluateFreezeGate(input));
