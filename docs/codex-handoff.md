# Codexへの引き継ぎ

**現在は第9工程の公開前統合版。次は工程10。** 以下の工程別記述は経緯として残す。現在の手順は本節と[第9工程資料](application/README.md)を優先し、依頼された範囲を越えない。

- 第9工程PR：[#8](https://github.com/yumotof01-dotcom/ECO-MIRROR/pull/8)。ブランチ：`feat/phase-9-interactive-application`。baseは`feat/phase-8-network-visualization`、継承先端05a732f。開始時にPR #1〜#7とCI成功を確認、未マージの継承を維持した。
- UI・Worker・出力の実装は実在コミットを先に保存し、検証・来歴は後続コミットに分ける。計算版は既存a55e7e2、数理仕様1.0.0・元データ・正規化・依存を変更していない。
- [状態遷移](application/state-transitions.md)、[実装/責務](application/README.md)、[出力と再現](application/exports.md)、[ブラウザ/数値検証](application/validation.md)、[性能](application/performance.md)を読む。
- 次は低メモリ端末/Safari実機、独立した数値照合、読み上げとキーボードの回帰を検証する。公開・既存PRマージは別途依頼がない限り行わない。

## 作業場所

- 既存リポジトリ：<https://github.com/yumotof01-dotcom/ECO-MIRROR>
- 基盤ブランチ：`feat/foundation-phase-1-2`
- 第3工程ブランチ：`docs/phase-3-data-assessment`。基盤コミット `6322b566c24a8d3396f499bc4e30382de7e88bd4` を継承。
- 第4工程ブランチ：`feat/phase-4-data-pipeline`。工程3コミット `5880e52c64d4f44ad95f727b782b1823018f3606` を継承。開始時はPR #1・#2ともopen・未マージのため、工程4PRのbaseは `docs/phase-3-data-assessment`。
- 第5工程ブランチ：`docs/phase-5-mathematical-specification`。工程4先端 `e07f7c0ea52a0b5241f97894a658740b6ab445dd` を継承。開始時にPR #1〜#3は全てopen・未マージを確認し、工程5PRのbaseは `feat/phase-4-data-pipeline`。次回も全PRの最新状態を確認する。
- 第6工程ブランチ：`feat/phase-6-single-trial-core`。PR #1〜#4がopen・未マージで、工程5先端 `3aea5c385cd99a7bb67ab0879c5eb6bab7cbc315` を継承。工程6PRのbaseは `docs/phase-5-mathematical-specification`。計算コードの検証済みリビジョンは `0823bc6a278c948cacffbfd2463783083e21fad5`、後続コミットに検証記録を保存。
- 新しいGitHubリポジトリは作成しない。mainへの直接変更・マージ・公開は行わない。
- 基盤PRが未マージなら、まずその差分とブランチを確認して引き継ぐ。mainしか取得しないと基盤コードが見えない。
- 工程3開始時のPR #1はopen・未マージ。第3工程PRは基盤ブランチをbaseにして工程3の差分を分ける。引き継ぎ時に両PRの最新状態を確認し、PR #1が後からmainへマージされた場合は履歴と差分を見て第3工程PRのbase変更を検討する。無断でマージしない。

## 今あるもの

React、TypeScript、Vite、Tailwind CSS、4画面と404、フォーム下書きの状態、初期値へのリセット、入力検証、科学的注意事項、DOMテスト、ビルド設定、CI、各種docs。

工程3ではCC-plant-pollinatorの指定実CSVの3,882行・7列、出典・方法、CC BY 4.0、大学保管v1とGitHub版の記録内容の同一性、欠損・重複・分類名・年/区画/回の件数を調査した。用途を英国の観測記録の教材に限定し、原分類ラベルを保持して採用する判断を記録した。

工程4では大学保管v1原本・取得情報・公式API応答を同梱し、固定ハッシュ検証、CSVパーサー、全3,882行の正規化、原ラベル辞書、監査値との照合、決定的JSON、実在する変換Gitコミットと入出力ハッシュ、型と実行時検証を備えた遅延ローダー、不正入力テストを用意した。

工程5では `docs/simulation/` にモデル・指標・乱数・反復・正確な結果契約・境界条件・手計算例と宣言的fixtureを確定した。既存アプリ、データ、取得/正規化コード、依存は変更していない。

工程6では独立した `src/features/simulation/core/` に条件選択、PCG32/棄却法、部分Fisher–Yates、原ラベルの固定基準ネットワーク、Fraction、正式な単一試行結果を実装した。`features/simulation/run.ts`は既存の全件ローダーを呼び、画面からは使われない。`scripts/simulation/`に実在Gitスナップショットの確認・来歴・固定再現検証・テストがある。9規範ファイル・工程4基盤・依存・既存UIは不変。

工程7で反復計算・サマリーを実装した。工程8で独立したグラフと開発者プレビューを実装した。工程9で通常アプリへの接続・実行状態・ユーザー出力を実装した。サーバー・公開設定は追加していない。旧段階の無効ボタンという仕様は更新済み。

## 第3工程の成果を読む

- [調査・採用判断](data/cc-plant-pollinator/README.md)
- [出典・版・ライセンス・ハッシュ](data/cc-plant-pollinator/manifest.json)
- [全件数と原分類ラベル](data/cc-plant-pollinator/profile.json)
- [取り込み・正規化設計](data/cc-plant-pollinator/normalization.md)
- [第3工程の検証記録](data/cc-plant-pollinator/validation.md)

## 第4工程の仕様と検証

[実装仕様](data/cc-plant-pollinator/implementation.md)、[検証記録](data/cc-plant-pollinator/phase4-validation.md)、[データの帰属・利用条件](../data/README.md) を読む。

```bash
npm ci
npm run data:check
npm test
npm run build
```

Node.js 24.12以上とGit完全履歴を使う。浅いcloneは `git fetch --unshallow`。原本は同梱済みで通常の検証に通信は不要。`data:fetch` は既存原本を検証し、取得日時を更新しない。固定版と異なる入力を採用しない。

変換コード・固定契約・依存・参照監査を変更する場合は、作業ブランチへ先にコードをコミットし、`npm run data:normalize` で実在するリビジョンを記録して生成物を次のコミットに保存する。未コミットの処理を来歴へ記載するために検査を迂回しない。原CSVは `.gitattributes` の `-text` を維持し、Git indexのバイト列も検証する。

後工程の入口は `src/features/data/index.ts` の `loadObservationData()`。全イベント・ID・null・監査値・辞書の対応と成果物ハッシュを実行時検証し、ネストを含めfreezeしたreadonlyデータを返す。現在は計算Workerから呼ぶ。Node専用のCSV/crypto/fs処理をブラウザへ持ち込まない。

## 工程5の数理仕様を読む

[仕様索引](simulation/README.md)、[モデル](simulation/model-specification.md)、[指標](simulation/metrics.md)、[乱数](simulation/randomness.md)、[反復](simulation/repetitions.md)、[結果契約](simulation/reproducibility.md)、[手計算](simulation/worked-examples.md)、[境界](simulation/edge-cases.md)、[科学的限界](simulation/scientific-limitations.md)、[検証記録](simulation/validation.md) を正本とする。JSON fixtureは合成された仕様確認用で、研究データや実行結果ではない。

## 工程6の実装と検証を読む

[実装仕様と関数境界](simulation/phase6-implementation.md)、[検証結果](simulation/phase6-validation.md)、[正式結果と別来歴の固定検証](simulation/phase6-verification/README.md)を読む。`npm run check`は186テスト、データ監査・型検査・ビルドに成功。公式PCG6語、10件fixtureの[1,3,4,5,6]/保持率200/3%、全実データ100%の3,882件・20/104原ラベル・257ペアが一致した。0%、empty_scope、不正入力、全321記録ありグループも照合済み。

`node scripts/simulation/verify.ts`は固定結果の全バイトと別来歴を照合する。実装入力を変えた場合はコードを先にコミットし、`--write-verification`で検証記録を再生成して文書と別コミットへ保存する。旧コミットに未コミットコードを偽装して通さない。既存の原データ来歴を上書きしない。

## 第7工程で実装した内容

1. `AGENTS.md`、README、全数理仕様、工程6の実装・検証、全PRの最新状態を確認する。工程6を全て継承した新しい作業ブランチと、この工程だけのPRを使用する。既存PRを無断でマージしない。
2. `simulateTrial`を再利用し、固定した同じD・p・k・基準ノードに対しt=0〜R−1、initseq=54+tで試行する。前試行の標本を次の母集団にしない。共有PRNG、重複試行の削除、層化抽出への変更をしない。
3. R=1〜1,000を厳密検査する。Rを増やしても既存prefixを維持し、処理順によらずt順で全試行を保存する。単一モードt=0と反復モードR=1の契約を分ける。
4. 定義済みの7スカラーをBigInt/Fractionで集計。平均、標本分散、SqrtFractionのSD、min/max、type 7分位点（1/40,1/2,39/40）を実装する。表示用近似を計算・保存へ戻さない。
5. R=1の分散/SDはnullとinsufficient_trials、有効な0は含め、途中失敗やnullを除いた「成功した反復」を作らない。N=0は試行せずempty_scope。
6. `conformance-fixtures.json`の統計式専用fixture、R変更時prefix、t別再現、順序、R=1/全同値/0、負例をテストする。統計fixtureの手指定3標本をPCGのt=0,1,2の結果と呼ばない。
7. 正規結果契約の反復モードと全試行・集計・理由、来歴を整合させる。実装を先にコミットし、検証結果・文書を次に保存する。工程6の固定再現テストも維持し、変更後の実装識別子を正しく記録する。
8. `npm run data:check`、`npm test`、`npm run build`、`npm run check`を実行し、日本語で結果と引き継ぎを報告する。**画面接続・可視化・ユーザー出力・AI・公開へ進まない**。

反復の分布は固定した有限記録と抽出モデルに条件付けられる。自然界の完全な不確実性や、生態系の95%信頼区間ではない。日時、実績努力量、15組の実施状態、分類名、48区画年の独立性を推測で補わない。

## 次のCodexに渡す依頼文

> 既存yumotof01-dotcom/ECO-MIRRORの第10工程を始める前に、最新の全PR/継承/CI、AGENTS.md、工程9の実装・状態・出力・性能・検証記録と既存数理仕様を読んでください。工程9先端を引き継いだ作業ブランチを作成し、数理・科学・データ・性能の独立検証と必要最小限の修正を進めてください。実際のSafari/iPad・低メモリ・読み上げは未検証なので検証済みと扱わないでください。元データ/数理仕様/PRNG/全試行保存を保持し、mainへの直接push・無断マージ・公開は行わないでください。

## 第9工程の回帰確認

`npm run check`を実行する。既存の公式PCG/手計算/実CSV監査に加え、Worker結果の元番号・全summary・正規JSON/CSV・旧要求/取消/URL寿命・条件の取り違えを確認する。ブラウザE2Eは`scripts/application/e2e.mjs`で、別途Playwright/Chromiumと任意のaxe-coreが必要。依存追加で過去の正規化来歴を無効化しない。実在するアプリ実装コミットと実バイトが一致した状態で正式出力の検証を行う。

ページ再読み込みはメモリ内条件・結果を失う。保存ファイルの取り込みは未実装であり、インポートされた未検証データを成功扱いする入口はない。同条件の再実行はメモリ内の実行時条件からできる。出力の再現手順は別来歴に記録する。

## 完了した第8工程への継承

第7工程ブランチは`feat/phase-7-repeated-simulation`、baseは`feat/phase-6-single-trial-core`。計算版はa55e7e2a86d2c9ac58de23fdbb2a0ae673ddb0b1。[実装](simulation/phase7-implementation.md)・[検証](simulation/phase7-validation.md)・[計算済み全結果](simulation/phase7-verification/README.md)を読む。第7工程PR・テスト・CIが正常に完了したため、そのコードを継承した別ブランチ・別PRで、既にユーザーが依頼した第8工程を実装した。依頼済み仕様に従い、追加承認を待たずに再開した。

第8工程は計算済みRunResultと実在するtrial_indexを受け取る独立した可視化層。左右で同じ基準ノードと座標を使い、元ラベルと全基準ペアを維持する。未確認リンクは消滅と呼ばず、詳細・凡例・検索/フォーカス・キーボード・狭い画面を検証する。開発者用プレビューだけを用意し、本番フローの実行/状態/結果接続と出力UIは工程9に残す。

第7工程は[PR #6](https://github.com/yumotof01-dotcom/ECO-MIRROR/pull/6)、先端85c83737de6bc657bda877d176268bc43448a565、218テストとCI成功。第8工程はその先端から`feat/phase-8-network-visualization`を作り、同ブランチだけの差分をPRで提案する。

[可視化設計](visualization/README.md)と[検証結果](visualization/validation.md)を読む。`NetworkComparison`は既存RunResultとtrialIndex/onTrialChangeを受け取る。基準ノード位置を共有し、抽出後の未確認リンクも保持する。`/dev/network.html`は開発者用。工程9ではこのコンポーネントを再実装せず、成功した計算結果を渡す状態管理と正式出力を接続した。後工程もエラーを隠す目的で成功へ切り替えない。

## 第10・11工程の追加記録

独立監査は docs/verification/、画面検査・改善と実機手順は docs/usability/。計算版・原本・規範仕様は変更なし。未検証のSafari/iPad・読み上げ・低メモリをPASSにしない。第12工程は本番成果物と来歴、科学・ライセンス・セキュリティ、公開手順を整え、公開・既存PRマージは承認まで行わない。
