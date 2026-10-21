# 科学・ライセンス内部レビュー

## 根拠と採用範囲

Ellen Moss / Darren Evans (2022), *Climate change impacts on plant-pollinator interactions and functioning - experiment data*, University archive v1, https://doi.org/10.25405/data.ncl.17430548.v1 。2026-10-21に大学保管版のFigshare APIを再取得し、版1、著者、CC BY 4.0、file34178859を照合した（source-check.json）。原本の全バイト・行対応は工程10の監査を参照。

元論文：*Experimental Climate Warming Reduces Floral Resources and Alters Insect Visitation and Wildflower Seed Set in a Cereal Agro-Ecosystem*, https://doi.org/10.3389/fpls.2022.826205 。英国の実験データを、有限の訪花記録の抽出教材として利用する。元論文の結実等の別解析まで、この7列CSVで再現したとは主張しない。調査方法・処理の詳細は工程3の出典照合を保持する。

## モデル・結論の監査

- 個別イベントを等確率・非復元・固定件数で抽出する。現実の訪問時刻、観測努力量、調査回内の集中をモデル化しない。
- 全記録は選択範囲内の有限の比較基準。自然界の真値ではない。
- 同値行1,930件を削除せず、原分類ラベルを統合しない。原ラベル数を確定種数としない。
- 年別Roundを保持。15組の記録なしは実施不明であり0件観測とみなさない。
- 48区画年を独立した48反復として因果推論に用いない。処理/年の比較から因果効果を主張しない。
- 二値Connectanceは基準植物×昆虫ラベル数を分母に固定。元論文のweighted指標と同一ではない。
- 反復は条件付き抽出分布。2.5–97.5%分位範囲を生態系の95%信頼区間と呼ばない。
- 訪花≠受粉成功、未確認≠自然界の不在/絶滅、記録数≠個体数、割合≠調査時間、英国実験≠日本の再生草原。

主張できるのは「この記録集合から、この割合・シードで抽出すると、この観測ペアが確認できた/できなかった」。将来予測、健康度、受粉効率、生態学的な重要度の推定は行わない。

工程10の独立参照コードは数学的整合性の検証であり、生態学的妥当性の外部専門家レビューではない。観測努力量、実施不明の単位、未確定同定は未解決のまま明記する。

## 帰属と加工

CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ の原作者・題名・版・出典・ライセンスと加工の表示を、研究情報、public/DATA-ATTRIBUTION.txt、run-provenance.jsonで維持する。正式JSONと来歴JSONを一緒に保存する。元CSVは無変更、正規化・抽出・集計・描画は派生処理。著者による承認/推奨を示唆しない。ライセンスを追加制限しない。

第三者コードはpublic/THIRD-PARTY-NOTICES.txtにインストール済みの原ライセンス本文を保持し、distに同梱。scripts/release/notices.mjsで再生成できる。React/DOM/Router/Scheduler等の実行依存に加え、Tailwind・Vite・Rolldownの生成コードに関わる通知を含めた。依存更新時は本文とlockを再照合する。ECO MIRROR自作コード全体のライセンスは所有者が決定する事項であり、無断でMIT等を設定しない。
