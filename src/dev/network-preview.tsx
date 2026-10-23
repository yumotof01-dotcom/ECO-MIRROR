import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { RunResult } from "../features/simulation/core/types";
import { NetworkComparison } from "../features/visualization/index";
import half from "../../docs/simulation/phase7-verification/half-result.json";
import full from "../../docs/simulation/phase7-verification/full-result.json";
import zero from "../../docs/simulation/phase7-verification/zero-result.json";
import empty from "../../docs/simulation/phase7-verification/empty-result.json";
import "./preview.css";

// Only actual phase-7 calculation checkpoints. The preview never imports an engine.
const cases = { half, full, zero, empty } as unknown as Record<string, RunResult>;
function Preview() {
  const [scenario, setScenario] = useState("half");
  const [trial, setTrial] = useState(0);
  return <main className="em-preview">
    <header><h1><a className="em-brand" href="/">ECO MIRROR<span>OBSERVATION & RELATIONSHIPS</span></a></h1><span className="em-dev-badge">第8工程 · 開発者プレビュー</span></header>
    <div className="em-preview-source"><p>実データで計算済みの結果を表示しています。ここではシミュレーションを実行しません。</p><label htmlFor="preview-case">検証する保存済み結果<select id="preview-case" value={scenario} onChange={e => { setScenario(e.target.value); setTrial(0); }}><option value="half">全3,882記録から50%抽出 · 3試行</option><option value="full">100%抽出 · 1試行</option><option value="zero">0%抽出 · 有効な空抽出</option><option value="empty">記録なし · empty_scope</option></select></label></div>
    <NetworkComparison key={scenario} result={cases[scenario]} trialIndex={trial} onTrialChange={setTrial} />
    <footer><p>Ellen Moss / Darren Evans (2022), <cite>Climate change impacts on plant-pollinator interactions and functioning - experiment data</cite>, version 1. <a href="https://doi.org/10.25405/data.ncl.17430548.v1">大学保管版</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>。</p><p>加工：原ラベルを保持した記録の非復元抽出とネットワーク集計・比較描画。著者の承認を意味しません。英国の実験データであり、日本の再生草原の状態を直接示すものではありません。反復は未来予測ではありません。</p><p>通常アプリは第9工程で実データ・実行・結果・保存へ接続済みです。このページは計算済み結果の独立した開発確認用で、一般公開・デプロイは行いません。</p></footer>
  </main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Preview /></StrictMode>);
