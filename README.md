# ECO-MIRROR

**観測を、問い直す。** 植物と昆虫の公開訪花データを使い、観測条件によって見える関係がどのように変わるかを確かめるWebシミュレーターです。

観測不足によって、生態系の状態を誤って判断するリスクを減らすことを目指します。生成AIによる予測は行わず、実データと再現可能な数理計算を使う方針です。

## 現在の範囲：工程1・2

この版は**開発基盤**です。公開データの取得・接続、サンプリング、乱数生成、指標計算、結果生成は実装していません。分析結果を装った数値やグラフもありません。

| 画面             | URL           | 現在できること                                 |
| ---------------- | ------------- | ---------------------------------------------- |
| ホーム           | `/`           | プロジェクトの目的・方針・実装範囲を読む       |
| シミュレーション | `/simulation` | 観測条件の下書き、入力確認、初期値へのリセット |
| 分析結果         | `/results`    | 未実行・データ未接続の状態を確認する           |
| 研究情報         | `/research`   | 科学的な注意事項、背景資料、データ候補を読む   |

条件の下書きはアプリ内の画面移動で保持されます。再読み込みやタブを閉じると失われます。データ選択・実行・書き出しは無効です。ホームの植物と昆虫の図は**説明用イラスト**で、観測データではありません。

## 起動方法

Node.js 24系とnpmを推奨します（`.nvmrc` を用意）。この変更がmainにマージされる前は、次のブランチを取得してください。新しいGitHubリポジトリの作成は不要です。

```bash
git clone --branch feat/foundation-phase-1-2 https://github.com/yumotof01-dotcom/ECO-MIRROR.git
cd ECO-MIRROR
npm ci
npm run dev
```

ターミナルに表示されるURLを開きます。通常は `http://localhost:5173/` です。環境変数、APIキー、外部サービスの接続は不要です。

すでにローカルにリポジトリがある場合は、未コミットの変更を確認したうえで次のコマンドを使います。

```bash
git fetch origin
git switch feat/foundation-phase-1-2
npm ci
npm run dev
```

## 確認コマンド

```bash
npm run typecheck  # TypeScriptの型チェック
npm test           # 画面遷移・入力・未実行状態などのDOMテスト
npm run build     # 型チェックと本番ビルド。出力先はdist/
npm run check     # テストと本番ビルドをまとめて実行
npm run preview   # ビルド済み成果物をローカル表示
```

GitHub Actionsも、Pull Requestとmainへのpushで `npm ci` と `npm run check` を実行する構成です。ブラウザでの見た目・実機操作の確認はDOMテストとは別に行ってください。

## 技術・構成

React / TypeScript / Vite / Tailwind CSS、React Router、Vitest / Testing Library / jsdomを使用します。依存バージョンは `package.json` と `package-lock.json` で固定しています。

```text
src/
  app/                  ルート、画面遷移、統合テスト
  components/           共通レイアウト・見出し・SVGイラスト
  content/              研究上の注意事項・参照先
  features/simulation/  条件の下書きと入力検証（計算処理なし）
  pages/                4画面と404画面
  styles/               Tailwindとデザイントークン、レスポンシブCSS
  test/                 テストの共通設定
docs/                   仕様・設計・ロードマップ・科学的注意事項
```

BrowserRouterを使用します。将来ホスティングする場合は、`/simulation` などの直接アクセスを `index.html` にフォールバックさせるSPA設定が必要です。GitHub Pagesへの配置やその他の公開設定は今回の範囲に含みません。

## 開発文書とCodexへの引き継ぎ

- [仕様書](docs/specification.md)
- [アーキテクチャ](docs/architecture.md)
- [12工程のロードマップ](docs/roadmap.md)
- [科学的な注意事項](docs/scientific-notes.md)
- [データ選定・出典管理の方針](docs/data-policy.md)
- [Codexへの引き継ぎ](docs/codex-handoff.md)
- [検証記録](docs/validation.md)
- [開発時の作業ルール](AGENTS.md)

次は**工程3：公開データの調査・選定**です。まずデータの出典、利用条件、対象分類群、記録単位、欠測の扱いを確認し、採用理由を文書化します。計算実装へ先に進まないでください。
