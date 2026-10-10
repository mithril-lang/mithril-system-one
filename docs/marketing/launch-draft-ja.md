# 発信案 — 公開・投稿前の下書き

名称は **System One Coding**、エージェントループは **Mithril Semantic Loop**。英語の基本紹介文は **System One Coding — Generate Mithril code, verify its meaning, and iterate through a semantic loop.** とします。[名称と主張の範囲](../naming.md)。

## Mithril 特化の位置づけ

System One Coding は Mithril 特化の agent harness。短い提案から `.mith` を組み立て、意味検証・コンパイル・内容チェックを通った成果物を返します。対象は静的レポート・ダッシュボード・ディレクトリです。

反復試験で実行した8件はすべて合格し、生成からチェック完了までの中央値は5.362秒。予定1件は未実行です。費用と公開までの時間は未計測です。[対象範囲と合格条件](../mithril-harness.md)、[失敗・未実行を含む実測](../agent-benchmarks.md)。

English: **A Mithril-specific agent harness: short proposals, fast compilation, checked artifacts.** Eight executed static-Mithril attempts passed, with a 5.362-second median; one scheduled attempt remains missing. Cost and publication time are unmeasured.

## 2026-10-07 の比較試験

[3課題の試験結果と日英の発信案](../pilot-20261007.md)を追加。System One と同じQwenの全文生成が各3/3合格、中央値は5.76秒と15.83秒。既知フィールドのテンプレートは0.131秒。費用は未計測。以下の単発例とは別の記録であり、一般性能の倍率や料金削減率として使わない。

その後の[反復・agent-loop測定](../agent-benchmarks.md)では全文生成に応答不明のタイムアウトが1件あり、予定試行の一部は未実行。初回の成功例だけで信頼性を宣伝しない。公式課題の小規模試験も、AAの認定やフルランキング結果として表現しない。

## 現在の実測で使える短文

127出力トークンの提案から、Mithril の静的アプリを生成・検証。
実測6.263秒の例と、生成・コンパイル記録を公開しました。
System One Coding：短い提案を、検証可能なコードへ。
https://github.com/mithril-lang/mithril-system-one

注記を同じ投稿または画像内に掲載：単発実測／入力1,288トークン／静的reportの限定例／Chat・手編集・公開時間を除く／API料金は未計測。既存LLMより高速・安価という比較結果はまだない。

## 比較が揃った後の構成

1. 無編集の30秒程度の実演：依頼、実際のモデル応答、.mith、コンパイル・検証結果を連続して見せる。待ち時間をカット・倍速にしない。超過したら尺を延ばす。
2. 同じモデル・同じスターター・同じ合格条件の比較表を表示。成功率、時間、全トークンとテンプレート基準を含める。実請求額がなければ費用欄は「不明」。
3. 再現コマンド・失敗例・全結果・環境と公開日をrepoに置く。3課題の試験結果を一般性能の倍率にしない。
4. 日本語・英語の同じ主張を準備し、開発者向けにまず設計と再現方法を説明する。投稿・コミュニティへの送信は別途指示を受けて行う。

## 主張の段階

- 現在：少ない出力で静的文書を組み立て、実コンパイラで検証した具体例。
- 小規模試験後：限定3課題・単一モデル・単一試行での比較観測。料金差は未計測なら主張しない。
- 十分な比較後：課題集合、反復回数、成功率、時間境界を併記して測れた差だけを述べる。全機能がmodel生成されたTodo、汎用SWE性能、独自性・世界初は現状の証拠に含まれない。

## English version — same evidence boundary

127 output tokens → a compiled and checked Mithril static app.
We published a 6.263-second example, its source, and inference/compiler receipts.
System One Coding: a short proposal, then inspectable compilation and validation.
https://github.com/mithril-lang/mithril-system-one

Single static-report example; 1,288 input tokens. Timing covers the coding proposal, source emission, compiler and bounded checks; Chat orchestration, manual edits and publishing are excluded. API cost is unmeasured. Comparative speed and savings have not been established.

## 実演の収録手順

- 冒頭：実行する課題と、静的reportに限定した検証であることを画面に表示。
- 続けて：同じ画面で実行開始、モデル提案、実際の .mith とコンパイル・検証結果まで録画。体感の待ち時間を編集で短縮しない。
- 最後：入力／出力トークン、計測境界、repoへのリンク。未計測の費用や倍率を表示しない。
- 比較実測後：全方式の合否・失敗を含む結果を別画面で表示する。生成を録画する追加リクエストは比較6回の承認に含めず、別途実行範囲を決める。
