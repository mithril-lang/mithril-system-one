import {createHash} from 'node:crypto';

// Rules identify review candidates, never favorable findings or legal conclusions.
export const rules = [
  ['renewal', 'billing-exit', /auto(?:matic)?[ -]?renew|automatically renew|自動更新|自動継続/iu],
  ['refund', 'billing-exit', /non[ -]?refundable|no refunds?|返金不可|返金しません/iu],
  ['data-sharing', 'data-control', /third.part(?:y|ies)|sell.{0,40}(?:data|information)|第三者|個人情報.{0,20}販売/iu],
  ['ai-training', 'data-control', /train.{0,50}(?:model|AI)|(?:model|AI).{0,50}train|AI学習|学習データ|モデル.{0,20}学習/iu],
  ['content-license', 'data-control', /perpetual|irrevocable|sublicens|取消不能|永続的|再許諾/iu],
  ['unilateral-change', 'fairness', /(?:change|modify|amend).{0,50}(?:terms|agreement)|規約.{0,30}変更/iu],
  ['termination', 'user-choice', /sole discretion|terminate|suspend|当社の裁量|利用停止|アカウント.{0,20}削除/iu],
  ['liability', 'fairness', /limitation of liability|as is|disclaim|免責|責任を負いません|現状有姿/iu],
  ['dispute', 'user-choice', /arbitration|class.action|仲裁|集団訴訟|準拠法|管轄裁判所/iu],
  ['portability', 'user-choice', /export|portability|retention|エクスポート|保存期間|データ.{0,20}削除/iu],
];
const fail = () => { throw new Error('terms_review_refused'); };
const hash = text => createHash('sha256').update(text, 'utf8').digest('hex');
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function keys(v, allowed, required = allowed) {
  if (!object(v) || Object.keys(v).some(k => !allowed.includes(k)) || required.some(k => !(k in v))) fail();
}
function string(v, max) { if (typeof v !== 'string' || !v.trim() || v.length > max || /\u0000/u.test(v)) fail(); }
function document(v) {
  keys(v, ['kind','url','retrievedAt','effectiveDate','language','text','sha256'], ['kind','url','retrievedAt','language','text','sha256']);
  if (!['terms','privacy','pricing','cancellation','dpa'].includes(v.kind) || !['ja','en','other'].includes(v.language)) fail();
  string(v.text, 262144);
  if (Buffer.byteLength(v.text) > 262144 || !/^[a-f0-9]{64}$/u.test(v.sha256) || hash(v.text) !== v.sha256) fail();
  string(v.url, 2048);
  let url; try { url = new URL(v.url); } catch { fail(); }
  // URLs are provenance only and never fetched. Query/fragment may contain private IDs.
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail();
  if (typeof v.retrievedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(v.retrievedAt)
      || !Number.isFinite(Date.parse(v.retrievedAt)) || new Date(v.retrievedAt).toISOString() !== v.retrievedAt.replace('Z','.000Z')) fail();
  if ('effectiveDate' in v && (typeof v.effectiveDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(v.effectiveDate)
      || !Number.isFinite(Date.parse(v.effectiveDate)) || new Date(v.effectiveDate).toISOString().slice(0,10) !== v.effectiveDate)) fail();
  return {...v};
}
function candidates(d) {
  if (d.language === 'other') return [];
  const result = []; let offset = 0;
  for (const [i, line] of d.text.split('\n').entries()) {
    for (const [rule,dimension,pattern] of rules) {
      const match = pattern.exec(line);
      if (match) result.push({rule, dimension, status:'candidate_requires_context_review', sourceSha256:d.sha256,
        line:i+1, start:offset+match.index, end:offset+match.index+match[0].length});
    }
    offset += line.length + 1;
  }
  return result;
}

export function reviewTerms(input) {
  keys(input, ['service','documents','previous','assessments'], ['service','documents']);
  keys(input.service, ['name','plan','jurisdiction','usage'], ['name','plan','jurisdiction']);
  for (const value of Object.values(input.service)) string(value, 200);
  if (!Array.isArray(input.documents) || input.documents.length < 1 || input.documents.length > 5) fail();
  const documents = input.documents.map(document);
  if (new Set(documents.map(d=>d.kind)).size !== documents.length) fail();
  if (Buffer.byteLength(JSON.stringify(input)) > 1572864) fail();
  let previous = [];
  if ('previous' in input) {
    if (!Array.isArray(input.previous) || input.previous.length > 5) fail();
    previous = input.previous.map(document);
    if (new Set(previous.map(d=>d.kind)).size !== previous.length) fail();
  }
  const findings = documents.flatMap(candidates);
  const assessments = input.assessments ?? [];
  if (!Array.isArray(assessments) || assessments.length > 50) fail();
  for (const a of assessments) {
    keys(a,['dimension','risk','rationale','sourceSha256','start','end']);
    if (!['billing-exit','data-control','fairness','user-choice','transparency'].includes(a.dimension)
        || !['low','medium','high','unknown'].includes(a.risk)) fail();
    string(a.rationale,2000);
    const d=documents.find(d=>d.sha256===a.sourceSha256);
    if (!d || !Number.isInteger(a.start) || !Number.isInteger(a.end) || a.start<0 || a.end<=a.start || a.end>d.text.length) fail();
  }
  const changes = [...new Set([...documents,...previous].map(d=>d.kind))].map(kind => {
    const before = previous.find(d=>d.kind===kind), after = documents.find(d=>d.kind===kind);
    return {kind, status:!before?'no_baseline':!after?'not_supplied':before.sha256===after.sha256?'unchanged':'changed_requires_review',
      beforeSha256:before?.sha256??null, afterSha256:after?.sha256??null,
      addedSignals:after ? [...new Set(candidates(after).map(f=>f.rule))].filter(r=>!before||!candidates(before).some(f=>f.rule===r)) : [],
      removedSignals:before ? [...new Set(candidates(before).map(f=>f.rule))].filter(r=>after&&!candidates(after).some(f=>f.rule===r)) : []};
  });
  return {schemaVersion:'mithril-terms-review-v1', ok:true, status:'incomplete_requires_review', service:{...input.service},
    documents:documents.map(({text,...metadata})=>metadata), findings, changes,
    contextualAssessments:assessments.map(a=>({...a,status:'reviewer_supplied_not_independently_verified'})),
    coverage:{rulesVersion:'0.1.0', supportedLanguages:['ja','en'], missingDocuments:['terms','privacy','pricing','cancellation','dpa'].filter(k=>!documents.some(d=>d.kind===k)),
      unsupportedDocuments:documents.filter(d=>d.language==='other').map(d=>d.sha256), sourceAuthenticity:'caller_supplied_not_verified',
      applicability:'caller_declared_not_verified', fetched:false, semanticCompleteness:false},
    trustDimensions:['transparency','fairness','user-choice','operational-practice'].map(dimension=>({dimension,status:'unknown',reason:'Full contextual and operational evidence review required.'})),
    honestyScore:null, legalConclusion:null, publication:{status:'private_review_only',autoPublish:false},
    nextSteps:['Read complete clauses, exceptions and linked documents. Negation and favorable clauses can match rules.',
      'Verify official source, plan, region, effective date and contract applicability.',
      'Assess impact for actual usage; no matches never means safe.',
      'Keep subscription inventory, identifiers and negotiated contracts private. Publish only a separately reviewed public summary.']};
}

export function runTermsWorkflow(input) {
  keys(input, ['tasks']);
  if (!Array.isArray(input.tasks) || !input.tasks.length || input.tasks.length > 3) fail();
  return {schemaVersion:'mithril-terms-workflow-v1', ok:true, results:input.tasks.map(reviewTerms),
    stoppedOnFailure:true, retryUnknown:false, externalEffects:[], published:false};
}
