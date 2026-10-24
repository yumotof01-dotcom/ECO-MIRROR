# Observation Interface V2（現行UI）

作業場所：`/workspace/ECO-MIRROR-observation-v2`。Node.js >=24.12、完全なGit履歴を使用します。

```sh
npm ci
npm run data:check
npm test
npm run build
npm run dev -- --host 127.0.0.1
```

観測 `/`、詳細条件 `/simulation`、比較 `/results`、現在実行の記録 `/results?mode=records`、研究情報 `/research`。起動時のネットワーク・指標は未実行です。水滴ボタンで実データの計算を開始します。正式保存にはアプリを実在コミットへ保存して再起動/再計算する必要があります。

[Observation Interface V2の設計](docs/design/observation-interface-v2.md)、[操作](docs/design/interaction-specification.md)、[検証報告](docs/design/implementation-report.md)を参照。以下の工程別READMEは履歴として保持しています。

# ECO-MIRROR

**観測を、問い直す。** 植物と昆虫の公開訪花データを使い、観測条件によって見える関係がどのように変わるかを確かめるWebシミュレーターです。

観測不足によって、生態系の状態を誤って判断するリスクを減らすことを目指します。生成AIによる予測は行わず、実データと再現可能な数理計算を使う方針です。

## 現在の範囲：第9工程の公開前機能統合版

大学保管の実CSVを取得・ハッシュ検証し、全3,882行の正規化・品質監査・型安全な読み込みを用意しました。工程5の [数理仕様](docs/simulation/README.md) に従い、工程6の単一コアに続き、工程7で1〜1,000試行・試行別PCG32系列・全試行保存・正確な平均/標本分散/SD/type 7分位点を実装しました。[反復の実装説明](docs/simulation/phase7-implementation.md) と [検証記録](docs/simulation/phase7-validation.md) を参照してください。

工程8のReact/SVG比較図を、工程9で実データ・既存計算コアへ正式接続しました。条件入力→単一/反復実行→指標・ネットワーク・統計→正式JSON/別来歴/CSVの保存を操作できます。計算と全試行の保持・出力はWeb Workerで行い、画面へはサマリーと現在の1試行だけを渡します。初期条件は全範囲・50%・seed 42・反復100回です。[第9工程の実装・利用手順](docs/application/README.md)を参照してください。公開・デプロイは行っていません。

工程3では指定のCC-plant-pollinator実CSVを調査し、3,882行・7列、大学保管v1のCC BY 4.0、GitHub版との改行以外の一致を確認しました。英国の実験記録を使う観測条件の教材として、原分類ラベルを保持して採用します。調査結果は [データ調査報告](docs/data/cc-plant-pollinator/README.md) にあります。工程4では原CSVのバイト列を保持し、CC BY 4.0の帰属・変更表示を付けて同梱しました。[データ処理の実装仕様](docs/data/cc-plant-pollinator/implementation.md) と [検証記録](docs/data/cc-plant-pollinator/phase4-validation.md) を参照してください。

| 画面             | URL           | 現在できること                                 |
| ---------------- | ------------- | ---------------------------------------------- |
| ホーム           | `/`           | プロジェクトの目的・方針・実装範囲を読む       |
| シミュレーション | `/simulation` | 年・区画・処理・年別Round、0〜100%、シード、実行モードの設定・実行・取消 |
| 分析結果         | `/results`    | 実計算の指標・試行別ネットワーク・反復統計・保存           |
| 研究情報         | `/research`   | 採用データの出典・CC BY 4.0・加工内容・科学的限界を読む   |

条件と実行結果は画面移動で保持されます。再読み込みやタブを閉じると失われるため、必要な結果は先に保存してください。結果は実行時点の条件に対応し、入力を変更すると旧条件であることを表示します。処理中の条件変更は処理を中止します。ホームの植物と昆虫の図は**説明用イラスト**で、観測データではありません。

## 起動方法

Node.js 24.12以上とnpmを使用します（`.nvmrc` を用意）。この変更がmainにマージされる前は、次のブランチを取得してください。新しいGitHubリポジトリの作成は不要です。

```bash
git clone --branch feat/phase-9-interactive-application https://github.com/yumotof01-dotcom/ECO-MIRROR.git
cd ECO-MIRROR
npm ci
npm run dev
```

ターミナルに表示されるURLを開きます。通常は `http://localhost:5173/` です。環境変数、APIキー、外部サービスの接続は不要です。Git完全履歴が必要です。ビルド/開発起動時に、同梱データ・9規範仕様・計算コードとアプリコードの実在コミット/実バイトを照合します。未コミットのアプリ変更は開発用として計算できますが正式保存は無効です。計算来歴そのものが不一致なら実行を拒否します。実装を先にコミットして再起動/再ビルドしてください。Gitを含まないソース配布だけでは検証済みビルドを生成できません。

すでにローカルにリポジトリがある場合は、未コミットの変更を確認したうえで次のコマンドを使います。

```bash
git fetch origin
git switch feat/phase-9-interactive-application
npm ci
npm run dev
```

## 開発者用ネットワークプレビュー

`npm run dev -- --host 127.0.0.1`で起動し、`http://127.0.0.1:5173/dev/network.html`を開きます。工程7の実データで計算済みの50%・100%・0%・empty_scopeを比較できます。ここで再計算は行わず、通常の本番ビルドにはこの独立ページを含めません。操作・凡例・検証は[可視化資料](docs/visualization/README.md)を参照してください。

## 確認コマンド

```bash
npm run typecheck  # TypeScriptの型チェック
npm test           # 実データ・不正入力・読み込み・既存画面のテスト
npm run build     # 型チェックと本番ビルド。出力先はdist/
npm run data:fetch # 原本があれば検証のみ。取得する場合も版とハッシュを固定
npm run data:check # 保存済みデータ・来歴・Git内原本をオフライン検証
npm run check     # データ検証・テスト・本番ビルドをまとめて実行
node scripts/simulation/verify.ts # 保存済み単一試行の全バイト・来歴を照合（UI・通信なし）
node scripts/simulation/verify-repeated.ts # 実データの反復結果・別来歴を照合
npm run preview   # ビルド済み成果物をローカル表示
```

変換を変更した場合は、コードを先に作業ブランチへコミットし、`npm run data:normalize` で来歴付き成果物を生成して別コミットに保存します。通常の確認では再取得・再生成は不要です。浅いcloneの場合、来歴検証のため `git fetch --unshallow` を実行してください。

GitHub Actionsも、Pull Requestとmainへのpushで `npm ci` と `npm run check` を実行する構成です。ブラウザでの見た目・実機操作の確認はDOMテストとは別に行ってください。

## 技術・構成

React / TypeScript / Vite / Tailwind CSS、React Router、Vitest / Testing Library / jsdomを使用します。依存バージョンは `package.json` と `package-lock.json` で固定しています。

```text
src/
  app/                  ルート、画面遷移、統合テスト
  components/           共通レイアウト・見出し・SVGイラスト
  content/              研究上の注意事項・参照先
  features/data/        型・実行時検証・型安全な遅延読み込み（Workerから使用）
  features/simulation/  入力下書きと、独立したcore/・ハッシュ境界・既存実行入口
  features/execution/   Worker、状態管理、厳密結果検証、表示・統計・出力
  features/visualization/ 計算済み結果のアダプター、固定配置、左右SVG、詳細と操作
  dev/                  実データ計算済み結果だけを使う独立プレビュー
  pages/                4画面と404画面
  styles/               Tailwindとデザイントークン、レスポンシブCSS
  test/                 テストの共通設定
scripts/data/           原本取得・CSV解析・正規化・品質監査・CLIテスト
scripts/simulation/     実行コンテキスト・固定再現検証・計算のテスト
scripts/browser/        ビルド/開発時の実在Git・データ・仕様・アプリの照合
scripts/application/    実ブラウザ統合検証（別途Playwright/ブラウザが必要）
data/raw/               大学保管v1の原CSV・取得情報・ライセンス証拠
data/processed/         決定的なイベント・原ラベル辞書・品質監査・来歴
docs/                   仕様・設計・ロードマップ・科学的注意事項
```

BrowserRouterを使用します。将来ホスティングする場合は、`/simulation` などの直接アクセスを `index.html` にフォールバックさせるSPA設定が必要です。GitHub Pagesへの配置やその他の公開設定は今回の範囲に含みません。

## 開発文書とCodexへの引き継ぎ

- [仕様書](docs/specification.md)
- [アーキテクチャ](docs/architecture.md)
- [12工程のロードマップ](docs/roadmap.md)
- [科学的な注意事項](docs/scientific-notes.md)
- [データ選定・出典管理の方針](docs/data-policy.md)
- [第3工程のデータ調査・採用判断](docs/data/cc-plant-pollinator/README.md)
- [年・区画・調査回別の記録数](docs/data/cc-plant-pollinator/counts.md)
- [取り込み・正規化の設計](docs/data/cc-plant-pollinator/normalization.md)
- [第5工程の数理仕様](docs/simulation/README.md)
- [第5工程の手計算例](docs/simulation/worked-examples.md)
- [第5工程の検証記録](docs/simulation/validation.md)
- [第6工程の実装と再現手順](docs/simulation/phase6-implementation.md)
- [第6工程の検証記録](docs/simulation/phase6-validation.md)
- [第7工程の実装・統計と再現手順](docs/simulation/phase7-implementation.md)
- [第7工程の検証記録](docs/simulation/phase7-validation.md)
- [第8工程の可視化設計](docs/visualization/README.md)
- [第8工程の検証記録](docs/visualization/validation.md)
- [第9工程の操作・構成・出力](docs/application/README.md)
- [第9工程の検証と制約](docs/application/validation.md)
- [第9工程の性能測定](docs/application/performance.md)
- [Codexへの引き継ぎ](docs/codex-handoff.md)
- [検証記録](docs/validation.md)
- [開発時の作業ルール](AGENTS.md)

工程10〜12の監査・操作性改善・公開準備を作業ブランチで整備しました。[最終判定と残る確認](docs/release/final-readiness-report.md)を参照してください。mainへの統合・一般公開は未実施です。

第5工程ブランチ `docs/phase-5-mathematical-specification` はPR #3の先端 `e07f7c0ea52a0b5241f97894a658740b6ab445dd` を継承しています。開始時はPR #1〜#3がすべて未マージのため、第5工程PRのbaseは `feat/phase-4-data-pipeline` です。既存PRを無断でmainへマージせず、引き継ぎ時に最新状態を確認してください。

第6工程はPR #1〜#4が未マージであることを確認し、工程5先端 `3aea5c385cd99a7bb67ab0879c5eb6bab7cbc315` を継承しました。作業ブランチは `feat/phase-6-single-trial-core`、PRのbaseは `docs/phase-5-mathematical-specification` です。

第7工程は `feat/phase-7-repeated-simulation`、baseは `feat/phase-6-single-trial-core`。開始時にPR #1〜#5は全て未マージで、第6工程先端d349f3dを継承しました。

第8工程は`feat/phase-8-network-visualization`、baseは`feat/phase-7-repeated-simulation`。工程7のPR #6とCI成功を確認し、先端85c8373を継承しました。

第9工程は[PR #8](https://github.com/yumotof01-dotcom/ECO-MIRROR/pull/8)、ブランチ`feat/phase-9-interactive-application`、baseは`feat/phase-8-network-visualization`。開始時にPR #1〜#7が未マージ、工程8先端05a732fとCI成功を確認して継承しました。既存PRのマージ・mainへの直接pushは行いません。

## 最終監査と公開準備

[数理監査](docs/verification/README.md)、[操作性と実機手順](docs/usability/README.md)、[公開準備](docs/release/README.md)、[PR統合計画](docs/release/integration.md)。完全Git履歴とclean treeで `node scripts/release/build.mjs` を実行すると、配信せずdistと `.release/build-manifest.json` を生成・検証します。
