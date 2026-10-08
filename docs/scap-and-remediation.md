# SCAP result ontology and npm remediation

## SCAP / OVAL / XCCDF

`node bin/mithril-scap.mjs --stdin` and `mithril_scap_review` (MCP/Hermes) accept exactly `{ "xml": "caller-supplied XML" }`. The frontend imports namespace-qualified OVAL 5 results plus embedded definitions, XCCDF 1.2 Benchmark/TestResult, SCAP 1.2 source data-stream containers and ARF 1.1 report containers. It retains hashes, CVE references, targets and inert check references, then runs the real Mithril OWL/SHACL policy in `examples/scap/policy.mith`.

OVAL vulnerability/patch `true` and compliance `false` are failures; inventory `true` is not a vulnerability. Unknown definition classes, unknown/error/not evaluated remain gaps. XCCDF fail is a failure; fixed requires re-evaluation. No results means no host evaluation, never a clean report. Unselected/not applicable rules do not prove system-wide compliance. Multiple systems/TestResults and duplicate result identities are refused rather than silently mixed. DTD/entities, spoofed root namespaces, oversized/deep XML and malformed outcomes are refused; links and fixes never execute. Limits: 1 MiB XML, 10,000 nodes, depth 64, 2,000 results.

This is **scan-result ingestion and Mithril re-evaluation**, not a complete OVAL definition interpreter, host probe engine, SCAP conformance certification or automated OS hardening. Caller-supplied results are not authenticated scanner/host attestations. See the [OVAL results specification](https://oval-community-guidelines.readthedocs.io/en/latest/oval-schema-documentation/oval-results-schema.html) and [NIST XCCDF 1.2](https://csrc.nist.gov/pubs/ir/7275/r4/upd1/final).

## Automatic npm security upgrades

`node bin/mithril-upgrade.mjs --stdin` and `mithril_dependency_upgrade` accept exactly `{ "files": [{ "path": "package.json", "text": "...", "sha256": "..." }, { "path": "package-lock.json", "text": "...", "sha256": "..." }] }`.

The harness assesses the lock using full OSV/Knowledge/private version matcher/Mithril, chooses same-major stable fixed-version hints for affected **direct** dependencies, resolves a new lock in a temporary HOME/config/cache with fixed npm registry and lifecycle scripts disabled, checks exact resolved versions, and re-assesses all resulting locked components. It returns both updated files only when findings and coverage gaps are zero in this supported scope. Original manifest scripts remain data and are preserved in the output; never executed. No installation of target code, test command, LLM call, repository write or automatic merge occurs through MCP/bot.

Unsupported/transitive-only fixes, major jumps, missing fixes, workspace/override/peer/optional manifests, non-registry dependency specs or tarballs, missing integrity, changed hashes, feed outages and post-update findings refuse output. Only root npm lock v2/v3, registry tarballs and simple exact/caret/tilde direct dependency specs are supported. Private engine setup remains required. Upstream fixed hints are not compatibility guarantees, and no application tests are run.

For explicitly requested local application, append `--apply-dir /absolute/clean/git/project` to the CLI. It requires clean tracked package files and identical base SHA-256, refuses symlinks, stages atomic file replacements and rolls back already-written files if a later write fails. It does not commit, push or run application scripts. Concurrent changes cause refusal, not overwriting. GitHub PR creation remains an operator action after application compatibility checks.

## Qualification

The synthetic ARF fixture produced two actual Mithril violations and retained one unknown. The real npm resolver plus canonical live OSV/Knowledge and the private pinned matcher upgraded synthetic lodash **4.17.20 → 4.18.0**: five affected-version candidates before, zero candidates and zero gaps after. `examples/dependency-ontology/live-upgrade.receipt.json` records hashes and evidence. This is a single qualification, not a throughput benchmark or proof of application compatibility. No real user project was upgraded during qualification.

## Live scanner and application qualification (2026-10-08, 0.4.1)

OpenSCAP 1.3.7 ran actual file probes in an isolated Debian container (`--network none`, capabilities dropped, no host filesystem mounted). One known file existed and one intentionally did not. XML schemas validated; XCCDF evaluation returned expected exit code 2 for a failed rule. The unmodified generated OVAL, XCCDF and ARF XML were then sent through the CLI and the actual Mithril compiler: respectively 2/2/4 results, 1/1/2 failed-control assertions, no unknown gaps. These are overlapping representations of the same two controlled checks, not independent vulnerabilities.

This exposed a 0.4.0 ARF interoperability bug: source-datastream and result-local copies of the same definition were incorrectly treated as ambiguous. Version 0.4.1 binds class/CVE semantics to each `oval_results` element; definitions in a different component cannot change the result. Duplicate definitions within one result still refuse. The authentic ARF output is retained as `examples/scap/openscap-arf-results.xml` and covered by actual compiler regression tests.

Live npm CLI `--apply-dir` updated exactly package.json/package-lock.json in a synthetic clean Git repository, with unchanged Git HEAD. Five controlled lodash application checks passed on both 4.17.20 and 4.18.0. Lifecycle-script sentinel never ran. Reapplication refused the dirty project without modifying its files. The MCP upgrade tool independently resolved and reassessed the live registry/feed data, returning a patch without project writes. Native owning-profile tool dispatch also qualified the authentic ARF and live npm patch; other-profile tool isolation remains verified. No new model conversation or installed Desktop UI qualification is claimed.

[Receipt](../examples/scap/live-qualification.receipt.json) separates the tested published npm runtime from the corrected SCAP source digest. Durations include network/resolution and are single-run observations, not benchmark scores. The five application checks establish only this controlled fixture's compatibility.

To reproduce the scanner lane, copy `examples/scap/live/{definitions.xml,benchmark.xml,scan.sh}` to a new writable temporary directory, build `examples/scap/live/Dockerfile`, and mount only that directory at `/work` when running `sh scan.sh` with no network/capabilities. The Dockerfile pins the base image digest and Debian scanner package; build needs package-network access. Feed qualification is opt-in: `node scripts/qualify-upgrade-application.mjs --output-dir /absolute/new/directory` creates its own fixture and explicitly installs/executes the controlled lodash checks with scripts disabled. The harness upgrade tool itself never executes application tests. Private matcher/dynamic runtime setup is required.

For current 0.5.0 transaction recovery, manifest/lock consistency, input and target boundaries, and local CI, see [reliability contract](security-maturity-0.5.0.md).
