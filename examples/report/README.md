# Chat から Mithril を生成・確認・公開する

2026-10-07 JST、code.mithril.fund の通常の Chat で `mithril_code` を選び、Mithril 言語の静的 report を生成した実例です。Desktop と共通のソースエディターで見出しを編集し、「Mithril ソースをコンパイル」から本番 App コンパイラーによる再検査に成功しました。

推論は api.mithril.fund の qwen/qwen3.8-27b。1回のコーディング提案から Mithril Form の組み立て、実コンパイル、静的セマンティック検査まで 6.263 秒、入力1288・出力127 tokens。通常 Chat の前後の応答と公開時間は含みません。料金は未取得 (`null`) です。修正前の Worker では2回の診断試行が失敗しており、この成功1件から一般的な速度・費用・信頼性は主張しません。

公開は既存の GitHub CLI 認証で明示的に行いました。この新しい成果物を Web の GitHub 接続画面から保存できたという確認ではありません。生成・再コンパイルによる自動保存・自動公開はありません。

## Files and proof

- `application.mith`: 編集後の Mithril ソース。
- `artifact.json`, `index.html`: 編集後の実コンパイラー出力。
- `compilation-receipt.json`: 編集後ソースに結び付くコンパイル・セマンティック検査記録。deploy ステージは実行していません。
- `qa/original/`: 最初の生成成果物。
- `inference-receipt.json`, `metrics.json`: 最初の生成の記録。編集後の検証証明としては扱いません。ブラウザーから取得した応答であり、第三者向けの署名済み証明ではありません。

## Supported scope

This is a real `.mith` static report, generated in ordinary Mithril Chat and edited through the shared Desktop source editor. The model selects a bounded template and five fields; the harness emits Mithril Form and the production compiler executes infer/query/validate/compile/test. The static dashboard/report/directory catalog does not support arbitrary application logic, repository execution, or general UI authoring.

Inference uses api.mithril.fund, not a direct OpenRouter request. The 6.263-second measurement covers one coding proposal, source emission, compilation and bounded semantic checks; Chat orchestration and GitHub publication are excluded. Cost is unknown, not zero. Publication used the existing GitHub CLI account explicitly; this is not evidence of a new Web GitHub connection. No general performance or reliability advantage is claimed.

## App の通常 Chat でも確認

後続の本番 App 検証でも、通常 Chat → mithril_code → 実 .mith → 共有ソースエディター → 明示コンパイルが成功しました。[実ソースと記録](qa/app/) を残しています。コーディング提案から検査まで12.609秒、入力1287・出力114 tokens、料金null。Chat の前後の応答・公開を含まない測定です。この App 成果物の GitHub 保存は UI で行っていません。
