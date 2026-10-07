// Join explicitly supplied settled billing records; do not derive invoices from token counts.
export function applyBilling(rows,records){
 if(!Array.isArray(records))throw Error('invalid_billing_records');
 const ledger=new Map();
 for(const r of records){
  if(!r||typeof r.request_id!=='string'||!r.request_id||!Number.isSafeInteger(r.amount_micro_usd)||r.amount_micro_usd<0||r.status!=='settled'||ledger.has(r.request_id))throw Error('invalid_billing_records');
  ledger.set(r.request_id,r.amount_micro_usd);
 }
 const used=new Set();
 return rows.map(row=>{
  const ids=row.api_request_ids??[];
  if(!row.inference_calls||ids.length!==row.inference_calls)return {...row,billed_cost_usd:null};
  let amount=0;
  for(const id of ids){
   if(used.has(id))throw Error('duplicate_benchmark_request');used.add(id);
   if(!ledger.has(id))return {...row,billed_cost_usd:null};amount+=ledger.get(id);
  }
  if(!Number.isSafeInteger(amount))throw Error('invalid_billing_records');
  return {...row,billed_cost_usd:amount/1_000_000,billed_cost_source:'supplied_settled_mithril_account_records'};
 });
}
