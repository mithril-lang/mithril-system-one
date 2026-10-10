# Runtime integration qualification — 2026-10-10 JST

PR22 production code was reviewed for scoped executor lifetime, pin/identity checks, fresh compilation, batch-only immutable quad reuse, full per-state validation, failure closure and graph-context forwarding. No must-fix issue was found in that review.

The previously skipped real CodeGraph integration now runs against a clean published Mithril checkout at `1ff06959616c5b421ec92710b4a749aa8554efa1` (PR85 merge), with the existing pinned dynamic runtime. All six CodeGraph tests pass, zero skipped.

The real integration now additionally calls the default workflow entry point with two distinct dynamic repair tasks and two original `.mith` files. It verifies one runtime process, two requests, zero result-cache hits, eleven projections per task, two isolated graph candidates with conforming saved-premise reasoning, and preservation of original source. This exercises real graph handling together with real scoped compiler reuse rather than only injecting a graph fixture or a custom one-shot workflow executor.

The first new fixture incorrectly repeated a task ID and was refused by the existing unique-task contract. That failed test log is preserved separately; the fixture now uses inheritance and validation repair with separate source files. Runtime behavior was not changed to accept duplicates.

Local raw logs remain in the calling task's `output/system-one-delivery-20261010/`. This is compiler/graph qualification, not model generation, speed/cost evidence, profile activation or hosted delivery. Older browser/default-CI failures remain preserved.
