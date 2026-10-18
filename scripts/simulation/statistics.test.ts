// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fraction } from "../../src/features/simulation/core/fraction.ts";
import { addFractions, subtractFractions, divideFractions, compareFractions, quantileType7, summarizeValues, summarizeTrials } from "../../src/features/simulation/core/statistics.ts";
import { fixtures } from "./test-support.ts";

describe("exact statistics, repetitions.md 1.0.0", () => {
  it("matches the hand-specified [3,4,5] fixture including exact type 7 quantiles", () => {
    const expected = fixtures.statistics_fixture.expected_pair_summary;
    const summary = summarizeValues([3, 4, 5].map(n => fraction(BigInt(n), 1n)));
    expect(summary).toMatchObject({ valid_count: 3, mean: expected.mean, sample_variance: expected.sample_variance, sample_sd: expected.sample_sd, min: fraction(3n, 1n), max: fraction(5n, 1n), undefined_reasons: {} });
    expect(summary.quantiles.map(q => q.value)).toEqual(expected.quantiles);
    expect(summary.quantiles.map(q => q.probability)).toEqual([fraction(1n, 40n), fraction(1n, 2n), fraction(39n, 40n)]);
  });
  it("matches the retention-percent fixture without a binary floating-point conversion", () => {
    const expected = fixtures.statistics_fixture.expected_retention_summary;
    const summary = summarizeValues([fraction(50n, 1n), fraction(200n, 3n), fraction(250n, 3n)]);
    expect(summary).toMatchObject({ mean: expected.mean, sample_variance: expected.sample_variance, sample_sd: expected.sample_sd });
    expect(summary.quantiles.map(q => q.value)).toEqual(expected.quantiles);
  });
  it("distinguishes R=1 undefined variance from R>=2 valid zero variance", () => {
    const one = summarizeValues([fraction(4n, 1n)]);
    expect(one).toMatchObject({ mean: fixtures.one_trial_summary.mean, sample_variance: null, sample_sd: null, undefined_reasons: { sample_variance: "insufficient_trials", sample_sd: "insufficient_trials" } });
    expect(one.quantiles.map(q => q.value)).toEqual(fixtures.one_trial_summary.quantiles);
    const zero = summarizeValues([fraction(0n, 1n), fraction(0n, 1n)]);
    expect(zero).toMatchObject({ mean: fixtures.two_zero_trials_summary.mean, sample_variance: fixtures.two_zero_trials_summary.sample_variance, sample_sd: fixtures.two_zero_trials_summary.sample_sd, undefined_reasons: {} });
  });
  it("sorts fractions by exact magnitude, preserves input and handles q=0/1 and n=1", () => {
    const input = [fraction(9n, 10n), fraction(1n, 10n), fraction(1n, 3n)];
    const before = JSON.stringify(input);
    expect(quantileType7(input, fraction(0n, 1n))).toEqual(fraction(1n, 10n));
    expect(quantileType7(input, fraction(1n, 1n))).toEqual(fraction(9n, 10n));
    expect(quantileType7(input, fraction(1n, 2n))).toEqual(fraction(1n, 3n));
    expect(quantileType7([input[0]], fraction(39n, 40n))).toEqual(input[0]);
    expect(JSON.stringify(input)).toBe(before);
    expect(compareFractions(fraction(9007199254740993n, 1n), fraction(9007199254740992n, 1n))).toBe(1);
    expect(addFractions(fraction(1n, 3n), fraction(1n, 6n))).toEqual(fraction(1n, 2n));
  });
  it("refuses undefined, sparse, nonreduced or empty values, invalid probabilities and negative differences", () => {
    expect(() => summarizeValues([])).toThrow(/INVALID_NUMERIC_RESULT/);
    expect(() => summarizeValues(new Array(2))).toThrow(/INVALID_NUMERIC_RESULT/);
    expect(() => summarizeValues([{ numerator: "2", denominator: "4" }])).toThrow(/reduced/);
    expect(() => quantileType7([fraction(1n, 1n)], fraction(2n, 1n))).toThrow(/probability/);
    expect(() => subtractFractions(fraction(0n, 1n), fraction(1n, 1n))).toThrow(/INVALID_NUMERIC_RESULT/);
    expect(() => divideFractions(fraction(1n, 1n), fraction(0n, 1n))).toThrow(/INVALID_NUMERIC_RESULT/);
    expect(() => summarizeTrials(new Array(2))).toThrow(/trial 0/);
  });
});
