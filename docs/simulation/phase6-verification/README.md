# 第6工程の開発者用再現チェックポイント

`run-result.json`は大学保管v1の全3,882行を基準に、p=50、seed=42、t=0で実際に計算した単一試行。架空の手計算fixtureと異なる。原レコード番号の採用列・全重み・指標・正式な来歴識別子をコード検証のため保存する。画面へ接続・表示するデータではなく、ユーザー向けレポート出力機能でもない。

計算リビジョン：`0823bc6a278c948cacffbfd2463783083e21fad5`。本体SHA-256：`b10a059e4185c1797b11e8d15bef824abe6971ec7921e30398b8d67883fa9373`。

`run-provenance.json`に本体ハッシュ、データ来歴ハッシュ、コード入力ハッシュ、実行日時・環境、出典・CC BY 4.0・加工表示を分離する。実行日時は本体を変えない。元CSVと元データ来歴を書き換えていない。

```bash
npm ci
node scripts/simulation/verify.ts
```

通常は照合だけで書き込みを行わない。実装を変更したときは先に作業ブランチへコミットし、`node scripts/simulation/verify.ts --write-verification`で固定検証記録を作り直してから、記録・文書を別コミットへ保存する。浅いGit履歴・未コミットの計算入力は拒否する。

Ellen Moss / Darren Evans (2022), _Climate change impacts on plant-pollinator interactions and functioning - experiment data_, version 1, [大学DOI](https://doi.org/10.25405/data.ncl.17430548.v1), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。加工は行の非復元抽出と原ラベルのネットワーク集計。著者の承認を意味しない。訪花は受粉成功ではなく、英国実験から日本の草原を判断せず、残す割合を実際の調査時間と同一視しない。
