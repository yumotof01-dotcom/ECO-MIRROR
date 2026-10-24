# Observation Interface V2：実データの森林観測空間と再現可能な比較・保存

観測条件を設定して実計算を行い、植物と昆虫の訪花関係を森林の観測空間で操作できるようにしました。参考画像は背景に流用せず、装飾用の独自SVG森林を用意しています。

## 実装
- ObservationInterface / Scene：観測・比較・記録モード、決定的な2D配置、検索、選択、Pointer Eventsのパン・ピンチ、キーボード操作。
- ForestBackground / DropletButton / OrganicDetailLayer：独立した森林、実行に接続した非対称水滴、検証済みペア重みから得た詳細。
- ObservationControls / Metrics：既存の厳密入力と成功時の値。全条件フォームはObservationConditionsへ保持。
- HomePage / SimulationPage / ResultsPage / AppLayoutを接続。既存結果画面はDetailedResultsへ保持し、StatisticsPanel、ExportPanel、NetworkComparisonを再利用。

## 科学計算への影響
原CSV・正規化・データ契約・数理コア・PCG32・Fraction・反復統計・正式RunResult・依存lockは不変です。Worker/ExecutionClient/Providerを再利用し、全試行をUIへ複製しません。訪花と受粉、未確認と消滅、原ラベルと確定種を区別します。

## 検証
npm ci / data:check / 316テスト / 型検査 / build / check。既存の固定単一・反復再現検証と保存結果のCLI全バイト照合。新UIの実ブラウザ検証はパン・ピンチ・比較・ノード・0/100・empty_scope・取消・失敗回復・保存・再実行を含みます。単一50%、R100、R1000の正式JSONハッシュは既存値と一致します。最終結果はdocs/design/implementation-report.mdと機械記録を参照してください。

## スクリーンショット
![デスクトップ比較](https://raw.githubusercontent.com/yumotof01-dotcom/ECO-MIRROR/feat/observation-interface-v2/docs/design/screenshots/comparison-desktop.png)
![ノード詳細](https://raw.githubusercontent.com/yumotof01-dotcom/ECO-MIRROR/feat/observation-interface-v2/docs/design/screenshots/node-detail.png)
![タブレット縦](https://raw.githubusercontent.com/yumotof01-dotcom/ECO-MIRROR/feat/observation-interface-v2/docs/design/screenshots/comparison-tablet-portrait.png)
![タブレット横](https://raw.githubusercontent.com/yumotof01-dotcom/ECO-MIRROR/feat/observation-interface-v2/docs/design/screenshots/comparison-tablet-landscape.png)
![スマートフォン](https://raw.githubusercontent.com/yumotof01-dotcom/ECO-MIRROR/feat/observation-interface-v2/docs/design/screenshots/comparison-phone.png)

## 制約
写真の森林・生物写真・高度な屈折表現は使用せず、様式化したベクトル森林です。実機iPad/Safari、VoiceOver、低メモリ・長期背景復帰は未検証です。自動アクセシビリティ検査はWCAG全体適合を保証しません。性能は共有環境の参考値です。

## PR #11との関係
baseはchore/phase-12-release-readiness。公開準備・ライセンス・配信ヘッダー・来歴付きbuild・E2E修正を継承し、UI差分を分離します。#11を無断マージしません。#11統合後に最新main・履歴・差分・CIを確認してbase変更を検討します。mainへの直接push、force push、アプリ公開は行っていません。
