import { useNavigate } from "react-router-dom";
import { useExecution } from "../execution/ExecutionProvider";
import { useSimulationDraft } from "../simulation/SimulationDraftContext";
import { draftErrors, isIntegerInRange } from "../simulation/model";
import { ObservationDropletButton } from "./ObservationDropletButton";
export function ObservationControls() {
  const { draft } = useSimulationDraft(),
    { state, edit, start } = useExecution(),
    navigate = useNavigate();
  const errors = draftErrors(draft),
    busy = state.status === "loading" || state.status === "running";
  const execute = () => {
    if (!busy && !errors.length) {
      start();
      navigate("/results");
    }
  };
  return (
    <section className="observation-controls" aria-label="抽出設定">
      <div className="control-rate">
        <label htmlFor="ob-rate">
          抽出割合 <output>{draft.observationRate}%</output>
        </label>
        <input
          id="ob-rate"
          aria-label="観測割合"
          type="range"
          min="0"
          max="100"
          step="1"
          value={draft.observationRate}
          onChange={(e) => edit({ observationRate: Number(e.target.value) })}
        />
        <p>元の記録から残す割合</p>
      </div>
      <ObservationDropletButton
        status={state.status}
        disabled={busy || errors.length > 0}
        onClick={execute}
      />
      <div className="control-numbers">
        <label>
          乱数シード
          <input
            type="text"
            inputMode="numeric"
            value={draft.seed}
            onChange={(e) => edit({ seed: e.target.value })}
            aria-invalid={!isIntegerInRange(draft.seed, 0, 4294967295)}
            aria-describedby="ob-input-help"
          />
        </label>
        <label>
          反復回数
          <input
            type="text"
            inputMode="numeric"
            value={draft.repetitions}
            disabled={draft.mode === "single_trial"}
            onChange={(e) => edit({ repetitions: e.target.value })}
            aria-invalid={
              draft.mode === "repeated_trials" &&
              !isIntegerInRange(draft.repetitions, 1, 1000)
            }
            aria-describedby="ob-input-help"
          />
        </label>
        <label className="mode-input">
          実行モード
          <select
            value={draft.mode}
            onChange={(e) =>
              edit({ mode: e.target.value as typeof draft.mode })
            }
          >
            <option value="single_trial">単一試行（1回）</option>
            <option value="repeated_trials">反復試行（R回）</option>
          </select>
        </label>
      </div>
      <p id="ob-input-help" className="ob-input-help">
        シードは0〜4,294,967,295、反復は1〜1,000の整数。再読み込みで条件・結果は失われます。
      </p>
      {errors.length > 0 && (
        <ul className="ob-errors" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
