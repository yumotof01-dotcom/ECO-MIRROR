# アクセシビリティ・端末検証

Chromium 154.0.8037.57、Playwright 1.62.1、Linuxで確認。

- 320×568、390×844、768×1024、1024×768、1440×900、1920×1080 × 観測・比較・記録・研究情報・詳細条件の30条件。responsive-report.jsonでページ横溢れ0、axe対象規則の違反0、pageerror 0。
- 初回は研究情報と記録画面の小文字・見出し・表見出しのコントラスト不足を検出。暗い背景に対応した色へ修正し、全条件再実行で解消。記録リンクと詳細条件の操作ボタンも既存E2Eで再検査して修正。
- keyboard：スキップリンク、ラベル付き入力、実行button、ノードEnter/Space・矢印移動、＋/−/0、詳細のタブ、nativeノード選択、記録・保存導線。
- 詳細条件はnative dialog。Escape/閉じるで復帰し背面はinert。既存E2Eも実際の操作順として閉じてからナビへ移動するよう更新。
- 水滴の実行はEnterでも確認。比較URLの戻る・進むで表示と座標の維持を確認。
- Pointer Eventsでマウスドラッグ、CDPで2本指touchStart/touchMove/touchEndを実ブラウザへ送って拡大と選択抑止、1本指ドラッグを確認。これは実iPadや実指での検証ではない。
- prefers-reduced-motionではアニメーション・transitionを停止。強制カラー時は装飾背景を外し輪郭を維持。

実機iPad/Safari、VoiceOver/他スクリーンリーダー、利用者参加、OSの文字/画面拡大、低メモリ・長期背景復帰は未検証。axeの成功はWCAG全体の適合保証ではない。SVG関係図の詳細はHTMLの選択と説明でも確認できる。

再実行：npm run build後、ECO_QA_NODE_MODULES、ECO_MIRROR_BROWSER_PATH、ECO_AXE_PATHを指定して node scripts/observation/responsive.mjs。QAツールはプロジェクト外へ導入し依存lockを変更しない。出力は既定/tmp/eco-v2-audit。
