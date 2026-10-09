// T7: universal-cex-directory — query and extend a deterministic CEX directory.
// Accepts an operation (query / upsert / prune) and a directory state; returns the
// next directory state plus a per-entry freshness verdict. No network.
import {CEX_TOOL_VERSION,requireFields,assertString,digestOf} from './cex-common.mjs';

const COUNTRIES=new Set(['jp','us','eu','ky','sg','ru','kp','cz','ae','il','gb','ca','au','kr']);
const STATUS=['active','restricted','sanctioned','unknown'];

function validCountry(c){return COUNTRIES.has(String(c).toLowerCase());}
function validStatus(s){return STATUS.includes(s);}

function normalizeEntry(entry,source){
  if(!entry||typeof entry!=='object')throw{code:'invalid_entry',message:`directory entry from ${source} must be an object`,detail:{}};
  assertString(entry.exchange_id,'entry.exchange_id');
  assertString(entry.name,'entry.name');
  if(typeof entry.countries!=='string'||typeof entry.chains!=='string'||typeof entry.jurisdiction_base!=='string')
    throw{code:'invalid_entry_type',message:'countries/chains/jurisdiction_base must be strings',detail:{exchange_id:entry.exchange_id}};
  const countries=(entry.countries||'').split(',').map(s=>s.trim()).filter(Boolean);
  if(!countries.length)throw{code:'invalid_countries',message:'countries must list at least one country code',detail:{exchange_id:entry.exchange_id}};
  for(const c of countries)if(!validCountry(c))throw{code:'invalid_country',message:`unknown country code ${c}`,detail:{exchange_id:entry.exchange_id,country:c}};
  if(typeof entry.last_verified_at!=='string'||Number.isNaN(Date.parse(entry.last_verified_at)))
    throw{code:'invalid_last_verified_at',message:'last_verified_at must be ISO-8601',detail:{exchange_id:entry.exchange_id}};
  const status=entry.status??'unknown';
  if(!validStatus(status))throw{code:'invalid_status',message:`status ${status} not in enum`,detail:{exchange_id:entry.exchange_id,allowed:STATUS}};
  return {
    exchange_id:entry.exchange_id,
    name:entry.name,
    countries:countries.sort(),
    chains:(entry.chains||'').split(',').map(s=>s.trim()).filter(Boolean).sort(),
    jurisdiction_base:entry.jurisdiction_base.toLowerCase(),
    status,
    last_verified_at:entry.last_verified_at,
    verified_by:entry.verified_by?String(entry.verified_by):null,
  };
}

export function applyDirectoryOp(input){
  requireFields(input,['op','directory','as_of']);
  assertString(input.op,'op');
  assertString(input.as_of,'as_of');
  const directory=input.directory&&typeof input.directory==='object'?input.directory:{};
  if(!Array.isArray(directory.entries))throw{code:'invalid_directory',message:'directory.entries must be an array',detail:{}};
  const asOf=Date.parse(input.as_of);
  if(Number.isNaN(asOf))throw{code:'invalid_as_of',message:'as_of must be ISO-8601',detail:{}};
  const STALE_MS=90*24*3600*1000;
  const entries=new Map();
  for(const raw of directory.entries){
    const e=normalizeEntry(raw,'directory');
    entries.set(e.exchange_id,e);
  }
  let changed=false;
  if(input.op==='upsert'){
    const e=normalizeEntry(input.entry,'input.entry');
    const prev=entries.get(e.exchange_id);
    if(prev&&prev.last_verified_at>=e.last_verified_at&&!input.force)
      throw{code:'stale_upsert',message:'upsert last_verified_at not newer than existing entry; supply force=true to override',detail:{exchange_id:e.exchange_id,existing:prev.last_verified_at,supplied:e.last_verified_at}};
    if(prev&&prev.last_verified_at>=e.last_verified_at&&input.force)
      throw{code:'stale_upsert',message:'force set but last_verified_at still not newer',detail:{exchange_id:e.exchange_id}};
    entries.set(e.exchange_id,e);
    changed=true;
  }else if(input.op==='prune'){
    for(const id of input.remove_exchange_ids||[])if(entries.delete(id))changed=true;
  }else if(input.op!=='query'){
    throw{code:'invalid_op',message:`op ${input.op} not in {query,upsert,prune}`,detail:{}};
  }
  const list=[...entries.values()].sort((a,b)=>a.exchange_id<b.exchange_id?-1:1);
  const withFreshness=list.map(e=>({
    ...e,
    fresh:Date.parse(e.last_verified_at)>asOf-STALE_MS,
    staleness_days:Math.max(0,Math.floor((asOf-Date.parse(e.last_verified_at))/86400000)),
  }));
  const next={schemaVersion:'1',entries:withFreshness,as_of:input.as_of,op:input.op,changed};
  next.digest=digestOf(next);
  return next;
}

export const VERSION=CEX_TOOL_VERSION;
