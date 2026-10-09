#!/usr/bin/env node
// mithril_cex_exchange_api_submission — deterministic CEX asset-recovery entry point (stdin JSON -> stdout JSON).
import {runTool} from '../lib/cex-common.mjs';
import * as T from '../lib/cex-exchange-submission.mjs';
runTool('mithril_cex_exchange_api_submission',T.VERSION,async(input)=>T.buildSubmissionPackage(input));
