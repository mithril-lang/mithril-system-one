# Exact-commit validation: 2eefb6bee9dde2da0d0e0d7a7319dcaa8da48b77

These sanitized logs contain no credentials or personal home paths. All counts
refer to this exact commit; later identity hardening is not retroactively tested
by these logs. Original evidence is retained separately, unchanged.

- Original local CI started 2026-10-09 09:09:00 UTC: dependencies/runtime passed;
  conformance exit 1. Node94 + Todo3 and Python31 passed, browser57/60 failed.
- All three failures are Firefox artifact ENOSPC errors at context.close or trace
  writes/mkdir, not reported assertion failures. We cannot infer that no additional
  issue could exist. The original local CI remains failed.
- Restored native suite: process exit0, 13/13 passed.
- Supplemental low-disk browser run 09:18:06–09:18:28 UTC: exit0, 60/60 passed,
  retries0, same assertion/config hashes, one worker and trace off, line reporter
  and new output. The source and Git checkout stayed unchanged. It checks the same
  browser behavior but differs in diagnostic output/concurrency from default CI.
- Minimum host free during the successful supplement: 122,855,424 bytes (~117MiB).
  Host-wide free drop 16,621,568 bytes includes unrelated activity; isolated test
  peak/minimum required space is unmeasured. Around 116–439MiB fluctuated during
  this work; later tiny writes also hit ENOSPC. Do not claim storage is restored.

Only regenerable build/test output identified in this checkout totals ~512KiB
(HTML report ~508KiB and last-run state ~4KiB). Removing it would not resolve the
host-wide problem. Runtime browsers/dependencies are needed and no caches were
removed. The only prior cleanup was our downloaded Node archive, 27MB, already
hash-recorded; original evidence, user files and other tasks are untouched.
Normal three-worker/trace CI minimum is unknown. A conservative operational
headroom target is >=1GiB stable free, not an experimentally established minimum.
The low-disk method completed equivalent assertions without deleting evidence.

Final performance comparison contains 90 observations: five policies ×18 each;
per policy development9 and holdout9 (three same-family tasks ×three rounds), with
six three-task sessions. P95 uses the same task start-to-independent-verification
interval including cold process start; no model/human time is included. Development
fresh/parallel p95 is 3.438166/3.618146s (+5.23%). Small correlated samples and
uncontrolled load make persistent tail regression unproven, but the observed
worsening must remain visible. The prior complete 90-observation run and final
complete run are separate, not pooled. An intermediate final-code attempt only
persisted the initial baseline development3, missing87, in-flight outcome unknown;
none of its rows enters the final percentile denominator. The deliberate interrupted
probe is also a separate incomplete 2-task plan, not a successful benchmark.
