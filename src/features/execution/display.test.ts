import { describe, expect, it } from "vitest";
import { formatFraction, formatSqrt } from "./format";
import { histogram } from "./histogram";
import { historicalPayload } from "../../test/execution-fixtures";

describe("display-only rational rounding and frequency bins", () => {
  it("rounds only display values and handles half boundaries, huge exact integers and undefined SD", () => {
    const input = { numerator: "200", denominator: "3" };
    expect(formatFraction(input)).toBe("66.67"); expect(input.numerator).toBe("200");
    expect(formatFraction({ numerator: "1", denominator: "200" })).toBe("0.01");
    expect(formatFraction({ numerator: "9007199254740993", denominator: "1" }, 0)).toBe("9,007,199,254,740,993");
    expect(formatSqrt({ radicand: { numerator: "2500", denominator: "9" } })).toBe("16.67");
    expect(formatSqrt({ radicand: { numerator: "1", denominator: "40000" } })).toBe("0.01");
    expect(formatSqrt(null)).toBe("未定義（1試行）");
    expect(formatFraction(null)).toBe("未定義");
  });
  it("uses exact 5-point bins, including 0 and 100%, while keeping every trial", () => {
    const values = [0, 5, 100].map((n, trial_index) => ({ trial_index, pair_count: n, pair_retention_pct: { numerator: String(n), denominator: "1" } }));
    const bins = histogram(values, "pair_retention_pct");
    expect(bins[0].count).toBe(1); expect(bins[1].count).toBe(1); expect(bins[19].count).toBe(1);
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(3);
    const pairBins = histogram(historicalPayload().distribution, "pair_count");
    expect(pairBins).toEqual([{ label: "182", count: 1 }, { label: "183", count: 2 }]);
  });
});
