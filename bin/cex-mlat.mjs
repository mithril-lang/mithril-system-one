#!/usr/bin/env node
// mithril_cex_cross_border_mlat_submission — deterministic CEX asset-recovery entry point (stdin JSON -> stdout JSON).
import {runTool} from '../lib/cex-common.mjs';
import * as T from '../lib/cex-mlat.mjs';
runTool('mithril_cex_cross_border_mlat_submission',T.VERSION,async(input)=>T.buildMlatPackage(input));
