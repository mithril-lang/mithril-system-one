# Registry execution surfaces

System One uses one bounded Mithril executor through four entrypoints:

| Surface | Command / tool | Contract |
| --- | --- | --- |
| Agent | `node bin/mithril-task.mjs agent --stdin` | One supported task |
| Workflow | `node bin/mithril-workflow.mjs --stdin` | 1–3 distinct tasks, stop on failure/unknown |
| MCP | `node bin/mithril-mcp.mjs` | MCP 2025-06-18 stdio, list/run/workflow |
| Hermes plugin | `mithril_task`, `mithril_workflow` | Owning-profile configuration and credentials |

Run `npm run setup:dynamic` in a reviewed checkout before dynamic tasks.
The MCP initialization handshake advertises five tools: `mithril_task_list`,
`mithril_task_run`, `mithril_workflow_run`, `mithril_source_convert` and
`mithril_codegraph`. Requests are newline-delimited JSON-RPC;
stdout contains only protocol messages. Inputs are bounded; arbitrary commands,
repository roots, task IDs and extra arguments are refused. Discovery and ontology proposals
need no model credential. `system-one` is an explicit inference choice using
`MITHRIL_API_KEY` from the owning process/profile; only api.mithril.fund is called.
The dynamic compiler child never receives this credential. Listing the MCP tools
never initiates inference or compiles a task.

```json
{"mcpServers":{"mithril-system-one":{"command":"node","args":["/ABSOLUTE/REVIEWED/CHECKOUT/bin/mithril-mcp.mjs"]}}}
```

Configure the path locally; no device path is a portable registry credential.
A host may supply its own scoped `MITHRIL_API_KEY` environment binding when the
user chooses System One. Do not paste tokens into exported MCP JSON.

```sh
printf '%s' '{"task_ids":["dynamic-repair-inheritance","dynamic-repair-validation","dynamic-refactor"],"method":"ontology"}' |
  node bin/mithril-workflow.mjs --stdin
```

The agent implements bounded inspect/propose/apply/compile/verify behavior and
returns candidates and receipts. Optional [CodeGraph contexts](codegraph-integration.md)
save private indices, Mithril evidence and isolated candidate previews. The default
task path returns artifacts without saving them. Neither path commits,
create GitHub repositories or publish Pages. Those effects remain in the owning
product's existing user-authorized save/publish flow. A finite task workflow is
not a scheduler or a general autonomous agent. Dynamic behavior means actual
OWL/SHACL evaluation across input snapshots; see the dynamic evaluation contract.
