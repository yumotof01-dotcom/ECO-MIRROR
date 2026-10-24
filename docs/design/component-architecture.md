# UI・実行・計算の分離

| コンポーネント/関数 | 責務・再利用 |
| --- | --- |
| AppLayout / ForestBackground | 装飾SVG、ブランド、既存4ルートのリンク。装飾はaria-hidden・pointer-events:none |
| ObservationInterface | Providerの小さいstateを購読。URLモード、選択ID、詳細設定dialog。PRNG・集計エンジンなし |
| ObservationControls / ObservationDropletButton | SimulationDraftの文字列を維持。draftErrorsで検証して既存start/cancelへ接続 |
| ObservationConditions | 元SimulationPageのフォームを再利用。元の条件・検証・editを維持 |
| ObservationScene / scene-layout | adaptNetworkTrialView→VisualNode/VisualLink。基準IDから一度だけ決定的に座標生成 |
| scene-transform | ズーム・パン・ピンチの純粋な表示変換。計算状態と分離 |
| scene-adapter / OrganicDetailLayer | PairWeight由来の件数合算、相手、原ID、科学的限界。正式結果へ書き戻さない |
| ObservationMetrics | 現在の成功試行の値だけをformatFractionで表示。分子は抽出後、分母は比較基準 |
| DetailedResults | 元ResultsPageを保持。StatisticsPanel、ExportPanel、NetworkComparison、実行条件・来歴を再利用 |

Provider・client・protocol・Worker・データ契約・数理コアは変更しない。レイアウトと表示の状態はUI内。正式な実行入力・要求/操作ID・Blob寿命は既存実行層内。結果の非同期境界を新UIで再実装しない。
