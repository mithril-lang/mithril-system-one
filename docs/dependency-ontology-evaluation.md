# Locked dependency → OSV / Knowledge → Mithril evaluation

The public-code-review bot now joins a verified public GitHub commit's supported lockfiles with full OSV advisory records, uses an existing pinned local version-range engine, emits evidence-backed RDF, and executes actual Mithril OWL/SHACL evaluation. This deterministic System One harness path makes zero inference calls. Model conversation uses the existing owning-profile Mithril API configuration separately.

## Supported scope

The initial frontend supports npm `package-lock.json` v2/v3 only, including scoped names and nested packages, exact installed versions, dev dependencies and duplicate evidence locations. Links, workspaces, malformed or non-semver identities, and other discovered dependency formats stay in coverage gaps. Public source is acquired at a 40-character commit and both Git blob SHA-1 and file SHA-256 are checked; target files are data, never installed, imported or executed. Evidence uses a JSON pointer because JSON whitespace does not give a stable AST source line.

Limits: 20 inventory files, 1 MiB per file / 2 MiB aggregate, 100 distinct components, one OSV batch, at most 40 full advisory lookups, and 20 CVEs for Knowledge enrichment. The matching subprocess input is bounded at 1 MiB. Timeouts, 429, invalid data and unknown outcomes do not retry or become clean assessments.

[OSV's batch API](https://google.github.io/osv.dev/api/) returns summaries; the adapter fetches complete `/v1/vulns/{id}` records before matching. It compares modified timestamps at the batch's declared precision (batch truncates detail nanoseconds to microseconds) and retains hashes of batch/detail response bytes. Withdrawn records remain withdrawn. The matcher sees only the queried npm package's affected entries; other ecosystems in the same advisory are outside this frontend's scope. Unknown ranges remain unknown.

The [OSV schema](https://ossf.github.io/osv-schema/) describes reopened `introduced`/`fixed` intervals, exact versions and different range types. The adapter reuses the existing engine's logic rather than implementing another version comparator. Findings are **affected-version candidates**, not proof of exploitability or runtime reachability. Fixed-version hints are upstream advisory values, not verified compatible upgrades.

## Private matching-engine boundary

The existing comparator is in an operator-owned **private** `cloud-kotoba/security-core` checkout. This release contains only its invocation adapter and immutable commit reference, not copied proprietary implementation. Public consumers need separately authorized access to that engine. Missing/unavailable engines produce explicit gaps; no invented matcher or safe fallback is substituted.

```sh
npm ci --ignore-scripts
npm run setup:dynamic
npm run setup:dependencies -- --engine-root /absolute/reviewed/security-core
npm run test:dependencies
node bin/mithril-public-review.mjs --stdin
# {"repository":"owner/public-repository","commit":"40-character-immutable-commit"}
```

Setup stores only the absolute operator checkout path and reviewed commit in ignored `node_modules/mithril-dependency-runtime/config.json`. It does not clone private sources or copy credentials. Every matcher call verifies the pinned checkout HEAD and tracked contents, and pinned nbb/text sources. Parser, matcher and Mithril compiler subprocesses receive only PATH/HOME/TMPDIR, no inference credentials. No target-controlled command, namespace or plugin is loaded.

A supplied-inventory entrypoint is `node bin/mithril-dependencies.mjs --stdin` with `{ "files": [{"path":"package-lock.json","text":"…","sha256":"actual UTF-8 text SHA-256"}] }`. Its evidence is caller-supplied; only the public-repository path authenticates bytes against GitHub's immutable tree.

## Knowledge integration

The adapter calls the canonical `https://knowledge.mithril.fund/index.json` and fixed `/api/knowledge/search?dataset=nvd|kev|epss&cve=CVE-…` routes. It requires query-ready catalog descriptors, validates returned CVE identities, records response hashes/times and rechecks the catalog after enrichment. Only a KEV 404 against an unchanged ready catalog means absent from that snapshot; other failures mean unknown. EPSS includes its source date, not a prediction of certainty. Catalog availability alone does not prove that a dataset is recently refreshed.

Priority is transparent: known KEV membership first, EPSS ≥0.1 next as a review heuristic, then high/critical severity; remaining candidates require review. Unknown enrichment never clears an affected-version finding. Knowledge facts and dates are included in RDF when observed. Version-range matching belongs to the OSV engine; Knowledge's NVD lookup is contextual, not a second CPE/version matcher.

The current live Knowledge index returned **503** during qualification. Therefore live enrichment is not qualified. The implementation has working contract tests for positive data, stale snapshots, mismatched identities and unavailable feeds. It reports the live failure explicitly; no mirror or different credentials were silently substituted. SCAP/OVAL/XCCDF execution, automatic upgrades, broad CPE matching and production Knowledge repair are outside this release.

## Mithril policy and bot

`examples/dependency-ontology/policy.mith` defines affected dependencies, a known-exploited subclass and a remediation SHACL constraint. The adapter emits package/version/purl/evidence-digest and advisory/CVE/feed-digest facts, executes the actual pinned Mithril engine and independently checks the finding focus set against its violations. An inventory-observation marker keeps an empty assessment representable; it does not establish coverage or safety. Overall status stays `review_incomplete`.

The existing CLI, public-review MCP and `mithril_public_repo_review` Agent tool include a `dependencies` result without adding a dashboard or a second bot. Start a new chat after upgrading profile instructions/tools. `install-public-review-profile.py --upgrade --tool-only` updates only hash-reviewed tool/instruction files while preserving operator config and credentials. Registry artifacts need both the public runtime pin and separately prepared private-engine checkout; public installation is not evidence of runtime readiness.
