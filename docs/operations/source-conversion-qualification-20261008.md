# Source conversion qualification — 2026-10-08

Implemented in the independent public System One repository. No Agent core checkout or existing security/dynamic compiler pin was changed.

## Delivered

- Deterministic JavaScript/TypeScript exported pure function frontend, typed signatures, source provenance and JSON-LD expression ontology.
- Executable `.mith` native-module emission and compilation using published Mithril `f78ce5756261131509aca0a5f417923eb0c4447d`.
- Separate admitted-source AST reference interpreter; execution of compiler-generated output in a fixed bounded subprocess.
- CLI, existing MCP `mithril_source_convert`, and independent Hermes/Mithril Agent plugin.
- Original and conditional-refactor Todo `.ts` / compiled `.mith` examples and actual qualification receipts.

Both example variants pass 513 cases and produce the same compiled-result digest. They exhaust the stated finite domain: Boolean toggle plus all 511 dense Boolean arrays of length 0–8. No claim is made for arbitrary host objects or full applications.

## Local gates

- `npm run test:convert`: 9 Node checks and 2 Python adapter integration checks passed. Includes actual compilation/execution, original/refactor equality, CLI refusal, compiler invalid-module refusal and independent verifier failure on a deliberately incorrect artifact.
- `npm test`: 54 core tests and 3 Todo tests passed.
- `npm run test:python`: 19 existing profile/adapter checks passed.
- `npm run test:dynamic`: 7 actual dynamic/MCP/workflow checks passed; includes new MCP tool invocation and previous dynamic contracts.
- `npm run test:public-review`: 6 source/policy/runtime checks passed.
- `npm run setup:module`: immutable compiler cache preparation passed.
- `git diff --check`: passed.

Validation runs locally without GitHub Actions and without paid inference. Timing in example receipts describes those individual local executions, not a repeated performance benchmark. Inference-call count is zero; infrastructure/billed savings are not measured.

## Delivery boundaries

The Agent adapter is available for explicit profile opt-in. Installed profile activation, Desktop/Web production rollout and Registry pin upgrades are separate steps and are not claimed by these results. No account cookies, API keys, active-profile settings or target source execution were involved.
