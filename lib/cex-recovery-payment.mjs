// T6: recovery-payment-settlement — validate a recovery-payment settlement instruction.
// Deterministic: checks payer/payee, amounts, fee allocation, and idempotency;
// produces a canonical settlement instruction with a digest. No payment is moved.
import {CEX_TOOL_VERSION,requireFields,assertString,assertIsoTimestamp,digestOf} from './cex-common.mjs';

const METHODS=['bank_wire','exchange_credit','stablecoin_transfer','central_bank_settlement','escrow_release'];
const FEE_BEARERS=['reclaimant','exchange','shared','pro_rata'];

export function buildSettlementInstruction(input){
  requireFields(input,['settlement_id','case_id','payer_entity','payee_entity','currency','amount','fee_bearer','method','reference_idempotency_key','issued_at']);
  for(const f of ['settlement_id','case_id','payer_entity','payee_entity','currency','reference_idempotency_key'])assertString(input[f],f);
  assertIsoTimestamp(input.issued_at,'issued_at');
  if(typeof input.amount!=='number'||!Number.isFinite(input.amount)||input.amount<=0)throw{code:'invalid_amount',message:'amount must be positive finite',detail:{}};
  if(!METHODS.includes(input.method))throw{code:'invalid_method',message:'method not in enum',detail:{allowed:METHODS}};
  if(!FEE_BEARERS.includes(input.fee_bearer))throw{code:'invalid_fee_bearer',message:'fee_bearer not in enum',detail:{allowed:FEE_BEARERS}};
  if(input.fee_amount!==undefined&&(typeof input.fee_amount!=='number'||!Number.isFinite(input.fee_amount)||input.fee_amount<0))throw{code:'invalid_fee',message:'fee_amount must be non-negative finite (default 0)',detail:{}};
  if(input.payer_entity===input.payee_entity)throw{code:'self_settlement',message:'payer and payee must differ',detail:{}};
  const payload={
    schemaVersion:'1',
    tool:'mithril_cex_recovery_payment_settlement',
    settlement_id:input.settlement_id,
    case_id:input.case_id,
    payer_entity:input.payer_entity,
    payee_entity:input.payee_entity,
    currency:input.currency,
    amount:input.amount,
    fee_amount:input.fee_amount??0,
    fee_bearer:input.fee_bearer,
    method:input.method,
    reference_idempotency_key:input.reference_idempotency_key,
    issued_at:input.issued_at,
    status:'instructed',
  };
  payload.instruction_digest=digestOf(payload);
  return {
    instruction:payload,
    executed:false,
    notes:[
      'Instruction is deterministic and offline-validated; no funds have moved.',
      'Settlement execution requires the owning profile to present this instruction to the settlement channel and return the acknowledgement reference.',
    ],
  };
}

export const VERSION=CEX_TOOL_VERSION;
