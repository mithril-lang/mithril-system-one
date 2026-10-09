# Local CodeGraph integration qualification — 2026-10-09

This records local source/runtime checks, not publication or native profile activation.

- System One `npm test`: 80 core tests and 3 Todo tests passed, zero failures.
- Explicit CodeGraph qualification with the reviewed Mithril checkout: 6 tests
  passed, none skipped. The real integration uses the actual pinned dynamic
  compiler, eleven input snapshots, isolated incremental candidate indexing,
  saved Mithril premise/schema/evidence, OWL/SHACL replay and actual MCP dispatch.
  Original source, revision drift (including edits during verification), malformed candidate extraction and private
  parent symlinks are checked. Unit checks cover prompt grounding, owner-selected
  roots, no credential forwarding and no retry after failure.
- Existing MCP/runtime qualification: 2 tests passed, including source conversion
  and dynamic tasks/workflow without optional graph contexts.
- Hermes adapter: 10 Python tests passed. These qualify registration, fixed child
  invocation, configured roots and credential boundaries; no Hermes profile was
  installed or activated.
- Mithril's existing graph/language/documents/persistence regression: 33 tests,
  239 assertions, zero failures/errors under the local SCI runner.
- Final changed task/planner/graph unit regression: 19 tests passed.
- JavaScript/Python syntax and both repositories' `git diff --check` passed.

A separate real CLI demo is saved privately under
`.mithril-codegraph/system-one-demo/`, with
`.mithril-codegraph/integration-receipt.json` in this checkout. The
`dynamic-repair-inheritance` task passes all eleven compiler input cases;
only `policy.mith` changes in the candidate; the original remains intact;
saved-premise graph reasoning conforms with zero violations. Candidate and
`reasoned.mith` paths/digests are in the receipt. The Japanese original evidence
is retained as source data, without an automatically invented semantic claim.

No hosted System One inference call was made for qualification. Planner prompt
grounding is protocol-fixture tested; the real compiler/graph replay uses the
deterministic ontology method. Whole-repository inference throughput, native
Amu validation, hosted Web/Desktop rollout, registry-pin migration, CI and
publication remain unqualified by these local checks. The existing compiler
continues to use Amu; these adapters do not pursue self-hosting.
