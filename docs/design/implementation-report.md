# Observation Interface V2 実装・検証報告

## 総合判定

アプリ実装とローカル必須検証は成功。ただしP0のPR作成がGitHub APIアクセスで阻止されているため、要求全体としては未完了。新規PR/CIの成功を主張しない。

## 範囲
PR #11 head 88afaffを継承。独自SVGの森林、空間ネットワーク、比較、記録、詳細レイヤー、水滴button、既存入力/実行/統計/出力の統合。写真・和名・未知の関係は補完しない。旧作業場所には触れない。

## 実装の主な対応
AppLayoutを全画面シェルへ変更。HomePage/SimulationPage/ResultsPageからObservationInterfaceへ接続。元の条件フォームをObservationConditions、元結果画面をDetailedResultsへ保持。ForestBackground、ObservationScene、scene-layout/transform/adapter、OrganicDetailLayer、ObservationControls/DropletButton/Metricsを追加。

## 科学・保存の不変性
原CSV/正規化・データ契約・計算コア・規範仕様・package/lockの差分なし。既存Worker/ExecutionClient/Provider/protocol/StatisticsPanel/ExportPanelを保持する。単一50%・seed42は1941記録/183ペア/未確認74。正式JSONの単一・R100・R1000は既存ハッシュ一致。nodeDetailは表示用の重み合計のみ。

## 現在確認できた結果
- npm ci、data:check成功。
- 24ファイル316テスト成功、型検査/本番build/総合check成功。
- 単一/反復の固定再現検証成功。ブラウザ保存の単一/R100はCLIでも全バイト一致。
- 新UI E2E：7実行、Enterでの実行、ブラウザの戻る/進む、1本指ドラッグ、比較・検索・詳細・マウスパン・CDPピンチ・キーボードズーム・0/100・empty_scope・取消・ネットワーク障害回復・JSON/来歴/CSV成功。
- 詳細条件を含む30画面条件で横溢れ0/axe対象違反0。既存フルE2Eも13実行・アクセシビリティ違反0で成功。HMR/未コミット時の正式保存拒否と復元も確認。

## 調査中に修正した点
新UIのテスト検索オプションの型エラー、モード変更に伴う旧UIテストの経路、selectのアクセシブル名、React更新前にポインター差分を確定しないパン不具合、暗い面での文字/操作部のコントラストを修正。アサーションや来歴検証を無効化していない。native modalを閉じてからナビへ進むよう既存E2Eの操作経路を更新。

## 制約と未完了
- P0：GitHub APIのForbiddenでPR作成が未完了。Git pushは成功。api.github.comの許可追加は環境設定下書きへ保存したが、ランタイム反映は未確認。
- P1：写真ではなく独自のベクトル森林であり、参考画像の写真素材・生物写真・高度な屈折の品質とは異なる。
- 実機iPad/Safari・VoiceOver・低メモリ・長期背景復帰は未検証。自動Chromiumタッチ操作を実機検証と呼ばない。
- 既存PRのマージ・アプリの公開は行っていない。今回の機能実装はPR/CIを含む最終確認が必要。作成予定PRの本文はpull-request.md。baseはchore/phase-12-release-readiness、headはfeat/observation-interface-v2。

## 証跡
browser-report.json、legacy-browser-report.json、responsive-report.json、accessibility-validation.md、performance-validation.md。screenshots/に変更前、デスクトップ、タブレット縦横、スマートフォン、ノード詳細、記録画面を保存。これらは実ブラウザ画像であり参考画像の加工ではない。機械記録の画像/ダウンロード名は実行時artifact_directory内の名前。選択した画像のみscreenshots/へ保存し、86MBの正式JSONはGitへ追加しない。


## 再現コマンド

```sh
npm ci
npm run data:check
npm test
npm run build
npm run check
node scripts/simulation/verify.ts
node scripts/simulation/verify-repeated.ts
node scripts/release/build.mjs
ECO_QA_NODE_MODULES=/tmp/eco-audit-qa/node_modules ECO_MIRROR_BROWSER_PATH=/usr/bin/chromium node scripts/observation/e2e.mjs
ECO_QA_NODE_MODULES=/tmp/eco-audit-qa/node_modules ECO_MIRROR_BROWSER_PATH=/usr/bin/chromium ECO_AXE_PATH=/tmp/eco-audit-qa/node_modules/axe-core/axe.min.js node scripts/observation/responsive.mjs
```

Playwright/axeはQA専用にプロジェクト外へ導入。既存のscripts/application/e2e.mjsはHMR用にCSSを一時変更して戻すため、コード編集や厳密なread-only監査と並行しない。release buildは未コミット資料があるとRELEASE_DIRTYで拒否する。今回も一度その拒否を確認し、資料をコミットしてから再実行して成功した。保護を無効化しない。
