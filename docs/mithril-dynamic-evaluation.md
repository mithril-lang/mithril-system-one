# Dynamic Mithril evaluation

This original task pack tests input-dependent execution of actual Mithril
OWL 2 RL inference and SHACL validation. It extends the static-document task
pack; it is not an Artificial Analysis, SWE-bench or Terminal-Bench score.

Three bounded coding tasks repair inheritance, repair required-label validation,
and compact a `.mith` ontology while preserving its semantic graph and runtime
results. An independent ordinary Todo implementation supplies expected task and
completion sets, validation outcomes and violations for eleven changing inputs:
add, complete, add another task, reopen, remove, missing label, duplicate labels,
wrong datatype, supply a missing label, and remove the two remaining invalid tasks.

The harness prepares immutable RDF snapshots from those events. Mithril itself
compiles the authored ontology, computes each input's OWL closure and executes
SHACL checks. It does not execute the JavaScript reference. Every snapshot is
reasoned from fresh input; facts from deleted tasks or earlier completion states
must disappear. This verifies dynamic semantic evaluation, not a mutable browser
Todo engine, general arithmetic evaluator, arbitrary code interpreter or persistent
transaction service. Those capabilities are not established by this pack.

The repair tasks must fail the independent contract before the edit and pass
all eleven cases after it. Refactoring must preserve the entire measured runtime
result, the canonical semantic graph digest and reduce source bytes. Negative
controls remove inheritance, weaken min/max validation, reuse a stale state and
reorder the responses. The verifier must reject each control.

## Run

Node.js 22+, Git and npm are required. Setup fetches immutable public Mithril,
Kotoba resolver, text and CLJK/SCI engine commits listed in
[`runtime/pins.json`](../runtime/pins.json), resolves the language's own pinned
Git dependencies and installs the engine's npm dependencies without lifecycle
scripts. Initial dependency download time is excluded from task timings. Warm
CLI timings include process startup, pin checks, two ontology compilations and
22 snapshot evaluations.

```sh
npm run setup:dynamic
npm run test:dynamic
printf '%s' '{"task_id":"dynamic-refactor","method":"ontology"}' |
  node bin/mithril-task.mjs agent --stdin
```

The same `mithril_task` native Hermes tool supports `dynamic-repair-inheritance`,
`dynamic-repair-validation` and `dynamic-refactor`. Upgrade the plugin to 0.2.0
and run setup in its configured `system_one_root` checkout. A new chat discovers
the updated tool description. No extra profile, gateway restart or core tool
override is necessary. Dynamic evaluation runs locally, without network effects
or an inference credential in the compiler child.

`method: "system-one"` uses one proposal from `api.mithril.fund` with the configured
Mithril API credential. Proposals select one bounded source edit and are admitted
by the same real compiler and independent verifier; there is no catalog fallback
or retry. `method: "ontology"` selects the catalog edit deterministically. These
small repair tasks expose a narrow action space rather than general code synthesis.
Usage and failure records must be reported; billed USD remains unknown.

Task sources and independent expectations are in
[`bench/task-packs/mithril-dynamic-v1`](../bench/task-packs/mithril-dynamic-v1).
Live records are in
[`bench/results/mithril-dynamic-20261007`](../bench/results/mithril-dynamic-20261007).
CI has a separate dynamic-runtime job that installs the pinned runtime and runs
real integration checks. Unit tests alone do not establish runtime execution.

## Initial live qualification (2026-10-07)

| Method | Tasks passing all 11 states | Wall time per task | Inference usage |
| --- | --- | --- | --- |
| Ontology catalog | 3/3 | 1.157–1.232 s | 0 calls |
| System One, Qwen3.8-27B via Mithril API | 3/3 | 5.299–6.235 s | 3 total calls, 1181 input / 21 output tokens |

Each task was attempted once. Both methods ran the same real compiler/reasoner
and independent verification. Timings include local runtime startup and checks;
they exclude dependency setup and outer Hermes orchestration. This is a small
functional qualification, not a statistically meaningful latency estimate or a
comparison against conventional LLM agents. No billed dollar measurement exists.
