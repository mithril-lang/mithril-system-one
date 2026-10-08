# Dependency review qualification — 2026-10-08

The existing public-code-review bot now includes a dependency lane:
verified public GitHub lockfile → exact npm versions → OSV batch/full detail →
existing pinned private version matcher → evidence-backed RDF → actual Mithril
OWL/SHACL → affected-version candidates and explicit unknown coverage.

The private comparator source was not copied, published or changed. Its reviewed
commit is recorded in `runtime/dependency-engine-pin.json`; local configuration
references an operator-owned checkout. Missing access remains a matching-engine
gap. Existing ontology/compiler pins and Agent core were preserved.

## Actual external checks

- Public `mithril-lang/mithril-system-one` commit
  `e3c3f87e7946e49052990f9f7a279e4d884cbc2a`: 62 eligible source files and
  10 distinct supported npm dependencies were acquired and evaluated. No known
  affected-version candidates were found in that query; unsupported inventory and
  workspace references remain gaps. This is not whole-repository safety.
- A **synthetic lockfile** declaring `lodash 4.17.20` was queried against actual
  OSV. Five advisory candidates were matched and yielded five actual Mithril
  remediation violations. Advisory aliases and fixed-version hints are retained
  in `examples/dependency-ontology/live-osv.receipt.json`; no exploit or upgrade
  compatibility is asserted.
- The live Knowledge index returned HTTP 503. This is preserved as unknown and
  never substituted with KEV=false or an EPSS=0. Live Knowledge enrichment is
  unqualified; no production deployment or repair is claimed.
- Installed profile `mithril-public-code-review` upgraded four hash-reviewed
  instruction/plugin files to 0.3.0, preserving operator config and credentials.
- Native Hermes registry dispatch executed the upgraded public-review tool and
  returned the dependency result. Profile A → temporary B → A tool visibility
  was true → false → true. No model call, GitHub write, scheduled run or target
  execution was involved. New sessions see the updated instructions.

## Local gates

`npm run test:dependencies` checks actual private range matching, fixed boundaries,
reopened ranges, GIT unknown, actual Mithril evaluation, feed gaps, stable Knowledge
snapshots, identity checks, detailed-record resolution and timestamp precision.
Existing public-review, core/Todo and Python adapter/profile tests also pass.
The installer test verifies that tool-only upgrades preserve customized config.

Knowledge positive enrichment and KEV prioritization are contract-tested with
fixtures and real matcher/Mithril execution. These are not live production data.
Cold timings describe individual qualification runs, not a repeated benchmark.

Delivery is through local verification and GitHub commit status; Actions remains
manually disabled for this repository. Registry entries preserve the private
runtime prerequisite and unavailable-live-Knowledge boundary.
