# 第12工程 最終記録の再取得（2026-10-22）

前回の未保存一時ファイルは復元せず、保存済み565c55aから実際に再実行した記録を保存する。原データ、数理コア、アプリ実装、依存lockは変更しない。アプリ版6695046、計算版a55e7e2。環境は environment.json。

## 実行手順

1. 完全履歴でcheckout、npm ci、npm run check。
2. cleanな状態で node scripts/release/build.mjs。manifestはdistの外に生成する。
3. Playwright、Chromium、axe-coreを検証環境に用意する。ECO_MIRROR_BROWSER_PATHを実行可能ブラウザへ、CODEX_PRIMARY_RUNTIME_NODE_MODULESをPlaywrightがインストールされたnode_modulesへ指定する。本アプリにテスト専用依存を追加しない。
4. ECO_MIRROR_AXE_PATHをaxe.min.jsへ、ECO_MIRROR_APPLICATION_QA_OUTPUTを一時出力ディレクトリへ指定し node scripts/application/e2e.mjs。巨大なJSONのダウンロード先は一時領域。正式ハッシュ・来歴・CSVを検査後、browser-report.jsonを本ディレクトリへ保存する。
5. Noto Sans CJK JPを検証環境に導入してから、ECO_USABILITY_OUTPUTを本ディレクトリのresponsiveへ指定し node scripts/usability/review.mjs。初回E2Eのフォント不足画像は視覚的合格の根拠にしない。
6. 一時自己署名TLS証明書を生成しECO_TLS_KEY/CERTへ指定、node scripts/release/static-smoke.mjs。鍵はコミットしない。
7. node scripts/release/interaction-smoke.mjs でキーボード操作・6回反復利用・URL/Worker寿命と保存JSONを照合。
8. node scripts/release/guards.mjs は使い捨てcloneでshallow/dirty拒否を検証する。

WebKitはダウンロードできたがOS共有ライブラリ不足で起動できなかった。webkit-launch.txtを参照。iPad/Safari、VoiceOver、低メモリ、長時間利用は未検証であり、Chromiumの合格で置き換えない。自己署名HTTPS検査は実ホストのTLS/CDNの検査ではない。

測定時間は共有Linux環境の実測値であり、以前の測定との差をコード最適化の成果と扱わない。画面への転送量と正式結果の保存量を区別する。全試行の結果は維持する。
