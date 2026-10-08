# Public review qualification — 2026-10-08

The native Mithril/Hermes Agent tool route successfully reviewed public repository `mithril-lang/mithril-system-one` at `b4489ce0e5a7680b5b2da9620841f16207bdfff4`. Acquisition checked public visibility, the commit/tree and file digests. It parsed 47 selected JavaScript files and observed 7 child_process calls with unresolved input paths. It produced zero source-policy candidates, 7 unknown observations and `review_incomplete`; this is not a security clearance.

The actual pinned Mithril compiler/OWL-SHACL receipt has graph digest `sha256:683a80167a3f6bbe9f016165f1b5fe2a2907cdc1a2050597a7aeb6533d7fe9e6`. Because all security facts were unknown, evaluation used an inert scope marker, without asserting unknown facts or manufacturing a finding. Controlled source fixtures separately prove that direct CLI-to-shell input produces a policy candidate through the actual engine.

Installed profile: `mithril-public-code-review`. Native Agent runtime tested: `0.21.5+4485.g3da66ca.dirty`, macOS arm64. A → isolated-other → A discovery produced review tool available → absent → available. No existing profile was altered. The new profile has no provider key, channel, cron job or started gateway; a live LLM conversation has not been qualified. Its configured provider URL is api.mithril.fund.

Local verification: root 48 tests + Todo 3; Python 18; public-review 5 including MCP handshake/refusal and actual ontology cases; security 6. Existing dynamic runtime checks are also required before publication. No GitHub Actions execution is used as qualification. Source acquisition is read-only and public; there is no target package installation/code execution, model inference, GitHub write, disclosure or remediation.

Private detailed read-back receipt remains in the owning profile's `source-checks/native-public-review-20261008.json`. It contains source locations and digests, not source snippets or credentials. Tests use synthetic adversarial fixtures; no third-party exploit was executed.

## 0.2.0 follow-up

Coverage now includes TypeScript/TSX/JSX plus static top-level CommonJS bindings, namespace ESM calls and immutable CLI aliases. Shadowed/reassigned bindings remain unknown. Separate fetched/parsed/unsupported/excluded counts and acquisition/parse/compiler/graph timings are returned. The profile installer upgrades only reviewed old package hashes and preserves operator edits and credentials.

Local verification passed 49 root tests + 3 Todo, 19 Python and 6 public-review tests (including the actual Mithril engine). The owning profile credential was explicitly supplied by the operator and stored privately outside Git. A real native Agent conversation through api.mithril.fund called the review tool and described the exact public commit's incomplete coverage. Its first 700-token/3-iteration qualification hit an output/iteration budget and took 71.58 seconds; this is retained as a bounded attempt, not a repository-scanner speed benchmark. A compact-report qualification follows separately.
