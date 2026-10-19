import { validateFraction } from "../simulation/core/fraction";
import type { DistributionValue } from "./protocol";

export interface HistogramBin { readonly label: string; readonly count: number }
/** Display grouping only. Exact persisted means/quantiles are never recomputed here. */
export function histogram(values: readonly DistributionValue[], metric: "pair_count" | "pair_retention_pct"): readonly HistogramBin[] {
  if (!values.length) throw new Error("分布の試行がありません。");
  if (metric === "pair_count") {
    const counts = values.map(v => v.pair_count);
    if (counts.some(v => !Number.isSafeInteger(v) || v < 0 || v > 257)) throw new Error("観測ペア数が不正です。");
    const min = Math.min(...counts), max = Math.max(...counts);
    const bins = Array.from({ length: max - min + 1 }, (_, i) => ({ label: String(min + i), count: 0 }));
    for (const value of counts) bins[value - min].count++;
    return bins;
  }
  const bins = Array.from({ length: 20 }, (_, i) => ({ label: `${i * 5}〜${(i + 1) * 5}${i === 19 ? "%（100含む）" : "%未満"}`, count: 0 }));
  for (const value of values) {
    validateFraction(value.pair_retention_pct);
    const n = BigInt(value.pair_retention_pct.numerator), d = BigInt(value.pair_retention_pct.denominator);
    if (n > 100n * d) throw new Error("保持率が100%を超えています。");
    const index = n === 100n * d ? 19 : Number(n / (5n * d));
    bins[index].count++;
  }
  return bins;
}
