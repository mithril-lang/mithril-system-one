# Architecture and integration boundaries

Normal Desktop/Web Chat → owner-bound tool execution → Mithril Code result → shared source editor → explicit recompile → explicit GitHub save / publication.

The core here invokes https://api.mithril.fund/v1/chat/completions and https://app.mithril.fund/api/compile. There is no direct OpenRouter client. Compiler requests do not carry the inference credential; redirects and uncertain retries are refused. The output is admitted only after its expected semantic stages are reported. Browser-reported receipts are not independent signed attestations.

## Existing consumers

Local task/CLI/MCP and the Hermes adapter support opt-in
[saved Mithril CodeGraph integration](codegraph-integration.md). The model receives
bounded revision-bound evidence; candidate source is compiled, independently
checked, indexed in a private preview repository and reasoned from saved Mithril.
This addition does not migrate existing hosted Web/Desktop consumers or activate
an owning Hermes profile.

- Hermes plugin source: adapters/hermes/mithril-code, extracted from https://github.com/mithril-lang/mithril-agent/tree/main/plugins/mithril-code. Install through the owning Hermes profile's normal plugin mechanism. Existing conversations keep their cached toolsets; new conversations discover updated tools.
- Native UI: https://github.com/mithril-lang/mithril-desktop, using canonical shared workspace components. No Desktop screens are duplicated here.
- Code/App service and shared package: mithril-lang/mithril-fund (private). Service auth/metering/compiler/deployment ownership remains there. The core extraction is not a production consumer migration.
- https://github.com/mithril-lang/mithril-harness is a separate DeepSeek Harness fork and is preserved.

## Examples

The Todo copy is pinned to 1567d383776876a745db618b164701e875a74778 of https://github.com/com-junkawasaki/mithril-todo; its independent repo remains available. Report receipts/source are pinned in provenance.json. Existing published report: https://com-junkawasaki.github.io/mithril-chat-coding-20261007/. Publication used GitHub CLI; it does not qualify new Web GitHub saving.

## Reproducibility

provenance.json records each copied file's origin revision and source SHA256. Two core test files have module-path adaptations; Todo uses 3 workers and list assertions that wait for hashchange rendering. The private API-owned system-policy test is excluded instead of replaced with a fake implementation. The compiler fixture is an actual prior bounded compiler response used offline, not a new live inference run. Local CLI adapter tests do not qualify native Hermes profile installation.
