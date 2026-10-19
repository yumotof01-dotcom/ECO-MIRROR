// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ExecutionRuntime } from "./runtime";
import type { WorkerResponse } from "./protocol";
import { historicalInput, historicalMetadata, historicalResult } from "../../test/execution-fixtures";
import { canonicalJson } from "../simulation/core/serialization";
import { loadObservationData } from "../data/index";
import { blobSha256 } from "./export";

describe("real-data Worker runtime reuses existing numerical engines", () => {
  it("produces precisely the existing R=3 result and sends only a header, scalars and one trial", async () => {
    const messages: WorkerResponse[] = [];
    const runtime = new ExecutionRuntime(m => messages.push(m), { metadata: async () => historicalMetadata });
    await runtime.handle({ type: "start", run_id: 1, input: historicalInput });
    const ready = messages.find(m => m.type === "ready"); if (ready?.type !== "ready") throw Error(JSON.stringify(messages));
    expect(ready.payload.header).not.toHaveProperty("trials");
    expect(ready.payload.trial).toEqual(historicalResult.trials[0]);
    expect(ready.payload.distribution.map(t => t.pair_count)).toEqual([183, 182, 183]);
    expect(ready.payload.ui_payload_bytes).toBeLessThan(200000);
    await runtime.handle({ type: "export", run_id: 1, operation_id: 1 });
    const output = messages.find(m => m.type === "export_ready"); if (output?.type !== "export_ready") throw Error(JSON.stringify(messages));
    expect(await output.result.text()).toBe(canonicalJson(historicalResult));
    await runtime.handle({ type: "trial", run_id: 1, operation_id: 2, trial_index: 2 });
    expect(messages.at(-1)).toMatchObject({ type: "trial_ready", trial: historicalResult.trials[2] });
  });
  it.each([0, 100, 50])("has audited single-trial values at p=%i", async rate_percent => {
    const messages: WorkerResponse[] = [];
    const runtime = new ExecutionRuntime(m => messages.push(m), { metadata: async () => historicalMetadata });
    await runtime.handle({ type: "start", run_id: 1, input: { mode: "single_trial", request: { selection: historicalResult.selection, rate_percent, master_seed: 42 } } });
    const ready = messages.find(m => m.type === "ready"); if (ready?.type !== "ready") throw Error(JSON.stringify(messages));
    expect(ready.payload.header.reference).toMatchObject({ event_count: 3882, plant_label_count: 20, visitor_label_count: 104, pair_count: 257 });
    expect(ready.payload.trial!.sample.event_count).toBe(rate_percent === 0 ? 0 : rate_percent === 100 ? 3882 : 1941);
    expect(ready.payload.trial!.sample.pair_count).toBe(rate_percent === 0 ? 0 : rate_percent === 100 ? 257 : 183);
    expect(ready.payload.trial!.lost_pair_count).toBe(rate_percent === 0 ? 257 : rate_percent === 100 ? 0 : 74);
    expect(ready.payload.header.execution_mode).toBe("single_trial");
    expect(ready.payload.header.summary).toBeNull();
  });
  it("has no fake trials for empty_scope and preserves the reason", async () => {
    const messages: WorkerResponse[] = [];
    const runtime = new ExecutionRuntime(m => messages.push(m), { metadata: async () => historicalMetadata });
    const selection = { years: [2014] as const, plot_ids: ["3"], treatments: ["Water"] as const, rounds_by_year: { 2014: ["1"] } };
    await runtime.handle({ type: "start", run_id: 1, input: { ...historicalInput, request: { ...historicalInput.request, selection } } });
    expect(messages.at(-1)).toMatchObject({ type: "ready", payload: { header: { status: "empty_scope", reference: null, summary: null }, trial: null, distribution: [] } });
  });
  it("does not turn loader failure or unverified computation context into a successful run", async () => {
    const messages: WorkerResponse[] = [];
    const runtime = new ExecutionRuntime(m => messages.push(m), { metadata: async () => historicalMetadata, load: async () => { throw Error("ARTIFACT_HASH mismatch"); } });
    await runtime.handle({ type: "start", run_id: 1, input: historicalInput });
    expect(messages.at(-1)).toMatchObject({ type: "error", stage: "run", message: "ARTIFACT_HASH mismatch" });
    const dirty = new ExecutionRuntime(m => messages.push(m), { metadata: async () => ({ ...historicalMetadata, context: null, verification: "unverified", reason: "dirty core" }) });
    await dirty.handle({ type: "start", run_id: 2, input: historicalInput });
    expect(messages.at(-1)).toMatchObject({ type: "error", message: "dirty core" });
  });
  it("keeps all 1000 real trials for exact canonical export, with a small display payload", async () => {
    const messages: WorkerResponse[] = [];
    const runtime = new ExecutionRuntime(m => messages.push(m), { metadata: async () => historicalMetadata, load: loadObservationData });
    await runtime.handle({ type: "start", run_id: 1, input: { mode: "repeated_trials", request: { ...historicalInput.request, repetitions: 1000 } } });
    const ready = messages.find(m => m.type === "ready"); if (ready?.type !== "ready") throw Error(JSON.stringify(messages));
    expect(ready.payload.distribution).toHaveLength(1000);
    expect(ready.payload.header.requested_repetitions).toBe(1000);
    expect(ready.payload.ui_payload_bytes).toBeLessThan(300000);
    await runtime.handle({ type: "trial", run_id: 1, operation_id: 1, trial_index: 999 });
    expect(messages.at(-1)).toMatchObject({ type: "trial_ready", trial: { trial_index: 999, initseq_u64_hex: "000000000000041d" } });
    await runtime.handle({ type: "export", run_id: 1, operation_id: 2 });
    const output = messages.find(m => m.type === "export_ready"); if (output?.type !== "export_ready") throw Error(JSON.stringify(messages));
    expect(output.info.result_bytes).toBe(86277392);
    expect(output.info.result_sha256).toBe("083873fbd56b8b3a7fb30c876a86c878252d18583b906c4354bfe85286c29ab8");
    expect(await blobSha256(output.result)).toBe(output.info.result_sha256);
  }, 120000);
});
