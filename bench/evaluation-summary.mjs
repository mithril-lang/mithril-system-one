/** Equal task weighting and explicit missing telemetry; no official AA score. */
export function evaluateRows(rows,scheduled) {
 const methods=[...new Set(scheduled.map(r=>r.method))];
 const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
 const quantile=(xs,p)=>xs.length?xs.toSorted((a,b)=>a-b)[Math.ceil(xs.length*p)-1]:null;
 return methods.map(method=>{
  const plan=scheduled.filter(r=>r.method===method),group=rows.filter(r=>r.method===method);
  const key=r=>`${r.task_id}:${r.round}`;
  if(new Set(plan.map(key)).size!==plan.length||new Set(group.map(key)).size!==group.length||group.some(r=>!plan.some(p=>key(p)===key(r))))throw Error('invalid_attempt_identity');
  const complete=group.length===plan.length;
  const ids=[...new Set(plan.map(r=>r.task_id))];
  const perTask=ids.map(task_id=>{
   const expected=plan.filter(r=>r.task_id===task_id),actual=group.filter(r=>r.task_id===task_id);
   return {task_id,scheduled:expected.length,attempted:actual.length,passed:actual.filter(r=>r.success).length,pass_at_1:actual.length===expected.length?mean(actual.map(r=>Number(r.success))):null};
  });
  const passed=group.filter(r=>r.success),times=group.map(r=>r.seconds).filter(t=>typeof t==='number'&&Number.isFinite(t)&&t>=0);
  const allCostsKnown=group.length>0&&complete&&group.every(r=>typeof r.billed_cost_usd==='number'&&Number.isFinite(r.billed_cost_usd)&&r.billed_cost_usd>=0);
  return {method,official_aa_score:null,scheduled:plan.length,attempted:group.length,passed:passed.length,missing:plan.length-group.length,outcome_unknown:group.filter(r=>r.outcome_unknown).length,complete,per_task:perTask,task_normalized_pass_at_1:complete?mean(perTask.map(t=>t.pass_at_1)):null,
   all_attempt_mean_seconds:times.length===group.length?mean(times):null,all_attempt_p50_seconds:quantile(times,.5),all_attempt_p95_seconds:quantile(times,.95),successful_mean_seconds:mean(passed.map(r=>r.seconds)),
   billed_cost_per_task_usd:allCostsKnown?mean(group.map(r=>r.billed_cost_usd)):null};
 });
}
