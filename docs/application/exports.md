# 正式出力と再現

## 3ファイル

| ファイル | 内容/形式 |
| --- | --- |
| `run-result.json` | 正式RunResult 1.0.0。全R試行の原番号、基準/試行ネットワークと重み、全指標・厳密統計、条件、データ/仕様/計算版 |
| `run-provenance.json` | 本体SHA-256、正規化来歴SHA、実行日時/環境、元著者/DOI/版/CC BY 4.0/加工、コードとアプリの入力ハッシュ、再実行条件 |
| `trial-metrics.csv` | 全試行の7主要指標。正式JSONを置き換えない派生出力 |

`run-result.json`は既存`canonicalJson`と同じキー順・配列順・整数/既約分数/SqrtFraction・2スペース・UTF-8・末尾LF一つ。時刻、処理時間、ブラウザ名、アプリ版、表示の小数、本体自身のハッシュを混ぜない。全く同じ数値契約ならブラウザとNodeでも同一バイトになる。本体の計算版は変更していないa55e7e2a86d2c9ac58de23fdbb2a0ae673ddb0b1。

Workerは全結果を完全検証し、正規トークンを約64K文字の境界でUTF-8へ変換しBlob化する。巨大オブジェクトの全体再帰コピーと巨大な正規JSON文字列の追加生成を避ける。Web CryptoにはBlob全体のArrayBufferを渡すため、このバッファ相当の空きメモリは必要。出力をReact stateへバイト列で保存せず、WorkerからBlobを渡してBlob URLを作る。再描画/試行切替では出力を再シリアライズしない。

保存リンクは利用者の直接操作でダウンロードを開始する。端末の保存完了はブラウザで確認する。準備の失敗と端末側の失敗を成功と偽らない。取消/次実行/Provider破棄でWorkerと全URLを解放する。

## ブラウザの来歴照合

`scripts/browser/metadata.ts`はビルド/開発起動時に既存`readExecutionContext()`を使い、原CSV、同梱データ、正規化コード、実在計算コミット、9規範ファイルを照合する。さらにアプリの`src`（テスト/テストヘルパー/独立開発プレビューを除く）、`scripts/browser`、`vite.config.ts`、`index.html`を実在する同一アプリコミットの実バイトと比較する。入力ハッシュ一覧も保存する。package/lock/計算用tsconfigは既存計算スナップショットの照合対象。

アプリの64入力（今回の版）と計算コアは別のリビジョン。UIの更新だけで旧コードの計算版と偽装しない。Node/Git/FSはビルドプラグイン側に限定し、仮想モジュールは値だけをブラウザ/Workerへ埋め込む。ランタイムはそのデータ識別情報と実際に読んだ同梱JSONのハッシュを再照合する。

- 計算データ/仕様/コード来歴の不一致：実行を拒否する。
- アプリだけ未コミット：開発用として明記して実計算を許可し、正式保存は無効。
- 全一致：来歴照合済みとして正式保存を許可する。

検証対象の実装を先にコミットし、その実在版で記録する。HMR変更時はキャッシュを無効化してリロードし、以前の検証済み実装表示を使い回さない。ビルド途中に実装が変わった場合も成功ビルドとしない。これは保存した来歴が実ファイルへ対応する検査であり、第三者の署名・生態学の妥当性認証ではない。

## CSV契約

全セルを二重引用符で囲み、カンマ区切り、CRLF、末尾CRLF。先頭行+全R試行をt昇順で出す。empty_scopeは先頭行だけで架空の試行を作らない。

`trial_index,event_count_records,plant_label_count_raw_labels,visitor_label_count_raw_labels,pair_count_pairs,lost_pair_count_pairs,pair_retention_pct_numerator,pair_retention_pct_denominator,pair_retention_unit,connectance_fixed_numerator,connectance_fixed_denominator,connectance_unit`

保持率の単位はpercent、Connectanceはdimensionless。例：保持率200/3%は分子`200`、分母`3`、単位`percent`として保存し、66.67だけを残さない。件数は正確な整数。分類名をCSVへ入れず、ユーザー文字列を式として生成しない。反復の厳密summary/SDは正式JSONに保持する。

## 同じ条件での再実行

結果画面の「この条件で再実行」は、表示中の結果を生成した正規条件・モード・R・シードを下書きへ戻し、新しい要求として計算する。編集後の別条件を混ぜない。来歴の`reproduction`にも同じ入力を記録する。

保存ファイルはブラウザへ取り込まない。開発者は別来歴の`application_git_revision`を持つ既存リポジトリを取得し、そのコミットに対応する作業環境で次を実行できる。実行時点と同じデータ/仕様/コードを使い、通常の原本取得日時は書き換えない。

```bash
npm ci
npm run check
node scripts/application/reproduce.mjs /path/to/run-result.json /path/to/run-provenance.json
```

CLIがまだ含まれない初期の実装コミットなら、第9工程の後続コミットを取得してCLIを利用する。CLI/検証文書だけの更新は検証対象アプリ入力に含まれないため、同じアプリ版のまま照合できる。CLIは保存本体SHA-256と正規化バイト、コード/アプリ/データ/仕様の実在版と入力ハッシュ、元条件を確認し、既存全件ローダーと単一/反復入口で再計算して全バイトを比較する。保存結果の型だけを信用して成功へ取り込まない。ViteのSSR読み込みを使うが待受/アップロードはしない。

大きい保存結果のCLI検証は解析した本体と再計算結果の両方を保持するため、ブラウザ操作と別の大きいメモリが必要。86MBの結果で低メモリ環境を保証しない。
