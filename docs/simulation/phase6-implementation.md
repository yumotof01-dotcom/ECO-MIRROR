# 第6工程：単一試行コアの実装

数理仕様は工程5の **1.0.0のまま**。9つの規範文書・fixtureのバイト列、工程4のデータ・処理・ローダー、依存・ロック、画面のコードは変更していない。反復ループ・集計、描画、画面接続、実行ボタンの有効化、利用者向け出力、公開は対象外。

## 利用入口と型

画面から呼ばれていない `src/features/simulation/run.ts` の `runObservationSimulation(request, context): Promise<RunResult>` が、既存の `src/features/data/index.ts` の `loadObservationData()` を使う。取得・ハッシュ検証の失敗はそのまま伝播し、空配列へ変換しない。

`SingleTrialRequest` は `selection`, `rate_percent`, `master_seed` の3項目。選択4項目と全許容値を明示する。単一モードはt=0、R=1に固定し、`trial_index`や反復の指定を受け付けない。下位の `simulateTrial` だけが将来の個別試行再現用にt=0〜999を受け取る。反復エンジンは存在しない。

`Selection`, `Fraction`, `NetworkSummary`, `TrialResult`, `RunContext`, `RunResult` は `src/features/simulation/core/types.ts` のreadonly型。結果のキーは [reproducibility.md](reproducibility.md) と一致する。`summary`は常にnull。空範囲は `empty_scope`、参照null、試行なし、抽出件数と実現割合null。正の参照に0件を残す抽出は `success`。

## 関数の責務

| 場所（core/内） | 主な関数 | 責務 |
| --- | --- | --- |
| `inputs.ts` | `normalizeSelection`, `normalizeRequest` | 項目・型・範囲・重複・年別Roundを検査。順序だけを正規化 |
| `events.ts` | `validateEventSequence`, `validateSubset` | 原番号の昇順・一意性、原ラベルIDと部分集合の同一性。原行を修復・再採番しない |
| `scope.ts` | `selectScope` | 項目間AND、項目内ORの原順filter。全元データから実施不明グループを記述 |
| `sampling.ts` | `sampleSize`, `sampleEvents` | 整数の半数切上げ、前方部分Fisher–Yates、採用位置の数値昇順化 |
| `pcg32.ts` | `createPcg32`, `boundedUint` | BigIntのPCG32、旧状態からの出力、棄却法と語消費数 |
| `network.ts` | `compareNetworks` | 基準ノード/ペア固定、原ラベルの重み・相手数・各指標、不変条件の検証 |
| `fraction.ts` | `fraction`, `validateFraction` | BigIntによる既約分数作成。保存済みの非既約値は補正せず拒否 |
| `serialization.ts` | `canonicalJson`, `idsHash` | ASCIIキー順、意味を持つ配列順、UTF-8/LF、ID列専用のコンパクトJSON |
| `trial.ts` | `simulateTrial` | 1試行の抽出、比較、原番号・シード組・ハッシュの生成 |
| `run.ts` | `runSingleTrial` | 全データ検証→全条件検証→スコープ→試行/空範囲→正式な結果 |

コアにはReact、DOM、時計、ファイル、Git、通信、グローバル乱数への依存がない。SHA-256関数は `Sha256 = (utf8Text: string) => string | Promise<string>` として渡す。`hash.ts` は境界のWeb Crypto実装、Node検証は既存のnode:cryptoを使用する。ハッシュの失敗を代替値で隠さない。

`createPcg32`の状態はインスタンスに閉じ、各抽出で新たに初期化する。k=0/全件は初期化自体を行わない。供給語の棄却分を含めて数え、初期化の2語は含めない。元イベントの配列をシャッフルせず、位置配列だけを交換する。処理が同じ行を別の原IDとして保持することと、同じ原IDの二重採用を拒否することを区別する。

ペアは植物→昆虫のネストしたMapで扱い、区切り文字を解析しない。観測ラベル数は抽出で出現したものだけ、比較配列には基準側の全ノードとE₀を同順で保持する。Sに出ない基準ペアの重みは0、E₀以外の仮想ペアは生成しない。重みの総和、両側の相手数の総和、件数/ラベル/ペアの範囲を検査する。

## 全データ検証と派生データの分離

正式入口はハッシュ検証済みの全3,882行を読み込む。`runSingleTrial`も全番号1〜3,882の連続性を検査し、呼出側のデータを複製して既存の `validateObservationData` で再検証する。さらに工程4の固定キー順・2スペース・末尾LFの形式へ戻して全イベント/辞書のSHA-256を照合する。監査総数が同じでも、Treatment等の改変は拒否する。この入力の照合形式は結果のASCIIキー順JSONと別であり、ローダーから得たデータを並べ替えず使う。既存検証がfreezeするのは複製側で、呼出側の未凍結オブジェクトにも副作用を与えない。

下位関数の `CoreEvent` は追跡・ラベルの6フィールドを持ち、部分スコープには原番号の間隔を許す。元データ全体を示す `ObservationData` と別の型・契約である。合成10行はこの下位テストだけに渡し、正式ローダーへ渡さない。全3,882件の条件を弱めていない。

## 数値・失敗

`k=floor((N*p+50)/100)`、pは整数0〜100。指定割合と実現割合 `100k/N` を別々に保存する。分数は非負のBigIntで計算し、10進文字列・正の分母・既約形で保存する。表示用小数は保存しない。

純粋な空ネットワークの指標検証では、Connectanceはnullと `zero_reference_nodes`、保持率はnullと `zero_reference_pairs`。実行APIのN=0は試行を作らず `empty_scope`。下位 `simulateTrial([])`も拒否する。0件抽出の指標0を、未実行や現地の訪花0の代用品にしない。

`SimulationError`はcode、stageと原因を持つ。工程5の入力/原順/部分集合/数値エラーに加え、メタデータやハッシュ境界の不正を `INVALID_CONTEXT` として実装上区別する。数理仕様の意味や結果スキーマの変更ではない。既存の `DataValidationError` も保持する。入力のtrim、分類統合、原行の削除、0/100へのclampを行わない。

## Git・仕様・データの実在確認

`scripts/simulation/context.ts` の `readExecutionContext()` はNode専用の境界である。原CSV・大学版メタデータ、固定したevents/taxaのサイズとSHA-256、工程4の変換コードと来歴を照合し、9つの規範ファイルをハッシュする。

計算コード、読み込み境界、データコード、依存・設定と規範ファイルに最後に変更を加えたGitコミットを探し、そのコミット内の全入力ファイルと作業中のバイト列を照合する。未追跡の計算ファイル、未コミット変更、浅い履歴を成功扱いしない。計算だけを行うコアはGitを検査できないため、外部の呼出側がこの確認を行った `RunContext` を渡す責任を持つ。

実装を先にコミットし、次に検証結果と文書を保存する。今回の計算リビジョンは `0823bc6a278c948cacffbfd2463783083e21fad5`。後続の文書・検証記録・テストだけのコミットでも、この実装入力のバイトが同じなら識別子は維持する。存在しないコミットや、工程5の未実装コミットを計算版として記録しない。

`makeRunProvenance`は結果のSHA-256、時刻、環境、データ来歴のハッシュ、コード入力ハッシュ、データの著者・タイトル・大学DOI・CC BY 4.0・加工内容を別ファイルに置く。元データのsource/provenanceを変更しない。結果は自分自身のハッシュを含まない。

## 再現コマンド

Node.js 24.12以上、完全なGit履歴、`npm ci`を使う。

```bash
npm run data:check
npm test
npm run build
npm run check
node scripts/simulation/verify.ts
```

最後のコマンドは開発者向けの固定受け入れ検証であり、ユーザー向けのレポート出力機能ではない。インプロセスのViteで既存の `?raw` ローダーを使用し、HTTPサーバーを公開せず、UIを有効化しない。全実データ100%の監査、50%/seed42/t0の二回の全バイト一致と保存済み結果を照合する。`npm test`でもネイティブNodeからこのコマンドを実行する。

保存済みの検証記録は [phase6-verification/README.md](phase6-verification/README.md)。実装入力を変更する場合は先に作業ブランチへコミットし、その後だけ `node scripts/simulation/verify.ts --write-verification` で固定検証結果を生成し、記録・文書を次のコミットに保存する。このフラグは固定した開発者検証先だけに書き、`data/`を上書きしない。

## 残る工程

工程7では確定済みの[反復仕様](repetitions.md)どおり、同じDからt別系列で試行し、正確なFractionの平均・標本分散、SqrtFraction、type 7分位点、全試行保存を実装する。今回はこれらを作らない。画面接続・可視化、出力UI、実ブラウザ間の数値/性能確認はそれぞれ後の工程で行う。
