# Mithril task, ontology and terminal harness

Six original public tasks translate common static-document maintenance problems into Mithril contracts with an executable ordinary JavaScript reference. The harness performs source inspection, a bounded edit proposal, source editing, actual Mithril compilation and independent task verification. The same harness is callable from a terminal or the opt-in Hermes task tool.

These are adapted Mithril problems with explicit equivalence boundaries. They do not replace the original tasks or graders of Terminal-Bench, DeepSWE or any external leaderboard.

## Tasks and equivalence

| Task | Ordinary problem | Mithril / ontology problem | Required result |
| --- | --- | --- | --- |
| `create-report` | Implement a static incident report | Populate bounded application facts | Exact content and ordinary HTML bytes |
| `repair-summary` | Fix an incorrect incident count in displayed text | Correct the summary fact, preserve other fields | Correct text and ordinary HTML bytes |
| `migrate-directory` | Migrate a report to a directory representation | Change template and derive its required shape | Exact content, directory template and entity-directory shape |
| `repair-shape` | Repair a view/schema mismatch | Satisfy the template-to-shape relation | Claim-list shape for the report; unchanged visible content |
| `repair-import` | Repair a corrupted dependency lock | Restore the approved ontology/library bindings | Initially refused import becomes admitted; unchanged output |
| `compact-refactor` | Reduce source formatting without changing behavior | Compact whitespace outside string literals | Entire compiled App IR unchanged, HTML bytes unchanged, fewer source bytes |

The [task pack](../bench/task-packs/mithril-v1/) contains each problem, its initial `application.mith`, goal, ontology contract and ordinary reference HTML. The [ordinary JavaScript executor](../bench/ordinary-reference.mjs) produces the reference independently of Mithril's HTML renderer. Template/shape properties are checked in the compiled artifact as well as rendered text: the current static text renderer does not display distinct layouts for every template.

The summary task repairs displayed text; it does not calculate a count from a dynamic incident database. Refactor is format-only, not function extraction or arbitrary repository restructuring. This first pack exercises the currently supported static language boundary.

## Two explicit solving methods

**`ontology`** is a deterministic catalog-rule control. It inspects the source and target facts, derives the required shape, restores approved bindings or compacts source. These host rules are bounded catalog operations, not a new general OWL reasoner. The actual compiler then executes its existing Mithril semantic pipeline and returns the receipts.

**`system-one`** uses one proposal from Qwen through `api.mithril.fund`. The model selects up to four bounded operations: set app facts, bind shape, restore bindings or compact. The host admits data operations, applies them to `.mith`, and checks the actual compiler result against the same task contract. Model output is never a shell command or executable host source. A failed proposal is not replaced by a successful deterministic result.

The `.mith` program declares the reasoner/query/validator/compiler/tester loop and approved library. JavaScript/Python are terminal and Hermes host adapters; this is not a claim that a general shell interpreter has been implemented in Mithril. Deployment remains a separate action.

## Recorded pilot — 2026-10-07 JST

| Method | Executed / scheduled | Passed | All-attempt P50 | Inference calls | Input / output tokens |
| --- | ---: | ---: | ---: | ---: | ---: |
| Catalog-rule ontology control | 6 / 6 | 6 | 0.351 s | 0 | 0 / 0 |
| System One edit proposals | 6 / 6 | 5 | 4.773 s | 6 | 3,066 / 305 |

Each method ran once per task in a separate sequential run. P50 uses the nearest-rank definition (the third sorted time for six attempts); the historical summary field is named `all_attempt_median_seconds`. These times cover inspection, proposing, applying, compiler requests and contract verification; they retain the unsuccessful attempt. Compiler-before calls are included for the shape/import repair and refactor cases. The small public pack and separate runs do not support a general speed multiplier. API and compiler monetary cost remain unknown, including for the no-inference rule control.

System One passed creation, text repair, template migration, shape repair and refactor. Its import-repair proposal was refused before applying a candidate; the recorded 544 input / 34 output tokens remain included. That failed proposal's content was not retained, so its precise format error cannot be reconstructed. Subsequent instrumentation captures bounded response content for diagnosis; no replacement attempt was run.

An earlier six-case qualification run assumed the compiler itself refused a known but mismatched shape. The server admitted it, exposing an incorrect benchmark assumption. That run is retained with five passes; the qualified task now checks the mismatch at the task-contract layer. The compiler's own import refusal remains required for the dependency case.

Separately, the terminal CLI completed the refactor, rechecked its candidate against the real compiler and produced HTML byte-identical to the ordinary reference. Its source shrank from **1,606 to 1,210 UTF-8 bytes**, while the complete App IR stayed equal. The JSON-stdin agent entrypoint also completed summary repair through the real compiler. Native Hermes plugin activation was not performed.

[All attempts, qualification, terminal records and SHA256 manifest](../bench/results/mithril-equivalent-20261007/). These results are separate from the earlier [Mithril generation / general terminal diagnostics](agent-benchmarks.md).

## Terminal workflow

Requires Node.js22+. Use a fresh output directory; initialization and candidate writes refuse to overwrite existing files. `run` keeps the initial source intact and returns a candidate only after successful verification.

```sh
node bin/mithril-task.mjs list
node bin/mithril-task.mjs init compact-refactor /tmp/mithril-refactor-UNIQUE
node bin/mithril-task.mjs run compact-refactor /tmp/mithril-refactor-UNIQUE ontology
node bin/mithril-task.mjs check compact-refactor /tmp/mithril-refactor-UNIQUE --candidate
cmp /tmp/mithril-refactor-UNIQUE/index.html /tmp/mithril-refactor-UNIQUE/ordinary-reference.html

# Independent ordinary implementation:
node bench/ordinary-reference.mjs compact-refactor

# Agent tool protocol: JSON input, JSON result; no filesystem writes.
printf '%s' '{"task_id":"repair-summary","method":"ontology"}' |
  node bin/mithril-task.mjs agent --stdin
```

Use `system-one` instead of `ontology` with your owning process's existing `MITHRIL_API_KEY` to request one model proposal. Normal inference charges/allowances apply; do not put credentials in task files or source. Neither route commits nor publishes artifacts.

```sh
node bench/run-mithril-tasks.mjs # plan only, no network
node bench/run-mithril-tasks.mjs --live --methods ontology --output /tmp/mithril-ontology-UNIQUE
# Six inference calls maximum at one round, eighteen at three rounds:
node bench/run-mithril-tasks.mjs --live --methods ontology,system-one --rounds 1 --output /tmp/mithril-comparison-UNIQUE
```

No uncertain inference/compiler outcomes are retried. Unknown outcomes stop the suite; known task failures remain visible. Attempts, token usage and compiler calls are recorded separately. The [optional Hermes adapter](../adapters/hermes/mithril-tasks/README.md) exposes the same JSON protocol as `mithril_task` with a reviewed checkout configuration; install/activation belongs to the owning profile.
