// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { loadObservationData } from "../../src/features/data/index.ts";
import type { ObservationData } from "../../src/features/data/index.ts";
import { runRepeatedTrials } from "../../src/features/simulation/core/repeated.ts";
import { runSingleTrial } from "../../src/features/simulation/core/run.ts";
import { canonicalJson } from "../../src/features/simulation/core/serialization.ts";
import type { RepeatedRunResult, RunContext } from "../../src/features/simulation/core/types.ts";
import { readExecutionContext } from "./context.ts";
import { allSelection, sha256 } from "./test-support.ts";

describe("repeated full-source data and reproducibility", () => {
  let data: ObservationData, context: RunContext;
  const base = { selection: allSelection, rate_percent: 50, master_seed: 42, repetitions: 100 };
  beforeAll(async () => { data = await loadObservationData(); context = (await readExecutionContext()).context; });
  it("matches phase 6 at t=0, distinguishes repeated R=1 and preserves the input", async () => {
    const before = JSON.stringify(data);
    const repeated = await runRepeatedTrials(data, { ...base, repetitions: 1, rate_percent: 100 }, context, sha256);
    const single = await runSingleTrial(data, { selection: base.selection, rate_percent: 100, master_seed: 42 }, context, sha256);
    expect(repeated.trials[0]).toEqual(single.trials[0]);
    expect(repeated.reference).toEqual(single.reference);
    expect(repeated.summary!.pair_count).toMatchObject({ mean: { numerator: "257", denominator: "1" }, sample_variance: null, sample_sd: null });
    expect(repeated.summary_reason).toBeNull();
    expect(single.summary_reason).toBe("repetition_not_requested");
    expect(JSON.stringify(data)).toBe(before);
  });
  it.each([0, 100])("retains 100 valid real-data results at p=%i and exact zero variances", async rate_percent => {
    const result = await runRepeatedTrials(data, { ...base, rate_percent }, context, sha256);
    expect(result.reference).toMatchObject({ event_count: 3882, plant_label_count: 20, visitor_label_count: 104, pair_count: 257 });
    expect(result.trials).toHaveLength(100);
    expect(result.trials.every(t => t.random_word_count === 0)).toBe(true);
    expect(result.summary!.pair_count.mean).toEqual({ numerator: rate_percent === 0 ? "0" : "257", denominator: "1" });
    for (const summary of Object.values(result.summary!)) {
      expect(summary.valid_count).toBe(100);
      expect(summary.sample_variance).toEqual({ numerator: "0", denominator: "1" });
      expect(summary.sample_sd).toEqual({ radicand: { numerator: "0", denominator: "1" } });
    }
  }, 20000);
  it("keeps 100 real half-samples and reproduces their complete JSON/hash", async () => {
    const a = await runRepeatedTrials(data, base, context, sha256);
    expect(a.trials).toHaveLength(100);
    expect(a.trials.every(t => t.sample.event_count === 1941)).toBe(true);
    expect(a.trials.every((t, i) => t.trial_index === i && t.sampled_source_record_numbers.length === 1941)).toBe(true);
    const bytes = canonicalJson(a);
    const b = await runRepeatedTrials(data, base, context, sha256);
    expect(canonicalJson(b)).toBe(bytes);
    expect(sha256(canonicalJson(b))).toBe(sha256(bytes));
  }, 30000);
  it("runs all 1000 real half-samples twice, preserves a 100-trial prefix and hashes every result field", async () => {
    const prefix = await runRepeatedTrials(data, base, context, sha256);
    const run = async () => {
      const start = performance.now();
      const result = await runRepeatedTrials(data, { ...base, repetitions: 1000 }, context, sha256);
      expect(result.trials).toHaveLength(1000);
      expect(result.trials.slice(0, 100)).toEqual(prefix.trials);
      expect(result.trials[999].initseq_u64_hex).toBe("000000000000041d");
      expect(result.summary!.pair_count.valid_count).toBe(1000);
      const bytes = canonicalJson(result);
      if (process.env.ECO_MIRROR_AUDIT_PATH) {
        writeFileSync(process.env.ECO_MIRROR_AUDIT_PATH, JSON.stringify({
          data_identity: result.data_identity, implementation_git_revision: result.implementation_git_revision,
          summary: result.summary, trials: result.trials.map(t => ({
            trial_index: t.trial_index, sampled_ids_sha256: t.sampled_ids_sha256, random_word_count: t.random_word_count,
            event_count: t.sample.event_count, plant_label_count: t.sample.plant_label_count, visitor_label_count: t.sample.visitor_label_count,
            pair_count: t.sample.pair_count, lost_pair_count: t.lost_pair_count, pair_retention_pct: t.pair_retention_pct, connectance_fixed: t.sample.connectance_fixed,
          })),
        }));
      }
      return { hash: sha256(bytes), bytes: Buffer.byteLength(bytes), summary: result.summary, elapsed_ms: Math.round(performance.now() - start), rss_mb: Math.round(process.memoryUsage().rss / 1048576) };
    };
    const a = await run(), b = await run();
    expect(b.hash).toBe(a.hash);
    expect(b.summary).toEqual(a.summary);
    console.info(`real R=1000: ${a.bytes} canonical bytes; first=${a.elapsed_ms}ms, second=${b.elapsed_ms}ms; observed RSS=${Math.max(a.rss_mb, b.rss_mb)}MiB; SHA-256=${a.hash}`);
  }, 120000);
  it("returns no fabricated empty-scope trials and validates all parameters first", async () => {
    const selection = { years: [2014], plot_ids: ["3"], treatments: ["Water"], rounds_by_year: { 2014: ["1"] } };
    const result: RepeatedRunResult = await runRepeatedTrials(data, { ...base, selection }, context, sha256);
    expect(result).toMatchObject({ status: "empty_scope", execution_mode: "repeated_trials", requested_repetitions: 100, reference: null, trials: [], summary: null, summary_reason: "empty_scope" });
    await expect(runRepeatedTrials(data, { ...base, selection, repetitions: 0 }, context, sha256)).rejects.toThrow(/INVALID_REPETITIONS/);
    await expect(runRepeatedTrials(data, { ...base, selection, rate_percent: -1 }, context, sha256)).rejects.toThrow(/INVALID_RATE/);
    await expect(runRepeatedTrials(data, { ...base, selection, master_seed: -1 }, context, sha256)).rejects.toThrow(/INVALID_SEED/);
  });
});
