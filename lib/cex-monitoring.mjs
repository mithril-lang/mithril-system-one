// T8: live-cex-balance-monitoring-service — deterministic balance-monitoring report.
// Ingests a current on-chain snapshot and a prior snapshot for a set of addresses;
// emits deltas, threshold violations, freeze-state verdicts, and a monitoring receipt.
// No network; the service contract is the shape of the report and the digest.
import {CEX_TOOL_VERSION,requireFields,assertAddress,assertString,assertIsoTimestamp,assertPositiveNumber,digestOf} from './cex-common.mjs';

export function buildMonitoringReport(input){
  requireFields(input,['monitor_id','chain','addresses','current_snapshot','prior_snapshot','as_of','thresholds']);
  assertString(input.monitor_id,'monitor_id');
  assertString(input.chain,'chain');
  assertIsoTimestamp(input.as_of,'as_of');
  const addrs=Array.isArray(input.addresses)?input.addresses:[];
  if(!addrs.length)throw{code:'no_addresses',message:'addresses must be non-empty array',detail:{}};
  for(const a of addrs)assertAddress(a,'addresses[]');
  const current=input.current_snapshot&&typeof input.current_snapshot==='object'?input.current_snapshot:{};
  const prior=input.prior_snapshot&&typeof input.prior_snapshot==='object'?input.prior_snapshot:{};
  const perAddress={};
  for(const a of addrs){
    const cur=current[a]??null;
    const prev=prior[a]??null;
    if(cur&&typeof cur!=='object')throw{code:'invalid_current_snapshot',message:`current_snapshot[${a}] must be an object`,detail:{}};
    if(prev&&typeof prev!=='object')throw{code:'invalid_prior_snapshot',message:`prior_snapshot[${a}] must be an object`,detail:{}};
    const bal=cur?cur.balance:null;
    if(bal!==null&&typeof bal!=='number')throw{code:'invalid_balance',message:`balance for ${a} must be a number`,detail:{}};
    const bal0=prev?prev.balance:null;
    if(bal0!==null&&typeof bal0!=='number')throw{code:'invalid_balance',message:`prior balance for ${a} must be a number`,detail:{}};
    const delta=(bal!==null&&bal0!==null)?bal-bal0:null;
    const threshold=input.thresholds&&typeof input.thresholds==='object'?input.thresholds[a]??null:null;
    let freezeState='unknown';
    let violation=null;
    if(typeof cur?.frozen==='boolean')freezeState=cur.frozen?'frozen':'not_frozen';
    if(threshold&&bal!==null){
      if(typeof threshold!=='object')throw{code:'invalid_threshold',message:`thresholds[${a}] must be an object`,detail:{}};
      if(typeof threshold.min_balance==='number'&&bal<threshold.min_balance){
        violation={kind:'below_min',threshold:threshold.min_balance,observed:bal};
      }else if(typeof threshold.max_delta==='number'&&delta!==null&&Math.abs(delta)>threshold.max_delta){
        violation={kind:'delta_exceeded',threshold:threshold.max_delta,observed:delta};
      }
    }
    perAddress[a]={
      balance:bal,
      prior_balance:bal0,
      delta,
      frozen:freezeState,
      violation,
      last_tx:cur?.last_tx??null,
      last_tx_at:cur?.last_tx_at??null,
    };
  }
  const violations=Object.entries(perAddress).filter(([,v])=>v.violation).map(([a,v])=>({address:a,...v.violation}));
  const payload={
    schemaVersion:'1',
    tool:'mithril_cex_live_balance_monitoring',
    monitor_id:input.monitor_id,
    chain:input.chain,
    as_of:input.as_of,
    addresses:perAddress,
    violations,
    frozen_addresses:Object.entries(perAddress).filter(([,v])=>v.frozen==='frozen').map(([a])=>a),
  };
  payload.report_digest=digestOf(payload);
  return {
    report:payload,
    notes:[
      'Report is deterministic over the supplied snapshots; no on-chain query was made by this tool.',
      'The live-monitoring service contract is the report shape and digest; a scheduler must supply fresh snapshots to keep as_of current.',
      'A frozen verdict of unknown means the exchange did not expose freeze state in the snapshot; do not infer absence of a freeze.',
    ],
  };
}

export const VERSION=CEX_TOOL_VERSION;
