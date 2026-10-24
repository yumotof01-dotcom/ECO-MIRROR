import type { ReadyPayload } from "../execution/protocol";
import { count, formatFraction } from "../execution/format";
export function ObservationMetrics({
  payload,
}: {
  payload: ReadyPayload | null;
}) {
  const t = payload?.trial,
    ref = payload?.header.reference;
  if (!t || !ref)
    return (
      <p className="observation-metrics-empty">
        数値は成功した試行でのみ表示します。結果はこのタブ内だけに保持されます。
      </p>
    );
  return (
    <dl className="observation-metrics" aria-label="選択中の試行の主要指標">
      {[
        [
          "植物原ラベル",
          `${t.sample.plant_label_count} / ${ref.plant_label_count}`,
        ],
        [
          "昆虫原ラベル",
          `${t.sample.visitor_label_count} / ${ref.visitor_label_count}`,
        ],
        ["観測ペア", `${t.sample.pair_count}組 / ${ref.pair_count}組`],
        ["訪花記録", `${count(t.sample.event_count)}件`],
        ["今回未確認", `${t.lost_pair_count}組`],
        ["保持率", `${formatFraction(t.pair_retention_pct)}%`],
        ["固定Connectance", formatFraction(t.sample.connectance_fixed, 6)],
      ].map(([title, value]) => (
        <div key={title}>
          <dt>{title}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
