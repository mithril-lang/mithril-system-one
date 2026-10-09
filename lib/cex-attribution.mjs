// T3: exchange-on-chain-attribution — attribute on-chain entities to exchanges with a
// deterministic confidence rubric. Accepts an entity, observed on-chain facts, and
// any external tracker evidence; emits a tiered attribution with explicit confidence.
import {CEX_TOOL_VERSION,requireFields,assertAddress,assertString,digestOf} from './cex-common.mjs';

const EVIDENCE_KINDS=['on_chain_flow_pattern','external_tracker_label','exchange_public_deposit_address','known_label_tronscan','exchange_api_confirmation','regulatory_filing'];

export function attributeEntity(input){
  requireFields(input,['entity_address','chain','evidence']);
  assertAddress(input.entity_address,'entity_address');
  assertString(input.chain,'chain');
  const evidence=Array.isArray(input.evidence)?input.evidence:[];
  if(!evidence.length)throw{code:'no_evidence',message:'at least one evidence item is required',detail:{}};
  const seen=new Set();
  const scored=evidence.map((ev,i)=>{
    if(!ev||typeof ev!=='object')throw{code:'invalid_evidence',message:`evidence[${i}] must be an object`,detail:{}};
    assertString(ev.kind,'evidence[].kind');
    if(!EVIDENCE_KINDS.includes(ev.kind))throw{code:'invalid_evidence_kind',message:`evidence[${i}].kind not in enum`,detail:{allowed:EVIDENCE_KINDS}};
    if(typeof ev.weight!=='number'||ev.weight<0||ev.weight>1)throw{code:'invalid_weight',message:`evidence[${i}].weight must be in [0,1]`,detail:{}};
    if(seen.has(ev.kind))throw{code:'duplicate_evidence_kind',message:`evidence kind ${ev.kind} supplied more than once`,detail:{}};
    seen.add(ev.kind);
    return {kind:ev.kind,weight:ev.weight,source:ev.source?String(ev.source):null};
  });
  // Deterministic tier:
  //  - exchange_api_confirmation alone => confirmed (API ack from the exchange itself)
  //  - external_tracker_label + on_chain_flow_pattern => high
  //  - external_tracker_label alone => medium
  //  - on_chain_flow_pattern alone => low
  //  - known_label_tronscan (public deposit address label) => high when combined with flow pattern
  let tier='low';let rationale='insufficient evidence variety';
  const kinds=scored.map(s=>s.kind);
  const has=k=>kinds.includes(k);
  if(has('exchange_api_confirmation')){tier='confirmed';rationale='exchange API acknowledgement present';}
  else if(has('external_tracker_label')&&has('on_chain_flow_pattern')){tier='high';rationale='independent tracker label corroborated by flow pattern';}
  else if(has('known_label_tronscan')&&has('on_chain_flow_pattern')){tier='high';rationale='public exchange deposit address label corroborated by flow pattern';}
  else if(has('external_tracker_label')||has('known_label_tronscan')){tier='medium';rationale='single-label evidence without independent corroboration';}
  else if(has('on_chain_flow_pattern')){tier='low';rationale='flow pattern only; no label';}
  const exchange_id=input.exchange_id?String(input.exchange_id):null;
  if(exchange_id)assertString(exchange_id,'exchange_id');
  const payload={
    schemaVersion:'1',
    tool:'mithril_cex_exchange_on_chain_attribution',
    entity_address:input.entity_address,
    chain:input.chain,
    exchange_id,
    tier,
    rationale,
    evidence:scored,
  };
  payload.digest=digestOf(payload);
  return payload;
}

export const VERSION=CEX_TOOL_VERSION;
