import { useExecution } from "./ExecutionProvider";
import { count } from "./format";

export function ExportPanel() {
  const { state, prepareExport, cancel } = useExecution();
  const verified = state.payload?.metadata.verification === "verified";
  return <section className="export-panel" aria-labelledby="export-title"><h2 id="export-title">結果と再現情報を保存する</h2><p>正式JSONは全試行の原番号・重み・指標・厳密な統計を含みます。来歴JSONと一緒に保存してください。CSVは各試行の7指標を分子・分母付きで表す派生出力です。</p>
    {!verified && <p className="field-error">開発用の未検証スナップショットです。実装をコミットして再起動した版で再実行するまで、正式保存は利用できません。</p>}
    {state.exportStatus !== "ready" && <button type="button" className="button button-primary" disabled={!verified || state.exportStatus === "preparing"} onClick={prepareExport}>{state.exportStatus === "preparing" ? "保存ファイルを準備中…" : "保存ファイルを準備"}</button>}
    {state.exportStatus === "preparing" && <button type="button" className="button button-outline" onClick={cancel}>準備を中止して結果を破棄</button>}
    <p role={state.exportStatus === "error" ? "alert" : "status"} aria-live="polite">{state.exportMessage}</p>
    {state.urls && state.exportInfo && <><div className="download-actions"><a className="button button-primary" href={state.urls.result} download="run-result.json">正式JSONを保存</a><a className="button button-outline" href={state.urls.provenance} download="run-provenance.json">来歴JSONを保存</a><a className="button button-outline" href={state.urls.csv} download="trial-metrics.csv">試行別CSVを保存</a></div><dl className="provenance-list"><dt>正式JSONのサイズ</dt><dd>{count(state.exportInfo.result_bytes)} bytes</dd><dt>正式JSONのSHA-256</dt><dd><code>{state.exportInfo.result_sha256}</code></dd></dl><p className="field-help">保存リンクはブラウザのダウンロードを開始します。端末への保存完了・保存先はブラウザで確認してください。</p></>}
    <p className="field-help">1,000試行のJSONは約86MBになる場合があります。準備はWorker内で行いますが、端末の空きメモリが必要です。準備を中止するとWorker内の結果も破棄され、再実行が必要です。</p>
  </section>;
}
