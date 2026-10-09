// T5: cross-border-mlat-submission — validate and package a cross-border MLAT request.
// Deterministic: builds a canonical MLAT package with required-field checks per
// jurisdiction pair; no network.
import {CEX_TOOL_VERSION,requireFields,assertString,assertIsoTimestamp,digestOf} from './cex-common.mjs';

const RELATIONS=['mlat_treaty','evidence_convention_hague','interpol_chn','eurestag','custom_bilateral','none'];

export function buildMlatPackage(input){
  requireFields(input,['request_id','case_id','requesting_country','requested_country','request_type','authority_requesting','authority_requested','basis_instrument','requested_at','evidence_digests']);
  for(const f of ['request_id','case_id','requesting_country','requested_country','authority_requesting','authority_requested','basis_instrument'])assertString(input[f],f);
  assertIsoTimestamp(input.requested_at,'requested_at');
  if(typeof input.request_type!=='string'||!input.request_type.length)throw{code:'invalid_request_type',message:'request_type must be non-empty',detail:{}};
  const digests=Array.isArray(input.evidence_digests)?input.evidence_digests.map(String):[];
  if(!digests.length)throw{code:'no_evidence',message:'evidence_digests must be non-empty array',detail:{}};
  const channel=input.channel?String(input.channel):'mlat';
  const relation=input.treaty_relation?String(input.treaty_relation):'none';
  if(!RELATIONS.includes(relation))throw{code:'invalid_treaty_relation',message:'treaty_relation not in enum',detail:{allowed:RELATIONS}};
  const routing={
    channel,
    treaty_relation:relation,
    requires_interpol_ccn:relation==='interpol_chn'||channel==='interpol_chn',
    requires_hague_convention:relation==='evidence_convention_hague',
    notes:[
      'Package is deterministic and offline-validated; the MLAT request has NOT been transmitted.',
      'Transmission requires the competent authority of the requesting country; the tool only guarantees field completeness and canonical digest.',
    ],
  };
  const payload={
    schemaVersion:'1',
    tool:'mithril_cex_cross_border_mlat_submission',
    request_id:input.request_id,
    case_id:input.case_id,
    requesting_country:input.requesting_country,
    requested_country:input.requested_country,
    request_type:input.request_type,
    authority_requesting:input.authority_requesting,
    authority_requested:input.authority_requested,
    basis_instrument:input.basis_instrument,
    requested_at:input.requested_at,
    evidence_digests:digests,
    routing,
  };
  payload.digest=digestOf(payload);
  return payload;
}

export const VERSION=CEX_TOOL_VERSION;
