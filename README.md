# ECO-MIRROR

**観測を、問い直す。** 植物と昆虫の公開訪花データを使い、観測条件によって見える関係がどのように変わるかを確かめるWebシミュレーターです。

観測不足によって、生態系の状態を誤って判断するリスクを減らすことを目指します。生成AIによる予測は行わず、実データと再現可能な数理計算を使う方針です。

## 現在の範囲：画面・データ基盤と第7工程の反復・統計コア

大学保管の実CSVを取得・ハッシュ検証し、全3,882行の正規化・品質監査・型安全な読み込みを用意しました。工程5の [数理仕様](docs/simulation/README.md) に従い、工程6の単一コアに続き、工程7で1〜1,000試行・試行別PCG32系列・全試行保存・正確な平均/標本分散/SD/type 7分位点を実装しました。[実装説明](docs/simulation/phase6-implementation.md) と [検証記録](docs/simulation/phase6-validation.md) を参照してください。

計算コアと実データは画面へ未接続です。反復計算は画面から独立したコアのみです。グラフ・結果表示・ユーザー向け出力はまだありません。既存の実行/書き出しボタンは無効、分析画面は未実行のままです。

工程3では指定のCC-plant-pollinator実CSVを調査し、3,882行・7列、大学保管v1のCC BY 4.0、GitHub版との改行以外の一致を確認しました。英国の実験記録を使う観測条件の教材として、原分類ラベルを保持して採用します。調査結果は [データ調査報告](docs/data/cc-plant-pollinator/README.md) にあります。工程4では原CSVのバイト列を保持し、CC BY 4.0の帰属・変更表示を付けて同梱しました。[データ処理の実装仕様](docs/data/cc-plant-pollinator/implementation.md) と [検証記録](docs/data/cc-plant-pollinator/phase4-validation.md) を参照してください。

| 画面             | URL           | 現在できること                                 |
| ---------------- | ------------- | ---------------------------------------------- |
| ホーム           | `/`           | プロジェクトの目的・方針・実装範囲を読む       |
| シミュレーション | `/simulation` | 観測条件の下書き、入力確認、初期値へのリセット |
| 分析結果         | `/results`    | 未実行・データ未接続の状態を確認する           |
| 研究情報         | `/research`   | 科学的な注意事項、背景資料、データ候補を読む   |

条件の下書きはアプリ内の画面移動で保持されます。再読み込みやタブを閉じると失われます。データ選択・実行・書き出しは無効です。ホームの植物と昆虫の図は**説明用イラスト**で、観測データではありません。

## 起動方法

Node.js 24.12以上とnpmを使用します（`.nvmrc` を用意）。この変更がmainにマージされる前は、次のブランチを取得してください。新しいGitHubリポジトリの作成は不要です。

```bash
git clone --branch feat/phase-7-repeated-simulation https://github.com/yumotof01-dotcom/ECO-MIRROR.git
cd ECO-MIRROR
npm ci
npm run dev
```

ターミナルに表示されるURLを開きます。通常は `http://localhost:5173/` です。環境変数、APIキー、外部サービスの接続は不要です。

すでにローカルにリポジトリがある場合は、未コミットの変更を確認したうえで次のコマンドを使います。

```bash
git fetch origin
git switch feat/phase-7-repeated-simulation
npm ci
npm run dev
```

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
  features/data/        型・実行時検証・型安全な遅延読み込み（画面未接続）
  features/simulation/  UI下書きと、独立したcore/・ハッシュ境界・画面未接続の実行入口
  pages/                4画面と404画面
  styles/               Tailwindとデザイントークン、レスポンシブCSS
  test/                 テストの共通設定
scripts/data/           原本取得・CSV解析・正規化・品質監査・CLIテスト
scripts/simulation/     実行コンテキスト・固定再現検証・単一試行のテスト
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
- [Codexへの引き継ぎ](docs/codex-handoff.md)
- [検証記録](docs/validation.md)
- [開発時の作業ルール](AGENTS.md)

次は**工程8：実データの関係可視化**です。計算済みRunResultの既存試行を受け取り、固定した基準ノード位置で左右比較します。計算を描画側で実行し直さず、画面の正式な実行・状態管理・出力接続は工程9に残します。

第5工程ブランチ `docs/phase-5-mathematical-specification` はPR #3の先端 `e07f7c0ea52a0b5241f97894a658740b6ab445dd` を継承しています。開始時はPR #1〜#3がすべて未マージのため、第5工程PRのbaseは `feat/phase-4-data-pipeline` です。既存PRを無断でmainへマージせず、引き継ぎ時に最新状態を確認してください。

第6工程はPR #1〜#4が未マージであることを確認し、工程5先端 `3aea5c385cd99a7bb67ab0879c5eb6bab7cbc315` を継承しました。作業ブランチは `feat/phase-6-single-trial-core`、PRのbaseは `docs/phase-5-mathematical-specification` です。

第7工程は `feat/phase-7-repeated-simulation`、baseは `feat/phase-6-single-trial-core`。開始時にPR #1〜#5は全て未マージで、第6工程先端d349f3dを継承しました。
