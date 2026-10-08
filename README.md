# Mithril System One Coding

**A Mithril-specific agent harness for short proposals, fast compilation and checked results.**

System One Coding turns a bounded model proposal into an inspectable `application.mith`, then runs the actual Mithril compiler and checks its semantic receipts and task contract. The current supported tasks are static reports, dashboards and directories. Hermes, Desktop and Web can use this flow through their existing tools and shared editor.

The product goal is to clear supported Mithril contracts quickly. Evaluation focuses on contract pass rate, time to a checked artifact, proposal size and correct refusal of invalid sources. The package's CLI returns artifacts; saving and publishing use the owning product's workflow.

This repository publishes the coding core, Hermes adapter and examples. See the [Mithril harness scope and acceptance criteria](docs/mithril-harness.md).

The [Mithril task / ontology / terminal suite](docs/mithril-equivalent-tasks.md) adds six original tasks for creation, bug fixing, migration, schema repair, dependency repair and format-only refactor. It checks ordinary JavaScript output equivalence and whole-IR preservation for refactor. Its pilot records 6/6 passes for the catalog-rule control and 5/6 for System One proposals, with failures retained. Start with `node bin/mithril-task.mjs list`.

Source-to-Mithril conversion is also available: bounded pure JavaScript/TypeScript functions → inert AST → typed IR and source ontology → executable `.mith` → pinned native compiler → exhaustive finite-domain checks. See [supported syntax, CLI, MCP and Hermes setup](docs/source-to-mithril.md).

[Dependency evaluation](docs/dependency-ontology-evaluation.md) connects supported lockfiles, full OSV advisories, the existing private local version matcher and Knowledge context to actual Mithril ontology evaluation. Feed failures remain unknown; no automatic upgrades or exploit-proof claims.

## Included

- `lib/mithril-language.mjs`: fixed Mithril API proposal → inert `application.mith` → actual bounded App compiler → source/artifact/HTML/receipts.
- `lib/inference.mjs`: legacy Todo typed-AST admission, deterministic CLJK emission and 511 completion-vector checks.
- `adapters/hermes/mithril-code`: the existing Hermes plugin and CLI adapter, including its license.
- `examples/todo`: runnable standalone TodoMVC plus functional conformance tests.
- `examples/report`: the real generated/edited Mithril application and original/compiler receipts.
- `test/`: core, transport, CLI and adapter tests. CI also runs 20 Todo scenarios on Chromium, Firefox and WebKit.

## Run / test

Requires Node.js 22+ and Python 3. Standard tests are offline and do not invoke paid inference.

```sh
npm ci
npx playwright install chromium firefox webkit
npm run test:all
node bin/system-one.mjs status
```

Live generation requires your existing `MITHRIL_API_KEY` in the environment. Normal Mithril inference and allowances apply. `run` sends one request; uncertain failures are never retried. The CLI returns JSON to stdout and does not write, save or publish artifacts.

```sh
printf '%s' '{"goal":"Create a static Mithril report"}' | node bin/system-one.mjs run --template mithril-app --stdin
printf '%s' '{"goal":"Todo toggle and unfinished count"}' | node bin/system-one.mjs run --template todo --stdin
```

Run the Todo locally:

```sh
python3 -m http.server 8000 --directory examples/todo
```

Open http://localhost:8000/. Tasks stay in browser localStorage.

## Scope and measured results

Mithril generation currently supports static dashboard/report/directory documents. Todo generates only toggle and unfinished-count logic; its other UI/state behavior is maintained JavaScript. Functional coverage is not full-app model-generation coverage.

The latest repeated run cleared all eight executed System One Mithril contracts, with a median of **5.362 seconds**; one scheduled attempt remains unexecuted because the comparison run stopped on a baseline timeout. The compiler semantic loop passed **18/18 checks**, including invalid-source refusal; positive cases had a **0.189-second** median. These are bounded measurements, exclude Chat orchestration and publication, and leave billed cost unknown. [Full results](docs/agent-benchmarks.md), [coverage](docs/coverage.md), [architecture and integration](docs/integration.md), [provenance](provenance.json), [Todo](examples/todo/README.md), [actual report](examples/report/README.md).

## Publication boundary

This repository is a fresh independent Git root, not a fork of the private Fund repository. It contains only the reviewed coding core, adapters, tests and public examples. The hosted compiler, auth/metering, deployment configuration and Desktop UI remain in their owning products. This package calls the existing services; it is not a self-hosted replacement for them. Existing consumers retain their reviewed pins until a separate migration.

Core/examples: Apache-2.0. Hermes adapter and bundled Todo/policy assets retain the notices described in [NOTICE](NOTICE). This repository is published on GitHub; no npm package release is implied.

## Comparison benchmark

[Protocol, limits and reproducible commands](docs/benchmark.md). `node bench/run.mjs` prints a no-network six-call pilot plan. Live execution is opt-in, has an explicit inference-call limit and never retries unknown outcomes. The ordinary full-source baseline and template control use the same actual compiler/task checks. The [three-task live pilot](docs/pilot-20261007.md) records 3/3 passes for each arm, with medians of 5.760 seconds for System One, 15.833 seconds for full source, and 0.131 seconds for the known-field template. These bounded public fixtures do not establish general coding performance; billed savings remain unknown. [Launch drafts](docs/marketing/launch-draft-ja.md) preserve these evidence limits.

[Historical Jev comparison and current API availability](docs/jev-comparison.md): raw recorded results are separate from today's Mithril-language pilot. The recorded Jev experiment did not lead its ordinary-LLM controls in speed or provider-reported cost.

[Coding and agent-loop evaluations](docs/agent-benchmarks.md) add a three-repeat run with its timeout and missing attempts retained, 18 real semantic-loop contract checks, and an optional pinned Harbor adapter for the public Mithril Hermes fork. External task smoke results and transport qualification are separate from bounded Mithril generation. No official Artificial Analysis score or billed savings are claimed.

Dynamic Mithril evaluation now includes input-dependent OWL inference and SHACL
validation over eleven Todo states, repair tasks and semantic refactoring. See
[the dynamic evaluation contract and reproduction steps](docs/mithril-dynamic-evaluation.md).

[Registry execution surfaces](docs/registry-runtime.md) share the bounded agent,
workflow, MCP stdio server and Hermes plugin without duplicating the executor.

## Ontology security evaluation prototype

[Security evaluation design and local proof](docs/security-ontology-evaluation.md) uses the actual Mithril compiler and OWL/SHACL engine for three bounded source/environment snapshot policies. It preserves unknown coverage, validates policy-code proposals, and records synthetic graph-only timing. The separate [public source review bot](docs/public-code-review-bot.md) now extracts a bounded JavaScript subset from immutable public GitHub commits; neither capability proves exploitable vulnerabilities. Run `npm run test:security`.

## Public source review bot

[Profile, plugin and Registry integration](docs/public-code-review-bot.md) provides `mithril_public_repo_review` with authenticated file provenance and actual Mithril ontology evaluation. Repository reviews always preserve incomplete coverage; target code is never executed.
