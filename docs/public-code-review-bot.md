# Public GitHub source review bot

The opt-in `mithril-public-code-review` profile uses `mithril-public-review` and the `mithril_public_repo_review` tool. The same implementation is callable through JSON stdin or MCP stdio. English is the default. Source acquisition and AST extraction are JavaScript adapters; evaluation policies are written in Mithril (`examples/security-ontology/policy.mith`) and executed by the pinned Mithril OWL/SHACL runtime.

## Execution contract

Input is exactly `{ "repository": "owner/name", "commit": "<40 lowercase hexadecimal characters>" }`. Branch names, arbitrary URLs, private repositories and commands are refused. GitHub public visibility, commit/tree identity, non-truncated inventory, per-file Git blob SHA-1 and SHA-256 are checked. Acquisition sends no authentication header, follows no redirects, and never uses a profile's GitHub token. Budgets are 5,000 tree entries, 100 selected files, 256 KiB per file, 5 MiB source and 1,000 observations. Failures and unknown outcomes are not retried.

Regular JavaScript `.js`, `.mjs`, `.cjs`, `.jsx` and TypeScript `.ts`, `.tsx`, `.mts`, `.cts` files are parsed inertly by pinned Acorn 8.15.0 / Babel parser 7.28.4. Babel uses its documented ESTree and TypeScript plugins (https://babeljs.io/docs/babel-parser). The extractor recognizes named or namespace ESM imports and static top-level CommonJS const bindings from `child_process` and `node:child_process`. It blocks bindings shadowed or reassigned anywhere in a file. Direct `process.argv[2+]` and immutable top-level CLI aliases are a supported external-input subset; mutable, shadowed or forward-referenced aliases stay unknown. Other arguments and unresolved shell options remain unknown. No general interprocedural taint analysis, general module resolution, authorization analysis, secret scanning or deployed-environment inventory is claimed.

Source code and comments remain inert data. The tool does not run package installation, imports, tests, builds, shell commands or target code. The only subprocess runs the trusted pinned Mithril compiler on generated facts; it receives no inference/GitHub credential. This is inert parsing, not a general container sandbox for executable repository workloads. No repository text is sent to a model. The separately published System One policy-refactoring prototype is not enabled here.

Outputs contain file locations/hashes, call observations, known-policy candidates, unknown facts, exclusions, Mithril graph/compiler receipts and elapsed time. Candidate status is `source_policy_candidate_requires_review`, never confirmed exploit. Every repository review remains `review_incomplete`, including zero candidates. Report acquisition/parse/compiler time separately from graph evaluation time; do not market graph-only timing as end-to-end repository scan performance.

The dependency lane adds locked npm OSV matching and Knowledge CVE/KEV/EPSS enrichment through actual Mithril ontology evaluation. See [supported scope, private-engine setup and live Knowledge gate](dependency-ontology-evaluation.md).

## Profile installation

Use Node 22+ and the reviewed checkout:

```sh
npm ci --ignore-scripts
npm run setup:dynamic
npm run setup:dependencies -- --engine-root /absolute/reviewed/security-core
python3 scripts/install-public-review-profile.py --home /absolute/hermes/home --apply
```

Version 0.2.0 adds `--upgrade`: it replaces only old package files matching shipped reviewed hashes and refuses operator edits. Credentials remain untouched. The installer creates one independent profile and copies only its reviewed plugin. It refuses symlink destinations and differing existing files; reruns are idempotent. Files are private (0600), directories 0700. It copies no credentials, channels, cron jobs or histories and does not change the active profile or start a gateway. The profile selects `https://api.mithril.fund/v1` for future conversations and references its own `MITHRIL_API_KEY`; configure that profile's credential separately. A successful deterministic tool review is not evidence of a successful LLM conversation.

```sh
node bin/mithril-public-review.mjs --stdin
# Supply one JSON object on stdin.
node bin/mithril-public-mcp.mjs
# MCP 2025-06-18 stdio: initialize, notifications/initialized, tools/list, tools/call.
```

Native Agent/Desktop uses the existing profile picker and plugin toolset (`mithril_public_review`). No separate dashboard or credential store is introduced. Start a new session after selecting this profile. Registry manifests compose skill, plugin, agent, workflow and MCP around these fixed entrypoints; runtime readiness means the bounded tool works, not provider authentication, scheduled scanning, GitHub posting or automated remediation.

## Qualification

`npm run test:public-review` checks bounded acquisition, visibility/blob mismatches, unsupported syntax, shadowed bindings, unknown propagation and actual Mithril policy evaluation. Python tests check profile isolation, idempotence, permissions and overwrite/symlink refusal. Tests are local; GitHub Actions is not required. Public read-back and the native Agent tool route are separate evidence gates recorded in operation notes.

Timing fields separately measure fetch, parse, acquisition total, assessment, compilation and graph evaluation. Eligible/parsed/unsupported/excluded counts are separate; parser success is not security coverage. No whole-repository score is emitted.
