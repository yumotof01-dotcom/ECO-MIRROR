import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useExecution } from "../execution/ExecutionProvider";
import { ExecutionStatus } from "../execution/ExecutionStatus";
import { adaptNetworkTrialView } from "../visualization/adapter";
import type { ComparisonData } from "../visualization/adapter";
import { DetailedResults } from "../../pages/DetailedResults";
import { ObservationConditions } from "./ObservationConditions";
import { ObservationControls } from "./ObservationControls";
import { ObservationMetrics } from "./ObservationMetrics";
import { ObservationScene } from "./ObservationScene";
import type { ComparisonMode } from "./ObservationScene";
import { OrganicDetailLayer } from "./OrganicDetailLayer";

export function ObservationInterface({
  settings = false,
}: {
  settings?: boolean;
}) {
  const { state, stale, selectTrial, rerun } = useExecution(),
    [selected, setSelected] = useState<string | null>(null),
    [searchParams, setSearchParams] = useSearchParams(),
    location = useLocation(),
    navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const records = searchParams.get("mode") === "records",
    comparison = location.pathname === "/results" && !records;
  const mode = (
    ["reference", "sample", "difference"].includes(
      searchParams.get("view") ?? "",
    )
      ? searchParams.get("view")
      : "sample"
  ) as ComparisonMode;
  const data = useMemo<{
    data: ComparisonData | null;
    error: string | null;
  }>(() => {
    if (state.status !== "success" || !state.payload?.trial)
      return { data: null, error: null };
    try {
      const view = adaptNetworkTrialView(
        {
          kind: "network_trial_view",
          header: state.payload.header,
          trial: state.payload.trial,
        },
        state.payload.trial.trial_index,
      );
      return { data: view.status === "success" ? view : null, error: null };
    } catch (e) {
      return {
        data: null,
        error: `ネットワークを表示できません：${String(e)}`,
      };
    }
  }, [state.payload, state.status]);
  const node = data.data?.nodes.find((n) => n.id === selected);
  useEffect(() => {
    if (settings && dialog.current) {
      if (typeof dialog.current.showModal === "function")
        dialog.current.showModal();
      else dialog.current.setAttribute("open", "");
    }
  }, [settings]);
  const closeSettings = () => navigate(state.payload ? "/results" : "/");
  return (
    <div className={`observation-interface ${records ? "records-mode" : ""}`}>
      <nav className="observation-navigation" aria-label="観測モード">
        <Link
          to="/"
          aria-current={!comparison && !records ? "page" : undefined}
        >
          <span aria-hidden="true">◇</span>観測
        </Link>
        <Link to="/results" aria-current={comparison ? "page" : undefined}>
          <span aria-hidden="true">◉</span>比較
        </Link>
        <Link
          to="/results?mode=records"
          aria-current={records ? "page" : undefined}
        >
          <span aria-hidden="true">⁙</span>記録
        </Link>
      </nav>
      {records ? (
        <div className="observation-records">
          <p className="ob-eyebrow">
            現在の実行の記録 · 過去の履歴ではありません
          </p>
          <DetailedResults />
        </div>
      ) : (
        <>
          <div className="observation-topline">
            <div>
              <p className="ob-eyebrow">
                OBSERVATION INTERFACE / 英国の訪花記録
              </p>
              <h1>
                {state.status === "success"
                  ? "記録のつながりを、観る。"
                  : "森の記録に、近づく。"}
              </h1>
            </div>
            <p className="ob-dataset">
              Moss & Evans (2022)
              <br />
              <span>大学保管 v1 · CC BY 4.0 · 追加データセット未対応</span>
            </p>
          </div>
          {stale && (
            <p className="ob-stale" role="status">
              現在表示している結果は、以前の条件で計算されたものです。入力条件を変えても結果は変わりません。
              <button onClick={rerun}>この条件で再実行</button>
            </p>
          )}
          {state.payload && (
            <p className="ob-run-context" aria-label="実行条件の要約">
              {state.payload.header.selection.years.join("・")}年 ·{" "}
              {state.payload.header.selection.plot_ids.length}区画 · 指定
              {state.payload.header.sampling.rate_percent}% · seed{" "}
              {state.payload.header.randomness.master_seed} ·{" "}
              {state.payload.header.requested_repetitions}試行 /{" "}
              {state.payload.metadata.verification === "verified"
                ? "来歴照合済み"
                : "開発用 · アプリ来歴未検証"}
            </p>
          )}
          {comparison && (
            <div
              className="comparison-switch"
              role="group"
              aria-label="比較する記録"
            >
              {(
                [
                  ["reference", "全観測"],
                  ["sample", "抽出後"],
                  ["difference", "差分"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={mode === value}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("view", value);
                    setSearchParams(next);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="observation-space">
            {data.error ? (
              <p role="alert">{data.error}</p>
            ) : data.data ? (
              <>
                <div className="scene-trial">
                  <label>
                    表示する試行番号
                    <select
                      value={state.payload!.trial!.trial_index}
                      onChange={(e) => selectTrial(Number(e.target.value))}
                    >
                      {data.data.trialIndices.map((i) => (
                        <option key={i} value={i}>
                          試行 {i}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span>
                    試行 {state.payload!.trial!.trial_index} の結果
                    {state.pendingTrial !== null
                      ? `（試行${state.pendingTrial}読込中）`
                      : ""}
                  </span>
                </div>
                <ObservationScene
                  data={data.data}
                  selected={selected}
                  onSelect={setSelected}
                  mode={comparison ? mode : "sample"}
                />
                {node && (
                  <OrganicDetailLayer
                    data={data.data}
                    node={node}
                    onSelect={setSelected}
                    onClose={() => {
                      setSelected(null);
                      document
                        .querySelector<SVGElement>(
                          '[data-scene-node][tabindex="0"]',
                        )
                        ?.focus();
                    }}
                  />
                )}
              </>
            ) : state.status === "empty_scope" ? (
              <section className="ob-empty" role="status">
                <p className="ob-eyebrow">EMPTY SCOPE</p>
                <h2>選択範囲に観測記録がありません。</h2>
                <p>
                  元CSVに条件と一致する行がありません。調査済みで訪花0件だったことを意味しません。
                </p>
                <Link to="/simulation">観測条件を見直す →</Link>
                <Link to="/results?mode=records">
                  空スコープの正式記録を保存する →
                </Link>
              </section>
            ) : state.status === "idle" ? (
              <section className="ob-welcome">
                <span className="welcome-leaf" aria-hidden="true">
                  ◇
                </span>
                <p className="ob-eyebrow">見えなかった、つながりを見つける</p>
                <h2>
                  見えている自然が、
                  <br />
                  すべてとは限らない。
                </h2>
                <p>
                  残す記録の量を変えると、
                  <br />
                  植物と昆虫の関係はどう見えるだろう。
                </p>
                <p className="welcome-note">分析結果はまだありません。</p>
                <p className="welcome-note">
                  まだ実行していません。架空のネットワークは表示しません。
                  <br />
                  下の水滴から、実データの観測を始めてください。
                </p>
                <Link to="/simulation">
                  シミュレーションを始める · 詳細条件 →
                </Link>
              </section>
            ) : (
              <div className="ob-status">
                <ExecutionStatus />
              </div>
            )}
          </div>
          {!settings && <ObservationControls />}
          <ObservationMetrics
            payload={state.status === "success" ? state.payload : null}
          />
          <p className="ob-science">
            下部の数値は抽出後 /
            比較基準。固定Connectanceの分母は基準の植物×昆虫原ラベル数。全観測は自然界の完全な真値ではありません。訪花
            ≠ 受粉成功。未確認 ≠ 消滅。原ラベル ≠
            確定種。背景は装飾用の独自SVGです。
          </p>
        </>
      )}
      {settings && (
        <dialog
          ref={dialog}
          className="ob-settings"
          aria-label="観測条件の詳細設定"
          onCancel={(e) => {
            e.preventDefault();
            closeSettings();
          }}
        >
          <button autoFocus className="settings-close" onClick={closeSettings}>
            条件設定を閉じる ×
          </button>
          <ObservationConditions />
        </dialog>
      )}
    </div>
  );
}
