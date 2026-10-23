# ECO-MIRROR

**観測を、問い直す。** 植物と昆虫の公開訪花データを使い、観測条件によって見える関係がどのように変わるかを確かめるWebシミュレーターです。

観測不足によって、生態系の状態を誤って判断するリスクを減らすことを目指します。生成AIによる予測は行わず、実データと再現可能な数理計算を使う方針です。

## 現在の範囲：画面基盤と第4工程のデータ処理基盤

大学保管の実CSVを取得・ハッシュ検証し、全3,882行の正規化・品質監査・型安全な読み込みを用意しました。実データは画面へ未接続です。サンプリング、乱数生成、指標計算、結果生成は実装していません。分析結果を装った数値やグラフもありません。

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
git clone --branch feat/phase-4-data-pipeline https://github.com/yumotof01-dotcom/ECO-MIRROR.git
cd ECO-MIRROR
npm ci
npm run dev
```

ターミナルに表示されるURLを開きます。通常は `http://localhost:5173/` です。環境変数、APIキー、外部サービスの接続は不要です。

すでにローカルにリポジトリがある場合は、未コミットの変更を確認したうえで次のコマンドを使います。

```bash
git fetch origin
git switch feat/phase-4-data-pipeline
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
  features/simulation/  条件の下書きと入力検証（計算処理なし）
  pages/                4画面と404画面
  styles/               Tailwindとデザイントークン、レスポンシブCSS
  test/                 テストの共通設定
scripts/data/           原本取得・CSV解析・正規化・品質監査・CLIテスト
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
- [Codexへの引き継ぎ](docs/codex-handoff.md)
- [検証記録](docs/validation.md)
- [開発時の作業ルール](AGENTS.md)

次は**工程5：観測モデルと指標の数学的定義**です。全観測記録を比較基準に、選択範囲・抽出単位・割合と丸め・0と欠測・指標の式と分母・PRNGと反復仕様を定義します。重複行の一律削除、分類名の推測修正、記録のない調査単位への0補完をしないでください。数理仕様は工程5、計算実装は工程6以降です。

第4工程ブランチは第3工程PR #2の先端を継承しています。作業開始時はPR #1・#2とも未マージのため、第4工程PRのbaseは `docs/phase-3-data-assessment` です。既存PRを無断でmainへマージせず、引き継ぎ時に最新状態を確認してください。
