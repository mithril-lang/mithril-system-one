#!/usr/bin/env node
// mithril_cex_exchange_on_chain_attribution — deterministic CEX asset-recovery entry point (stdin JSON -> stdout JSON).
import {runTool} from '../lib/cex-common.mjs';
import * as T from '../lib/cex-attribution.mjs';
runTool('mithril_cex_exchange_on_chain_attribution',T.VERSION,async(input)=>T.attributeEntity(input));
