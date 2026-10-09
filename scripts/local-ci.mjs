/** Run both existing workflow jobs on one clean, exact commit; never infer or publish. */
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, arch } from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length % 2 || args.some((v, i) => i % 2 === 0 && !['--expected-sha', '--output'].includes(v)) ||
    new Set(args.filter((_, i) => i % 2 === 0)).size !== args.length / 2) throw Error('invalid_ci_arguments');
const options = Object.fromEntries(args.reduce((pairs, _, i) => i % 2 ? pairs : [...pairs, [args[i], args[i + 1]]], []));
const expected = options['--expected-sha'];
if (!/^[0-9a-f]{40}$/.test(expected ?? '')) throw Error('full_expected_sha_required');
const run = (cmd, argv) => execFileSync(cmd, argv, { cwd: root, encoding: 'utf8' }).trim();
const revision = run('git', ['rev-parse', 'HEAD']);
if (revision !== expected) throw Error('ci_revision_mismatch');
if (run('git', ['status', '--porcelain'])) throw Error('clean_ci_checkout_required');
const environment = { node: process.version, npm: run('npm', ['--version']), python: run('python3', ['--version']),
  platform: platform(), arch: arch(), git: run('git', ['--version']) };
if (Number(process.versions.node.split('.')[0]) !== 24 || !/^Python 3\.12\./.test(environment.python))
  throw Error('ci_requires_node_24_python_3_12');
const timestamp = new Date().toISOString();
const output = resolve(root, options['--output'] ?? `.local-ci/${revision}/${timestamp.replaceAll(':', '-')}`);
mkdirSync(dirname(output), { recursive: true });
mkdirSync(output); // Refuse an existing result directory instead of overwriting evidence.
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = { format: 'mithril.local-ci/v1', revision, tree: run('git', ['rev-parse', 'HEAD^{tree}']),
  started_at: timestamp, environment, status: 'running', steps: [], inference_calls: 0,
  github_actions_dispatched: 0, dependency_install_scripts: 'disabled', npm_userconfig: 'isolated-public',
  workflow_sha256: hash(resolve(root, '.github/workflows/test.yml')) };
const save = () => writeFileSync(resolve(output, 'summary.json'), JSON.stringify(report, null, 2) + '\n');
save();
// Public locked dependencies need no install lifecycle. Do not inherit personal auth/allow-scripts.
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json')));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json')));
const lifecycle = ['preinstall', 'install', 'postinstall', 'prepare'];
if (Object.values(lock.packages).some(p => p.hasInstallScript) ||
    [pkg, ...pkg.workspaces.map(p => JSON.parse(readFileSync(resolve(root, p, 'package.json'))))]
      .some(p => lifecycle.some(k => p.scripts?.[k]))) {
  report.status = 'failed'; report.error = 'dependency_install_lifecycle_requires_review'; save();
  throw Error(report.error);
}
const npmrc = resolve(output, 'public-npmrc');
writeFileSync(npmrc, 'ignore-scripts=true\n');
const childEnvironment = { ...process.env, npm_config_userconfig: npmrc, npm_config_ignore_scripts: 'true' };
delete childEnvironment.npm_config_allow_scripts;
delete childEnvironment.NPM_CONFIG_ALLOW_SCRIPTS;
delete childEnvironment.NPM_CONFIG_USERCONFIG;
const commands = [
  ['dependencies', 'npm', ['ci']],
  ['browser-runtime', 'npx', ['playwright', 'install', '--with-deps', 'chromium', 'firefox', 'webkit']],
  ['conformance', 'npm', ['run', 'test:all']],
  ['dynamic-setup', 'npm', ['run', 'setup:dynamic']],
  ['dynamic-runtime', 'npm', ['run', 'test:dynamic']],
];
for (const [id, cmd, argv] of commands) {
  const log = `${String(report.steps.length + 1).padStart(2, '0')}-${id}.log`;
  const row = { id, command: [cmd, ...argv], started_at: new Date().toISOString(), log,
    exit_code: null, signal: null, status: 'running' };
  report.steps.push(row); save();
  console.log(`${id}: ${cmd} ${argv.join(' ')} → ${resolve(output, log)}`);
  const fd = openSync(resolve(output, log), 'wx');
  const started = performance.now();
  try {
    await new Promise((ok, no) => {
      const child = spawn(cmd, argv, { cwd: root, env: childEnvironment, stdio: ['ignore', fd, fd] });
      child.once('error', no);
      child.once('exit', (code, signal) => { row.exit_code = code; row.signal = signal; ok(); });
    });
  } catch (e) { row.error = e.message; }
  finally { closeSync(fd); }
  row.finished_at = new Date().toISOString(); row.seconds = (performance.now() - started) / 1000;
  row.log_sha256 = hash(resolve(output, log));
  row.status = row.exit_code === 0 && !row.error ? 'passed' : 'failed';
  save();
  console.log(`${id}: ${row.status}, exit=${row.exit_code}`);
  if (row.status !== 'passed') { report.status = 'failed'; break; }
}
if (report.status !== 'failed') {
  report.final_revision = run('git', ['rev-parse', 'HEAD']);
  report.clean_after = !run('git', ['status', '--porcelain']);
  report.status = report.final_revision === revision && report.clean_after ? 'passed' : 'failed';
}
report.finished_at = new Date().toISOString(); save();
console.log(JSON.stringify({ status: report.status, revision, evidence: resolve(output, 'summary.json') }));
if (report.status !== 'passed') process.exitCode = 1;
