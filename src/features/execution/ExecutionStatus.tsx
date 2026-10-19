import { Link } from "react-router-dom";
import { useExecution } from "./ExecutionProvider";

export function ExecutionStatus() {
  const { state, cancel } = useExecution();
  if (state.status === "success" || state.status === "empty_scope") return null;
  const busy = state.status === "loading" || state.status === "running";
  return <section className={`execution-status status-${state.status}`} aria-label="計算の状態" aria-busy={busy}>
    <h2>{({ idle: "分析結果はまだありません。", loading: "実データを読み込んでいます。", running: "シミュレーションを計算しています。", error: "処理を完了できませんでした。", cancelled: "処理を中止しました。" } as Record<string, string>)[state.status]}</h2>
    <p role={state.status === "error" ? "alert" : "status"} aria-live="polite">{state.message}</p>
    {busy ? <><p>完了前の数値や推測の進捗率は表示しません。画面を移動しても処理は続きます。</p><button type="button" className="button button-outline" onClick={cancel}>計算を中止</button></> : <Link className="button button-primary" to="/simulation">観測条件を設定する</Link>}
    <p className="field-help">条件と結果はこのタブのメモリに保持します。再読み込み・タブを閉じると失われます。</p>
  </section>;
}
