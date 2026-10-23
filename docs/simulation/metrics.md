# 訪花ネットワークと指標 1.0.0

## 1. 記号と比較基準

[選択規則](model-specification.md)で得た全記録D（N件）と、その非復元部分列S（k件）を比較する。ここで「全記録」は**選択範囲内の全記録**であり、自然界の真値ではない。ノードは原ラベルID `plant:<raw>` / `visitor:<raw>`。両側は互いに異なる集合として扱う。

記録列A（D又はS）について、

$$
P(A)=\{\text{plant label of }e:e\in A\},\quad
V(A)=\{\text{visitor label of }e:e\in A\},
$$

$$
w_{pv}(A)=\sum_{e\in A}\mathbf1\{e.plant=p,\ e.visitor=v\},
\quad E(A)=\{(p,v):w_{pv}(A)>0\}.
$$

$P_0=P(D),V_0=V(D),E_0=E(D)$、$a_0=|P_0|,b_0=|V_0|,L_0=|E_0|$ と置く。Sについて $a=|P(S)|,b=|V(S)|,L=|E(S)|$。SがDの部分集合なので、P(S)⊆P₀、V(S)⊆V₀、E(S)⊆E₀。これが成り立たない入力は `NOT_A_SUBSET` で拒否し、L>L₀等を補正しない。

比較用の二部グラフは $G_0=(P_0\sqcup V_0,E_0,w(D))$、$G_S=(P_0\sqcup V_0,E(S),w(S))$。比較グラフのノードは固定する一方、**観測ラベル数**はSで実際に出現するa,bを数える。孤立した参照ノードが残ることと、観測ラベル数が減ることは矛盾しない。

## 2. 必須のスカラー指標

| 出力キー | 定義・分母 | 単位・範囲 | 例外・解釈 |
| --- | --- | --- | --- |
| `event_count` | $\lvert A\rvert$ | 記録、0〜Nの整数 | 原同値行も別記録。個体数・密度ではない |
| `plant_label_count` | $\lvert P(A)\rvert$ | 原ラベル、0〜a₀の整数 | 確定植物種数ではない。全辞書の長さを使わない |
| `visitor_label_count` | $\lvert V(A)\rvert$ | 原ラベル、0〜b₀の整数 | 確定昆虫種数ではない |
| `pair_count` | $\lvert E(A)\rvert$ | 観測ペア、0〜L₀の整数 | 同じ組合せの複数行を1ペアと数える |
| `lost_pair_count` | $\lvert E_0\setminus E(S)\rvert=L_0-L$ | ペア、0〜L₀の整数 | 自然界の消滅数ではなく、今回Sに含まれなかった基準ペア数 |
| `pair_retention_pct` | $100L/L_0$ | %、0〜100 | L₀=0はnull、理由`zero_reference_pairs`。0%や100%を代入しない |
| `connectance_fixed` | $L/(a_0b_0)$ | 無次元比、0〜1 | a₀b₀=0はnull、理由`zero_reference_nodes`。MVP採用 |
| `actual_record_pct`（実行共通） | $100k/N$ | %、0〜100 | N=0はnull、理由`empty_scope`。指定割合pとは分ける |

Dの基準値はN,a₀,b₀,L₀と $C_0=L_0/(a_0b_0)$。Sの `connectance_fixed` は0〜C₀。L=0かつL₀>0なら保持率は**有効な0%**、固定Connectanceも有効な0となる。

数学上、空のDの行数・ラベル数・ペア数は0、空集合間の差の濃度も0だが、比較比率の分母は0。この場合アプリの実行契約は `empty_scope` とし、試行・比較結果を生成しない。`eligible_record_count=0` だけを「選択したCSVに行なし」と明示する。野外の訪花0件という結果を表示しない。

## 3. 各原ラベルの観測相手数

各p∈P₀、v∈V₀について、

$$
d_p(A)=\sum_{v\in V_0}\mathbf1\{w_{pv}(A)>0\},\quad
d_v(A)=\sum_{p\in P_0}\mathbf1\{w_{pv}(A)>0\}.
$$

植物側は相手昆虫ラベル数で0〜b₀、昆虫側は相手植物ラベル数で0〜a₀の整数。Sに現れない参照ラベルにも0を保存する。選択範囲外のラベルは対象に含めない。同じ相手への複数記録は相手数を増やさず、重みを増やす。

「相手0」は今回のSで相手の記録がない意味であり、自然界で孤立した証拠ではない。両側について $\sum_{p\in P_0}d_p(A)=\sum_{v\in V_0}d_v(A)=\lvert E(A)\rvert$ を不変条件とする。

## 4. 重みとリンク表

原ペアを区切り文字で連結して解析しない。キーは植物IDと昆虫IDの**順序付き2要素組**とし、両側を分ける。E₀の各ペアについて参照のw(D)と抽出のw(S)を整数で保持し、Sの0も保存する。[結果契約](reproducibility.md)では参照側・試行側の `pair_weights` を同じE₀の順序で持ち、それぞれの `record_count` に対応する重みを置く。E₀にないペアの行を生成しない。

重みは訪花**記録件数**。記録が独立した個体である保証はなく、訪花率・相互作用の強さ・送粉効率へ単位変換しない。

$$
\sum_{(p,v)\in E_0}w_{pv}(D)=N,\quad
\sum_{(p,v)\in E_0}w_{pv}(S)=k,\quad
0\le w_{pv}(S)\le w_{pv}(D).
$$

## 5. Connectanceの選択

二値Connectanceの基本形はリンク数÷両側ノード数の積。CRANの[bipartite公式マニュアル、networklevel](https://cran.r-project.org/web/packages/bipartite/refman/bipartite.html#networklevel)も二値とweighted connectanceを別の指標として扱う。本仕様はどのノードを分母に使うかをさらに固定する。

| 方式 | 式 | 特徴・MVPの判断 |
| --- | --- | --- |
| 参照ノード固定 | $C_{\rm fixed}(S)=L/(a_0b_0)$ | 採用。欠けた参照ノードも分母へ残り、同じDで抽出量を比較できる |
| 抽出後の出現ノード | $C_{\rm active}(S)=L/(ab)$、ab>0 | 今回出力しない。ノードも減るため、Lが減っても値が上がり得る。S空ならnull |

原記録の全ラベルを使う固定方式でも、それらの全直積が生物学的に実現可能だとは主張しない。年・季節・処理が混ざるプールでは特に、同時に出会い得る全組合せの推定ではない。

$$
\frac{C_{\rm fixed}(S)}{C_0}=\frac{L}{L_0}
\quad(L_0>0).
$$

したがって固定Connectanceとペア保持率は、同じDでは情報として独立していない。二つの独立した生態学的証拠と説明しない。異なる選択範囲で分母が変わる場合も、値だけで優劣を判断しない。

weighted connectance、一般性/脆弱性、花数で標準化した頻度、受粉指標、健全性スコアはMVPで計算しない。二値の式に重みの合計を入れて、既存論文のweighted connectanceと呼ぶことは禁止する。

## 6. 数値表現と検証条件

件数は整数。保持率、Connectance、実現割合は[正確な分数](reproducibility.md)で保存する。例えば4/6の保持率は `200/3` %であり、途中で66.7へ丸めない。表示用の近似は別にする。

N>0の有効な選択範囲ではa₀,b₀,L₀はいずれも正。0≤k≤N、0≤L≤min(k,L₀)、a≤min(k,a₀)、b≤min(k,b₀)、L≤ab（k>0）、Lost+L=L₀、両側相手数の総和=L、全重みの総和=kを検証する。k=0の場合a=b=L=0、参照ノードの相手数とペア重みも全て0。

正しい出力では、抽出から新しい原ラベル・新しいペア・増加した記録重みは生じない。もし生じれば実装エラーとして失敗し、値を切り詰めて隠さない。
