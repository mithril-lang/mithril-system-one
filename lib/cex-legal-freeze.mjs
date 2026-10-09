// T4: legal-freeze-decision — evaluate a deterministic legal-freeze decision matrix.
// Given the jurisdiction, asset custody facts, and authority facts, returns whether a
// legal freeze order is supportable and which instrument to recommend.
import {CEX_TOOL_VERSION,requireFields,assertString,digestOf} from './cex-common.mjs';

const JURISDICTIONS=['jp','us','eu','ky','sg','ru','kp','unspecified'];
const CUSTODY=['exchange_held','custodial_wallet','self_custodial','unknown'];
const INSTRUMENTS=[
  'preliminary_injunction','seizure_order','administrative_hold','mlat_request',
  'sanctions_enforcement','exchange_compliance_hold','none'
];

export function evaluateLegalFreeze(input){
  requireFields(input,['jurisdiction','custody','amount_usd','authority_backing','authority_type','evidence_digest']);
  assertString(input.jurisdiction,'jurisdiction');
  if(!JURISDICTIONS.includes(input.jurisdiction))throw{code:'invalid_jurisdiction',message:'jurisdiction not in enum',detail:{allowed:JURISDICTIONS}};
  if(!CUSTODY.includes(input.custody))throw{code:'invalid_custody',message:'custody not in enum',detail:{allowed:CUSTODY}};
  if(typeof input.amount_usd!=='number'||!Number.isFinite(input.amount_usd)||input.amount_usd<=0)throw{code:'invalid_amount',message:'amount_usd must be positive finite',detail:{}};
  if(typeof input.authority_backing!=='boolean')throw{code:'invalid_flag',message:'authority_backing must be boolean',detail:{}};
  assertString(input.authority_type,'authority_type');
  assertString(input.evidence_digest,'evidence_digest');
  const matrix={
    jurisdiction:input.jurisdiction,
    custody:input.custody,
    amount_usd:input.amount_usd,
    authority_backing:input.authority_backing,
    authority_type:input.authority_type,
    evidence_digest:input.evidence_digest,
  };
  // Deterministic tier:
  const supportable=input.authority_backing&&input.custody!=='self_custodial';
  let recommended='none';
  if(supportable){
    if(input.custody==='exchange_held'||input.custody==='custodial_wallet'){
      if(input.jurisdiction==='us'||input.jurisdiction==='eu')recommended='preliminary_injunction';
      else if(input.jurisdiction==='jp')recommended='exchange_compliance_hold';
      else if(input.jurisdiction==='ky')recommended='administrative_hold';
      else if(input.jurisdiction==='sg')recommended='exchange_compliance_hold';
      else recommended='mlat_request';
    }else{
      recommended='mlat_request';
    }
  }
  const payload={
    schemaVersion:'1',
    tool:'mithril_cex_legal_freeze_decision',
    matrix,
    supportable,
    recommended_instrument:recommended,
    alternative_instruments:INSTRUMENTS.filter(i=>i!==recommended),
  };
  payload.decision_digest=digestOf(payload.matrix);
  return payload;
}

export const VERSION=CEX_TOOL_VERSION;
