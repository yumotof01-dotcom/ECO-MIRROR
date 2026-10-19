import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeading } from "../components/PageHeading";
import { useExecution } from "../features/execution/ExecutionProvider";
import { ExecutionStatus } from "../features/execution/ExecutionStatus";
import { ExportPanel } from "../features/execution/ExportPanel";
import { StatisticsPanel } from "../features/execution/StatisticsPanel";
import { count, formatFraction } from "../features/execution/format";
import { NetworkComparison } from "../features/visualization";
import type { NetworkTrialView } from "../features/visualization/adapter";

export function ResultsPage() {
  const { state, stale, rerun, selectTrial } = useExecution();
  const payload = state.payload, header = payload?.header, trial = payload?.trial;
  const view = useMemo<NetworkTrialView | null>(() => header && trial ? { kind: "network_trial_view", header, trial } : null, [header, trial]);
  return <div className="inner-page analysis-page">
    <PageHeading eyebrow="02 / 分析結果" title="見え方の違いを、読み解く。">選択範囲の全観測記録を比較基準に、残した記録から確認できる訪花関係を比較します。全記録も自然界の完全な真値ではありません。</PageHeading>
    <ExecutionStatus />
    {header && payload && ["success", "empty_scope"].includes(state.status) && <>
      <div className="result-toolbar"><span className={`small-tag ${payload.metadata.verification === "verified" ? "verified-tag" : "unverified-tag"}`}>{payload.metadata.verification === "verified" ? "データ・計算版・アプリ来歴を照合済み" : "開発用 · アプリ来歴未検証"}</span><button type="button" className="button button-outline" onClick={rerun}>この条件で再実行</button><Link className="text-link" to="/simulation">条件を変更</Link></div>
      {stale && <p className="stale-result" role="status">現在表示している結果は、以前の条件で計算されたものです。以下は実行時点の条件と結果です。</p>}
      {payload.metadata.reason && <p className="field-error">{payload.metadata.reason}</p>}
      <section className="scope-summary" aria-labelledby="scope-title"><h2 id="scope-title">この結果を計算した条件</h2><dl className="provenance-list"><dt>観測年</dt><dd>{header.selection.years.join("・")}年{header.scope.scope_mode === "pooled_records" ? "（両年の記録をまとめた抽出）" : ""}</dd><dt>調査区画</dt><dd>{header.selection.plot_ids.length === 24 ? "全24区画" : header.selection.plot_ids.map(p => `Plot ${p}`).join("、")}</dd><dt>実験条件</dt><dd>{header.selection.treatments.join("、")}</dd>{header.selection.years.map(year => <div className="provenance-row" key={year}><dt>{year}年のRound</dt><dd>{header.selection.rounds_by_year[year]!.join("、")}</dd></div>)}<dt>指定割合 / 実現割合</dt><dd>{header.sampling.rate_percent}% / {header.sampling.actual_record_pct ? `${formatFraction(header.sampling.actual_record_pct)}%` : "未定義（空スコープ）"}</dd><dt>モード・試行数・シード</dt><dd>{header.execution_mode === "single_trial" ? "単一試行" : "反復試行"} · {header.requested_repetitions}回 · seed {header.randomness.master_seed}</dd><dt>元記録の内訳</dt><dd>{header.scope.records_by_year.map(row => `${row.year}年 ${count(row.record_count)}件`).join(" / ")}、記録のある区画年 {header.scope.plot_year_count}組、年×区画×回 {header.scope.observation_group_count}組</dd></dl><p className="field-help">条件内で元記録がない調査単位は{header.scope.no_record_groups.length}組です。調査の未実施と、実施後の訪花0件をCSVだけでは区別できません。区画年を独立した実験反復とはみなしません。</p></section>
      {state.status === "empty_scope" ? <section className="execution-status" role="status"><h2>選択範囲に観測記録がありません。</h2><p>empty_scope：元CSVに条件と一致する行がないため、抽出試行・比較指標・ネットワークを生成していません。調査済みで訪花0件だったことを意味しません。</p><Link className="button button-primary" to="/simulation">条件を見直す</Link></section> : trial && view && header.reference && <>
        <section className="trial-summary" aria-labelledby="trial-title" aria-busy={state.pendingTrial !== null}><h2 id="trial-title">試行 {trial.trial_index} の結果</h2>{state.pendingTrial !== null && <p role="status">試行{state.pendingTrial}の計算済み結果を読み込んでいます。現在表示中の指標と図は試行{trial.trial_index}です。</p>}
          <dl className="analysis-metrics" aria-label="選択中の試行の主要指標">{[
            ["比較基準の訪花記録", `${count(header.reference.event_count)}件`], ["抽出後の訪花記録", `${count(trial.sample.event_count)}件`], ["全観測ペア", `${count(header.reference.pair_count)}組`], ["抽出後の観測ペア", `${count(trial.sample.pair_count)}組`], ["今回の抽出では未確認", `${count(trial.lost_pair_count)}組`], ["観測ペア保持率", `${formatFraction(trial.pair_retention_pct)}%`],
          ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          <p className="result-explanation">比較基準の{count(header.reference.event_count)}記録から{count(trial.sample.event_count)}記録を残しました。基準の{header.reference.pair_count}組の関係のうち、{trial.sample.pair_count}組を抽出後も確認し、{trial.lost_pair_count}組は今回の抽出では確認できませんでした。これは自然界での関係の消滅や、昆虫の個体数の減少を示すものではありません。</p>
          <p>抽出後の植物原ラベル {trial.sample.plant_label_count} / 基準{header.reference.plant_label_count}、昆虫原ラベル {trial.sample.visitor_label_count} / 基準{header.reference.visitor_label_count}。固定Connectance：{formatFraction(trial.sample.connectance_fixed, 6)}（分母は基準の両側ノード数の積）。</p>
        </section>
        {header.execution_mode === "repeated_trials" && header.summary && <><p className="result-explanation">同じ範囲と割合で{header.requested_repetitions}回抽出した観測ペア数は、最小{formatFraction(header.summary.pair_count.min, 0)}〜最大{formatFraction(header.summary.pair_count.max, 0)}組、平均{formatFraction(header.summary.pair_count.mean)}組でした。この幅は、この抽出モデルに条件付けられた記録のばらつきです。</p><StatisticsPanel summary={header.summary} values={payload.distribution} repetitions={header.requested_repetitions} /></>}
        {header.execution_mode === "single_trial" && <p className="field-help">単一試行のため反復統計はありません。反復モードR=1とは結果契約が異なります。</p>}
        <NetworkComparison result={view} trialIndex={trial.trial_index} onTrialChange={header.execution_mode === "repeated_trials" ? selectTrial : undefined} />
      </>}
      <ExportPanel />
      <details className="run-provenance"><summary>データ・仕様・実装の来歴を確認する</summary><dl className="provenance-list"><dt>データセットID</dt><dd><code>{header.data_identity.dataset_id}</code></dd><dt>大学保管版</dt><dd><a href={`https://doi.org/${header.data_identity.archive_doi}`}>{header.data_identity.archive_doi}</a></dd><dt>原CSV SHA-256</dt><dd><code>{header.data_identity.source_sha256}</code></dd><dt>正規化イベント SHA-256</dt><dd><code>{header.data_identity.normalized_events_sha256}</code></dd><dt>計算コードのGit版</dt><dd><code>{header.implementation_git_revision}</code></dd><dt>アプリのGit版</dt><dd><code>{payload.metadata.application_git_revision ?? "未検証"}</code></dd><dt>仕様版</dt><dd>{header.result_schema_version} / PCG-XSH-RR 64/32</dd></dl></details>
      <p className="result-limits">訪花は受粉成功の証明ではありません。原分類ラベルは確定種名とは限りません。英国実験の記録から日本の草原の状態を直接判断しません。割合は調査時間ではなく、反復分位範囲は生態系全体の信頼区間ではありません。</p>
    </>}
  </div>;
}
