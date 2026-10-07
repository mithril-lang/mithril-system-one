# Jev comparison: historical results and current availability

The current System One harness uses `api.mithril.fund` and emits actual Mithril `.mith` applications. Jev is a separate decision model, not another name for the current Qwen structured-output path.

## Current Mithril API comparison

The public Mithril model catalog currently lists Qwen blue/red routes, not `typesafe/jev-1.13`. The existing Jev adapter in the compiler repository calls OpenRouter's Decisions API (`/api/alpha/decisions`); the current Mithril API implements no equivalent Decisions route. Changing its URL would not make its choice/probability/confidence contract compatible with a chat-completions response.

No new OpenRouter request or Jev inference was submitted for this work. A new live Jev arm remains unavailable until a real authenticated Mithril API decision route and its model are provisioned and verified. It must use the same tasks and acceptance checks as its controls; the legacy two-function Todo task cannot be presented as a comparison against today's static-report task. Do not silently substitute Qwen, a fixture, or a predetermined choice for Jev.

## Recorded 2026-10-06 Todo experiment

These are existing historical records, not a new run. All four arms solved the same two CLJK function bodies, checked both toggle states and 511 completion vectors, and preserved unrelated markers. UI, application construction and publication are excluded. Ordinary LLM arms were allowed up to four repair attempts. Jev assembled typed blocks using multiple Decisions calls. Five attempts per arm are too small and narrow to establish general coding superiority.

| Method | Passing attempts | Median seconds | Median provider-reported API USD | Total inference calls, five attempts |
|---|---:|---:|---:|---:|
| System One + Jev 1.13 | 5/5 | 2.973 | 0.000401268 | 41 |
| Qwen3 Coder Next + repair | 5/5 | 2.195 | 0.000089240 | 9 |
| Gemini 2.5 Flash + repair | 5/5 | 2.624 | 0.000231600 | 9 |
| Known template + checks | 5/5 | 0.361 | 0 inference charge | 0 |

In this recorded experiment, Jev took about **1.35× the Qwen time** and **4.50× its reported API cost**. Against Gemini, it took **1.13× the time** and **1.73× the reported API cost**. These ratios describe the medians of the historical experiment only. They do not support a claim that Jev is faster or cheaper. Provider-reported amounts are not settled invoices or total operating cost; the template still requires infrastructure and checks.

[Raw historical rows](../bench/results/legacy-jev-20261006/rows.json) and [derived summary and source digest](../bench/results/legacy-jev-20261006/summary.json) preserve the recorded timings, usage and failures/repairs. The source is Fund `apps/code/public/coding-benchmark.json` at revision `e5f6f2867751b8bbed3e4c27f4eb594eab317a86`.

For current Mithril-language comparisons, follow [the matched benchmark protocol](benchmark.md). Keep these historical results separate from current API measurements and from the English Code quick-start demonstration.
