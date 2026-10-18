# 第7工程の固定した実データチェックポイント

全て既存の大学v1・3,882行から、検証済みの第7工程のコードで実際に計算した結果。合成fixtureや画面用の架空結果ではない。元CSV・正規化・分類ラベルを変更していない。

| ケース | 条件 | 用途 |
| --- | --- | --- |
| `half-result.json` | 全範囲、p=50、seed42、R=3 | 全3試行、正確な7指標の統計、元番号・重み・相手数。第8工程がそのまま受け取れるRunResult |
| `full-result.json` | 全範囲、p=100、seed42、反復R=1 | 全124原ラベル・257ペア、0消費、R=1の分散/SD null |
| `zero-result.json` | 全範囲、p=0、seed42、反復R=1 | 正の比較基準に対する有効な空抽出 |
| `empty-result.json` | 2014/Plot3/Water/Round1、p=50、seed42、R=3 | CSVに行のないスコープ。試行なしで実施状態不明を保持 |

各`*-provenance.json`は対応する結果SHA-256、コード入力ハッシュ、実行日時・環境、データ来歴ハッシュとCC BY 4.0を持つ。数値本体には時刻・自己ハッシュを入れない。

R=100/1,000の自動テストは全試行を保持して実行・再実行する。巨大な全結果をGitへ重ねて保存する代わりに、固定チェックポイントは上記の小さいRを使う。APIは全R試行の正式JSONを生成でき、試行を間引く保存契約へ変更していない。

```bash
node scripts/simulation/verify-repeated.ts
```

通常は読み取り・再計算・照合のみ。コードを先にコミットした後に限り、`--write-verification`で固定ケースを更新して別コミットへ保存する。第8工程のコンポーネントはこれらの計算済み結果を受け取り、描画時にはシミュレーションを呼ばない。

Ellen Moss / Darren Evans (2022), _Climate change impacts on plant-pollinator interactions and functioning - experiment data_, version 1, [DOI](https://doi.org/10.25405/data.ncl.17430548.v1), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。行の非復元抽出と原ラベルのネットワーク・条件付き統計への加工。著者の承認を意味しない。訪花は受粉成功ではなく、英国から日本の草原の状態を断定しない。
