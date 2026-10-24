# Observation Interface V2

## 目的と基盤
森林の中にある観測装置を表現する。参考画像のUI・生物・数値は流用しない。PR #11（88afaff）の公開準備を継承した feat/observation-interface-v2。mainへのpush・既存PRマージ・アプリ公開は行わない。

## ルートとモード
- `/`：観測空間。起動時は未実行で、装飾以外のノード・指標を作らない。
- `/simulation`：同じ空間の上にnative dialogで詳細条件フォーム。元の年・Plot・Treatment・年別Roundと厳密入力をすべて維持。
- `/results`：比較空間。`view=reference|sample|difference`で全観測・抽出後・差分。URLの戻る・進むに対応。
- `/results?mode=records`：現在の実行の記録。既存の条件要約・統計・厳密二部図・正式保存・来歴を維持。過去の履歴ではない。
- `/research`・404：既存の科学的根拠と復帰導線を維持。

## 不変条件
計算は既存ExecutionProvider→ExecutionClient→Worker→計算コアを使用。シーンは検証済みadaptNetworkTrialViewの結果だけを受け取る。原データ・正規化・PCG32・Fraction・統計・正式RunResultを変えない。
全基準ノード・ペアは図に保持。差分は抽出後0の基準ペアを示し、消滅とは呼ばない。0%成功・empty_scope・未実行・失敗・取消を区別する。1,000試行をReactへ全コピーしない。

## 範囲
写真の森林や生物写真は使用しない。出典と分類対応が確認できる画像がないため独自SVGを採用。参考画像の写真表現、立体的な生物、屈折表現との視覚的な差は残る。架空の和名や写真を追加しない。
