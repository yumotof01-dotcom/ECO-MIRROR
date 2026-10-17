# Codexへの引き継ぎ

## 作業場所

- 既存リポジトリ：<https://github.com/yumotof01-dotcom/ECO-MIRROR>
- 基盤ブランチ：`feat/foundation-phase-1-2`
- 第3工程ブランチ：`docs/phase-3-data-assessment`。基盤コミット `6322b566c24a8d3396f499bc4e30382de7e88bd4` を継承。
- 第4工程ブランチ：`feat/phase-4-data-pipeline`。工程3コミット `5880e52c64d4f44ad95f727b782b1823018f3606` を継承。開始時はPR #1・#2ともopen・未マージのため、工程4PRのbaseは `docs/phase-3-data-assessment`。
- 第5工程ブランチ：`docs/phase-5-mathematical-specification`。工程4先端 `e07f7c0ea52a0b5241f97894a658740b6ab445dd` を継承。開始時にPR #1〜#3は全てopen・未マージを確認し、工程5PRのbaseは `feat/phase-4-data-pipeline`。次回も全PRの最新状態を確認する。
- 新しいGitHubリポジトリは作成しない。mainへの直接変更・マージ・公開は行わない。
- 基盤PRが未マージなら、まずその差分とブランチを確認して引き継ぐ。mainしか取得しないと基盤コードが見えない。
- 工程3開始時のPR #1はopen・未マージ。第3工程PRは基盤ブランチをbaseにして工程3の差分を分ける。引き継ぎ時に両PRの最新状態を確認し、PR #1が後からmainへマージされた場合は履歴と差分を見て第3工程PRのbase変更を検討する。無断でマージしない。

## 今あるもの

React、TypeScript、Vite、Tailwind CSS、4画面と404、フォーム下書きの状態、初期値へのリセット、入力検証、科学的注意事項、DOMテスト、ビルド設定、CI、各種docs。

工程3ではCC-plant-pollinatorの指定実CSVの3,882行・7列、出典・方法、CC BY 4.0、大学保管v1とGitHub版の記録内容の同一性、欠損・重複・分類名・年/区画/回の件数を調査した。用途を英国の観測記録の教材に限定し、原分類ラベルを保持して採用する判断を記録した。

工程4では大学保管v1原本・取得情報・公式API応答を同梱し、固定ハッシュ検証、CSVパーサー、全3,882行の正規化、原ラベル辞書、監査値との照合、決定的JSON、実在する変換Gitコミットと入出力ハッシュ、型と実行時検証を備えた遅延ローダー、不正入力テストを用意した。

工程5では `docs/simulation/` にモデル・指標・乱数・反復・正確な結果契約・境界条件・手計算例と宣言的fixtureを確定した。既存アプリ、データ、取得/正規化コード、依存は変更していない。

画面への接続、PRNG、サンプリング、分析エンジン、実行状態、結果データ、グラフ、書き出し、サーバー、公開設定はまだない。実行・書き出しの無効状態は意図的であり、単にボタンを有効にして解消するバグではない。

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

後工程の入口は `src/features/data/index.ts` の `loadObservationData()`。全イベント・ID・null・監査値・辞書の対応と成果物ハッシュを実行時検証し、ネストを含めfreezeしたreadonlyデータを返す。現段階では画面から呼ばない。Node専用のCSV/crypto/fs処理をブラウザへ持ち込まない。

## 工程5の数理仕様を読む

[仕様索引](simulation/README.md)、[モデル](simulation/model-specification.md)、[指標](simulation/metrics.md)、[乱数](simulation/randomness.md)、[反復](simulation/repetitions.md)、[結果契約](simulation/reproducibility.md)、[手計算](simulation/worked-examples.md)、[境界](simulation/edge-cases.md)、[科学的限界](simulation/scientific-limitations.md)、[検証記録](simulation/validation.md) を正本とする。JSON fixtureは合成された仕様確認用で、研究データや実行結果ではない。

## 次に行うこと：工程6「単一試行の再現可能な計算コア」

1. `AGENTS.md`、README、上記仕様、全既存PR、現在のGit状態を確認する。工程5を全て継承した新しい作業ブランチを使い、この工程だけのPRを作る。無断でmainへマージしない。
2. 既存UIの `features/simulation/model.ts` は下書き専用なので尊重し、別の `core/` 等へ純粋な計算層を置く。全ファイル用の `src/features/data/` と元/正規化データを変更せず、検証済み全データから原順を保って選択する。
3. 年・Plot・Treatment・年別RoundのAND条件と選択の正規順、入力エラーとempty_scopeを実装する。元データをソートして修復しない。
4. 整数p=0〜100、`k=floor((N*p+50)/100)`、k=0/全件の乱数消費0、原IDの追跡を実装する。
5. PCG-XSH-RR 64/32をBigIntで正確に実装し、初期化・棄却法・前方部分Fisher–Yates・シード組(s,54+t)を固定する。公式6語、初期状態、手計算の標本[1,3,4,5,6]、消費数を完全一致でテストする。
6. 原ラベルの重み・相手数・記録/ラベル/ペア数・Lost・保持率・固定Connectanceを実装する。固定分母、0/null、同値行、原IDの相違を守る。
7. Fraction、正規結果本体、版・ハッシュと実在コードリビジョンの記録を実装する。表示用小数・実行時刻・取得時刻は正規の数値本体へ混ぜない。
8. 手指定fixture、境界・負例、入力不変性、実データ100%の監査一致、seed再現をテストする。`npm run check` と追加コアテストを実行し、変更と未実施事項を日本語で報告する。
9. **反復ループ・サマリーは工程7、ネットワーク描画・結果画面接続は工程8・9**。工程6では単一試行まで。UI実行を有効化せず、AI補完・バックエンド・公開へ進まない。

反復仕様は確定済みだが、工程6でR回ループを作る要求ではない。単一コアがtを受け取るのは将来の反復・個別再現の準備。全記録プールでkを一度だけ決め、年ごとに丸めた件数を合計する層化モデルへ変えない。

## 次のCodexに渡す依頼文

> 既存の yumotof01-dotcom/ECO-MIRROR で第6工程「単一試行の再現可能な計算コア」のみを実装してください。新しいリポジトリを作らず、AGENTS.md、README、docs/simulation/の確定仕様、PR #1〜#3と工程5PRの最新状態を確認し、工程5を継承した作業ブランチからPRで提案してください。第4工程のコードとデータを尊重し、条件選択、半数切上げ、PCG-XSH-RR 64/32と棄却法、前方部分Fisher–Yates、原ラベルの指標、Fractionと正規結果・来歴を純粋関数として実装してください。合成fixtureの公式6語・初期状態・標本[1,3,4,5,6]、0%/100%/空範囲、元行追跡、同値行保持、負例と実データ監査一致を検証してください。48区画年の独立性、努力量、日付、分類名を推測せず、訪花から受粉成功や英国から日本の草原の状態を断定しないでください。反復・描画・画面接続・AI予測・公開は実装せず、npm run checkと追加テスト、ファイル、ブランチとPR、次工程を日本語で報告してください。

## 画面を変更する後工程での確認

4画面、条件下書きの保持、リセット、不正な整数入力、未実行表示、404からの復帰を確認する。将来実データと計算を接続するときは、現在の常に未実行のテストを状態遷移と来歴のテストへ更新する。未実行と有効なゼロ結果を区別する原則は維持する。
