import { Link, useNavigate } from "react-router-dom";
import { PageHeading } from "../../components/PageHeading";
import { useSimulationDraft } from "../simulation/SimulationDraftContext";
import { draftErrors, freshDraft, isIntegerInRange } from "../simulation/model";
import { useExecution } from "../execution/ExecutionProvider";
import { ExecutionStatus } from "../execution/ExecutionStatus";
import { ROUNDS, SOURCE, TREATMENTS } from "../data/contract";
import type { ObservationYear } from "../data/index";

const plots = Array.from({ length: 24 }, (_, i) => String(i + 1));
const toggle = <T,>(values: readonly T[], value: T) =>
  values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
export function ObservationConditions() {
  const { draft } = useSimulationDraft();
  const { state, edit, start, stale } = useExecution();
  const navigate = useNavigate(),
    errors = draftErrors(draft);
  const busy = state.status === "loading" || state.status === "running";
  const selection = draft.selection;
  const setYears = (years: ObservationYear[]) =>
    edit({
      selection: {
        ...selection,
        years,
        rounds_by_year: Object.fromEntries(
          years.map((year) => [
            year,
            selection.rounds_by_year[year] ?? [...ROUNDS[year]],
          ]),
        ),
      },
    });
  const seedValid = isIntegerInRange(draft.seed, 0, 4294967295),
    repetitionsValid = isIntegerInRange(draft.repetitions, 1, 1000);
  return (
    <div className="inner-page simulation-page">
      <PageHeading eyebrow="01 / 観測条件" title="観測条件を、組み立てる。">
        英国の訪花記録から、どの範囲の記録を何%残すかを選びます。残す記録の割合は、実際の調査時間や昆虫の個体数を示しません。
      </PageHeading>
      <div className="lab-layout">
        <form
          className="lab-panel"
          aria-label="観測条件"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!errors.length && !busy) {
              start();
              navigate("/results");
            }
          }}
        >
          <div className="panel-heading">
            <h2>計算する条件</h2>
            <span className="small-tag">実データ · 3,882記録</span>
          </div>
          <div className="form-section">
            <label htmlFor="dataset">使用するデータセット</label>
            <select
              id="dataset"
              aria-describedby="dataset-help"
              value={SOURCE.dataset_id}
              onChange={() => {}}
            >
              <option value={SOURCE.dataset_id}>
                Moss & Evans (2022) · 英国の実験データ
              </option>
            </select>
            <p id="dataset-help" className="field-help">
              大学保管v1 / CC BY 4.0。計算時に版とハッシュを検証します。
            </p>
          </div>
          <fieldset className="form-section choice-section">
            <legend>観測年</legend>
            <div className="choice-row">
              {(
                [
                  {
                    value: "both",
                    label: "両方（2014・2015年）",
                    years: [2014, 2015],
                  },
                  { value: "2014", label: "2014年", years: [2014] },
                  { value: "2015", label: "2015年", years: [2015] },
                ] as const
              ).map((option) => (
                <label key={option.value}>
                  <input
                    type="radio"
                    name="years"
                    value={option.value}
                    checked={
                      selection.years.join(",") === option.years.join(",")
                    }
                    onChange={() => setYears([...option.years])}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="form-section choice-section">
            <legend>調査区画（{selection.plot_ids.length} / 24選択）</legend>
            <div className="choice-actions">
              <button
                type="button"
                onClick={() =>
                  edit({ selection: { ...selection, plot_ids: plots } })
                }
              >
                全区画を選択
              </button>
              <button
                type="button"
                onClick={() =>
                  edit({ selection: { ...selection, plot_ids: [] } })
                }
              >
                全区画を解除
              </button>
            </div>
            <div className="plot-choices">
              {plots.map((plot) => (
                <label key={plot}>
                  <input
                    type="checkbox"
                    checked={selection.plot_ids.includes(plot)}
                    onChange={() =>
                      edit({
                        selection: {
                          ...selection,
                          plot_ids: toggle(selection.plot_ids, plot),
                        },
                      })
                    }
                  />
                  Plot {plot}
                </label>
              ))}
            </div>
            {!selection.plot_ids.length && (
              <p className="field-error">調査区画を1つ以上選択してください。</p>
            )}
          </fieldset>
          <fieldset className="form-section choice-section">
            <legend>実験条件</legend>
            <div className="choice-row">
              {TREATMENTS.map((treatment) => (
                <label key={treatment}>
                  <input
                    type="checkbox"
                    checked={selection.treatments.includes(treatment)}
                    onChange={() =>
                      edit({
                        selection: {
                          ...selection,
                          treatments: toggle(selection.treatments, treatment),
                        },
                      })
                    }
                  />
                  {treatment}
                </label>
              ))}
            </div>
            <p className="field-help">
              Control：対照、Heat：加温、Water：水処理、Heat+Water：両処理。元区画の属性で絞り込み、処理を割り当て直す機能ではありません。
            </p>
          </fieldset>
          {selection.years.map((year) => (
            <fieldset key={year} className="form-section choice-section">
              <legend>{year}年の調査回（Round）</legend>
              <div className="choice-actions">
                <button
                  type="button"
                  onClick={() =>
                    edit({
                      selection: {
                        ...selection,
                        rounds_by_year: {
                          ...selection.rounds_by_year,
                          [year]: [...ROUNDS[year]],
                        },
                      },
                    })
                  }
                >
                  {year}年の全調査回を選択
                </button>
                <button
                  type="button"
                  onClick={() =>
                    edit({
                      selection: {
                        ...selection,
                        rounds_by_year: {
                          ...selection.rounds_by_year,
                          [year]: [],
                        },
                      },
                    })
                  }
                >
                  {year}年の調査回を解除
                </button>
              </div>
              <div className="choice-row">
                {ROUNDS[year].map((round) => (
                  <label key={round}>
                    <input
                      type="checkbox"
                      aria-label={`${year}年 Round ${round}`}
                      checked={selection.rounds_by_year[year]!.includes(round)}
                      onChange={() =>
                        edit({
                          selection: {
                            ...selection,
                            rounds_by_year: {
                              ...selection.rounds_by_year,
                              [year]: toggle(
                                selection.rounds_by_year[year]!,
                                round,
                              ),
                            },
                          },
                        })
                      }
                    />
                    Round {round}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <p className="field-help">
            年別の元ラベルを使います。Roundを日付や等間隔の時間軸とみなしません。異なる項目間はAND、同じ項目内はORで絞り込みます。
          </p>
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
              min="0"
              max="100"
              step="1"
              value={draft.observationRate}
              onChange={(event) =>
                edit({ observationRate: Number(event.target.value) })
              }
              aria-describedby="rate-help"
            />
            <div className="range-limits" aria-hidden="true">
              <span>0%</span>
              <span>100%</span>
            </div>
            <p id="rate-help" className="field-help">
              0%は基準の記録を残さない正常な空抽出、100%は選択範囲の全記録を残します。小さい範囲では丸め後の実現割合が指定値と異なるため、結果に両方を表示します。
            </p>
          </div>
          <fieldset className="form-section choice-section">
            <legend>実行モード</legend>
            <div className="choice-row">
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={draft.mode === "single_trial"}
                  onChange={() => edit({ mode: "single_trial" })}
                />
                単一試行（1回）
              </label>
              <label>
                <input
                  type="radio"
                  name="mode"
                  checked={draft.mode === "repeated_trials"}
                  onChange={() => edit({ mode: "repeated_trials" })}
                />
                反復試行（R回）
              </label>
            </div>
            <p className="field-help">
              反復は同じ元記録から繰り返し抽出し、見える関係のばらつきを調べます。反復R=1ではサマリーを作りますが、標本分散・標準偏差は定義されません。
            </p>
          </fieldset>
          <div className="form-section execution-numbers">
            <div>
              <label htmlFor="repetitions">反復回数</label>
              <input
                id="repetitions"
                type="text"
                inputMode="numeric"
                value={draft.repetitions}
                disabled={draft.mode === "single_trial"}
                onChange={(event) => edit({ repetitions: event.target.value })}
                aria-invalid={
                  draft.mode === "repeated_trials" && !repetitionsValid
                }
                aria-describedby="repetitions-help"
              />
              <p
                id="repetitions-help"
                className={
                  repetitionsValid || draft.mode === "single_trial"
                    ? "field-help"
                    : "field-error"
                }
              >
                1〜1,000の整数。1,000回は全試行の保存で大きいファイルとメモリを使います。回数は自動変更しません。
              </p>
            </div>
            <div>
              <label htmlFor="seed">乱数シード</label>
              <input
                id="seed"
                type="text"
                inputMode="numeric"
                value={draft.seed}
                onChange={(event) => edit({ seed: event.target.value })}
                aria-invalid={!seedValid}
                aria-describedby="seed-help"
              />
              <p
                id="seed-help"
                className={seedValid ? "field-help" : "field-error"}
              >
                同じデータ・条件・計算版で同じ抽出を再現するための番号です。0〜4,294,967,295の整数。空白・小数・指数表記は使えません。先頭0は同じ数値のシードとして扱います。
              </p>
            </div>
          </div>
          {errors.length > 0 && (
            <div className="input-errors" role="alert">
              <p>実行前に確認してください。</p>
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {stale && (
            <p className="stale-result" role="status">
              以前の条件の結果があります。現在の条件ではまだ実行していません。
            </p>
          )}
          <div className="form-actions">
            <button
              type="submit"
              className="button button-primary"
              disabled={errors.length > 0 || busy}
            >
              シミュレーションを実行
            </button>
            <button
              type="button"
              className="reset-button"
              onClick={() => edit(freshDraft())}
            >
              初期値に戻す
            </button>
          </div>
          <p className="draft-note">
            条件と結果はページ移動後も保持します。再読み込みやタブを閉じると失われます。処理中に条件を変更すると、その処理を中止します。
          </p>
        </form>
        <aside className="lab-sidebar">
          <div className="sidebar-note">
            <h2>記録の不足と、自然の変化を分ける。</h2>
            <p>
              抽出で見えなくなった関係が、自然界で消滅したとは限りません。訪花は受粉成功の証明ではなく、原ラベル数は確定種数ではありません。
            </p>
            <Link className="text-link" to="/research">
              出典と科学的な注意事項
            </Link>
          </div>
          <ExecutionStatus />
          <Link className="text-link" to="/results">
            現在の計算状態・結果を見る
          </Link>
        </aside>
      </div>
    </div>
  );
}
