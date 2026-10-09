// T2: automatic-freeze-execution — evaluate a deterministic freeze-execution policy gate.
// Given a validated submission package (from T1) and the exchange account state,
// returns whether an automatic freeze may be executed and the exact action plan.
import {CEX_TOOL_VERSION,requireFields,assertAddress,assertIsoTimestamp,assertString,digestOf} from './cex-common.mjs';

export function evaluateFreezeGate(input){
  requireFields(input,['package_digest','exchange_id','account_tier','auto_freeze_enabled','frozen_addresses','decision_threshold_usd','balance_usd','policy_version']);
  assertString(input.package_digest,'package_digest');
  assertString(input.exchange_id,'exchange_id');
  assertString(input.policy_version,'policy_version');
  if(typeof input.auto_freeze_enabled!=='boolean')throw{code:'invalid_flag',message:'auto_freeze_enabled must be boolean',detail:{}};
  if(typeof input.balance_usd!=='number'||!Number.isFinite(input.balance_usd))throw{code:'invalid_amount',message:'balance_usd must be finite number',detail:{}};
  if(typeof input.decision_threshold_usd!=='number'||!Number.isFinite(input.decision_threshold_usd))throw{code:'invalid_amount',message:'decision_threshold_usd must be finite number',detail:{}};
  const addrs=Array.isArray(input.frozen_addresses)?input.frozen_addresses:[];
  if(!addrs.length)throw{code:'invalid_addresses',message:'frozen_addresses must be non-empty array',detail:{}};
  for(const a of addrs)assertAddress(a,'frozen_addresses[]');
  if(!['hot','warm','cold','exchange_internal'].includes(input.account_tier))
    throw{code:'invalid_tier',message:'account_tier not in enum',detail:{allowed:['hot','warm','cold','exchange_internal']}};
  const gate={
    package_digest:input.package_digest,
    exchange_id:input.exchange_id,
    policy_version:input.policy_version,
    auto_freeze_enabled:input.auto_freeze_enabled,
    balance_usd:input.balance_usd,
    decision_threshold_usd:input.decision_threshold_usd,
    over_threshold:input.balance_usd>=input.decision_threshold_usd,
    frozen_addresses:addrs,
  };
  const mayExecute=input.auto_freeze_enabled&&input.balance_usd>=input.decision_threshold_usd;
  const plan={
    action:mayExecute?'freeze':'no_action',
    scope:'account-level',
    addresses:mayExecute?addrs:[],
    idempotency_key:input.request_id??input.package_digest,
  };
  const receipt={
    gate,
    decision:mayExecute?'executable':'not_executable',
    reason:mayExecute?'auto_freeze_enabled and balance over threshold':'auto_freeze disabled or balance under threshold',
    plan,
    executed:false,
    notes:[
      'Gate is deterministic and offline; the freeze action has NOT been executed against the exchange.',
      'Executed state requires the owning profile to call the exchange API with plan.idempotency_key and return the exchange acknowledgement.',
      'No claim is made about actual exchange-side enforcement until an acknowledgement is supplied.',
    ],
  };
  receipt.gate_digest=digestOf(receipt.gate);
  return receipt;
}

export const VERSION=CEX_TOOL_VERSION;
