// Bounded compiler-only evaluation. No model requests, credentials, retries or publication.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { emitMithril, COMPILER } from '../lib/mithril-language.mjs';
const live = process.argv.includes('--live-compiler');
const limits = { name: 80, description: 240, headline: 120, summary: 480 };
const app = { name: 'App', description: 'Description', headline: 'Headline', summary: 'Summary', template: 'report' };
const cases = [];
for (const [field, limit] of Object.entries(limits)) {
  for (const [kind, unit] of [['ascii', 'a'], ['japanese', '日'], ['non-bmp', '😀'], ['combining', 'e\u0301']]) {
    for (const delta of [-1, 0, 1]) {
      const length = limit + delta;
      cases.push({ id: `${field}/${kind}/${delta}`, expected: delta <= 0,
        value: { ...app, [field]: unit.repeat(Math.floor(length / unit.length)) + 'x'.repeat(length % unit.length) } });
    }
  }
}
for (const template of ['report', 'dashboard', 'directory']) {
  const value = { ...app, template };
  for (const [field, limit] of Object.entries(limits)) {
    const prefix = '日😀e\u0301"\\';
    value[field] = prefix + '界'.repeat(limit - prefix.length);
  }
  cases.push({ id: `held-out/${template}`, expected: true, value });
}
if (!live) {
  console.log(JSON.stringify({ cases: cases.length, compiler_call_limit: cases.length, inference_calls: 0,
    plan: 'Use --live-compiler --baseline-root PATH --output PATH; stop on unknown outcome; no retries.' }));
  process.exit(0);
}
const option = (name) => process.argv[process.argv.indexOf(name) + 1];
if (!process.argv.includes('--baseline-root') || !process.argv.includes('--output')) throw Error('explicit_baseline_and_output_required');
const { pathToFileURL } = await import('node:url');
const { resolve } = await import('node:path');
const baseline = await import(pathToFileURL(resolve(option('--baseline-root'), 'lib/mithril-language.mjs')));
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const started = performance.now();
const report = { format: 'mithril.proposal-boundaries/v1', timestamp: new Date().toISOString(),
  baseline_revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: option('--baseline-root'), encoding: 'utf8' }).trim(),
  baseline_emitter_sha256: hash(resolve(option('--baseline-root'), 'lib/mithril-language.mjs')),
  candidate_emitter_sha256: hash(new URL('../lib/mithril-language.mjs', import.meta.url)),
  compiler: COMPILER, inference_calls: 0, compiler_calls: 0, compiler_call_limit: cases.length,
  billed_cost_usd: null, speedup: null, rows: [], stopped: false };
for (const row of cases) {
  let local = true;
  try { emitMithril(row.value); } catch (e) {
    if (e.code !== 'mithril_proposal_refused') throw e;
    local = false;
  }
  // Feed identical old-emitter source to the real compiler, including candidates now refused locally.
  const source = baseline.emitMithril(row.value);
  const result = { id: row.id, expected: row.expected, baseline_accepted: true, candidate_accepted: local };
  report.rows.push(result);
  try {
    report.compiler_calls++;
    const response = await fetch(COMPILER, { method: 'POST', redirect: 'manual',
      headers: { 'content-type': 'application/vnd.mithril.form', accept: 'application/ld+json' },
      body: source, signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (response.ok && body.status === 'admitted') {
      const actual = body.artifact?.['app-ir']?.app;
      if (!actual || !Object.keys(limits).every(k => actual[k] === row.value[k]) ||
          actual.template !== 'https://mithril.fund/id/template/' + row.value.template ||
          body.semanticRun?.status !== 'executed' ||
          !['infer', 'query', 'validate', 'compile', 'test'].every(id => body.trace?.some(s => s.id === id && s.status === 'executed')) ||
          body.trace?.find(s => s.id === 'deploy')?.status !== 'not-run') throw Error('compiler_evidence_failed');
      result.compiler_accepted = true;
    } else if (response.status === 422 && body.status === 'refused') {
      result.compiler_accepted = false;
      result.compiler_error = body.error ?? body.diagnostics ?? null;
    } else throw Error('compiler_outcome_unknown');
    result.pass = local === row.expected && result.compiler_accepted === row.expected;
  } catch (e) {
    result.error = e.message;
    report.stopped = true;
    break;
  }
}
report.seconds = (performance.now() - started) / 1000;
report.passed = report.rows.filter(row => row.pass).length;
report.failed = report.rows.filter(row => row.pass === false).length;
report.unknown = report.rows.filter(row => row.error).length;
report.unexecuted = cases.length - report.rows.length;
writeFileSync(option('--output'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, rows: undefined }));
if (report.stopped || report.failed || report.unexecuted) process.exitCode = 1;
