# 第7工程：反復と正確な統計

数学的な正本は工程5の9規範ファイル（1.0.0）のまま。原データ・正規化・全件ローダー・PCG32・抽出・ネットワークの数理的意味は変更しない。画面への接続・描画はこのPRに含まない。

## 公開入口と責務

| 場所 | 関数/型 | 責務 |
| --- | --- | --- |
| `core/repeated.ts` | `runRepeatedTrials` | 全データの複製、既存単一入口による全件/ハッシュ検証とt=0、同じDから全R試行、正式な反復結果 |
| 同上 | `simulateRepetitions` | 検証済みの正の部分スコープ用。合成fixtureを全件ローダーへ渡さない |
| 同上 | `normalizeRepeatedRequest` | selection/rate_percent/master_seed/repetitionsを必須とし、R=1〜1,000と未知キーを厳密に検査 |
| `core/statistics.ts` | `summarizeValues`, `quantileType7`, `summarizeTrials` | 既約分数の演算、正確な統計、全試行・7指標の欠落拒否 |
| `core/types.ts` | `RunResult` | `SingleRunResult`と`RepeatedRunResult`の判別可能なunion。既定済み1.0.0のJSONキーを維持 |
| `features/simulation/run.ts` | `runRepeatedObservationSimulation` | 既存`loadObservationData()`とWeb Cryptoを使う画面未接続の入口 |
| `scripts/simulation/verify-repeated.ts` | 固定チェックポイント | 実データからの全結果・別来歴の保存と再計算照合。アプリ用レポート出力ではない |

`DEFAULT_REPETITIONS=100`を公開する。仕様に従いAPI呼出しは100を含むRを明示し、省略・不正値から暗黙に補完しない。単一モードと反復R=1を区別する。

## 単一コアの再利用

呼出側のデータとメタデータをawait前に複製する。既存`runSingleTrial`を1回呼び、全3,882行・原番号・辞書・成果物ハッシュを検証し、比較基準とt=0を得る。同じ複製から同じ選択Dを作り、その原ID列ハッシュが一致することを確認する。t=1以降も既存`simulateTrial(D,p,seed,t,sha256)`を呼ぶ。

全試行は同じD、pとkを用いる。kの計算規則も不変。各試行は(seed,54+t)で初期化し、共有乱数状態・時刻・Math.randomを使わない。採用列が等しくても全試行を保存する。前の標本からの再抽出、再試行による重複排除、層化抽出をしない。

逐次実装でt順に保存する。順序の異なる個別試行・並行した個別呼出しでも、同じtの結果は一致する。Worker等はまだ追加していない。Rを増やしても既存prefixを変更しない。

## 統計と失敗

7指標はevent_count、plant_label_count、visitor_label_count、pair_count、lost_pair_count、pair_retention_pct、connectance_fixed。

全演算をBigIntの分子・分母で行い、計算ごとに既約分数にする。分母Rの平均、分母R−1の標本分散を計算し、分散の中心化式と二次モーメント式が厳密一致することも確認する。SDは`{radicand: variance}`とし、近似平方根を保存しない。

type 7は分数でh=(R−1)q、j=floor(h)、g=h−jを求める。数値順に整列し、x[j]+g(x[j+1]−x[j])を計算。保存qは1/40、1/2、39/40。表示用の小数を保存に戻さない。

R=1では平均・min/max・分位点は唯一の値、分散/SDはnullとinsufficient_trials。R≥2の同値なら有効な0。0件抽出も7指標の有効な値として含める。欠けた/重複した/順序の違う試行や、null指標、非既約値、負値、途中の例外を除外して成功扱いしない。

N=0では反復せずempty_scope、trials空、reference/summary/抽出件数/実現割合はnull。入力は空範囲の判定前に検査する。成功はexecution_mode=repeated_trials、requested_repetitions=R、全R試行、7指標のsummary、summary_reason=null。

## 再現性と保存

計算コミットは`a55e7e2a86d2c9ac58de23fdbb2a0ae673ddb0b1`。コードを先に保存し、その実在スナップショットを照合してから[固定チェックポイント](phase7-verification/README.md)を生成する。元データのsource/provenanceは変更しない。

工程6の単一チェックポイントも現行の計算リビジョンで再生成する。元の工程6のチェックポイントはGitの`d349f3d0e608fd22b76551198360c661155660a4`に残る。数値・原番号・消費数・仕様/データは維持し、実装識別子だけを更新したことを検証する。

```bash
npm ci
npm run data:check
npm test
npm run build
npm run check
node scripts/simulation/verify.ts
node scripts/simulation/verify-repeated.ts
```

原本からオフラインで検証できる。実装を変更したら先にコミットし、各検証CLIの`--write-verification`で更新して別コミットへ保存する。時刻・環境・結果ハッシュ・帰属は別来歴。結果本体は正規JSONで同じ入力から全バイト一致する。

反復分布は有限記録と抽出モデルに条件付けられたもの。「抽出モデルの2.5–97.5%分位範囲」と呼び、生態系全体の95%信頼区間、健康度、受粉成功や未来予測とは扱わない。
