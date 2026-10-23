# アーキテクチャ

## 現在の構成

ViteでビルドするReact SPA。TypeScriptのstrict設定、Tailwind CSSのViteプラグイン、React RouterのBrowserRouterを採用する。サーバー・DB・外部APIを持たず、工程9でWorkerを介して実データ・既存計算・結果・比較図・保存を統合する。

| ファイル・ディレクトリ                               | 責務                                                    |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `src/main.tsx`                                       | Reactルート、BrowserRouter、CSS読込                     |
| `src/app/App.tsx`                                    | ルーティング、タイトル更新、遷移時の本文フォーカス      |
| `src/app/navigation.ts`                              | ナビゲーションのパス・表示名                            |
| `src/components/`                                    | 共通レイアウト、見出し、アイコン、説明図                |
| `src/pages/`                                         | ホーム、シミュレーション、分析結果、研究情報、404       |
| `src/content/research.ts`                            | 科学的注意事項と参照資料。観測データを含まない          |
| `src/features/simulation/model.ts`                   | UI下書きの型、初期値、整数入力の検証                    |
| `src/features/simulation/SimulationDraftContext.tsx` | 下書きのメモリ内保持、更新、リセット                    |
| `src/styles/index.css`                               | Tailwind読込、色・フォント、画面別CSS、レスポンシブ対応 |
| `src/app/App.test.tsx`                               | 利用者の画面遷移と入力、結果の未実行状態を検証          |
| `src/test/setup.ts`                                  | DOMテストの共通設定                                     |

## 状態の流れ

`SimulationDraftProvider` はRoutesの外に配置する。条件画面から他の画面へ移動してもProviderを保持し、下書きを失わない。再読み込みするとProviderが作り直され、初期値へ戻る。localStorage、Cookie、サーバーには保存しない。

下書きは観測割合をnumber、反復回数・シードをstringとして持つ。後者は空欄などの編集途中の入力を維持し、不正な入力を勝手に0へ変換しないため。整数判定はフォーム入力の検証であり、生態学的な計算ではない。

Routes外の`ExecutionProvider`が小さい`ExecutionClient`状態を購読し、下書きと実行時点の正規条件を分ける。未実行・読み込み・計算・成功・空スコープ・失敗・取消を明示する。計算コアは`features/simulation/core/`のまま、ページから直接呼ばずWorkerに要求する。全結果はWorkerに保持し、ページ移動後も生存する。再読み込みでWorkerと結果は失われる。

## 後工程の分離方針

データスキーマは工程3の実物調査を基に工程4で実装した。`scripts/data/` はNode用の取得・CSV解析・監査・正規化、`src/features/data/` はブラウザ用の型・実行時検証・遅延ローダー、`data/` は原本と派生データを保持する。工程9ではWorkerから既存ローダーを利用する。全件監査後の同じデータを既存計算関数へ渡す。詳細は [工程4の実装仕様](data/cc-plant-pollinator/implementation.md)。後工程の責務も分離する。

| 層               | 将来の責務                                     | 導入時期 |
| ---------------- | ---------------------------------------------- | -------- |
| データ読込・検証 | 元ファイル、メタデータ、正規化、欠測・値の検証 | 工程4で実装    |
| 観測モデルの仕様 | 抽出単位、比較範囲、仮定、丸め規則             | 工程5で文書化、コードなし |
| 計算コア         | 仕様固定のPRNG、純粋関数、同じ入力で同じ出力   | 工程6で実装    |
| 反復・集計       | 反復別シードの導出、ばらつきの集計             | 工程7で実装    |
| 可視化・分析     | 出典と結果の対応、状態別表示、エクスポート     | 工程8・9 |

計算モジュールはReactやDOMへ依存させない。工程9は86MB級の正式結果を扱うため計算・完全結果検証・シリアライズ・ハッシュをWorkerへ分離した。状態は`idle/loading/running/success/empty_scope/error/cancelled`。cancelledはUIだけで、正式な計算契約を変更しない。詳細は[状態仕様](application/state-transitions.md)。

## デザインとアクセシビリティ

主要色は緑 `#204b3a`、オフホワイト `#f6f5ef`、濃いネイビー `#172a35`。日本語の本文は端末のサンセリフ、見出しは端末の明朝系を優先する。フォント取得用の通信は行わないため、端末によって字形は異なる。

フォームにはラベル、入力説明、`aria-invalid` を持たせる。SVG説明図はtitle/descとキャプションを持つ。アイコンは装飾用。リンクには現在地、外部リンクには新しいタブの説明を付ける。

## ビルドと配信

`npm run build` は型チェックの後に静的ファイルを `dist/` へ出力する。`dist/` と `node_modules/` はコミットしない。

BrowserRouterのため、将来の配信環境にはSPAフォールバックが必要。現段階はルートパスでの配信を前提とする。GitHub Pagesのリポジトリ配下への配信などは、Viteのbase、Routerのbasename、直接アクセス対応をまとめて検討する。デプロイ設定はまだ置かない。

## 継続的確認

CIはNode 24、`npm ci`、`npm run check` を実行する。ローカルと同じテスト・ビルドを実行し、デプロイやリポジトリへの書込みは行わない。データテストはNode環境、既存画面テストはjsdomで実行する。CIは完全なGit履歴と同梱原本を使い、オフラインの `data:check` を含む。jsdomは実ブラウザの描画やタッチ操作の確認を代替しない。

## 第5工程で確定した計算層の契約

[数理仕様](simulation/README.md)を規範とする。既存の `src/features/data/` と正規化データは変更しない。ローダーで全3,882件を検証してから、元イベントを変更せず選択スコープを作る。部分列を全データ用の検証ローダーへ再入力しない。

工程6では別モジュールに条件検証・選択、件数計算、PCG32/棄却法、非復元の部分Fisher–Yates、原ラベルのネットワーク集計、正確な分数と結果契約を実装する。React/DOM、時計、通信、グローバル乱数へ依存させない。固定ノード分母と原番号の追跡を保持する。反復は工程7。

[結果契約](simulation/reproducibility.md)は未実行/失敗/空スコープ/正しい空抽出を分ける。比率や集計は既約分数、SDは分散を被開平数として保存し、表示用小数や実行時刻を結果本体へ含めない。今回、関数・型・状態遷移・画面接続のコードは追加していない。

## 第6工程で実装した計算層

`features/simulation/core/`が条件・原順・件数・PCG32・抽出・ネットワーク・Fraction・単一結果を担当する。`features/simulation/run.ts`が既存の `loadObservationData()`を利用し、`hash.ts`がWeb Cryptoを提供する。工程6時点では画面から独立し、工程9ではWorkerから同じコアを呼ぶ。`run.ts`のデータ読込済み再読込を避けるため、Workerは検証ローダー後に同じ`core/run.ts`・`core/repeated.ts`の公開全件入口を使う。

`scripts/simulation/context.ts`だけがGit・ファイル・データ来歴を読み、実在する実装スナップショットと9規範ファイルのハッシュから `RunContext` を作る。値としてコアへ渡し、計算自身に環境依存を持ち込まない。開発者検証は `scripts/simulation/verify.ts`、テストも同ディレクトリ。Nodeの型検査にこの層と宣言的fixtureを含めた。

正式結果は比較基準と1試行、原番号・乱数消費数・正確な指標・版/ハッシュを持つ。時刻・環境・帰属・結果ハッシュは別来歴。反復サマリーはnull。詳細は [工程6の実装仕様](simulation/phase6-implementation.md)。

## 第7工程で実装した反復・統計層

`core/repeated.ts`は全件検証済みデータの同じ選択範囲から既存`simulateTrial`をR回再利用し、全試行をt順に保存する。`core/statistics.ts`が7指標の平均、標本分散、SDの被開平数、min/max、type 7分位点をBigIntの既約分数で計算する。React/DOMと無関係。工程9でWorker経由のページへ接続した。

`scripts/simulation/verify-repeated.ts`は実在する実装リビジョンと正規結果を検証する。別実装の`audit-repeated.py`が原CSVから1,000試行を再構築して照合する。詳細は[実装](simulation/phase7-implementation.md)と[検証](simulation/phase7-validation.md)。可視化層への入力は既存の`RunResult`と試行番号であり、描画のために抽出を再実行しない。

## 第8工程で実装した独立した可視化層

`features/visualization/`は既存RunResultの指定試行だけを受け取る。adapterがグラフの整合性を検査し、layoutが基準原IDの安定順から共通座標を計算する。React/SVGで両側を描画し、既存の計算関数を呼ばない。D3/forceを必要としない固定二列配置のため依存追加は行わない。

`dev/network.html`と`src/dev/`はVite開発時の独立入口。工程7の実データチェックポイントだけを読み、通常アプリのルート・Provider・ResultsPageを変更しない。プレビューは通常の本番buildに含めない。表示フィルター・拡大は表示状態だけで、計算結果・論理座標・指標を変えない。詳細は[可視化設計](visualization/README.md)。

## 第9工程の統合層

| 場所 | 責務 |
| --- | --- |
| `features/execution/protocol.ts` | run_id/operation_id付きのWorker契約。正式結果と表示用部分構造を別型にする |
| `input.ts` / `simulation/model.ts` | 厳密な整数・明示選択、既存コアによる条件正規化、入力の同一性 |
| `client.ts` / `ExecutionProvider.tsx` | Worker寿命、取消、旧応答排除、旧条件表示、画面間の小さい状態、Blob URL解放 |
| `worker.ts` / `runtime.ts` | 元データと来歴の検証、既存単一/反復入口、全試行保持、表示試行の取得 |
| `validate.ts` | 正式結果の構造・入力・原番号・ネットワーク・Fraction・全summaryの整合性確認 |
| `export.ts` | 既存正規JSONと同一バイトの分割Blob、Worker内SHA-256、別来歴、厳密CSV |
| `format.ts` / `histogram.ts` | 正確な分数から表示だけを丸める。厳密なビン所属判定 |
| `StatisticsPanel.tsx` / `ExportPanel.tsx` | 実結果の度数・統計・保存操作と失敗表示 |
| `scripts/browser/` | Node/Git/FSで実在版と入力ハッシュを検証し、Vite仮想モジュールに値だけを埋め込む |

データフローは「明示条件→要求ID→専用Worker→loadObservationData→既存全件計算入口→全RunResultをWorkerに保持→ヘッダー/サマリー/分布用スカラー/1試行→React表示」。試行変更では保存済みの1試行だけを送る。`NetworkTrialView`はヘッダーと実在する1試行を組み合わせた明示的な表示フラグメントで、trialsを削った不正なRunResultを作らない。工程8の共有座標・adapter検証を再利用する。

計算版a55e7e2とアプリ版は異なる実在リビジョンとして保持する。9規範ファイルと計算スナップショットは変更しない。未コミットアプリは開発用で正式保存不可、計算来歴不一致は計算自体を拒否する。来歴を隠すフォールバック値を作らない。開発時の実装変更はHMRキャッシュを無効にし全画面を再読込する。ビルド中の入力変更も検出する。

Workerを終了して取消するため既存同期コアの数式や順序を変えない。進捗はloading/running/出力準備の把握できる段階だけで、推測の完了率は出さない。全結果・出力バイトをReactへ複製しないが、SHA-256のWeb Crypto入力には結果Blob相当の連続バッファが必要。低メモリ端末の成功を保証する設計ではなく、失敗と取消を明示する。[性能](application/performance.md)に実測と制約を記す。
