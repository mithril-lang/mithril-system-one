#!/usr/bin/env node
// mithril_cex_recovery_payment_settlement — deterministic CEX asset-recovery entry point (stdin JSON -> stdout JSON).
import {runTool} from '../lib/cex-common.mjs';
import * as T from '../lib/cex-recovery-payment.mjs';
runTool('mithril_cex_recovery_payment_settlement',T.VERSION,async(input)=>T.buildSettlementInstruction(input));
