# Mithril task tool for Hermes

This opt-in local adapter runs the original six-task suite through the same Mithril harness as the terminal CLI. It adds `mithril_task`; the existing `mithril_code` extraction and its pins remain intact.

Install using your owning Hermes profile's normal plugin mechanism, set `system_one_root` to a reviewed checkout of this repository, and use a new conversation to discover the tool. Node.js22+ is required. The `system-one` method uses that profile's existing `MITHRIL_API_KEY`; `ontology` uses no inference credential. No profile is installed or activated by this repository.

Arguments: `task_id`, `method` (`ontology` or `system-one`), optional bounded Mithril `source`. The child receives JSON input and executes a fixed Node entrypoint, with no generated command or arbitrary process execution. It returns candidates and receipts without saving or publishing files. A host timeout means an unknown outcome and must not be retried.

The local adapter tests qualify registration and the subprocess/data/credential boundary. Native Hermes activation remains a separate verification step.

Version 0.2.0 adds `dynamic-repair-inheritance`, `dynamic-repair-validation` and
`dynamic-refactor` to the same tool. Run `npm run setup:dynamic` in the configured
checkout before using them. They execute the pinned real Mithril compiler and
OWL/SHACL engine locally over eleven input snapshots. See
[dynamic evaluation](../../../docs/mithril-dynamic-evaluation.md) for the exact
contract and limits. Static-document tasks keep their existing hosted compiler.

Version 0.3.0 adds `mithril_workflow` for 1–3 distinct tasks, using the same
executor as the task CLI and the local stdio MCP. Workflows stop at the first
failure or unknown outcome. See [registry runtime](../../../docs/registry-runtime.md).
