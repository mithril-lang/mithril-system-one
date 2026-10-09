// T1: exchange-api-submission — validate and package an exchange freeze/submission request.
// Deterministic: builds a canonical submission package with a digest; no network.
import {CEX_TOOL_VERSION,requireFields,assertAddress,assertString,assertIsoTimestamp,digestOf} from './cex-common.mjs';

const ACTION_TYPES=['freeze','unfreeze','hold','recovery_request','recovery_release','information_request'];

export function buildSubmissionPackage(input){
  requireFields(input,['case_id','exchange_id','action_type','chain','requested_amount','token_symbol','submission_channel','submitter_authority','request_id','requested_at']);
  for(const a of input.frozen_addresses||[])assertAddress(a,'frozen_addresses[]');
  for(const tx of input.evidence_txs||[])assertString(tx.block_hash||tx.tx_hash,'evidence_txs[]');
  assertString(input.exchange_id,'exchange_id');
  assertString(input.submission_channel,'submission_channel');
  assertString(input.submitter_authority,'submitter_authority');
  assertString(input.request_id,'request_id');
  assertIsoTimestamp(input.requested_at,'requested_at');
  if(input.frozen_addresses)assertAddress(input.frozen_addresses[0],'frozen_addresses[0]');
  if(input.amount_trx!==undefined&&typeof input.amount_trx!=='number')throw{code:'invalid_amount',message:'amount_trx must be a number',detail:{}};
  if(!ACTION_TYPES.includes(input.action_type))throw{code:'invalid_action_type',message:'action_type not in enum',detail:{allowed:ACTION_TYPES}};
  if(typeof input.requested_amount!=='number'||!Number.isFinite(input.requested_amount)||input.requested_amount<=0)
    throw{code:'invalid_amount',message:'requested_amount must be a positive finite number',detail:{}};
  if(typeof input.chain!=='string'||!input.chain.length)throw{code:'invalid_chain',message:'chain must be non-empty',detail:{}};
  if(typeof input.token_symbol!=='string'||!input.token_symbol.length)throw{code:'invalid_token_symbol',message:'token_symbol must be non-empty',detail:{}};
  const payload={
    schemaVersion:'1',
    tool:'mithril_cex_exchange_api_submission',
    request_id:input.request_id,
    case_id:input.case_id,
    exchange_id:input.exchange_id,
    action_type:input.action_type,
    chain:input.chain,
    token_symbol:input.token_symbol,
    requested_amount:input.requested_amount,
    amount_trx:input.amount_trx??null,
    frozen_addresses:input.frozen_addresses??[],
    evidence_txs:input.evidence_txs??[],
    submission_channel:input.submission_channel,
    submitter_authority:input.submitter_authority,
    requested_at:input.requested_at,
    api_reference:input.api_reference??null,
  };
  const digest=digestOf(payload);
  return {
    package:payload,
    digest,
    channel_status:'validated_offline',
    endpoint:input.endpoint?input.endpoint:null,
    notes:[
      'Package is deterministic and offline-validated; submission to the exchange API has NOT been executed.',
      'Live submission requires the owning profile to hold the exchange API credential and to replay this package verbatim.',
    ],
  };
}

export const VERSION=CEX_TOOL_VERSION;
