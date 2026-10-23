# 結果契約と再現性 1.0.0

この契約は工程6・7の計算結果に使い、画面接続・ユーザー向け書き出しは工程8・9で行う。工程5では型定義や実行コードを追加しない。正本は本ディレクトリの数式と[宣言的fixture](conformance-fixtures.json)。

## 1. 正確な数値の保存

件数、p、シード、t、Rは安全な整数Number。比率・平均・分散・分位点は **Fraction** とする。

| 型 | JSONの契約 |
| --- | --- |
| `Fraction` | `numerator`, `denominator` の2文字列。10進整数、余分な符号・先頭0なし。分母>0、既約分数。0は`0/1` |
| `SqrtFraction` | `radicand` に非負のFractionを持つ。値はその正の平方根（0は0） |
| 不定値 | nullに加え、同じオブジェクトの `undefined_reasons` に対象キーと理由を記録する |

この仕様で保存する指標・要約は全て非負。負の分子・分母、分母0、負の被開平数は `INVALID_NUMERIC_RESULT`。Fractionの四則演算と大小比較はBigIntで厳密に行う。例えば保持率4/6は `{"numerator":"200","denominator":"3"}` %、固定Connectance4/9は `{"numerator":"4","denominator":"9"}`。

標準偏差は分散を `radicand` として保存する。これによりMath.sqrtのエンジン依存の近似や、表示桁数を結果本体のハッシュへ混ぜない。例えば分散2500/9の標準偏差は `{"radicand":{"numerator":"2500","denominator":"9"}}`（数学的には50/3）。平方根を分数へ簡約する特別形式は設けない。

画面は後工程で近似値を表示できるが、表示用の丸めは採用・集計・分位点・保存値へ戻さない。%と無次元比を区別し、保持率100L/L₀は%の分数として保存する。表示数値の比較は工程10で許容誤差を明示して確認し、再現性の正本は整数・Fraction・SqrtFraction。

## 2. 参照ネットワークと試行のフィールド

共通の `NetworkSummary` は次のキーを必須とする。

| キー | 型・意味 |
| --- | --- |
| `event_count / plant_label_count / visitor_label_count / pair_count` | [metrics.md](metrics.md)の整数件数 |
| `connectance_fixed` | Fraction、空の参照に対する純粋な指標検証時のみnull |
| `plant_partner_counts` | `{label_id, partner_count}` の配列。P₀全件、IDのASCII順。Sで未出現の参照ラベルは0 |
| `visitor_partner_counts` | 同形式、V₀全件、IDのASCII順 |
| `pair_weights` | `{plant_label_id, visitor_label_id, record_count}` の配列。E₀全件、植物ID→昆虫IDのASCII順。Dではw(D)、Sではw(S)、Sの0も保持 |
| `undefined_reasons` | 通常は空オブジェクト。不定値がある検証用の空参照では理由を対応付ける |

参照と各試行のノード/ペア配列の**キーと順序を共通化**する。観測ラベル数はその配列の長さではなく、出現する原ラベル数を数える。選択範囲外の原ラベルを全ファイル辞書から混ぜない。

`TrialResult` は `trial_index`、`initstate_u64_hex`、`initseq_u64_hex`、`random_word_count`、`sampled_source_record_numbers`、`sampled_ids_sha256`、`sample`（NetworkSummary）、`lost_pair_count`、`pair_retention_pct`、`undefined_reasons` を必須とする。

原番号は**ファイル全体での番号**で、スコープ内の0始まりの位置とは異なる。保存は原番号の数値昇順。record_idは元SHAと原番号から既存の規則で再構成し、実際の原IDとも一致を検査する。必要な原分類名は既存辞書と対応でき、名前を書き換えない。

例えばスコープの原番号が[2,10,25]の場合、抽出位置1が指すのは原番号10であり、1又は2として保存しない。元配列・辞書のfreezeを解除しない。

## 3. 実行結果の状態

| 状態 | 結果の契約 |
| --- | --- |
| `idle / loading / running` | 将来のUI状態。完了したネットワーク・指標を0で仮置きしない |
| `error` | エラーコード・原因を保持。比較結果を成功値として返さない |
| `empty_scope` | 検証済みデータと条件は正しいがN=0。`eligible_record_count=0`、`reference=null`, `trials=[]`, `summary=null`、理由`empty_scope`。野外の0件調査ではない |
| `success` | N>0。k=0も有効。基準と全指定試行の検証に成功した場合のみ |

画面の実装は今回行わない。空スコープでは抽出件数を実行した値として保存せず `sample_record_count=null`、実現割合null。比較指標の数学的な分母0はnullであり、[空データの表](edge-cases.md)と整合させる。

工程6の実行モードは `single_trial`、R=1、t=0、`summary=null`、`summary_reason="repetition_not_requested"`。工程7のモードは `repeated_trials`、R≥1、t=0〜R−1の全結果とスカラー別サマリーを持つ。反復モードのR=1ではサマリーを生成し、分散/SDだけnull（`insufficient_trials`）。単一試行コア自体は将来の反復・試行別再現用に0〜999のtを受け付けるが、単一実行モードの公開結果はt=0とする。

サマリーの各指標は `valid_count`, `mean`, `sample_variance`, `sample_sd`, `min`, `max`, `quantiles`, `undefined_reasons`。数値の要約は全てFraction、SDだけSqrtFraction。`quantiles` は `{probability: Fraction, value: Fraction}` の3要素配列。順序は1/40、1/2、39/40。

## 4. 正規の実行本体

`RunResult` は次の情報を一つの正規JSON本体に保持する。キー名は以下を規範とし、追加キーは版の更新なしに導入しない。

| キー | 内容 |
| --- | --- |
| `result_schema_version` | `"1.0.0"` |
| `specification_versions` | `model`, `metrics`, `randomness`, `repetitions`, `serialization`。それぞれ`"1.0.0"` |
| `implementation_git_revision` | 実在する計算コードのコミット。未コミットのコードを別コミットとして記録しない |
| `specification_sha256` | 本書末尾の規範文書・fixtureのパス→SHA-256 |
| `data_identity` | 下記の出典・版・ハッシュ |
| `selection` | 検査・正規順化された全選択項目 |
| `scope` | `scope_mode`, `eligible_source_record_numbers`, `eligible_ids_sha256`, `records_by_year`, `plot_year_count`, `observation_group_count`, `no_record_groups` |
| `sampling` | `unit="event"`, `replacement=false`, `algorithm="partial-fisher-yates-forward"`, `rounding="nearest-half-up"`, `rate_percent`, `eligible_record_count`, `sample_record_count`, `actual_record_pct` |
| `randomness` | `algorithm="pcg-xsh-rr-64-32"`, `master_seed`, `stream_offset=54` |
| `execution_mode / requested_repetitions / status` | 上記のモード・件数・状態 |
| `reference` | DのNetworkSummary。空スコープではnull |
| `trials` | tの昇順の全TrialResult。単一モードは1件、空スコープは空配列 |
| `summary / summary_reason` | 反復の指標別サマリー又はnull。成功した反復では理由null |

`data_identity` は `dataset_id`, `archive_doi`, `archive_version`, `source_sha256`, `normalized_events_sha256`, `taxa_sha256`, `data_schema_version`, `transform_version`, `transform_git_revision`, `taxonomy_mode="verbatim-raw-labels-v1"` を必須とする。出典は大学保管v1のDOI `10.25405/data.ncl.17430548.v1`、archive_versionは整数1。対象のデータスキーマは1.0.0、変換版はccpp-verbatim-v1、変換コミットは工程4来歴の `c286c76e3a6d0e28ae9a22b7efd3686ca4f54f94`。

`records_by_year` は選択年ごとの `{year, record_count}` を年昇順で保存する。0も「その年で条件に該当するCSVの行なし」の記述であって実施済み0件ではない。

`plot_year_count` と `observation_group_count` はDに出現する `plot_year_id` と `observation_group_id` の異なり数。N=0なら0。選択肢の直積を「記録がある」グループ数にしない。全範囲では48と321となる。

`no_record_groups` は、元データの年×Plot→Treatment対応が選択処理に合うPlotと、選択年・年別Roundの組のうち、元CSVに行がないもの。`{year, plot_id, round_label, status:"no_record_effort_unknown"}` を年・区画番号・Round番号の順に置く。選択処理と一致しないPlotの仮想グループは作らない。全範囲なら15組となる。グループがSから消えたという理由でこの配列へ追加しない。

## 5. 正規バイトとハッシュ

`specification_versions.serialization="1.0.0"` の規則。将来保存する本体ファイル名は `run-result.json`：

1. オブジェクトのキーを再帰的にASCII辞書順へ整列する。現在のキー・原ラベル・IDはASCII。localeCompareを使わない。
2. 配列は意味を持つため一律ソートしない。選択の値はモデルの正規順、イベントは原順、ノード/ペアは上記ID順、試行はt順、分位点はq順とする。
3. 安全な非負整数・boolean・null・文字列・配列・オブジェクトだけを許容する。BigInt本体、Numberの非整数、undefined、NaN、Infinityを保存しない。0を-0で区別しない。
4. この正規オブジェクトに `JSON.stringify(value, null, 2)` と末尾LF一つを用い、UTF-8にする。そのバイト列のSHA-256を計算する。

`eligible_ids_sha256` と `sampled_ids_sha256` の入力だけは、該当するrecord_idの原順配列に `JSON.stringify(ids)`（字下げなし）+末尾LFを適用したUTF-8。空配列は `[]` +LF。SHA-256は小文字64桁16進。

本体自身のハッシュを本体に含めない。取得・実行日時、処理時間、ブラウザ/Node等の実行環境、表示用小数、保存操作の情報は別の `run-provenance.json` に置き、正規結果本体のハッシュと対応付ける。実行時刻が違っても本体のバイトは変わらない。データの既存source/provenanceを書き換えて計算来歴を追加しない。

この別来歴には `result_sha256`, `data_provenance_sha256`, `created_at_utc`, `runtime`（環境名と版）、元データのタイトル・著者・DOI・CC BY 4.0のリンク・実施した加工の説明も保持する。出典の原取得情報は既存source/provenanceを参照し、再実行時刻で上書きしない。取得時刻を含む来歴ファイルのハッシュもこちらへ分離し、取得日時だけの違いで数値本体が変わらないようにする。書き出しUIの実装は工程9。

## 6. 再現手順と版の変更

後工程で、(1)正規JSONのSHA-256を確認、(2)データの生/正規化ハッシュと版を確認、(3)同じ計算コミットと仕様文書ハッシュを準備、(4)選択を正規化し原番号列/そのハッシュを確認、(5)各tを同じシード組で再実行、(6)原番号・乱数消費数・全指標・集計を比較、(7)本体の全バイトを照合する。

整数・ID・分数・被開平数は完全一致が条件。UI表示用の近似値だけで再現成功と判定しない。生データ・選択・順序・丸め・PRNG・棄却・交換・指標分母・分位点・保存形式の意味を変える場合、該当する仕様版とハッシュを更新し、古い結果の版を保持する。

`specification_sha256` の対象は本ディレクトリの `model-specification.md`, `metrics.md`, `randomness.md`, `repetitions.md`, `reproducibility.md`, `edge-cases.md`, `scientific-limitations.md`, `worked-examples.md`, `conformance-fixtures.json`。READMEと実施日別validationは索引・検証記録であり、規範ハッシュに含めない。仕様のハッシュを仕様本文自身へ埋め込むことはしない。
