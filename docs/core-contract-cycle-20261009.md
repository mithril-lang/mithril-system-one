# Core contract boundary cycle — 2026-10-09 UTC

Base: `1d1b370513ae084e0eb0810e5b4c956fa6631571` (fresh origin/main fetch; no open PRs at inspection). Reference `c8838e5c818aac9b734b599aa53951206e255385` is historical, not the tested base. Independent task-3 checkout/branch: `codex/core-contract-boundaries`; task-2 UI/publishing checkout was read only and untouched. No AGENTS.md or .agents/skills exist in the target checkout or inspected workspace ancestors.

## Method and bounded decision

Inspired by [Google Research's AI co-scientist](https://research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/) and [DeepMind's description](https://deepmind.google/blog/co-scientist-a-multi-agent-ai-partner-to-accelerate-research/). This is a small sequential application of its roles, not a reproduction of Google's multi-agent system, Gemini service or Elo experiments.

- Generation: three distinct hypotheses: (A) missing graph-binding evidence is incorrectly accepted; (B) unsupported natural-language requests may be reduced to static documents; (C) contradictory/duplicate trace stages may be accepted.
- Reflection: A has an executable counterexample: deleting both digest fields makes `undefined === undefined` pass. Checking equality alone also admits null/empty/arbitrary matching values. B requires a separately agreed task-policy contract, and a keyword filter risks false refusals. C needs a complete versioned trace schema; broad tightening could reject legitimate compiler output.
- Ranking: choose A by concrete falsifiability, narrow scope, compatibility with the recorded real compiler response, and no live inference expenditure. No model score establishes correctness.
- Proximity: retain B (task selection) and C (trace semantics) as separate families rather than variations of A. They remain open limitations.
- Evolution: add a canonical `sha256:` plus 64 lowercase hexadecimal digit check, retain digest equality, and reject null response/non-array trace with the existing refusal code. Existing matching compiler evidence remains admitted. One candidate patch; no iterative tuning against validation cases.
- Meta-review: retain all rows, failed setup/test attempts and remaining uncertainty below. Stop after this bounded patch, regression checks and draft PR; do not broaden the architecture.

Budget: one candidate, 14 cases × 3 repeats × 2 versions = 84 offline attempts, no benchmark retries, no paid inference, no live compiler calls. Source analysis/implementation uses this existing Codex session; token usage and billed session cost are not available, not assumed zero. Node v26.0.0, same fixture/compiler protocol and same runner for both versions. CI uses Node24, so CI remains an independent check. No model comparison was run; existing live model settings were unchanged. The 15s compiler timeout and no-retry policy remain unchanged. Correctness criterion: every planned row must match its expected acceptance/refusal outcome; 3 repeats must agree. Timing is descriptive only: this tiny fixture test cannot certify production latency, and no post-hoc performance threshold is used to assert success.

## Frozen cases and results

Run `node bench/core-contract.mjs NEW_OUTPUT_PATH.json`. Output must not exist. The runner uses the existing saved compiler fixture and public deterministic emitter. It measures acceptance of that response, not actual compilation of changed source. The three template cases exercise source emission and valid receipt acceptance; exact inference-to-artifact content matching remains covered by the existing generation test.

Fixed set: dashboard, report, directory; missing/null/empty/matching-invalid/mismatched digests; executed deployment; unknown template. Validation-only set fixed before the patch: short SHA-256, numeric digests, object trace, null response. These validation cases were not used to tune the patch, but are same-family response mutations, **not genuinely unseen software tasks**. Hidden task-family generalization remains unmeasured.

| Set | Before | After | All-attempt p50 before/after (ms) | All-attempt p95 before/after (ms) |
|---|---:|---:|---:|---:|
| Fixed | 18/30 | 30/30 | 0.091667 / 0.091875 | 0.323375 / 0.709208 |
| Validation-only | 0/12 | 12/12 | 0.109625 / 0.077750 | 0.210667 / 0.221916 |
| Total | 18/42 | 42/42 | — | — |

All 84 planned attempts were recorded; missing 0, benchmark retries 0. Per-case outcomes agree across all three rounds on each version. Baseline failures: six digest families falsely accepted (18 rows), object trace/null response leaked TypeError (6 rows). All three supported templates remain accepted (9/9 each version). The stronger boundary corrects receipt admission; it does not increase catalogue expressiveness. p95 increased on the fixed set; timing includes Response construction/JSON parsing and runtime warm-up and has only three repeats. No speedup or absence of production performance regression is claimed.

[Raw baseline](../bench/results/core-contract-20261009/baseline.json), [raw candidate](../bench/results/core-contract-20261009/candidate.json), [source identities](../bench/results/core-contract-20261009/identities.json). Both JSON reports record the base HEAD because candidate was uncommitted during measurement; identities bind the actual measured implementation bytes. Individual rows distinguish deterministic emission from fixture-response validation. Saving/publishing and human-intervention times are null (not measured), not zero. Human-authored implementation/review occurred; there was no repair of individual fixture outputs. Session exploration, setup, human coding/review and PR publication are outside row latency; their durations and token costs are missing. Billed cost remains null. No 100× or cost-saving claim.

## Regression and failure ledger

All logs are retained under `bench/results/core-contract-20261009/`.

1. Initial local exploration: expected canonical repo path absent; exec transport temporarily disconnected. No file modifications on the shared checkout. Recovered and cloned its clean main into the writable task workspace. Ordinary network fetch initially failed DNS; authorized network retry succeeded. Initial parent status-message calls failed because the parent thread is not addressable from this host; this report is the handoff.
2. Existing focused suite before patch: 4/4 passed. After patch: 5/5 passed (`focused-test.txt`).
3. First candidate `npm test`: 73/76 passed; missing acorn/Babel dependencies and provenance mismatch. This provenance failure was introduced by editing two manifested files, not a baseline defect. `npm ci --ignore-scripts` succeeded (11 packages); no credential/config changes. Update only published hashes of changed files and add adaptation record; original upstream revision/source hashes remain intact.
4. Independent baseline `npm test` with the same installed dependencies: 82/82 root and 3/3 Todo passed (`npm-test-baseline.txt`). Final candidate: 83/83 root and 3/3 Todo passed (`npm-test-final.txt`).
5. Python first attempt: 31 tests, 6 errors due to sandbox local-port binding refusal (`python-test.txt`). Same suite rerun with local-port permission: 31/31 passed (`python-test-retry.txt`). Mock HTTP 400/403/429/503 warnings belong to refusal tests, not production requests.
6. Browser suite: all 60 planned tests failed at launch because required Playwright browser binaries were absent (`browser-test.txt`). No browser test reached application execution; no retry/install of browser binaries performed. This is an explicit remaining verification blocker. Interactive browser operations were not used.
7. `git diff --check` passed. Dynamic/runtime integrations were not run: this patch touches the bounded response reader, not those compiler runtimes; full CI and real compiler replay remain pending.

## Contract limits

The five-field schema and fixed dashboard/report/directory mapping remain a closed catalogue. OWL/SPARQL/SHACL/compiler contracts validate bounded source/effects and receipts; they do not turn parameterization into arbitrary software generation. This change checks digest presence/format/equality, not cryptographic recomputation or signed authenticity. A malicious service could still return fabricated consistent digests; malformed JSON and other untested response shapes are additional open cases. Natural-language task acceptance, contradictory traces, actual compiler availability, unseen task families and real billed costs need separate evidence. The previous three-task pilot and interrupted later run are untouched and are not combined with this offline study.

No production deployment, merge, public campaign post, new persistent access, credential changes or paid-service calls occurred.
