# Mithril-specific agent harness

System One Coding is a specialized agent harness that takes a supported Mithril application goal to a compiled, checked artifact with a small model proposal. Fast completion of Mithril contracts is its product objective.

## Supported flow

1. Propose bounded fields for a static report, dashboard or directory through `api.mithril.fund`.
2. Admit the proposal and emit inspectable `application.mith`.
3. Invoke the actual hosted Mithril compiler.
4. Check the expected semantic receipts and task content; return source, artifact and receipts only when the contract passes.
5. Let the owning Hermes/Desktop/Web workflow inspect, edit, recompile, save and publish the result.

The measured generation boundary ends at the checked artifact. A successful compilation does not by itself establish successful deployment or GitHub publication. The legacy Todo example has a separate typed-AST/JavaScript scope and is excluded from Mithril-language performance claims.

## What “clear” means

A supported task clears when its generated Mithril source is admitted, required compiler stages are reported and the explicit content contract passes. Invalid source must be refused. Connection health, a plausible model reply or a proposed repair alone cannot count as completion. Unknown outcomes and missing attempts remain visible.

The primary measurements are:

- Contract pass rate, with scheduled, executed, failed and missing attempts separately reported.
- End-to-end time from generation request to the checked artifact, retaining failed-attempt times.
- Input/output tokens and proposal size; monetary cost only when actual prices or charges are available.
- Semantic-loop admission and refusal correctness, measured separately from model generation.

Use the same Mithril tasks, model, compiler and contracts for full-source and known-field-template controls. A deterministic template is an essential control when the task fits a known schema.

## Current evidence

The [original Mithril task suite](mithril-equivalent-tasks.md) extends this flow to bounded source maintenance: bug fixing, template migration, shape/import repair and format-only refactor. It provides terminal and Hermes tool entrypoints with ordinary-output and whole-IR equivalence checks.

The [published evaluation](agent-benchmarks.md) records eight passing System One attempts with a 5.362-second median and one missing scheduled attempt. The semantic loop passed 18/18 admission/refusal checks, with a 0.189-second positive-case median. This supports a concrete demonstration of fast completion on the tested static Mithril tasks. It does not establish universal completion times or monetary savings.

General repository-edit benchmarks are secondary integration diagnostics. The recorded Hermes Terminal-Bench attempts remain published as unsuccessful diagnostics; they do not define the specialized Mithril product's primary score. No Artificial Analysis leaderboard score is available.

## Public description

> System One Coding is a Mithril-specific agent harness: a short proposal becomes inspectable Mithril source, then a compiled and checked artifact. Try supported static reports, dashboards and directories; inspect the source and validation receipts.

Japanese:

> System One Coding は Mithril 特化の agent harness です。短い提案から Mithril ソースを組み立て、意味検証とコンパイルを通った成果物を返します。静的レポート・ダッシュボード・ディレクトリを対象に、ソースと検証記録を確認できます。
