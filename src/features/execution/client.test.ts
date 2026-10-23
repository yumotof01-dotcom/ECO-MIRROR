import { describe, expect, it } from "vitest";
import { ExecutionClient } from "./client";
import type { WorkerPort, WorkerRequest, WorkerResponse } from "./protocol";
import { historicalInput, historicalPayload } from "../../test/execution-fixtures";

class FakeWorker implements WorkerPort {
  onmessage: WorkerPort["onmessage"] = null;
  onerror: WorkerPort["onerror"] = null;
  onmessageerror: WorkerPort["onmessageerror"] = null;
  requests: WorkerRequest[] = [];
  stopped = false;
  postMessage(message: WorkerRequest) { this.requests.push(message); }
  terminate() { this.stopped = true; }
  emit(message: WorkerResponse) { this.onmessage?.({ data: message } as MessageEvent<WorkerResponse>); }
}
function setup(failUrlAt = 0) {
  const workers: FakeWorker[] = [], revoked: string[] = []; let urls = 0;
  const client = new ExecutionClient(() => { const w = new FakeWorker(); workers.push(w); return w; }, { create: () => { if (++urls === failUrlAt) throw Error("URL allocation failed"); return `blob:test-${urls}`; }, revoke: url => revoked.push(url) });
  const ready = () => workers.at(-1)!.emit({ type: "ready", run_id: client.getSnapshot().runId, payload: historicalPayload() });
  return { client, workers, revoked, ready };
}
describe("request lifecycle, cancellation and resource cleanup", () => {
  it("keeps loading/running free of result values and exposes only the completed payload", () => {
    const { client, workers, ready } = setup();
    expect(client.getSnapshot().status).toBe("idle");
    client.start(historicalInput);
    expect(client.getSnapshot()).toMatchObject({ status: "loading", payload: null });
    workers[0].emit({ type: "phase", run_id: 1, phase: "running", message: "計算中" });
    expect(client.getSnapshot()).toMatchObject({ status: "running", payload: null });
    ready(); expect(client.getSnapshot()).toMatchObject({ status: "success", payload: { trial: { trial_index: 0 } } });
    workers[0].emit({ type: "phase", run_id: 1, phase: "loading", message: "late" });
    expect(client.getSnapshot().status).toBe("success");
  });
  it("terminates cancelled work and ignores even captured late success/error callbacks", () => {
    const { client, workers } = setup(); client.start(historicalInput);
    const oldMessage = workers[0].onmessage!, oldError = workers[0].onerror!;
    client.cancel(); expect(workers[0].stopped).toBe(true);
    oldMessage({ data: { type: "ready", run_id: 1, payload: historicalPayload() } } as MessageEvent<WorkerResponse>);
    oldError({} as ErrorEvent);
    expect(client.getSnapshot()).toMatchObject({ status: "cancelled", payload: null });
    client.start(historicalInput); oldError({} as ErrorEvent);
    expect(client.getSnapshot().status).toBe("loading");
  });
  it("replaces consecutive requests and never adopts old completions", () => {
    const { client, workers, ready } = setup(); client.start(historicalInput);
    const message = workers[0].onmessage!; client.start(historicalInput);
    message({ data: { type: "ready", run_id: 1, payload: historicalPayload() } } as MessageEvent<WorkerResponse>);
    expect(client.getSnapshot()).toMatchObject({ runId: 2, status: "loading", payload: null });
    ready(); expect(client.getSnapshot().runId).toBe(2);
    expect(workers[0].stopped).toBe(true);
  });
  it("retains the previous actual trial until the latest requested one arrives, without replacing summary", () => {
    const { client, workers, ready } = setup(); client.start(historicalInput); ready();
    const summary = client.getSnapshot().payload!.header.summary;
    client.selectTrial(1); client.selectTrial(2);
    workers[0].emit({ type: "trial_ready", run_id: 1, operation_id: 1, trial: { ...historicalPayload().trial!, trial_index: 1 } });
    expect(client.getSnapshot().payload!.trial!.trial_index).toBe(0);
    workers[0].emit({ type: "trial_ready", run_id: 1, operation_id: 2, trial: { ...historicalPayload().trial!, trial_index: 2 } });
    expect(client.getSnapshot().payload!.trial!.trial_index).toBe(2);
    expect(client.getSnapshot().payload!.header.summary).toBe(summary);
    expect(workers[0].requests.filter(r => r.type === "start")).toHaveLength(1);
  });
  it("reports loader/worker failures as errors, without fabricated results", () => {
    const { client, workers } = setup(); client.start(historicalInput);
    workers[0].emit({ type: "error", run_id: 1, stage: "run", message: "ARTIFACT_HASH" });
    expect(client.getSnapshot()).toMatchObject({ status: "error", payload: null, message: "ARTIFACT_HASH" });
    client.start(historicalInput); workers[1].onerror!({} as ErrorEvent);
    expect(client.getSnapshot().status).toBe("error"); expect(workers[1].stopped).toBe(true);
  });
  it("releases all output URLs on rerun/dispose and prevents duplicate exports", () => {
    const { client, workers, revoked, ready } = setup(); client.start(historicalInput); ready(); client.prepareExport(); client.prepareExport();
    expect(workers[0].requests.filter(r => r.type === "export")).toHaveLength(1);
    const body = new Blob(["{}\n"]);
    workers[0].emit({ type: "export_ready", run_id: 1, operation_id: 1, result: body, provenance: body, csv: body, info: { result_sha256: "a".repeat(64), result_bytes: 3, serialization_ms: 1, hashing_ms: 1 } });
    expect(client.getSnapshot().exportStatus).toBe("ready");
    client.start(historicalInput); expect(revoked).toEqual(["blob:test-1", "blob:test-2", "blob:test-3"]);
    client.dispose(); expect(workers[1].stopped).toBe(true);
  });
  it("does not report partial downloads as ready when Blob/URL creation fails", () => {
    const { client, workers, revoked, ready } = setup(2); client.start(historicalInput); ready(); client.prepareExport();
    const body = new Blob(["{}\n"]);
    workers[0].emit({ type: "export_ready", run_id: 1, operation_id: 1, result: body, provenance: body, csv: body, info: { result_sha256: "a".repeat(64), result_bytes: 3, serialization_ms: 1, hashing_ms: 1 } });
    expect(client.getSnapshot()).toMatchObject({ status: "success", exportStatus: "error", urls: null, exportInfo: null });
    expect(revoked).toEqual(["blob:test-1"]);
  });
});
