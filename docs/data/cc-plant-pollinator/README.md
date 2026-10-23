# 第3工程：CC-plant-pollinator データの調査・採用判断

調査日：2026-10-17。対象は `Data/Raw_InteractionData_BothYears.csv`。本書の数値は実ファイルの監査集計であり、アプリで生成した分析結果ではない。

## 1. 採用判断

**用途を限定して採用する。** 英国の野外実験で得た訪花記録を用いて、記録の抽出条件で観測関係の見え方が変わることを検証する教材に適する。アプリへの取り込み・正規化は工程4で行う。今回は原CSVも正規化済みイベントもリポジトリへ同梱していない。

| 観点 | 判断と理由 |
| --- | --- |
| 記録の粒度 | 年・区画・調査回・植物・昆虫ラベルを持つ3,882行のエッジリスト。抽出対象を明示しやすい |
| 来歴 | 著者のGitHub、査読論文、論文が案内する大学保管データの対応を確認 |
| 利用条件 | 大学保管v1のデータにCC BY 4.0を明示。帰属・ライセンス・変更表示を保持して利用する |
| 分類名 | 原ラベルで採用。属等の未確定同定、複合名、異名、綴りの確認対象を保持し、「104種」とは呼ばない |
| 科学的な適用範囲 | 英国の実験条件下の観測記録。受粉成功、自然全体の真値、日本の再生草原の実態を直接証明する用途には採用しない |
| 取り込み時の条件 | 行の一律重複削除、未確認の学名統合、行のない調査単位への0補完をしない |

この判断はデータの観測モデル教材への適合性に関するもの。ECO MIRRORの有効性、モデルや将来の指標の妥当性を検証したものではない。

## 2. 出典・研究背景

- 著者：Ellen D. Moss、Darren M. Evans。
- 論文：Moss & Evans (2022), *Experimental Climate Warming Reduces Floral Resources and Alters Insect Visitation and Wildflower Seed Set in a Cereal Agro-Ecosystem*, Frontiers in Plant Science 13:826205。[論文・方法・データ案内](https://doi.org/10.3389/fpls.2022.826205)
- 研究目的：温度・降水処理が農耕地の花資源、訪花昆虫、相互作用、種子生産へ及ぼす影響を調べる。今回のCSVはこのうち訪花の記録。
- 地域：英国North Yorkshire、Stockbridge Technology Centreの農地（著者記載53°49′N–1°9′W）。日本の草原調査ではない。
- 設計：2×2mの24区画、区画間2m、4処理を各6反復とする無作為化ブロック設計。Control、Heat、Water、Heat+Water。実験では約1.5°Cの昇温と40%の増水処理を扱う。
- 期間・方法：2014・2015年の6〜8月、各年7回。区画あたり各回20分を基本に、花で摂食する昆虫を網で採集し、可能な限り同定。論文には9〜17時、15°C以上・弱風以下・降雨なしでの調査と記載される。

区画、処理、年、調査回のある実験標本として解釈し、3,882行を独立した実験反復とみなさない。実施日時・区画のブロック・各回の実績努力量は、このCSVの列にはない。方法の詳細は[著者README](https://github.com/FrikadEllen/CC-plant-pollinator/blob/045906eb5f5f8b45c0b314cda980f33a349099e4/README.md)と論文を参照。

## 3. ライセンスとGitHub版の対応

指定GitHubコミットの全ファイル一覧に独立したLICENSEは見当たらず、GitHub APIのlicenseもnullだった。論文のCC BY表示を外部データへそのまま適用する判断はしていない。

論文のData availability statementが指す[大学データDOI](https://doi.org/10.25405/data.ncl.17430548)を追い、[公式配信APIのv1](https://api.figshare.com/v2/articles/17430548/versions/1)で以下を確認した。

| 項目 | 確認値 |
| --- | --- |
| 資料名 | Climate change impacts on plant-pollinator interactions and functioning - experiment data |
| 作成者 | Ellen Moss、Darren Evans |
| 版付きDOI | `10.25405/data.ncl.17430548.v1` |
| 公開日 | 2022-02-25 |
| データのライセンス | CC BY 4.0 |
| 対象ファイルID | `34178859` |
| 大学保管版のサイズ | 254,165 bytes |
| 配布元MD5と取得後計算値 | `6f083ca81e9bc14c3bbd5806aecb62e8`、一致 |

大学保管版はCRLF、指定GitHub版はLF。大学版のCRLFをLFに置き換えると**全バイトが一致**し、CSVとしてのヘッダー、全行の全値、行順も一致した。したがって同一記録内容の大学保管v1を、ライセンスと来歴の根拠を持つ工程4の正本取得先にする。GitHub版の独立した包括的ライセンスを新たに確認したという意味ではない。

CC BY 4.0では、[ライセンス条件](https://creativecommons.org/licenses/by/4.0/)に従い、作成者・出典・ライセンスへのリンクを保持し、変更を明記する。提供者の推奨・承認を示唆せず、許された利用を追加条件で制限しない。ECO MIRRORのコード全体や、GitHub上のRスクリプトの許諾まで同じとみなさない。

帰属表示案：Ellen Moss and Darren Evans (2022), *Climate change impacts on plant-pollinator interactions and functioning - experiment data*, v1, <https://doi.org/10.25405/data.ncl.17430548.v1>, CC BY 4.0。変更内容は、取り込み・集計・分類名対応など実施した操作を個別に追記する。今回の変更は監査集計と注意フラグの付加で、原行の削除・学名の修正は行っていない。

## 4. ファイルと列の監査

GitHubの固定コミット：`045906eb5f5f8b45c0b314cda980f33a349099e4`。

| 取得版 | SHA-256 |
| --- | --- |
| 指定GitHub版・250,282 bytes | `c7d2b988b6d8cb356351f3cf971ce297e9d531d81897e0ce368ba4629c84fd06` |
| 大学保管v1・254,165 bytes | `c2d7023215fb885070caf6603886bce10e965732e3cc2465111e9d73cad9ab9a` |

ヘッダーを除き**3,882行・7列**。UTF-8として復号可能、使用バイトはASCIIのみ、GitHub版にBOMなし。各行7フィールドで不整形行なし。数値列もCSV内では文字列で、下表の型は全値を確認した解釈型。

| 元の列名 | 解釈型 | 異なる値の数 | 意味・留意点 |
| --- | --- | --- | --- |
| Year | 整数 | 2 | 2014、2015 |
| Plot | 整数の識別子 | 24 | 1〜24。識別子として年と組にする |
| Round | 整数のラベル | 9（全年の和集合） | 各年7種類。連番・日付・等間隔を仮定しない |
| Plant | 文字列 | 20 | 植物の原分類ラベル。属までの同定を含む |
| Specimen_ID | 文字列 | 104 | 昆虫の原分類ラベル。個体を一意に識別するIDではない |
| Basic_Type | 文字列 | 10 | 著者による大分類。細かな分類階級や機能群の検証済み判定に置き換えない |
| Treatment | 文字列 | 4 | Control、Heat、Water、Heat+Water |

空セル、前後空白、監査対象の欠測表記は全7列で0件。欠測表記は空文字・`NA`・`N/A`・`null`・`(null)`・`NaN`・`none`を前後空白除去・大小文字を区別せず検査した。「列内の欠損なし」は、未観測の関係や調査実施情報まで完全であることを意味しない。

年×区画の48組すべてに記録があり、各組内のTreatmentは一意。24区画の処理は両年で一致し、各処理6区画。Specimen_IDとBasic_Typeの対応に複数値の衝突はなかった。

## 5. 重複の扱い

7列が完全一致する行を同一パターンとして数えると、異なるパターンは1,952。708パターンが複数行に現れ、該当行は2,638、最大反復18行。一律重複削除を行うと**1,930行が失われる**。

これは「1,930件の誤入力を発見した」という意味ではない。同じ回・区画で同じ植物から同分類の昆虫が複数記録されれば7列は一致し得る。[著者の解析](https://github.com/FrikadEllen/CC-plant-pollinator/blob/045906eb5f5f8b45c0b314cda980f33a349099e4/Scripts/CC-pp_Species-accumm-analysis.R)も行番号由来のRecord_IDを付け、行を記録として数える。個体ID・時刻がないため、実際の二重入力かをCSVだけで判別することはできない。**すべての行を保持し、同値行を削除しない。**

## 6. 分類名の監査

全20植物ラベル・104昆虫ラベルの原綴り、年別件数、Basic_Typeは[taxa.md](taxa.md)に収録した。分類学的な一括同定は実施していない。

| 元ラベル・事例 | 確認内容 | 工程4での扱い |
| --- | --- | --- |
| `Solanum_sp` | 2行。種が確定しないラベル | 元ラベルを保持。特定種へ割り当てない |
| 昆虫の`_sp`終端 | 14ラベル・187行。属・科等の未確定ラベルが混在 | 種レベルの観測と同じ同定精度と扱わない |
| `Bombus_terrestris_lucorum` | 160行の複合ラベル | 2種の記録に分割しない |
| `Bellardia_vulgaris_viarum`、`Syrphus_vitripennis_rectus`、`Platycheirus_scutatus_sl` | 複合・広義を示す可能性がある原ラベル | 自動分割・種の確定はしない |
| `Aglais_io`（1行）、`Inachis_io`（2行） | [GBIFの分類資料](https://www.gbif.org/taxon/943S3)はInachis ioをAglais ioの異名として扱う | 同物異名の対応候補。採集標本の再同定はしておらず、今回の集計では統合しない |
| `Chrysanthemum_segetum`（2,637行） | [Kew POWO](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:193744-1)はGlebionis segetumの異名とする。論文の表記とも対応 | 原綴りを保持し、将来の対応表へ根拠付きで記録 |
| `Capsella_bursapastoris`（15行） | [Kewの受容名](https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:30092589-2)はCapsella bursa-pastoris | 綴りの対応候補。著者の意図・標本を確認せずに修正を確定しない |
| `Ceonosia_trigrina`（1行）、`Lucilia_ceasar`（8行）、`Meigenia_mutabalis`（1行）、`Meredon_equestris`（2行） | Coenosia tigrina、Lucilia caesar、Meigenia mutabilis、Merodon equestrisが綴りの確認候補 | 未承認の候補として保持。類似名検索だけで原名を書き換えない |

綴り候補の参照先：[GBIF/Coenosia](https://www.gbif.org/taxon/WVC5)、[NHM/Lucilia](https://uksi-sandbox.nhm.ac.uk/taxon.php?linkKey=NBNSYS0000030348)、[NHM/Meigenia](https://www.nhm.ac.uk/our-science/data/uk-species/taxon?tvk=NBNSYS0000030181)、[GBIF/Merodon](https://www.gbif.org/species/1544340)。参照先に有効な名前があることは、この標本の同定を確定する根拠ではない。

104という値は原文字列の異なり数。異名と未確定同定を含むため、真の昆虫種数でも、すべて異なる104分類群であることの保証でもない。

## 7. 年・区画・調査回ごとの件数

| 年 | 記録数 | 植物ラベル | 昆虫ラベル | 観測された植物×昆虫ペア |
| --- | --- | --- | --- | --- |
| 2014 | 1,687 | 19 | 80 | 208 |
| 2015 | 2,195 | 9 | 68 | 111 |
| 全体 | 3,882 | 20 | 104 | 257 |

年別・処理別・24区画別・14年別調査回・48区画年の各回別の全件数は[counts.md](counts.md)、機械可読版は[profile.json](profile.json)にある。

2014年のRoundは **1,3,4,5,7,8,9**、2015年は **1,2,3,4,5,6,7**。両年とも7種類。2014年の2・6を「欠測回」と断定せず、年を無視してRoundを結合しない。

実在Roundラベル×24区画×2年の336組のうち、CSVに行のある組は321、ない組は15。15組の一覧もcounts.mdに記録した。方法に各回20分とあっても、各組の実施ログがないため、行のない組を「観測済みで訪花0」と確定しない。

補助資料 `AllData_PlotLevel_BothYears.csv` のYearは2014/2015ではなく1/2。**1→2014、2→2015と対応させると48区画年のVisitsが原CSVの行数と全件一致**した。この対応は照合から確認したものであり、列名が同じだからと暗黙結合しない。

## 8. 計算できること・できないこと

以下は利用できる情報の評価。指標計算やシミュレーションはまだ実装しない。

| 区分 | 指標・問い | 条件・限界 |
| --- | --- | --- |
| 記録から直接集計可能 | 年・処理・区画・Round・原分類ラベル別の行数 | 行数を野外の個体数密度と同一視しない |
| 原ラベルの記述として可能 | 観測植物ラベル数、昆虫ラベル数、異なるペア数、ペアの記録頻度 | 確定種数・自然全体の関係数ではない |
| 工程5で定義後に可能 | 観測された相手の数、観測行列のconnectance、重み付き指標 | 分母の分類集合、重複・未同定の方針、選択範囲を固定して定義。論文のweighted connectanceと単純比を混同しない |
| 後工程で検討可能 | 抽出後の記録・ラベル・ペアの残り方と反復の幅 | 記録の抽出による変化。時間短縮や個体群減少との等価性は未検証 |
| このCSV単独では不可 | 花あたりの訪花頻度、花数で標準化した値 | 花数の分母がない。別資料との単位・年コード・集計粒度の照合が必要 |
| このCSV単独では不可 | 回別の実測訪花率（毎分）、時刻・天候・空間ブロックに沿ったモデル | 実測努力量、日付・時刻、天候、ブロックの列がない。方法の代表値を各行へ実測値として埋めない |
| 断定不可 | 受粉成功、結実・繁殖への寄与、送粉効率 | 対象CSVに受粉・種子測定がない。別途測られた種子量も各訪花の因果証明にはならない |
| 断定不可 | 未観測関係の不在、真の種数・完全なネットワーク、自然界の健康度・絶滅リスク | 観測と同定の限界が残る |
| 適用不可 | 日本の再生草原の現状や、将来の気候変動影響の直接証明 | 地域・植生・実験条件・観測期間が異なる |

## 9. 未確認事項

| 未確認事項 | 影響と対応 |
| --- | --- |
| Roundと実施日の対応、2014年の番号が不連続な理由 | 日付・季節・連続時間のモデルは作れない。元ラベルを保持 |
| 15組の行なしが訪花0か、未実施・記録欠落か | 努力量台帳が得られるまで実施不明を保持 |
| 区画のブロック割当と各回の実績観測分数 | CSVだけで空間独立性や精確な毎分率を仮定しない |
| 全分類ラベルの正規名・同定粒度、綴り候補の著者意図 | 原名モードで採用。名寄せ版は承認付き対応表と版管理が必要 |
| 同値行が二重入力かどうか | 個体識別子等の根拠なしに削除しない |
| 同じRound内の行順の観測時刻との対応 | 原順は再現用順序。観測の時系列順とみなさない |

## 10. 次工程と再現方法

取り込み仕様・必須検証・正規化ルールは[normalization.md](normalization.md)。工程4で大学保管v1を取得し、ハッシュを検証して原本を保持し、全3,882行を識別可能なイベントへ変換した。[実装仕様](implementation.md) と [工程4の検証記録](phase4-validation.md) を参照。画面へのデータ接続とシミュレーションは未実装。欠測・分類・努力量に関する未確認事項を勝手に補完しない。

監査を再現するには、アプリへ取り込まず任意の一時ディレクトリに2版を取得して実行する。Python標準ライブラリだけで動く。出力先も一時ディレクトリに指定し、既存文書を不用意に上書きしない。

```bash
audit_dir=$(mktemp -d)
curl --fail --location 'https://raw.githubusercontent.com/FrikadEllen/CC-plant-pollinator/045906eb5f5f8b45c0b314cda980f33a349099e4/Data/Raw_InteractionData_BothYears.csv' --output "$audit_dir/github.csv"
curl --fail --location 'https://ndownloader.figshare.com/files/34178859' --output "$audit_dir/archive.csv"
python3 docs/data/cc-plant-pollinator/audit.py --github-csv "$audit_dir/github.csv" --archive-csv "$audit_dir/archive.csv" --output-dir "$audit_dir/report"
```

固定ハッシュ・列・両版の全値と行順の照合に失敗すれば監査は停止する。監査プログラムは取得元ファイルを変更せず、ランダム抽出・正規化・アプリへの接続も行わない。[検証記録](validation.md)に別パーサーによる照合も記載した。
