# Polyglot source extraction verification — 2026-10-11

Implemented in `mithril-system-one`: twelve additional offline source frontends, syntax ownership and provenance in compiler-admitted Mithril ontology JSON-LD, public immutable-source acquisition, a library subpath, CLI and `mithril_source_extract` MCP tool. Existing JS/TS binding-aware extraction and bounded executable conversion are retained.

## Observed local checks

- Node 24.19.0; dedicated owner-selected Python 3.14.7 interpreter with all five pinned parser distributions.
- Full unit suite: 123 harness tests and 3 Todo tests passed.
- Final scoped checks: 23 tests passed, including twelve language fixtures, malformed-source refusal for all twelve frontends, comment/string exclusion, UTF-8 locations, unresolved shadowed calls, immutable Git blob verification, missing-runtime refusal, MCP invocation and actual compiler integration.
- All twelve extracted `.mith` ontologies compiled using the unchanged Mithril runtime pin `439a202fcf5ad5d0712217c98deb0bfac56de4e9`. All twelve reasoning cases returned `conforms`, `consistent: true`, canonical graph digests and nonempty ontology triples.
- These source ontologies supply zero SHACL security validation constraints. Conformance here verifies admitted syntax ontologies, not a vulnerability verdict, source execution equivalence or an Artificial Analysis score.
- No target code execution, model inference calls, deployment or GitHub Actions dispatch occurred in these checks. Local fixture receipts are not signed standalone release receipts.

## Integration boundaries

The approved organization controller remains pinned to `cbc4c165c464c8aa7e986b52a87de5df03739f5b`. Its repository profile is `runtime-required`, with digest-pinned Node/Python/Playwright and dynamic compiler readiness required. Source qualification, integration and release stay subject to that controller. A draft PR is reviewable source work, not a production rollout or active bot-profile upgrade.

The owner must provision the hash-locked parser environment and set `MITHRIL_SOURCE_PYTHON` in the reviewing process. Unconfigured consumers explicitly report `parser_runtime_unavailable`; they do not silently report a successful clean review. Public review stays incomplete, and language extraction does not expand the separate dependency-lockfile or taint-analysis coverage.
