import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

function cex(binName,input,expectExit=0){
  const result=spawnSync(process.execPath,[`bin/${binName}.mjs`],{input:JSON.stringify(input),encoding:'utf8',timeout:20000});
  const parsed=result.stdout.trim()?JSON.parse(result.stdout):null;
  if(expectExit!==undefined)assert.equal(result.status,expectExit,result.stderr);
  return {result,parsed};
}
function digest(value){return 'sha256:'+createHash('sha256').update(JSON.stringify(value)).digest('hex');}

test('exchange_api_submission packages a deterministic freeze request',()=>{
  const input={
    request_id:'req-2026-1009-0001',
    case_id:'grinex-2026-06',
    exchange_id:'binance-tron-hot',
    action_type:'freeze',
    chain:'tron',
    token_symbol:'TRX',
    requested_amount:840038,
    amount_trx:840038,
    frozen_addresses:['TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf'],
    evidence_txs:[{tx_hash:'0e911551cdd84448925dadbca3dd9c4'}],
    submission_channel:'exchange-api',
    submitter_authority:'metropolitan-police-keishicho',
    requested_at:'2026-10-09T01:00:00Z',
  };
  const a=cex('cex-exchange-submission',input).parsed;
  const b=cex('cex-exchange-submission',input).parsed;
  assert.equal(a.success,true);
  assert.equal(a.receipt.package.request_id,'req-2026-1009-0001');
  assert.equal(a.receipt.digest,b.receipt.digest,'identical input must produce identical digest');
});

test('exchange_api_submission rejects invalid action type and bad amount',()=>{
  const bad=cex('cex-exchange-submission',{...{request_id:'r',case_id:'c',exchange_id:'e',action_type:'ban',chain:'tron',token_symbol:'TRX',requested_amount:-1,submission_channel:'api',submitter_authority:'a',requested_at:'2026-10-09T00:00:00Z'}},1).parsed;
  assert.equal(bad.success,false);
  assert.match(bad.code,/^invalid_/);
  const missing=cex('cex-exchange-submission',{request_id:'r'},1).parsed;
  assert.equal(missing.code,'input_missing_fields');
});

test('automatic_freeze_execution gates on policy and threshold',()=>{
  const base={package_digest:digest({x:1}),exchange_id:'binance-tron-hot',account_tier:'hot',auto_freeze_enabled:true,decision_threshold_usd:1000000,balance_usd:21800000,policy_version:'v1',frozen_addresses:['TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf']};
  const ok=cex('cex-freeze-execution',base).parsed;
  assert.equal(ok.success,true);
  assert.equal(ok.receipt.decision,'executable');
  assert.equal(ok.receipt.plan.action,'freeze');
  assert.equal(ok.receipt.executed,false,'the gate must not claim execution');
  const off=cex('cex-freeze-execution',{...base,auto_freeze_enabled:false}).parsed;
  assert.equal(off.receipt.decision,'not_executable');
  const under=cex('cex-freeze-execution',{...base,balance_usd:10}).parsed;
  assert.equal(under.receipt.decision,'not_executable');
});

test('on_chain_attribution tiers evidence deterministically',()=>{
  const twoKinds={entity_address:'TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf',chain:'tron',exchange_id:'binance',evidence:[
    {kind:'external_tracker_label',weight:0.9,source:'usdtbanlist.com'},
    {kind:'on_chain_flow_pattern',weight:0.8,source:'trongrid-snapshot'},
  ]};
  const high=cex('cex-attribution',twoKinds).parsed;
  assert.equal(high.receipt.tier,'high');
  const medium=cex('cex-attribution',{...twoKinds,evidence:twoKinds.evidence.slice(0,1)}).parsed;
  assert.equal(medium.receipt.tier,'medium');
  const confirmed=cex('cex-attribution',{entity_address:'TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf',chain:'tron',evidence:[{kind:'exchange_api_confirmation',weight:1}]}).parsed;
  assert.equal(confirmed.receipt.tier,'confirmed');
  const dup=cex('cex-attribution',{entity_address:'TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf',chain:'tron',evidence:[{kind:'external_tracker_label',weight:0.5},{kind:'external_tracker_label',weight:0.6}]},1).parsed;
  assert.equal(dup.code,'duplicate_evidence_kind');
});

test('legal_freeze_decision recommends an instrument per jurisdiction',()=>{
  const base={jurisdiction:'us',custody:'exchange_held',amount_usd:21800000,authority_backing:true,authority_type:'federal-court',evidence_digest:'sha256:abc'};
  const us=cex('cex-legal-freeze',base).parsed;
  assert.equal(us.receipt.supportable,true);
  assert.equal(us.receipt.recommended_instrument,'preliminary_injunction');
  const jp=cex('cex-legal-freeze',{...base,jurisdiction:'jp'}).parsed;
  assert.equal(jp.receipt.recommended_instrument,'exchange_compliance_hold');
  const self=cex('cex-legal-freeze',{...base,custody:'self_custodial'}).parsed;
  assert.equal(self.receipt.supportable,false);
  assert.equal(self.receipt.recommended_instrument,'none');
});

test('cross_border_mlat_submission validates jurisdiction routing',()=>{
  const base={request_id:'mlat-001',case_id:'grinex-2026-06',requesting_country:'jp',requested_country:'ky',request_type:'asset_freeze',authority_requesting:'metropolitan-police-keishicho',authority_requested:'fbi',basis_instrument:'mlat-treaty-jp-us',requested_at:'2026-10-09T02:00:00Z',evidence_digests:['sha256:one','sha256:two'],channel:'mlat',treaty_relation:'mlat_treaty'};
  const ok=cex('cex-mlat',base).parsed;
  assert.equal(ok.success,true);
  assert.equal(ok.receipt.routing.requires_hague_convention,false);
  const hague=cex('cex-mlat',{...base,treaty_relation:'evidence_convention_hague'}).parsed;
  assert.equal(hague.receipt.routing.requires_hague_convention,true);
  const bad=cex('cex-mlat',{...base,treaty_relation:'friendship'},1).parsed;
  assert.equal(bad.code,'invalid_treaty_relation');
});

test('recovery_payment_settlement builds a canonical instruction',()=>{
  const base={settlement_id:'set-001',case_id:'grinex-2026-06',payer_entity:'binance-exchange',payee_entity:'grinex-victrust',currency:'usd',amount:15500000,fee_bearer:'shared',method:'escrow_release',reference_idempotency_key:'req-2026-1009-0001',issued_at:'2026-10-12T00:00:00Z'};
  const a=cex('cex-recovery-payment',base).parsed;
  assert.equal(a.success,true);
  assert.equal(a.receipt.instruction.status,'instructed');
  assert.equal(a.receipt.executed,false,'no funds may have moved');
  const selfPay=cex('cex-recovery-payment',{...base,payee_entity:'binance-exchange'},1).parsed;
  assert.equal(selfPay.code,'self_settlement');
});

test('universal_cex_directory supports query upsert prune with freshness',()=>{
  const entry={exchange_id:'binance-tron-hot',name:'Binance (Tron hot wallet cluster)',countries:'ky,jp,us,sg',chains:'tron,ethereum,bsc',jurisdiction_base:'ky',status:'active',last_verified_at:'2026-10-08T12:00:00Z',verified_by:'usdtbanlist.com'};
  const q=cex('cex-directory',{op:'query',directory:{entries:[entry]},as_of:'2026-10-09T00:00:00Z'}).parsed;
  assert.equal(q.receipt.entries.length,1);
  assert.equal(q.receipt.entries[0].fresh,true);
  const up=cex('cex-directory',{op:'upsert',directory:{entries:[entry]},entry:{...entry,last_verified_at:'2026-10-09T00:00:00Z'},as_of:'2026-10-09T00:00:00Z'}).parsed;
  assert.equal(up.receipt.changed,true);
  const stale=cex('cex-directory',{op:'upsert',directory:{entries:[entry]},entry:{...entry},as_of:'2026-10-09T00:00:00Z'},1);
  assert.equal(stale.parsed.code,'stale_upsert');
  const pruned=cex('cex-directory',{op:'prune',directory:{entries:[entry]},remove_exchange_ids:['binance-tron-hot'],as_of:'2026-10-09T00:00:00Z'}).parsed;
  assert.equal(pruned.receipt.entries.length,0);
});

test('live_balance_monitoring emits deltas violations and freeze verdicts',()=>{
  const base={monitor_id:'mon-grinex',chain:'tron',addresses:['TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf'],as_of:'2026-10-09T01:00:00Z',
    current_snapshot:{TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf:{balance:39818590,last_tx:'ab',last_tx_at:'2026-10-09T01:03:00Z'}},
    prior_snapshot:{TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf:{balance:40658628}},
    thresholds:{TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf:{max_delta:1000000,min_balance:100000000}}};
  const ok=cex('cex-monitoring',base).parsed;
  assert.equal(ok.success,true);
  assert.equal(ok.receipt.report.addresses['TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf'].delta,-840038);
  assert.equal(ok.receipt.report.addresses['TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf'].frozen,'unknown','no freeze state in snapshot must stay unknown');
  assert.ok(ok.receipt.report.violations.length>=1);
  const frozen=cex('cex-monitoring',{...base,current_snapshot:{TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf:{...base.current_snapshot.TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf,frozen:true}}}).parsed;
  assert.deepEqual(frozen.receipt.report.frozen_addresses,['TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf']);
});
