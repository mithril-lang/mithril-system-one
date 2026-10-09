# App proposal/compiler field limits — 2026-10-09

A local proposal could contain an 81-unit name and pass emission, although the App compiler only accepts 80. The same mismatch applied to description, headline and summary. This change rejects oversized proposals before compilation and states the same field limits in both generation and edit prompts. Exact content and existing template choices are preserved.

## Authoritative contract

| Field | Maximum UTF-16 code units |
| --- | ---: |
| name | 80 |
| description | 240 |
| headline | 120 |
| summary | 480 |

Verified against [the handoff's compiler revision](https://github.com/mithril-lang/mithril/blob/0bbaed09f09100b0eba8c634c74653007dd499de/src/mithril/app.cljk#L26) and [current main at inspection](https://github.com/mithril-lang/mithril/blob/52ab600a170f4b6512cf5cca43f49bcaaa41f9d9/src/mithril/app.cljk#L67). Both use `bounded-text!` and `count`. [ClojureScript count](https://github.com/clojure/clojurescript/blob/r1.12.134/src/main/cljs/cljs/core.cljs#L1907) returns JavaScript string `.length`. This is neither a byte ceiling nor a Unicode code-point ceiling. Text is not normalized or truncated.

The existing proposal schema is enforced in `emitMithril`: five exact fields, nonempty strings, forbidden controls and a closed template catalog. Its text keys now come from one frozen limit map, which also generates the prompt instructions. No JSON Schema `maxLength` was introduced: standard JSON Schema character counting would not express this compiler's UTF-16 contract.

## Hypothesis, alternatives and falsification

The hypothesis was that sharing the compiler limits across validation and prompts would eliminate this bounded mismatch without changing accepted content. Three candidates were compared by their failure modes: prompt-only guidance still accepts bad model output; automatic truncation changes user content; shared limits with explicit refusal preserves exact content and closes the admission gap. The third was implemented. A fixed independent oracle in the tests uses literal compiler ceilings rather than importing production limits.

The bounded cycle follows hypothesis generation, reflection, comparison, implementation and external validation inspired by [Google Research's co-scientist method](https://research.google/blog/accelerating-scientific-breakthroughs-with-an-ai-co-scientist/) and [Google DeepMind's description](https://deepmind.google/blog/co-scientist-a-multi-agent-ai-partner-to-accelerate-research/). This is a small software experiment using the existing emitter, task planner and compiler; it is not a deployment of Google's system or a model-rated improvement claim.

## Results and preserved failures

Baseline: independent detached worktree at `1d1b370` (main); no PR #14 commits included. The same new offline suite failed 10/10 test groups before the change and passed 10/10 afterward. The tests cover 48 isolated N-1/N/N+1 cases across four fields and ASCII, Japanese, non-BMP and combining text; they also test pre-compiler refusal without retries, exact Unicode/escape round trips, simultaneous ceilings, all templates and both prompts.

The separate mixed-text checks combine Japanese, emoji, decomposed accents, quotes and backslashes with every field at its ceiling across all three templates. They passed locally and through the real public compiler. They were separately designed from the isolated matrix, not sampled unseen user workloads.

[Raw compiler-only evidence](../bench/results/proposal-field-limits-20261009.json): 51/51 comparisons passed, comprising 35 compiler admissions with exact app content and executed semantic stages, plus 16 explicit HTTP 422 refusals. Baseline local admission matched the compiler in 35/51 cases; candidate local admission matched in 51/51. No unknown outcomes or unexecuted cases occurred. Hosted deployment revision is not attested by the public response; source inspection and live behavior are separate evidence.

Regression commands: `npm test` passed 92 package tests and 3 Todo core tests; `npm run test:python` passed 31 tests. The initial Node run failed the published-byte provenance check; only the changed file's published hash was refreshed, preserving original source provenance. Python's first sandbox run failed six localhost bind attempts; rerunning with permission passed. The first browser run could not launch its missing pinned binaries on Air; this is recorded as an environment failure. After installing the fixed Playwright binaries inside the isolated workspace, the headless Chromium/Firefox/WebKit rerun passed 60/60 in 40.1 seconds, without operating the user's browser GUI.

PR #14 remains separate and unmerged at `849f5236cc838b1e93a1f9520651d317ca2587cc`. Its digest fix, prior 9/10 live plan result and separate dashboard pass are not reclassified by this field-limit experiment. No deployment or merge occurred.

## Budget, stop conditions and reproduction

One implementation candidate was applied. New paid inference calls: **0**. Public compiler call cap: **51**, executed **51**; no credentials were sent. Stop on any unknown transport/status/evidence outcome, without retries; report failures and unexecuted cases. Stop this improvement cycle once the fixed matrix, separate mixed-text cases and regressions pass. Billed cost is unmeasured; no speedup or 100x claim is made. The 4.626-second compiler evaluation duration is only this fixture run's wall time.

```sh
git worktree add --detach ../proposal-baseline 1d1b370
node --test test/proposal-field-limits.test.mjs
node bench/proposal-field-limits.mjs  # prints the no-network plan
node bench/proposal-field-limits.mjs --live-compiler \
  --baseline-root ../proposal-baseline --output /tmp/proposal-boundaries.json
npm test
npm run test:python
npm run test:browser
```

Live compilation is explicit opt-in and uses the public compiler only. Normal tests use mock transports and do not invoke inference or a remote compiler. The evaluation JSON identifies baseline revision and both emitter byte hashes. Changes to compiler ceilings require another source inspection and bounded evaluation.
