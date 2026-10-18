// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_REPETITIONS, normalizeRepeatedRequest, simulateRepetitions, validateRepetitions } from "../../src/features/simulation/core/repeated.ts";
import * as single from "../../src/features/simulation/core/trial.ts";
import { canonicalJson } from "../../src/features/simulation/core/serialization.ts";
import { summarizeTrials } from "../../src/features/simulation/core/statistics.ts";
import { allSelection, toy, sha256 } from "./test-support.ts";

describe("trial-local deterministic repetition", () => {
  it.each([1, 2, 3, 100, 1000])("retains every trial at R=%i and matches standalone t=0", async R => {
    const result = await simulateRepetitions(toy, 50, 42, R, sha256);
    expect(result.trials).toHaveLength(R);
    expect(result.trials.map(t => t.trial_index)).toEqual(Array.from({ length: R }, (_, i) => i));
    expect(result.trials[0]).toEqual((await single.simulateTrial(toy, 50, 42, 0, sha256)).trial);
    expect(result.summary.pair_count.valid_count).toBe(R);
    expect(result.trials[R - 1].initseq_u64_hex).toBe(BigInt(54 + R - 1).toString(16).padStart(16, "0"));
  });
  it("keeps the first 100 trials when R grows to 200 and does not depend on execution order", async () => {
    const a = await simulateRepetitions(toy, 50, 42, 100, sha256), b = await simulateRepetitions(toy, 50, 42, 200, sha256);
    expect(b.trials.slice(0, 100)).toEqual(a.trials);
    const shuffled = await Promise.all([99, 1, 0].map(t => single.simulateTrial(toy, 50, 42, t, sha256)));
    expect(shuffled.map(r => r.trial)).toEqual([a.trials[99], a.trials[1], a.trials[0]]);
    expect(canonicalJson(await simulateRepetitions(toy, 50, 42, 100, sha256))).toBe(canonicalJson(a));
  });
  it.each([0, 100])("keeps repeated identical outcomes at p=%i, with every word count zero", async p => {
    const result = await simulateRepetitions(toy, p, 42, 100, sha256);
    expect(result.trials).toHaveLength(100);
    expect(result.trials.every(t => t.random_word_count === 0)).toBe(true);
    expect(result.summary.pair_count.sample_variance).toEqual({ numerator: "0", denominator: "1" });
    expect(result.summary.pair_count.sample_sd).toEqual({ radicand: { numerator: "0", denominator: "1" } });
    expect(result.trials.every(t => JSON.stringify(t.sample) === JSON.stringify(result.trials[0].sample))).toBe(true);
  });
  it.each([0, -1, 1001, 1.5, "100", null, NaN, Infinity, undefined])("rejects invalid R=%s without filling a default", R => {
    expect(() => validateRepetitions(R)).toThrow(/INVALID_REPETITIONS/);
    expect(() => normalizeRepeatedRequest({ selection: allSelection, rate_percent: 50, master_seed: 42, repetitions: R })).toThrow(/INVALID_REPETITIONS/);
  });
  it("exposes the explicit default, rejects extra parameters and invalid lower-level inputs", async () => {
    expect(DEFAULT_REPETITIONS).toBe(100);
    expect(() => normalizeRepeatedRequest({ selection: allSelection, rate_percent: 50, master_seed: 42, repetitions: 100, trial_index: 0 })).toThrow(/INVALID_SELECTION/);
    await expect(simulateRepetitions(toy, 101, 42, 1, sha256)).rejects.toThrow(/INVALID_RATE/);
    await expect(simulateRepetitions(toy, 50, -1, 1, sha256)).rejects.toThrow(/INVALID_SEED/);
    await expect(simulateRepetitions([], 50, 42, 1, sha256)).rejects.toThrow(/empty source/);
  });
  it("aborts on an intermediate failure instead of dropping it, and rejects incomplete summaries", async () => {
    const actual = single.simulateTrial;
    const mock = vi.spyOn(single, "simulateTrial").mockImplementation(async (...args) => {
      if (args[3] === 2) throw new Error("trial 2: deliberately failing test source");
      return actual(...args);
    });
    try { await expect(simulateRepetitions(toy, 50, 42, 5, sha256)).rejects.toThrow(/trial 2/); }
    finally { mock.mockRestore(); }
    const result = await simulateRepetitions(toy, 50, 42, 3, sha256);
    expect(() => summarizeTrials([result.trials[0], result.trials[2]])).toThrow(/trial 1/);
    expect(() => summarizeTrials([{ ...result.trials[0], pair_retention_pct: null }])).toThrow(/undefined/);
  });
});
