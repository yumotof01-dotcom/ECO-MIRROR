// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { sampleEvents, sampleSize } from "../../src/features/simulation/core/sampling.ts";
import { simulateTrial } from "../../src/features/simulation/core/trial.ts";
import { fixtures, sha256, toy } from "./test-support.ts";

describe("fixed-size forward partial Fisher–Yates", () => {
  it.each(fixtures.rounding_cases)("rounds N=$N p=$p to exactly $k", ({ N, p, k }: { N: number; p: number; k: number }) => {
    expect(sampleSize(N, p)).toBe(k);
  });
  it("matches the complete hand-worked trial, including exact fractions and zeros on absent reference pairs", async () => {
    const { reference, trial } = await simulateTrial(toy, 50, 42, 0, sha256);
    expect(trial.sampled_source_record_numbers).toEqual(fixtures.main_sample.sampled_ids);
    expect(trial.random_word_count).toBe(5);
    expect(reference.pair_count).toBe(6);
    expect(reference.connectance_fixed).toEqual(fixtures.reference.connectance_fixed);
    expect(trial.sample).toMatchObject({ event_count: 5, plant_label_count: 2, visitor_label_count: 2, pair_count: 4, connectance_fixed: fixtures.main_sample.expected.connectance_fixed });
    expect(trial.lost_pair_count).toBe(2);
    expect(trial.pair_retention_pct).toEqual({ numerator: "200", denominator: "3" });
    expect(trial.sample.pair_weights.map(p => [p.plant_label_id.slice(6), p.visitor_label_id.slice(8), p.record_count])).toEqual(fixtures.main_sample.expected.pair_weights);
    expect(trial.sample.plant_partner_counts.map(n => n.partner_count)).toEqual([2, 2, 0]);
    expect(trial.sample.visitor_partner_counts.map(n => n.partner_count)).toEqual([2, 2, 0]);
    expect(trial.initstate_u64_hex).toBe("000000000000002a");
    expect(trial.initseq_u64_hex).toBe("0000000000000036");
  });
  it.each([0, 100])("handles p=%i without invoking Math.random or consuming words", async p => {
    const forbidden = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Math.random forbidden"); });
    try {
      const { reference, trial } = await simulateTrial(toy, p, 42, 0, sha256);
      expect(trial.random_word_count).toBe(0);
      expect(trial.sample.event_count).toBe(p === 0 ? 0 : 10);
      expect(trial.pair_retention_pct).toEqual({ numerator: String(p), denominator: "1" });
      if (p === 100) expect(trial.sample).toEqual(reference);
      else expect(trial.sample.pair_weights.every(pair => pair.record_count === 0)).toBe(true);
    } finally { forbidden.mockRestore(); }
  });
  it("is deterministic, nonmutating, without replacement and numerically source ordered", () => {
    const before = JSON.stringify(toy);
    const a = sampleEvents(toy, 50, 42, 0), b = sampleEvents(toy, 50, 42, 0);
    expect(a).toEqual(b);
    expect(JSON.stringify(toy)).toBe(before);
    const ids = a.events.map(e => e.source_record_number);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
    expect(a.events.every(e => toy.includes(e))).toBe(true);
  });
  it("does not renumber nonconsecutive original record numbers as local positions", () => {
    const scope = [toy[1], toy[4], toy[9]];
    const ids = sampleEvents(scope, 50, 42, 0).events.map(e => e.source_record_number);
    expect(ids).toHaveLength(2);
    expect(ids.every(n => [2, 5, 10].includes(n))).toBe(true);
  });
  it("shares the Fisher–Yates prefix across proportions but keeps seed streams trial-local", () => {
    const low = sampleEvents(toy, 30, 42, 0).events;
    const high = sampleEvents(toy, 80, 42, 0).events;
    expect(low.every(e => high.includes(e))).toBe(true);
    expect(sampleEvents(toy, 51, 42, 0)).toEqual(sampleEvents(toy, 50, 42, 0));
    const separate = sampleEvents(toy, 50, 42, 999);
    sampleEvents(toy, 50, 0, 1);
    expect(sampleEvents(toy, 50, 42, 999)).toEqual(separate);
  });
  it.each([-1, 101, 50.5, "50", NaN, Infinity, null, undefined])("rejects invalid rate %s, even for an empty sequence", p => {
    expect(() => sampleEvents([], p, 42, 0)).toThrow(/INVALID_RATE/);
  });
  it("validates seed and trial even when k=0 or k=N", () => {
    expect(() => sampleEvents(toy, 0, -1, 0)).toThrow(/INVALID_SEED/);
    expect(() => sampleEvents(toy, 100, 42, 1000)).toThrow(/INVALID_TRIAL_INDEX/);
  });
  it("rejects duplicate/unordered original records and invalid counts without repair", () => {
    expect(() => sampleEvents([toy[1], toy[0]], 50, 42, 0)).toThrow(/SOURCE_ORDER/);
    expect(() => sampleEvents([toy[0], toy[0]], 50, 42, 0)).toThrow(/SOURCE_ORDER/);
    expect(() => sampleSize(3883, 50)).toThrow(/INVALID_NUMERIC_RESULT/);
  });
});
