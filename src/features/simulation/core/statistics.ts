import { fraction, validateFraction } from "./fraction.ts";
import { requireSimulation } from "./errors.ts";
import type { Fraction, MetricKey, RepetitionSummary, ScalarSummary, TrialResult } from "./types.ts";

const zero = () => fraction(0n, 1n);
const integer = (n: number) => {
  requireSimulation(Number.isSafeInteger(n) && n >= 0, "INVALID_NUMERIC_RESULT", "statistics", "expected a safe nonnegative count");
  return fraction(BigInt(n), 1n);
};
export function compareFractions(a: Fraction, b: Fraction): number {
  validateFraction(a); validateFraction(b);
  const d = BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator);
  return d < 0n ? -1 : d > 0n ? 1 : 0;
}
export function addFractions(a: Fraction, b: Fraction): Fraction {
  validateFraction(a); validateFraction(b);
  return fraction(BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator), BigInt(a.denominator) * BigInt(b.denominator));
}
export function subtractFractions(a: Fraction, b: Fraction): Fraction {
  validateFraction(a); validateFraction(b);
  return fraction(BigInt(a.numerator) * BigInt(b.denominator) - BigInt(b.numerator) * BigInt(a.denominator), BigInt(a.denominator) * BigInt(b.denominator));
}
export function multiplyFractions(a: Fraction, b: Fraction): Fraction {
  validateFraction(a); validateFraction(b);
  return fraction(BigInt(a.numerator) * BigInt(b.numerator), BigInt(a.denominator) * BigInt(b.denominator));
}
export function divideFractions(a: Fraction, b: Fraction): Fraction {
  validateFraction(a); validateFraction(b);
  return fraction(BigInt(a.numerator) * BigInt(b.denominator), BigInt(a.denominator) * BigInt(b.numerator));
}
function validateValues(values: readonly Fraction[]): void {
  requireSimulation(Array.isArray(values) && values.length >= 1 && values.length <= 1000, "INVALID_NUMERIC_RESULT", "statistics", "expected 1..1000 values; missing trials may not be omitted");
  for (const value of values) validateFraction(value);
}
function quantileSorted(sorted: readonly Fraction[], q: Fraction): Fraction {
  const h = multiplyFractions(integer(sorted.length - 1), q);
  const j = Number(BigInt(h.numerator) / BigInt(h.denominator));
  const g = fraction(BigInt(h.numerator) % BigInt(h.denominator), BigInt(h.denominator));
  return j === sorted.length - 1 ? { ...sorted[j] } : addFractions(sorted[j], multiplyFractions(g, subtractFractions(sorted[j + 1], sorted[j])));
}
export function quantileType7(values: readonly Fraction[], probability: Fraction): Fraction {
  validateValues(values); validateFraction(probability);
  requireSimulation(compareFractions(probability, integer(1)) <= 0, "INVALID_NUMERIC_RESULT", "statistics", "quantile probability must lie in [0,1]");
  return quantileSorted([...values].sort(compareFractions), probability);
}
export function summarizeValues(values: readonly Fraction[]): ScalarSummary {
  validateValues(values);
  const sorted = [...values].sort(compareFractions), count = integer(values.length);
  const sum = values.reduce(addFractions, zero());
  const mean = divideFractions(sum, count);
  let variance: Fraction | null = null;
  if (values.length >= 2) {
    const sumSquares = values.reduce((s, x) => addFractions(s, multiplyFractions(x, x)), zero());
    variance = divideFractions(subtractFractions(multiplyFractions(count, sumSquares), multiplyFractions(sum, sum)), integer(values.length * (values.length - 1)));
    // Independently evaluate the centered expression; no rounding/clamping is permitted.
    const centered = values.reduce((s, x) => {
      const delta = compareFractions(x, mean) >= 0 ? subtractFractions(x, mean) : subtractFractions(mean, x);
      return addFractions(s, multiplyFractions(delta, delta));
    }, zero());
    requireSimulation(compareFractions(variance, divideFractions(centered, integer(values.length - 1))) === 0, "INVALID_NUMERIC_RESULT", "statistics", "two exact sample-variance expressions disagree");
  }
  return {
    valid_count: values.length, mean, sample_variance: variance, sample_sd: variance === null ? null : { radicand: variance },
    min: { ...sorted[0] }, max: { ...sorted[sorted.length - 1] },
    quantiles: [fraction(1n, 40n), fraction(1n, 2n), fraction(39n, 40n)].map(probability => ({ probability, value: quantileSorted(sorted, probability) })),
    undefined_reasons: variance === null ? { sample_variance: "insufficient_trials", sample_sd: "insufficient_trials" } : {},
  };
}
export const METRIC_KEYS: readonly MetricKey[] = Object.freeze(["event_count", "plant_label_count", "visitor_label_count", "pair_count", "lost_pair_count", "pair_retention_pct", "connectance_fixed"]);
export function summarizeTrials(trials: readonly TrialResult[]): RepetitionSummary {
  requireSimulation(Array.isArray(trials) && trials.length >= 1 && trials.length <= 1000, "INVALID_NUMERIC_RESULT", "statistics", "expected every requested trial");
  const fields = Object.fromEntries(METRIC_KEYS.map(key => [key, [] as Fraction[]])) as Record<MetricKey, Fraction[]>;
  for (let index = 0; index < trials.length; index++) {
    const trial = trials[index];
    requireSimulation(trial?.trial_index === index, "INVALID_NUMERIC_RESULT", "statistics", `trial ${index}: missing, duplicated or out-of-order trial`);
    for (const key of METRIC_KEYS) {
      const value = key === "lost_pair_count" || key === "pair_retention_pct" ? trial[key] : trial.sample[key];
      requireSimulation(value !== null, "INVALID_NUMERIC_RESULT", "statistics", `trial ${index}: ${key} is undefined; cannot omit failed values`);
      fields[key].push(typeof value === "number" ? integer(value) : value);
    }
  }
  return Object.fromEntries(METRIC_KEYS.map(key => [key, summarizeValues(fields[key])])) as unknown as RepetitionSummary;
}
