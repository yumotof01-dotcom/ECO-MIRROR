# ECO MIRROR の採用データ

## 出典・利用条件

Ellen Moss and Darren Evans (2022), *Climate change impacts on plant-pollinator interactions and functioning - experiment data*, version 1. [大学保管版 DOI: 10.25405/data.ncl.17430548.v1](https://doi.org/10.25405/data.ncl.17430548.v1).

対象は `Raw_InteractionData_BothYears.csv`（大学保管ファイルID `34178859`）。[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) に従い、著者名・出典・版・ライセンス・変更内容を保持する。原CSVはバイト列を変更せず同梱。派生JSONには型変換、原レコード番号、識別子、原ラベル辞書、品質監査を追加した。行削除、分類名修正、推測補完は行っていない。著者によるECO MIRRORの推奨・承認を意味しない。データのライセンスを上流のRコードや本アプリ全体へ拡張しない。

## 配置

`raw/moss-evans-2022-flower-visits-v1/` に原CSV、取得情報 `source.json`、取得時の公式API応答 `archive-metadata.json` を保存する。CSVは `.gitattributes` の `-text` によりCRLF原本を保持する。

`processed/moss-evans-2022-flower-visits-v1/` の `events.json`・`taxa.json`・`quality.json` は決定的な派生データ。`artifacts.json` はそのハッシュ、`provenance.json` はコードのGitリビジョンと入出力・取得情報の対応。取得時刻はイベントには含めない。

## 再現・検証

```bash
npm ci
npm run data:fetch      # 既存原本があれば検証のみ。取得日時を更新しない
npm run data:check      # オフラインで全成果物・原本・来歴・Git内のバイトを検証
npm test
npm run build
```

変換を変更した場合は、コードを作業ブランチでコミットしてから `npm run data:normalize` を実行し、生成物を確認して別コミットに保存する。来歴に存在しないコミットや未コミットの処理を記載しない。詳細は [第4工程の実装仕様](../docs/data/cc-plant-pollinator/implementation.md)。

## 解釈の制約

英国の実験で観測された訪花の行であり、受粉成功・自然全体の関係・日本の再生草原の状態の証明ではない。20植物ラベル・104昆虫ラベルは確定種数ではない。同値行は保持する。15組の行なしは `no_record_effort_unknown` であり、確認済みの訪花0件へ変換しない。実施日・実績努力量・ブロック情報は不明のまま扱う。
