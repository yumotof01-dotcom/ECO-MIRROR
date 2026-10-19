# 第9工程の統合計画

開始時：mainは3e6a155のREADMEのみ。PR #1〜#7は未マージで継承関係は変わっていない。第8工程05a732fのCIと既存249テスト・データ監査・ビルドを確認した。作業ブランチはfeat/phase-9-interactive-application、baseはfeat/phase-8-network-visualization。

| 要件 | 再利用 | 第9工程の責務 |
| --- | --- | --- |
| 実データ | loadObservationData、全3,882件検証 | Worker内の読込。元データ変更なし |
| 数理計算 | runSingleTrial / runRepeatedTrials、既存PCG・統計 | 同じコアをWorkerで実行。モデル変更なし |
| 来歴 | NodeのreadExecutionContext | Viteの仮想モジュールでGit実在・実ファイル一致を照合。計算版とアプリ版を分ける |
| ネットワーク | NetworkComparisonと固定座標 | 真の1試行フラグメントを追加。正式RunResultを偽造して小さくしない |
| 入力・状態 | 既存Providerと4画面 | 明示的な条件、要求ID、取消、旧結果の識別 |
| 統計 | 第7工程の厳密なsummary | 表示用近似とSVGの頻度分布。保存値へ丸めを戻さない |
| 出力 | 正規JSON契約 | Worker内で分割シリアライズ、Web Crypto、Blob。全試行を保存 |

データフローはフォーム→要求ID付きWorker→ローダー/来歴検証→既存コア→全結果をWorkerに保持→サマリーと現在の1試行のみ画面へ送信→試行指定時は保存済み結果を返す。保存時にだけ全結果を正規UTF-8/LFへ変換し、別来歴とCSVを作る。BlobのURLは失効時・次実行・Provider破棄時に解放する。

loading/running/success/empty_scope/error/cancelled/idleをUIだけで管理する。新規要求、条件変更中の取消、連続クリック、逆順通知はIDで分離する。正式結果にcancelled等を追加しない。計算中の架空の進捗率は使わず、把握できる段階だけを通知する。

大きいRでもReactに全ネットワークを持たせない。Workerの破棄で実行を中断し、結果を減らして成功扱いしない。出力は全文の再帰コピーを避ける分割JSONを、既存canonicalJsonと全バイト照合する。未コミットのアプリは開発用と明示し、正式保存を禁止する。コードを先にコミットし、その後に実在版でブラウザ検証・記録する。

検証順序：既存249テスト→入力/状態/分割出力/Worker境界の単体検証→実データと既存チェックポイント照合→実装コミット→検証済み来歴でE2E（0/50/100、R=1/2/100/1,000、取消・旧応答・保存）→4画面幅とスクリーンショット→全check・CI。未検証の実機やメモリ項目は区別して報告する。
