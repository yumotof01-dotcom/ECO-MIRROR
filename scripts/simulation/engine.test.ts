// @vitest-environment node
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as dataEntry from "../../src/features/data/index.ts";
import type { ObservationData, ObservationYear, Treatment } from "../../src/features/data/index.ts";
import { ROUNDS } from "../../src/features/data/contract.ts";
import { runSingleTrial, canonicalJson, selectScope, simulateTrial } from "../../src/features/simulation/core/index.ts";
import type { RunContext, RunResult } from "../../src/features/simulation/core/types.ts";
import { runObservationSimulation } from "../../src/features/simulation/run.ts";
import * as io from "../data/io.ts";
import { makeRunProvenance, readExecutionContext } from "./context.ts";
import { allSelection, copy, sha256 } from "./test-support.ts";

interface Audit {
  year_summary: { Year: ObservationYear; record_count: number; plant_label_count: number; visitor_label_count: number; observed_pair_count: number }[];
  year_plot_counts: { Year: ObservationYear; Plot: number; Treatment: Treatment; record_count: number }[];
  year_round_counts: { Year: ObservationYear; Round: number; record_count: number }[];
  year_treatment_counts: { Year: ObservationYear; Treatment: Treatment; record_count: number }[];
  year_plot_round_counts: { Year: ObservationYear; Plot: number; Round: number; record_count: number }[];
  plot_round_cells_without_records: { Year: ObservationYear; Plot: number; Round: number; status: string }[];
}

describe("real-data single-trial integration and truthful provenance", () => {
  let data: ObservationData, context: RunContext, snapshot: Awaited<ReturnType<typeof readExecutionContext>>, audit: Audit, full: RunResult;
  const request = { selection: allSelection, rate_percent: 100, master_seed: 42 };
  beforeAll(async () => {
    data = await dataEntry.loadObservationData();
    snapshot = await readExecutionContext(); // Requires an actual committed phase-6 implementation.
    context = snapshot.context;
    audit = await io.readJson(io.PROFILE_PATH) as unknown as Audit;
    full = await runObservationSimulation(request, context);
  });
  const forYear = (year: ObservationYear) => ({ ...allSelection, years: [year], rounds_by_year: { [year]: [...ROUNDS[year]] } });

  it("uses the unchanged phase-4 loader and matches all whole-file 100% audit values", async () => {
    expect(full.status).toBe("success");
    expect(full.reference).toMatchObject({ event_count: 3882, plant_label_count: 20, visitor_label_count: 104, pair_count: 257 });
    expect(full.trials).toHaveLength(1);
    expect(full.trials[0].sample).toEqual(full.reference);
    expect(full.trials[0]).toMatchObject({ trial_index: 0, random_word_count: 0, lost_pair_count: 0, pair_retention_pct: { numerator: "100", denominator: "1" }, undefined_reasons: {} });
    expect(full.scope).toMatchObject({ plot_year_count: 48, observation_group_count: 321 });
    expect(full.scope.no_record_groups).toEqual(audit.plot_round_cells_without_records.map(c => ({ year: c.Year, plot_id: String(c.Plot), round_label: String(c.Round), status: c.status })));
    expect(full.trials[0].sampled_source_record_numbers).toEqual(full.scope.eligible_source_record_numbers);
    expect(full.scope.eligible_ids_sha256).toBe(sha256(`${JSON.stringify(data.dataset.events.map(e => e.record_id))}\n`));
    expect(full.trials[0].sampled_ids_sha256).toBe(full.scope.eligible_ids_sha256);
    expect(full.summary).toBeNull();
    expect(full.summary_reason).toBe("repetition_not_requested");
  });
  it("matches each year's independent label and pair audit, retaining original Round labels", async () => {
    for (const row of audit.year_summary) {
      const result = await runSingleTrial(data, { ...request, selection: forYear(row.Year) }, context, sha256);
      expect(result.reference).toMatchObject({ event_count: row.record_count, plant_label_count: row.plant_label_count, visitor_label_count: row.visitor_label_count, pair_count: row.observed_pair_count });
      expect(result.scope.scope_mode).toBe("single_year_records");
      expect(result.selection.rounds_by_year[row.Year]).toEqual(ROUNDS[row.Year]);
      expect(result.trials[0].sample).toEqual(result.reference);
    }
  });
  it("matches all 48 year×plot and all 14 year×Round / 8 year×Treatment audit counts", async () => {
    for (const row of audit.year_plot_counts) {
      const { events } = await selectScope(data.dataset.events, { ...forYear(row.Year), plot_ids: [String(row.Plot)], treatments: [row.Treatment] }, sha256);
      expect(events.length).toBe(row.record_count);
      const result = await simulateTrial(events, 100, 42, 0, sha256);
      expect(result.reference.event_count).toBe(row.record_count);
      expect(result.trial.sample).toEqual(result.reference);
      expect(result.trial.random_word_count).toBe(0);
    }
    for (const row of audit.year_round_counts) {
      const { events } = await selectScope(data.dataset.events, { ...forYear(row.Year), rounds_by_year: { [row.Year]: [String(row.Round)] } }, sha256);
      expect(events.length).toBe(row.record_count);
    }
    for (const row of audit.year_treatment_counts) {
      const { events } = await selectScope(data.dataset.events, { ...forYear(row.Year), treatments: [row.Treatment] }, sha256);
      expect(events.length).toBe(row.record_count);
    }
  });
  it("matches all 321 recorded groups without adding zero events for 15 unknown groups", async () => {
    for (const row of audit.year_plot_round_counts) {
      const { events, scope } = await selectScope(data.dataset.events, { ...forYear(row.Year), plot_ids: [String(row.Plot)], rounds_by_year: { [row.Year]: [String(row.Round)] } }, sha256);
      expect(events.length).toBe(row.record_count);
      expect(scope.no_record_groups).toHaveLength(0);
    }
  });
  it("returns valid zero sampling with fixed reference nodes, not empty_scope", async () => {
    const result = await runSingleTrial(data, { ...request, rate_percent: 0 }, context, sha256);
    expect(result.status).toBe("success");
    expect(result.sampling).toMatchObject({ sample_record_count: 0, actual_record_pct: { numerator: "0", denominator: "1" } });
    expect(result.trials[0]).toMatchObject({ random_word_count: 0, lost_pair_count: 257, pair_retention_pct: { numerator: "0", denominator: "1" } });
    expect(result.trials[0].sample).toMatchObject({ event_count: 0, plant_label_count: 0, visitor_label_count: 0, pair_count: 0, connectance_fixed: { numerator: "0", denominator: "1" } });
    expect(result.trials[0].sample.plant_partner_counts).toHaveLength(20);
    expect(result.trials[0].sample.visitor_partner_counts).toHaveLength(104);
    expect(result.trials[0].sample.pair_weights).toHaveLength(257);
    expect(result.scope.no_record_groups).toEqual(full.scope.no_record_groups);
  });
  it("distinguishes empty_scope, preserves source-level effort unknown, and still rejects invalid parameters", async () => {
    const selection = { years: [2014], plot_ids: ["3"], treatments: ["Water"], rounds_by_year: { 2014: ["1"] } };
    const emptyRequest = { ...request, selection };
    const result = await runSingleTrial(data, emptyRequest, context, sha256);
    expect(result).toMatchObject({ status: "empty_scope", reference: null, trials: [], summary: null, summary_reason: "empty_scope" });
    expect(result.sampling).toMatchObject({ eligible_record_count: 0, sample_record_count: null, actual_record_pct: null });
    expect(result.scope.no_record_groups).toHaveLength(1);
    await expect(runSingleTrial(data, { ...emptyRequest, master_seed: -1 }, context, sha256)).rejects.toThrow(/INVALID_SEED/);
    await expect(runSingleTrial(data, { ...emptyRequest, rate_percent: "0" }, context, sha256)).rejects.toThrow(/INVALID_RATE/);
    await expect(runSingleTrial(data, { ...emptyRequest, trial_index: 1 }, context, sha256)).rejects.toThrow(/INVALID_TRIAL_INDEX/);
    await expect(runSingleTrial(data, { ...emptyRequest, repetitions: 100 }, context, sha256)).rejects.toThrow(/repetitions are outside phase 6/);
  });
  it("reproduces all canonical bytes for equivalent selections, preserving actual original IDs at 50%", async () => {
    const normal = { ...request, rate_percent: 50 };
    const a = await runSingleTrial(data, normal, context, sha256);
    const b = await runSingleTrial(data, { ...normal, selection: { ...allSelection, years: [2015, 2014], plot_ids: [...allSelection.plot_ids].reverse(), treatments: [...allSelection.treatments].reverse() } }, context, sha256);
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(a.sampling).toMatchObject({ sample_record_count: 1941, actual_record_pct: { numerator: "50", denominator: "1" } });
    const ids = a.trials[0].sampled_source_record_numbers;
    expect(new Set(ids).size).toBe(1941);
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
    expect(a.trials[0].sampled_ids_sha256).toBe(sha256(`${JSON.stringify(ids.map(n => data.dataset.events[n - 1].record_id))}\n`));
    expect(a.scope.no_record_groups).toEqual(full.scope.no_record_groups);
    expect(a.trials[0].sample.pair_weights.every((p, i) => p.record_count <= a.reference!.pair_weights[i].record_count)).toBe(true);
  });
  it("does not modify or freeze caller-owned data, conditions or metadata", async () => {
    const mutable = copy(data), input = copy(request), metadata = copy(context);
    const before = JSON.stringify({ mutable, input, metadata });
    await runSingleTrial(mutable, input, metadata, sha256);
    expect(JSON.stringify({ mutable, input, metadata })).toBe(before);
    expect(Object.isFrozen(mutable.dataset.events[0])).toBe(false);
    expect(Object.isFrozen(data.dataset.events[0])).toBe(true);
  });
  it("rejects missing/unordered/full-source mutations without weakening the phase-4 validator", async () => {
    await expect(runSingleTrial({ ...data, dataset: { ...data.dataset, events: data.dataset.events.slice(1) } }, request, context, sha256)).rejects.toThrow(/SOURCE_ORDER/);
    const changed = { ...data, dataset: { ...data.dataset, events: [{ ...data.dataset.events[0], observed_at: "invented" }, ...data.dataset.events.slice(1)] } };
    await expect(runSingleTrial(changed as unknown as ObservationData, request, context, sha256)).rejects.toThrow(/DATA_UNKNOWN/);
    const failure = new dataEntry.DataValidationError("ARTIFACT_HASH", "explicit loader failure");
    const loader = vi.spyOn(dataEntry, "loadObservationData").mockRejectedValue(failure);
    try { await expect(runObservationSimulation(request, context)).rejects.toBe(failure); }
    finally { loader.mockRestore(); }
  });
  it("records a real committed implementation and all nine specification hashes, with no circular hash", () => {
    expect(execFileSync("git", ["cat-file", "-t", context.implementation_git_revision], { cwd: io.ROOT, encoding: "utf8" }).trim()).toBe("commit");
    expect(Object.keys(context.specification_sha256)).toHaveLength(9);
    const keys = ["result_schema_version", "specification_versions", "implementation_git_revision", "specification_sha256", "data_identity", "selection", "scope", "sampling", "randomness", "execution_mode", "requested_repetitions", "status", "reference", "trials", "summary", "summary_reason"].sort();
    expect(Object.keys(JSON.parse(canonicalJson(full)))).toEqual(keys);
    expect(canonicalJson(full)).not.toMatch(/created_at_utc|data_provenance_sha256|result_sha256/);
  });
  it("keeps clocks and data provenance outside the numerical body and rejects mismatched metadata", async () => {
    const before = canonicalJson(full);
    const a = makeRunProvenance(full, snapshot, "2026-10-17T00:00:00.000Z", "test runtime A");
    const b = makeRunProvenance(full, snapshot, "2026-10-18T00:00:00.000Z", "test runtime B");
    expect(a.result_sha256).toBe(b.result_sha256);
    expect(canonicalJson(full)).toBe(before);
    expect(canonicalJson(a)).not.toBe(canonicalJson(b));
    const bad = { ...context, data_identity: { ...context.data_identity, source_sha256: "different" } };
    await expect(runSingleTrial(data, request, bad, sha256)).rejects.toThrow(/INVALID_CONTEXT/);
    await expect(runSingleTrial(data, request, { ...context, specification_sha256: {} }, sha256)).rejects.toThrow(/INVALID_CONTEXT/);
    expect(() => makeRunProvenance(full, snapshot, "invalid", "test")).toThrow(/INVALID_CONTEXT/);
  });
  it("refuses to give modified implementation bytes an existing commit's identity", async () => {
    const original = io.readBytes;
    const reader = vi.spyOn(io, "readBytes").mockImplementation(async path => {
      const bytes = await original(path);
      return path === "src/features/simulation/core/pcg32.ts" ? Buffer.concat([bytes, Buffer.from("// uncommitted change\n")]) : bytes;
    });
    try { await expect(readExecutionContext()).rejects.toThrow(/INVALID_CONTEXT.*pcg32.ts.*commit code/); }
    finally { reader.mockRestore(); }
  });
});
