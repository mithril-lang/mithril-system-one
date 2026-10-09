# Measured outcome — final-code repeat

The final-code repeat completed 90/90 planned observations, all executable gates
and receipt comparisons passed; missing 0, automatic task retries 0. Every policy
has 18 task observations (9 development, 9 holdout) and six three-task sessions.
These are six distinct same-family tasks repeated, not 90 distinct unseen tasks.

| Policy | task p50 s | task p95 s | session p50 s | session p95 s | result-cache hits |
| --- | ---: | ---: | ---: | ---: | ---: |
| fresh | 2.500 | 5.254 | 7.418 | 13.000 | 0 |
| reuse-sequential | 1.117 | 2.777 | 3.894 | 6.660 | 0 |
| reuse-parallel | 0.885 | 2.705 | 3.167 | 6.415 | 0 |
| batch-control | 3.366 | 6.239 | 3.367 | 5.685 | 0 |
| warm-cache-control | 0.046 | 0.061 | 0.136 | 0.173 | 18 |

Startup-inclusive three-task session p50 improves
7.418→3.167s
(2.34x).
Task p50 improves 2.500→0.885s
(2.83x).
The first complete run yielded 2.10x session p50. They are separate runs; their
percentiles are not pooled or mixed with the discovery or earlier static pilot.

The final development slice p95 is **worse** for the parallel candidate:
3.438→3.618s (9 observations each).
The sequential-reuse ablation development p95 is
2.223s. The holdout candidate p95 is
1.688s versus 5.429s fresh.
Do not claim a uniform tail improvement. Small samples, correlated task repeats,
shared Air load and changing initial-request costs prevent generalization and a
reliable independent confidence interval. The overall candidate is provisional;
the development tail regression remains a reason to hold merge pending judgement.

The cache control hits all 18 previously compiled inputs; its serving time omits
**41.294s** of prewarm compilation, which is retained in its raw summary.
This is a known-input upper bound, not new task generation or 100x end-to-end.
Batch control task latency is time until the whole batch is ready, not one-third
of batch duration. Neither control is enabled in production code.

## Failure, interruption and exploration ledger

- New discovery: 9/9 fixed catalog tasks; fresh runtime p50 3.808s, p95 9.280s.
- First comparison: 90/90, experiment wall 196.053s; prewarm 57.360s included.
- First final-code attempt: only 3 rows persisted; exited 1 without diagnostics.
  Missing 87, in-flight outcome/cause unknown; no finalized summary. Preserved in
  `comparison-final/termination.json`, not represented as success or zero time.
- Separate explicit final-code repeat: 90/90, wall 162.739s;
  prewarm 41.294s included. No automatic per-task retries in either completed run.
- Deliberate started-process interruption: 0 successes, 1 interrupted, 1 missing
  next task, complete false, no continuation/retry or cached fallback.
- Complete-run experiment wall alone totals
  358.791s. This excludes discovery, the
  unexplained incomplete interval, implementation, local CI and human work;
  their total cost is not inferred as zero. Do not conflate task-runtime totals
  with research or end-to-end exploration cost.

The runtime pin commits are the same across arms. Each request still runs all
HEAD/status checks and compiles fresh sources. Source hashes in each plan bind
measurement to code: the first complete run preceded an extra close-after-hash
check; the final repeat measures that hardened candidate. The hardening resolves
an identified asynchronous close race, not an observed failed correctness case.
All historical PR14/15 result artifacts are untouched.

Model generation and human review/repair are unmeasured; model/API calls and
measured API tokens are zero. Billed costs remain null; no dollar or token savings
claim follows. No API credential copying, budget changes, new model installation,
GitHub Actions dispatch, merge or deployment was performed for this improvement.
See `protocol.md` for conditions, stopping rules and the unexecuted capped proposal.
