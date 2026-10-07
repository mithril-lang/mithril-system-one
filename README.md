# Mithril System One Coding

日本語 | English

System One Coding の生成・検証コア、Hermes adapter、TodoMVC と Mithril report の実例をまとめた公開リポジトリです。Desktop と Web では通常の Chat からツールを呼び出し、共通エディタでソースを確認します。

This is a standalone public extraction of the current bounded coding core and its examples. It is not the separate DeepSeek Harness fork in mithril-lang/mithril-harness.

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

Code report generation/compiler checks took 6.263 seconds; App took 12.609 seconds. These are individual recorded calls, exclude Chat orchestration and publication, and do not establish a latency distribution or comparative advantage. API cost is unknown. [Coverage](docs/coverage.md), [architecture and integration](docs/integration.md), [provenance](provenance.json), [Todo](examples/todo/README.md), [actual report](examples/report/README.md).

## Publication boundary

This repository is a fresh independent Git root, not a fork of the private Fund repository. It contains only the reviewed coding core, adapters, tests and public examples. The hosted compiler, auth/metering, deployment configuration and Desktop UI remain in their owning products. This package calls the existing services; it is not a self-hosted replacement for them. Existing consumers retain their reviewed pins until a separate migration.

Core/examples: Apache-2.0. Hermes adapter and bundled Todo/policy assets retain the notices described in [NOTICE](NOTICE). This repository is published on GitHub; no npm package release is implied.

## Comparison benchmark

[Protocol, limits and reproducible commands](docs/benchmark.md). `node bench/run.mjs` prints a no-network six-call pilot plan. Live execution is opt-in, has an explicit inference-call limit and never retries unknown outcomes. The ordinary full-source baseline and template control use the same actual compiler/task checks. The [three-task live pilot](docs/pilot-20261007.md) records 3/3 passes for each arm, with medians of 5.760 seconds for System One, 15.833 seconds for full source, and 0.131 seconds for the known-field template. These bounded public fixtures do not establish general coding performance; billed savings remain unknown. [Launch drafts](docs/marketing/launch-draft-ja.md) preserve these evidence limits.

[Historical Jev comparison and current API availability](docs/jev-comparison.md): raw recorded results are separate from today's Mithril-language pilot. The recorded Jev experiment did not lead its ordinary-LLM controls in speed or provider-reported cost.

[Coding and agent-loop evaluations](docs/agent-benchmarks.md) add a three-repeat run with its timeout and missing attempts retained, 18 real semantic-loop contract checks, and an optional pinned Harbor adapter for the public Mithril Hermes fork. External task smoke results and transport qualification are separate from bounded Mithril generation. No official Artificial Analysis score or billed savings are claimed.
