# Reproducible comparison protocol — 2026-10-07 JST

Status: the [three-task live pilot](pilot-20261007.md) is published with all nine attempts. Costs remain unmeasured. Prior single-call case receipts are examples, not part of the comparison dataset.

The subsequent [coding and agent-loop evaluation](agent-benchmarks.md) retains an interrupted three-repeat run, including an unknown full-source timeout and missing planned attempts. It also records real semantic-loop checks and the separate official-task Harbor smoke runner. Do not combine the successful first pilot with the later run while dropping failures or missing attempts.

## Arms and equivalent task contract

1. `system-one`: five-field model proposal, Mithril emission and actual compiler validation.
2. `llm-source`: the same Qwen model returns full `.mith` source, with the same starter supplied, exact fields requested, template/catalog mapping, static effects, actual compiler and task checks.
3. `template`: known requested fields feed the deterministic emitter, then the same actual compiler. No inference call. Compiler/infrastructure costs remain unknown rather than zero.
4. Optional `llm-fields`: an optimized structured-output control using exactly the same protocol/core as System One. This explicitly tests that the result is not a unique advantage over equivalent structured-output engineering. It needs a separate inference call; it is excluded from the initial six-call pilot.

Both model arms use api.mithril.fund, qwen/qwen3.8-27b, temperature0 and max_completion_tokens2048. Method order rotates by task/round. All arms receive the requested content and existing starter/catalog; source generation does not face an empty project while the other arm receives a starter. No arm receives a correction loop or retry budget.

The 20 cases are PUBLIC contract fixtures for static report/dashboard/directory parameterization. They are neither a held-out benchmark nor 20 independent software-engineering problems. All requested fields are known in advance; the no-LLM template can solve them by construction. They establish performance for this narrow representation task only. Whole Todo generation, arbitrary repository edits, hidden-test generalization and human developer productivity are outside this dataset.

## Preflight without inference or compiler requests

```sh
node bench/run.mjs --tasks 3 --rounds 1 --max-api-calls 6
```

This prints `mode: plan_only`: 3 tasks × 3 arms, at most6 inference calls and9 compiler calls. No generation is executed.

## Explicit live pilot

Set your existing MITHRIL_API_KEY through your own secret manager, then:

```sh
node bench/run.mjs --live --tasks 3 --rounds 1 --max-api-calls 6 --output /tmp/mithril-system-one-pilot-UNIQUE
```

The output directory must not exist. No credential is printed, written into the result, or sent to the compiler. Normal account allowances/charges apply. There is no automatic retry or resume; an unknown network/server outcome stops subsequent requests. Authorization and quota refusal also stop. Preflight refuses a schedule exceeding the explicit call limit. Files are written after each completed attempt so failures are retained.

A larger four-arm comparison requires separate explicit authorization and enough budget:

```sh
node bench/run.mjs --tasks 20 --rounds 10 --arms system-one,llm-source,llm-fields,template --max-api-calls 600
```

The command above still only plans. Live execution would make600 inference calls and up to800 compiler calls. It is not authorized by the initial six-call pilot. New genuinely held-out task families require expanding the supported compiler/harness contract before broad performance claims.

## Metrics and publication rules

- Time includes dispatch, model response, source emission, actual compiler and exact expected-content validation. Chat orchestration, human review and GitHub publication are excluded. Compiler service wall time is included, but infrastructure charges are unknown.
- Publish every attempt, success/failure counts, successful latency median/p95 and all-attempt median together. A faster successful subset at a lower success rate is not an unconditional speedup.
- Record all input/output usage, including known failed proposals. Missing usage remains null. Provider `usage.cost`, if present, is labelled provider-reported, not an invoice.
- `billed_cost_usd` remains null until matched billing records are available. Success-normalized billed cost is total cost of ALL attempts / successful attempts and remains null with missing invoices or zero successes. A free account quota does not prove zero marginal infrastructure cost.
- No headline multiplier or savings percentage from a three-task pilot. No generic LLM superiority claim from public static parameterization tasks. A substantive later comparison must include the optimized fields control and report template baseline results.
- `attempt-NNN.json` retains source/artifact/trace and owned model proposals. Review files before publication; receipts are not signed third-party attestations.

Offline transport tests exercise matched contract checks, ordering, usage-on-failure, budget preflight and unknown-outcome refusal. They do not count as live results. GitHub CI runs the offline tests only.

## Billing reconciliation

`bench/billing.mjs` joins separately supplied settled account billing records by `x-mithril-request-id`, with integer micro-USD amounts. It never reads account credentials, modifies a ledger, or guesses a price. Missing IDs or charges remain unknown; failed attempts retain their settled charges. Template/compiler infrastructure cost remains unknown. These account charges are not a provider invoice or total system cost; free-tier zero charges must not become a claim of zero compute cost. Do not publish unrelated billing records.

## Jev

[The Jev comparison](jev-comparison.md) includes existing historical raw records and their narrow-task limits. A current Mithril API Jev arm is unavailable: the advertised models and API do not implement the required Jev Decisions contract. Do not use OpenRouter or label a Qwen structured-output arm as Jev to fill the missing comparison.
