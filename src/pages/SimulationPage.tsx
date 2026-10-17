import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { useSimulationDraft } from "../features/simulation/SimulationDraftContext";
import { isIntegerInRange } from "../features/simulation/model";

export function SimulationPage() {
  const { draft, setDraft, resetDraft } = useSimulationDraft();
  const repetitionsValid = isIntegerInRange(draft.repetitions, 1, 1000);
  const seedValid = isIntegerInRange(draft.seed, 0, 4294967295);

  return (
    <div className="inner-page">
      <PageHeading
        eyebrow="01 / OBSERVATION LAB"
        title="観測条件を、組み立てる。"
      >
        何を、どれだけ観測するか。まずは条件の下書きから。
        <br />
        この画面では条件を入力できますが、計算はまだ実行できません。
      </PageHeading>
      <div className="lab-layout">
        <form
          className="lab-panel"
          onSubmit={(event) => event.preventDefault()}
          aria-label="観測条件の下書き"
        >
          <div className="panel-heading">
            <h2>観測条件</h2>
            <span className="small-tag">下書き</span>
          </div>
          <div className="form-section">
            <label htmlFor="dataset">使用するデータセット</label>
            <select id="dataset" disabled aria-describedby="dataset-help">
              <option>公開データは未接続です</option>
            </select>
            <p id="dataset-help" className="field-help">
              出典・利用条件を確認したデータを、今後の工程で追加します。
            </p>
          </div>
          <div className="form-section">
            <div className="range-label">
              <label htmlFor="observation-rate">観測割合</label>
              <output htmlFor="observation-rate">
                {draft.observationRate}
                <span>%</span>
              </output>
            </div>
            <input
              id="observation-rate"
              type="range"
              min="1"
              max="100"
              step="1"
              value={draft.observationRate}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  observationRate: Number(event.target.value),
                })
              }
              aria-describedby="rate-help"
            />
            <div className="range-limits" aria-hidden="true">
              <span>1%</span>
              <span>100%</span>
            </div>
            <p id="rate-help" className="field-help">
              記録からどれだけを抽出するかの設定案です。実際の観測時間や検出率を示す値ではありません。
            </p>
          </div>
          <div className="form-section grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="repetitions">反復回数</label>
              <input
                id="repetitions"
                type="number"
                inputMode="numeric"
                min="1"
                max="1000"
                step="1"
                value={draft.repetitions}
                onChange={(event) =>
                  setDraft({ ...draft, repetitions: event.target.value })
                }
                aria-invalid={!repetitionsValid}
                aria-describedby="repetitions-help"
              />
              <p
                id="repetitions-help"
                className={repetitionsValid ? "field-help" : "field-error"}
              >
                {repetitionsValid
                  ? "条件を繰り返す回数の設定案（1〜1,000）。"
                  : "1〜1,000の整数を入力してください。"}
              </p>
            </div>
            <div>
              <label htmlFor="seed">乱数シード</label>
              <input
                id="seed"
                type="number"
                inputMode="numeric"
                min="0"
                max="4294967295"
                step="1"
                value={draft.seed}
                onChange={(event) =>
                  setDraft({ ...draft, seed: event.target.value })
                }
                aria-invalid={!seedValid}
                aria-describedby="seed-help"
              />
              <p
                id="seed-help"
                className={seedValid ? "field-help" : "field-error"}
              >
                {seedValid
                  ? "再現用の設定案（0〜4,294,967,295）。"
                  : "0〜4,294,967,295の整数を入力してください。"}
              </p>
            </div>
          </div>
          <p className="draft-note">
            入力内容は画面を移動しても保持されます。再読み込みすると初期値に戻ります。
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="button button-primary"
              disabled
              aria-describedby="run-reason"
            >
              シミュレーションを実行
              <Icon name="arrow" />
            </button>
            <button type="button" className="reset-button" onClick={resetDraft}>
              <Icon name="reset" width="17" height="17" />
              初期値に戻す
            </button>
          </div>
          <p id="run-reason" className="field-help">
            公開データと計算機能が未実装のため、実行できません。
          </p>
        </form>
        <aside className="lab-sidebar">
          <div className="sidebar-note">
            <span className="eyebrow">BEFORE YOU BEGIN</span>
            <h2>
              観測条件と、
              <br />
              自然の状態を分ける。
            </h2>
            <p>
              観測を少なくすることと、生物が実際に減ることは異なります。この違いを確かめるための場を目指しています。
            </p>
            <Link className="text-link" to="/research">
              科学的な注意事項
              <Icon name="arrow" />
            </Link>
          </div>
          <div className="quiet-note">
            <Icon name="info" />
            <p>
              数値は条件の初期設定です。分析結果や、推奨する調査量を表していません。
            </p>
          </div>
          <Link className="text-link" to="/results">
            分析結果の画面を見る
            <Icon name="arrow" />
          </Link>
        </aside>
      </div>
    </div>
  );
}
