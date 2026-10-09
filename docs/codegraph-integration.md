# System One ↔ saved Mithril CodeGraph

The local System One task harness can ground a proposal in a revision-bound
repository graph, then index and reason over an isolated candidate using the
actual Mithril CodeGraph and OWL/SHACL engines. The existing task compiler and
independent behavioral checks remain required. Compiler self-hosting is not a goal.

```mermaid
flowchart LR
  R[Owner-selected repository] --> G[Located graph context and revision]
  G --> P[System One or deterministic planner]
  P --> C[Existing compiler and task verification]
  C --> D[Isolated candidate and incremental index]
  D --> M[Saved asserted, source and ontology Mithril]
  M --> I[Reload and OWL / SHACL inference]
  I --> V[Reviewable source, delta and reasoned Mithril]
```

## Local configuration

Use a reviewed Mithril checkout containing `bin/mithril-system-one-graph.cljk`
and `scripts/run-sci.mjs`. Its pinned Clojure classpath, Node and SCI/nbb runner
must already work. Run `npm run setup:dynamic` in this System One checkout for
dynamic tasks. Existing App/module/dynamic compiler pins are unchanged.

```sh
export MITHRIL_CODEGRAPH_RUNTIME_ROOT=/absolute/reviewed/mithril
export MITHRIL_CODEGRAPH_REPOSITORY=/absolute/owner/repository
printf '%s' '{"action":"index"}' | node bin/mithril-codegraph.mjs --stdin
printf '%s' '{"action":"query","request":{"operation":"search","query":"Task","limit":5}}' |
  node bin/mithril-codegraph.mjs --stdin
```

Use explicit `{"action":"rebuild"}` to migrate old caches. `reason` reloads
saved premises and writes `reasoned.mith`; it is opt-in because materializing
an entire repository can be expensive. Root paths come from the owning process,
not model/tool arguments. Missing configuration refuses before inference.
The fixed graph subprocess receives PATH/HOME/TMPDIR, not the inference credential.
This is a local execution adapter, not an OS isolation claim.

## Task and workflow inputs

Choose a supported task whose input is compatible with the target `.mith` file:

```json
{
  "task_id": "dynamic-repair-inheritance",
  "method": "ontology",
  "codegraph": {
    "target": "policy.mith",
    "request": {"operation": "search", "query": "Done", "limit": 5}
  }
}
```

Send this JSON to `node bin/mithril-task.mjs agent --stdin`, or MCP
`mithril_task_run`. Set `method` to `system-one` to use the existing owning API
credential and model proposal. Only that choice performs inference. The graph
context is bounded data in the model prompt, with source and revision identities.
An existing target supplies the initial source; an explicitly supplied `source`
must equal it. A new target uses the task's initial source unless supplied.
Targets are bounded relative `.mith` paths. This does not add arbitrary coding tasks.

For `mithril_workflow_run` / `bin/mithril-workflow.mjs`, optional `codegraph` is
an array with one context for each `task_ids` entry. All contexts are validated
before starting. These are independent previews against the owning repository;
one preview is not silently applied before the next task. A workflow stops on
compiler failure, nonconformance, stale revision or unknown outcome.

After successful task checks, admitted original source strings are copied to a
private Git root under `.mithril-codegraph/system-one-candidates/<uuid>/`.
The baseline is indexed; only the target is replaced by the verified candidate;
the incremental index is updated and saved `.mith` premises are replayed.
The original revision/source manifest is checked again before success, so edits
during candidate inference also stop the workflow.
The original repository source is retained. No target hooks, original submitted
code, model commands or target package scripts are executed. The candidate's
`.git` exists only for the normal local CodeGraph manifest.

The receipt's `codegraph` contains context, repository/base-source identities,
candidate path, before/after receipts, changed/deleted/affected/reused counts,
diagnostics, saved archive path, reasoned path and digests. `total_seconds`
includes graph context, task and candidate verification; the existing task-only
`row.seconds` measurement retains its meaning. OWL conformance concerns the
located CodeGraph ontology, not whole-program behavior or arbitrary prose truth.
Unsupported extraction and unresolved relations remain coverage diagnostics.

## Agent surfaces

The System One MCP advertises `mithril_codegraph` with `query`, `index`,
`rebuild` and `reason`. Task/workflow schemas expose the optional contexts.
The Hermes `mithril-tasks` adapter exposes the same graph tool and contexts.
Configure `system_one_root`, `codegraph_runtime_root` and `codegraph_repository`
in the owning profile, and start a new chat. Existing consumers keep their
reviewed pins and configuration until explicitly upgraded. Native profile
activation and production Web/Desktop rollout are not established by local tests.

## Verification

```sh
npm test
python3 -m unittest discover -s test -p test_mithril_tasks_adapter.py
MITHRIL_CODEGRAPH_RUNTIME_ROOT=/absolute/reviewed/mithril npm run test:codegraph
node --test test/registry-runtime.integration.mjs
```

The real integration runs dynamic compiler verification over eleven inputs,
checks candidate-only deltas, original preservation, Japanese evidence storage,
separate inference layers, stale revisions, malformed extraction, private-parent
symlink refusal, workflow dispatch and actual MCP dispatch. Unit tests confirm
prompt grounding, credential separation, preflight and no retry after failure.
No hosted model call is made by these tests. The integration test skips when the
explicit runtime root is absent; a skipped test does not qualify the integration.
