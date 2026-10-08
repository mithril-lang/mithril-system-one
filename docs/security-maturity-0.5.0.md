# Security harness reliability, 0.5.0

This release strengthens the existing bounded npm/SCAP lanes without expanding their evaluated ecosystem or host-probe scope. Deterministic evaluation makes zero inference calls; live-feed and installed Desktop/model-conversation qualification remain separate.

## Applying and recovering npm patches

Local application now takes an exclusive transaction directory under the current worktree's Git directory, writes a private, fsynced recovery journal before changing either package file, stages replacements, and checks the pair after writing. Concurrent apply calls and an existing pending journal refuse. Caught write failures restore the original pair when their recorded hashes still match. Each replacement is atomic; the journal recovers process-interruption states. Power-loss durability and non-cooperating external writers are not qualified.

`node bin/mithril-upgrade.mjs --recover-dir /absolute/project` explicitly restores an abandoned journal without npm, feed, target script or model execution. Recovery requires the original owning process to be absent, matching Git HEAD and tracked package files, and each file to equal its recorded original or updated bytes. If an operator changed either file, it refuses the whole preflight before restoring another. Journal content/digests and temporary basenames are validated. Active owners and concurrent recovery calls refuse. Pending state never expires automatically. A recovery process interrupted while holding its own recovery guard requires operator inspection; it is not silently discarded. API callers should let the original failed process terminate before invoking the separate recovery CLI.

Journal and owner files are 0600 in a 0700 transaction directory. They may contain package-file data and remain local, never sent to feeds or Registry. An unresolved recovery error retains evidence rather than overwriting operator edits. Recovery restores package files only, not Git history or node_modules. Neither apply nor recovery creates a commit or runs application scripts.

The `--apply-dir` CLI checks clean tracked files, base digests and pending state before external feed evaluation, and checks again during actual application. This avoids expensive feed/resolver work for an already dirty or stale destination. It is an observation before locking, not a reservation.

## Evidence consistency

Package manifest and lockfile root dependency/devDependency specs must agree before resolution and after it. Escaped duplicate JSON object keys, excess nesting and input budgets refuse or produce invalid-inventory gaps. The patch receipt includes a complete bounded lock-entry delta (added/removed/version/metadata changes), including transitive drift caused by resolution. Fixed-version hints still do not prove application compatibility.

SCAP reads result-local definition metadata through indexed direct structural paths and retains reported OVAL host names. Different reported OVAL hosts or an OVAL/XCCDF host mismatch refuse rather than form one mixed assessment. Missing host identity remains caller-supplied, unverified result evidence; matching names are not a host attestation. No links, fixes or host probes execute. SCAP result imports still return `review_incomplete`.

## Validation and local CI

`npm run check:security-release` is the local CI entrypoint: core/Todo, Python profile/importer tests, pinned real matcher/Mithril dependency cases and real compiler/MCP SCAP cases. It needs prepared dynamic/private-engine runtimes; it does not schedule GitHub Actions or live feed calls. `npm run test:remediation` specifically checks input consistency, exclusive apply, simulated interrupted transaction states, explicit CLI recovery, operator-edit/HEAD refusal, and controlled second-replacement ENOSPC rollback.

Live qualification uses canonical npm/OSV/Knowledge services through the actual CLI/MCP/native owning-profile tools. The controlled lodash application fixture updates 4.17.20 → 4.18.0, applies only the package pair, passes five behavior checks before/after, preserves Git HEAD, never executes the lifecycle sentinel, and refuses a dirty reapplication. These are fixture-specific guarantees, not arbitrary application compatibility. [Receipt](../examples/scap/maturity-0.5.0.receipt.json) records source hashes, runtime evidence and limits. Interrupted transaction cases are constructed filesystem states; the rollback case injects a known filesystem error into the actual replacement path. They are not power-cut experiments.

A local volume-full condition interrupted one validation pass. Owned regenerable fixture caches were cleared and affected tests/native dispatch were repeated successfully. No repository, history, credential or user data was removed. No new paid model conversation or installed Desktop UI validation is claimed.
