#!/usr/bin/env node
// mithril_cex_universal_cex_directory — deterministic CEX asset-recovery entry point (stdin JSON -> stdout JSON).
import {runTool} from '../lib/cex-common.mjs';
import * as T from '../lib/cex-directory.mjs';
runTool('mithril_cex_universal_cex_directory',T.VERSION,async(input)=>T.applyDirectoryOp(input));
