#!/usr/bin/env node
// mithril_cex_live_balance_monitoring — deterministic CEX asset-recovery entry point (stdin JSON -> stdout JSON).
import {runTool} from '../lib/cex-common.mjs';
import * as T from '../lib/cex-monitoring.mjs';
runTool('mithril_cex_live_balance_monitoring',T.VERSION,async(input)=>T.buildMonitoringReport(input));
