import { memo, useId, useMemo } from "react";
import type { MetricKey, RepetitionSummary, Fraction } from "../simulation/core/types";
import type { DistributionValue } from "./protocol";
import { histogram } from "./histogram";
import { formatFraction, formatSqrt } from "./format";

const labels: Record<MetricKey, string> = { event_count: "抽出記録数（記録）", plant_label_count: "植物原ラベル数", visitor_label_count: "昆虫原ラベル数", pair_count: "観測ペア数（組）", lost_pair_count: "抽出で未確認の基準ペア数（組）", pair_retention_pct: "保持率（%、SDはポイント）", connectance_fixed: "固定Connectance（無次元）" };
function FractionText({ value, digits }: { value: Fraction; digits: number }) { return <span title={`正確な値：${value.numerator}/${value.denominator}`}>{formatFraction(value, digits)}</span>; }
function DistributionChart({ values, metric }: { values: readonly DistributionValue[]; metric: "pair_count" | "pair_retention_pct" }) {
  const uid = useId(), bins = useMemo(() => histogram(values, metric), [values, metric]);
  const max = Math.ceil(Math.max(1, ...bins.map(b => b.count)) / 4) * 4, step = 620 / bins.length;
  const title = metric === "pair_count" ? "観測ペア数の分布" : "観測ペア保持率の分布";
  const unit = metric === "pair_count" ? "観測ペア数（組）" : "観測ペア保持率（%）";
  return <figure className="distribution-chart"><figcaption>{title}</figcaption><div className="chart-scroll" tabIndex={0} role="region" aria-label={`${title}（横にスクロール）`}><svg viewBox="0 0 720 265" role="img" aria-labelledby={`${uid}-title ${uid}-desc`}>
    <title id={`${uid}-title`}>{title}</title><desc id={`${uid}-desc`}>{values.length}試行の度数分布。縦軸は試行数。下の度数表で全ての数値を確認できます。</desc>
    {[0, 1, 2, 3, 4].map(i => { const y = 210 - i * 42; return <g key={i}><line x1="58" x2="680" y1={y} y2={y} stroke="#d9ded3" /><text x="48" y={y + 4} textAnchor="end">{Math.round(max * i / 4)}</text></g>; })}
    <text x="15" y="25">試行数</text>
    {bins.map((bin, i) => <g key={bin.label}><rect x={60 + i * step + step * .08} y={210 - 168 * bin.count / max} width={step * .84} height={168 * bin.count / max} fill="#204b3a"><title>{bin.label}：{bin.count}試行</title></rect>{(bins.length <= 6 || i % Math.ceil(bins.length / 6) === 0 || i === bins.length - 1) && <text x={60 + (i + .5) * step} y="230" textAnchor="middle">{metric === "pair_count" ? bin.label : i * 5}</text>}</g>)}
    <text x="370" y="258" textAnchor="middle">{unit}</text>
  </svg></div><p className="field-help">{metric === "pair_count" ? "ビン幅：1組。横軸は実際の試行値の最小〜最大。" : "ビン幅：5パーセントポイント。0〜100%、左端を含み右端を含まない区間（最後は100%を含む）。"}</p><details><summary>度数表を読む</summary><div className="table-scroll"><table><caption>{title} · {values.length}試行</caption><thead><tr><th scope="col">{unit}</th><th scope="col">試行数</th></tr></thead><tbody>{bins.map(bin => <tr key={bin.label}><th scope="row">{bin.label}</th><td>{bin.count}</td></tr>)}</tbody></table></div></details></figure>;
}
export const StatisticsPanel = memo(function StatisticsPanel({ summary, values, repetitions }: { summary: RepetitionSummary; values: readonly DistributionValue[]; repetitions: number }) {
  return <section className="statistics-panel" aria-labelledby="statistics-title"><h2 id="statistics-title">反復全体の統計（{repetitions}試行）</h2><p>以下は選択中の1試行とは別の、全試行の要約です。試行番号を変えても、この統計は変わりません。</p><div className="distribution-grid"><DistributionChart values={values} metric="pair_count" /><DistributionChart values={values} metric="pair_retention_pct" /></div>
    <div className="table-scroll" tabIndex={0} role="region" aria-label="全7指標の統計サマリー"><table className="statistics-table"><caption>この抽出モデルの2.5〜97.5%分位範囲と統計値</caption><thead><tr>{["指標・単位", "平均", "標本分散", "標本標準偏差", "最小", "2.5%分位点", "中央値", "97.5%分位点", "最大"].map(text => <th scope="col" key={text}>{text}</th>)}</tr></thead><tbody>{(Object.keys(labels) as MetricKey[]).map(key => {
      const s = summary[key], digits = key === "connectance_fixed" ? 6 : 2;
      return <tr key={key}><th scope="row">{labels[key]}</th><td><FractionText value={s.mean} digits={digits} /></td><td>{s.sample_variance ? <FractionText value={s.sample_variance} digits={key === "connectance_fixed" ? 8 : 2} /> : "未定義（1試行）"}</td><td>{formatSqrt(s.sample_sd, digits)}</td><td><FractionText value={s.min} digits={digits} /></td>{s.quantiles.map(q => <td key={`${q.probability.numerator}/${q.probability.denominator}`}><FractionText value={q.value} digits={digits} /></td>)}<td><FractionText value={s.max} digits={digits} /></td></tr>;
    })}</tbody></table></div><p className="field-help">表示用の小数は丸めています。正式JSONは既約分数と標準偏差の被開平数を保持します。R=1では分散・標準偏差は未定義です。分位範囲はこの抽出モデルによるばらつきであり、生態系の95%信頼区間や将来予測ではありません。</p>
  </section>;
});
