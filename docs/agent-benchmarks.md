# Coding and agent-loop evaluations — 2026-10-07 JST

These are self-run measurements with published settings and retained failures. They are **not an Artificial Analysis score, endorsement, or leaderboard submission**.

## External benchmark target

The current [Artificial Analysis coding-agent methodology](https://artificialanalysis.ai/methodology/coding-agents-benchmarking) evaluates DeepSWE v1.1 (113 tasks), Terminal-Bench 4.0 (66), and SWE-Atlas-QnA (124). It averages three attempts within each task, weights tasks equally within a benchmark, then weights the three benchmarks equally. Efficiency measurements accompany quality. We adopt explicit task/attempt identities, equal task weighting and missing-data accounting, without claiming compatibility with the full Index.

The [official Terminal-Bench instructions](https://www.tbench.ai/run) use Harbor and some tasks require GPUs. This client's Docker environment is CPU-only; a complete 66-task result would require the corresponding resources and full task budgets.

| Layer | Current evaluation | Interpretation |
| --- | --- | --- |
| System One Coding | Three public static Mithril tasks, three scheduled attempts per arm/task | Custom bounded representation task; partial run, not a general SWE score |
| Mithril semantic loop | Six positive/refusal cases, three attempts each | Custom compiler/semantic contract checks, not a learned autonomous repair loop |
| Mithril Hermes terminal loop | Official `session-window-debug`, two distinct bounded configurations | Both recorded verifier reward0; one task per configuration, not an overall SWE rate |
| Full AA Coding Agent Index | Not run | No composite score available |

## System One Coding: interrupted three-repeat run

| Method | Planned | Executed | Contract passed | Missing | Unknown outcome | All-attempt mean seconds | All-attempt median seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| System One | 9 | 8 | 8 | 1 | 0 | 5.548 | 5.362 |
| Same Qwen, full Mithril source | 9 | 9 | 8 | 0 | 1 | 17.489 | 14.148 |
| Known-field template | 9 | 8 | 8 | 1 | 0 | 0.175 | 0.170 |

The last full-source request reached the 45-second deadline with an unknown transport outcome. The entire run stopped; it was not retried, resumed, or filled with fabricated results. Missing System One/template attempts remain missing. The full-source observed task-normalized contract pass rate is 8/9; a complete score for the other arms is unavailable. The unequal completion and small public fixture set prevent a headline performance multiplier.

Only 17 of the maximum 18 inference submissions occurred, with 24 compiler calls. Model, temperature, contracts and fixtures match the [pilot protocol](benchmark.md); API cost and invoice amounts remain unknown. All-attempt means retain the timed-out request. Successful-only means are also present in machine-readable data, and must not be used to hide the timeout.

[All records](../bench/results/mithril-repeated-20261007/), [run summary](../bench/results/mithril-repeated-20261007/summary.json), [task-weighted evaluation](../bench/results/mithril-repeated-20261007/evaluation.json). The benchmark generation core was unchanged from revision `40cf3246bd1c7a802507ea49d569bc5d02200171`.

## Mithril semantic loop

Eighteen real compiler requests completed; **18/18 contract checks passed**:

- Report, dashboard and directory sources: each admitted on all three attempts. Each result records `infer`, `query`, `validate`, `compile`, and `test` as executed, with `deploy` not run.
- Incomplete source, unknown ontology and unknown library digest: each refused with HTTP422 and `status: refused` on all three attempts.

Positive-case median end-to-end time: **0.189 seconds**. Refusal-case median: **0.024 seconds**. These timings include network/compiler/receipt checking. They are not stage CPU timings, model generation speeds, or a measurement of Hermes planning. No inference calls were made; compiler infrastructure cost is unknown.

The known ontology's positive fixtures exercise a bounded materialization/query/validation pipeline. This is not a general OWL/SPARQL benchmark, arbitrary ontology reasoning score, or whole application deployment measurement.

[Records](../bench/results/semantic-loop-20261007/), [summary](../bench/results/semantic-loop-20261007/summary.json), [runner](../bench/semantic-loop.mjs).

```sh
node bench/semantic-loop.mjs # plan only, no network
node bench/semantic-loop.mjs --live --rounds 3 --output /tmp/mithril-semantic-UNIQUE
```

## Harbor runner and boundaries

| Configuration | Official verifier reward | Agent active seconds | Upstream requests | Input tokens | Output tokens | Ending |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 8 turns / 8 upstream-request cap | 0 | 113.610 | 8 | 71,759 | 761 | Relay budget exhausted |
| 16 turns / 20 upstream-request cap | 0 | 215.611 | 18 | 206,247 | 5,436 | Native agent exited nonzero after the bounded run |

Each configuration was attempted once in a fresh container. They are different agent variants, not three repeats of one variant. The second native trajectory records eight `read_file`, two `search_files`, and twelve `terminal` calls; it ended with a proposed diagnosis, and its artifacts did not pass the separate official verifier. This is a real unsuccessful task attempt, not a substituted template or a mock shell. Neither result establishes a general 0% success rate, a full Terminal-Bench score, or a comparison with AA's longer-budget agents.

The failed runs' Harbor `agent_result` reports zero token counts. The independent relay measured the nonzero usage above; we preserve both observations and use the metered counts instead of claiming no inference was consumed. Warm-up/helper requests are included. Costs remain unknown.

Before these variants, transport qualification uncovered a Responses-vs-Chat-Completions mismatch, a refused upstream request before matching Code's origin header, and a streaming mismatch. Those setup/configuration failures are retained separately and are not pooled into a model capability score. The final relay forwards the actual provider SSE bytes and tool calls; it does not fabricate streamed completions.

[Task identity/resources](../bench/results/terminal-smoke-20261007/manifest.json), [qualification and eight-request smoke](../bench/results/terminal-smoke-20261007/qualification-and-smoke.json), [16-turn summary](../bench/results/terminal-smoke-20261007/16turn-20call-summary.json), and [metered requests](../bench/results/terminal-smoke-20261007/16turn-20call-usage.jsonl). Full private job logs and native trajectories remain in the local benchmark output so standard-task contents and potential solutions are not copied into the product repository.

The optional [adapter](../bench/harbor_mithril.py) installs the public Mithril Hermes fork at `e4a9b3d23d89429c2a59e97546c77685d37ade35`, rather than labelling the NousResearch upstream agent as Mithril. It uses normal Hermes terminal/file tools in the task container. It does not modify the owning Hermes profile, Desktop process, or production services. The existing `mithril_code` static-document plugin does not implement a general terminal task and is not advertised as doing so.

Configuration: Harbor0.24.0, Docker29.4.0/aarch64, sequential attempts; task CPU/memory and separate verifier unchanged. These smoke variants cap the agent at eight/sixteen turns and 600 seconds rather than the task's full 28,800-second allowance. The local relay caps upstream submissions and completion tokens (4,096), sets temperature0, preserves tool calls/streamed bytes, and routes only to `api.mithril.fund`. Provider/model usage, refused requests and warm-up probes are counted; no direct OpenRouter calls or other profile credentials are used.

Only the relay host process receives the real API key. The agent receives a short-lived relay token, with access limited to the chosen model and request budget. The relay binds to loopback, refuses redirects, and stops submissions after uncertain outcomes. Prompt/response content and headers are absent from its usage log. It provides no basis for comparing TTFT or decode throughput with AA's direct provider measurements.

Requires Docker, Python3.14 and the optional pinned dependency:

```sh
uv venv /tmp/mithril-harbor-venv --python 3.14
uv pip install --python /tmp/mithril-harbor-venv/bin/python -r bench/requirements-harbor.txt
/tmp/mithril-harbor-venv/bin/harbor datasets download terminal-bench/terminal-bench@4.0.0 -o /tmp/mithril-tasks
# Set your existing MITHRIL_API_KEY in the owning process, without committing it.
/tmp/mithril-harbor-venv/bin/python -m bench.harbor_run \
  --task /tmp/mithril-tasks/terminal-bench/session-window-debug \
  --output /tmp/mithril-terminal-UNIQUE --attempts 1 --max-api-calls 8
# The separately measured higher-budget variant:
# --output /tmp/mithril-terminal-HIGHER-UNIQUE --attempts 1 --max-api-calls 20 --max-turns 16
```

Repeated attempts and model warm-up requests incur normal inference charges. Run independent invocations with unique output directories for repeats, so each trial receives its own identical request budget. Harbor trial retries and public uploads are disabled. The native agent may retry a refused request against the relay, but the relay submits no further upstream requests after uncertainty or budget exhaustion. Environment/verifier/setup time must be reported separately from agent active time. Standard task instructions and grader/reference solutions are not copied into this repository.

## Remaining qualification

- System One requires a real repository/terminal agent adapter before it can be evaluated unchanged on general terminal or repository-edit tasks. Translating a standard task into a known static template would change the benchmark.
- A leaderboard-comparable Terminal-Bench result needs the full task set, official allowances/resources, three independent attempts per task and integrity review of passing trajectories. This smoke test is not that result.
- DeepSWE and SWE-Atlas require their actual task environments/verifiers, isolation and grading protocols; no scores were borrowed from the underlying Qwen model.
- Settled charges and provider token prices are unavailable for this endpoint. Cost/task and cost/success remain null; free allowances or fewer tokens do not prove monetary savings.
- These records must not be advertised as AA certification, held-out SWE results, broad faster/cheaper claims, or successful GitHub publication by an autonomous agent.
