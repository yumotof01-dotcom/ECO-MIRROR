# 第6工程の開発者用再現チェックポイント

`run-result.json`は大学保管v1の全3,882行を基準に、p=50、seed=42、t=0で実際に計算した単一試行。架空の手計算fixtureと異なる。原レコード番号の採用列・全重み・指標・正式な来歴識別子をコード検証のため保存する。画面へ接続・表示するデータではなく、ユーザー向けレポート出力機能でもない。

現行の計算リビジョン：`a55e7e2a86d2c9ac58de23fdbb2a0ae673ddb0b1`。本体SHA-256：`c7a9d45480d42834bdee569d94af0441b4e78a95e8d0452b552a63fcfb42fe45`。

工程7で実装識別子と別来歴を更新した。工程6の最終コミット`d349f3d0e608fd22b76551198360c661155660a4`に保存された元チェックポイント（計算リビジョン0823bc6、本体SHA-256 b10a059…）と、実装リビジョン以外の全フィールドが同一であることを自動テストで確認する。

`run-provenance.json`に本体ハッシュ、データ来歴ハッシュ、コード入力ハッシュ、実行日時・環境、出典・CC BY 4.0・加工表示を分離する。実行日時は本体を変えない。元CSVと元データ来歴を書き換えていない。

```bash
npm ci
node scripts/simulation/verify.ts
```

通常は照合だけで書き込みを行わない。実装を変更したときは先に作業ブランチへコミットし、`node scripts/simulation/verify.ts --write-verification`で固定検証記録を作り直してから、記録・文書を別コミットへ保存する。浅いGit履歴・未コミットの計算入力は拒否する。

Ellen Moss / Darren Evans (2022), _Climate change impacts on plant-pollinator interactions and functioning - experiment data_, version 1, [大学DOI](https://doi.org/10.25405/data.ncl.17430548.v1), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。加工は行の非復元抽出と原ラベルのネットワーク集計。著者の承認を意味しない。訪花は受粉成功ではなく、英国実験から日本の草原を判断せず、残す割合を実際の調査時間と同一視しない。
