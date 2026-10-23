import type { ExecutionInput, ExportInfo, ReadyPayload, WorkerPort, WorkerResponse } from "./protocol";
import { inputKey, normalizeExecutionInput } from "./input";

export type ExecutionStatus = "idle" | "loading" | "running" | "success" | "empty_scope" | "error" | "cancelled";
export interface ExecutionState {
  readonly status: ExecutionStatus;
  readonly runId: number;
  readonly input: ExecutionInput | null;
  readonly message: string;
  readonly payload: ReadyPayload | null;
  readonly pendingTrial: number | null;
  readonly exportStatus: "idle" | "preparing" | "ready" | "error";
  readonly exportMessage: string;
  readonly exportInfo: ExportInfo | null;
  readonly urls: { readonly result: string; readonly provenance: string; readonly csv: string } | null;
}
const initial: ExecutionState = { status: "idle", runId: 0, input: null, message: "まだ実行していません。", payload: null, pendingTrial: null, exportStatus: "idle", exportMessage: "", exportInfo: null, urls: null };

/** Small observable state. No complete RunResult or output byte arrays in React state. */
export class ExecutionClient {
  private state: ExecutionState = initial;
  private worker: WorkerPort | null = null;
  private listeners = new Set<() => void>();
  private runId = 0;
  private trialOperation = 0;
  private exportOperation = 0;
  private readonly factory: () => WorkerPort;
  private readonly createUrl: (blob: Blob) => string;
  private readonly revokeUrl: (url: string) => void;
  constructor(factory: () => WorkerPort, urls = { create: (blob: Blob) => URL.createObjectURL(blob), revoke: (url: string) => URL.revokeObjectURL(url) }) { this.factory = factory; this.createUrl = urls.create; this.revokeUrl = urls.revoke; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ExecutionState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  private release() {
    if (this.worker) { this.worker.onmessage = null; this.worker.onerror = null; this.worker.onmessageerror = null; this.worker.terminate(); this.worker = null; }
    if (this.state.urls) Object.values(this.state.urls).forEach(this.revokeUrl);
  }
  start(input: ExecutionInput) {
    this.release(); const id = ++this.runId;
    this.update({ ...initial, runId: id, status: "loading", message: "データの読込を開始しています。" });
    try {
      const normalized = normalizeExecutionInput(input);
      this.update({ input: normalized });
      const worker = this.factory(); this.worker = worker;
      worker.onmessage = event => {
        if (this.worker !== worker || this.state.runId !== id || event.data.run_id !== id) return;
        try { this.receive(event.data); } catch (error) { this.fail(`結果の受信検証に失敗しました：${String(error)}`); }
      };
      worker.onerror = () => { if (this.worker === worker && this.state.runId === id) this.fail("計算Workerが終了しました。メモリ不足やブラウザの制限の可能性があります。条件・回数は自動変更していません。再実行するか、条件を見直してください。"); };
      worker.onmessageerror = () => { if (this.worker === worker && this.state.runId === id) this.fail("Workerの結果を受信できませんでした。再実行してください。"); };
      worker.postMessage({ type: "start", run_id: id, input: normalized });
    } catch (error) { this.fail(error instanceof Error ? error.message : String(error)); }
  }
  private receive(message: WorkerResponse) {
    if (this.state.status === "cancelled" || this.state.status === "error") return;
    if (message.type === "phase" && ["loading", "running"].includes(this.state.status)) this.update({ status: message.phase, message: message.message });
    else if (message.type === "ready") {
      const status = message.payload.header.status;
      const input = this.state.input, header = message.payload.header;
      if (!input || !["success", "empty_scope"].includes(status) || header.execution_mode !== input.mode || header.sampling.rate_percent !== input.request.rate_percent || header.randomness.master_seed !== input.request.master_seed || header.requested_repetitions !== (input.mode === "repeated_trials" ? input.request.repetitions : 1) || inputKey({ ...input, request: { ...input.request, selection: header.selection } } as ExecutionInput) !== inputKey(input)) throw new Error("受信した結果と実行条件が一致しません。");
      this.update({ status, payload: message.payload, message: status === "success" ? "計算と結果の検証が完了しました。" : "選択範囲に元の観測記録がありません。" });
    } else if (message.type === "trial_ready" && message.operation_id === this.trialOperation && this.state.payload) {
      if (message.trial.trial_index !== this.state.pendingTrial) return;
      this.update({ payload: { ...this.state.payload, trial: message.trial }, pendingTrial: null });
    } else if (message.type === "export_phase" && message.operation_id === this.exportOperation) this.update({ exportMessage: message.message });
    else if (message.type === "export_ready" && message.operation_id === this.exportOperation) {
      const created: string[] = [];
      try {
        if (message.result.size !== message.info.result_bytes || !/^[a-f0-9]{64}$/.test(message.info.result_sha256)) throw new Error("保存ファイルの受信検証に失敗しました。");
        const make = (blob: Blob) => { const url = this.createUrl(blob); created.push(url); return url; };
        const urls = { result: make(message.result), provenance: make(message.provenance), csv: make(message.csv) };
        this.update({ exportStatus: "ready", exportMessage: "ファイルを準備しました。各保存リンクから端末へ保存してください。", exportInfo: message.info, urls });
      } catch (error) {
        created.forEach(this.revokeUrl);
        this.update({ exportStatus: "error", exportMessage: String(error), urls: null, exportInfo: null });
      }
    } else if (message.type === "error") {
      if (message.stage === "export") { if (message.operation_id === this.exportOperation) this.update({ exportStatus: "error", exportMessage: message.message }); }
      else if (message.stage !== "trial" || message.operation_id === this.trialOperation) this.fail(message.message);
    }
  }
  private fail(message: string) { this.release(); this.update({ status: "error", message, payload: null, pendingTrial: null, urls: null, exportStatus: "idle" }); }
  cancel(message = "実行を中止しました。結果は採用していません。") {
    this.release(); ++this.runId;
    this.update({ ...initial, status: "cancelled", runId: this.runId, input: this.state.input, message });
  }
  selectTrial(index: number) {
    if (this.state.status !== "success" || !this.state.payload || !this.worker) return;
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.state.payload.header.requested_repetitions) { this.fail("存在しない試行番号です。"); return; }
    const operation_id = ++this.trialOperation;
    this.update({ pendingTrial: index });
    try { this.worker.postMessage({ type: "trial", run_id: this.state.runId, operation_id, trial_index: index }); }
    catch (error) { this.fail(`試行の読込要求に失敗しました：${String(error)}`); }
  }
  prepareExport() {
    if (!["success", "empty_scope"].includes(this.state.status) || !this.worker || this.state.exportStatus === "preparing" || this.state.exportStatus === "ready") return;
    if (this.state.payload?.metadata.verification !== "verified") { this.update({ exportStatus: "error", exportMessage: "開発用の未検証スナップショットです。アプリ実装をコミットして再起動してから正式保存してください。" }); return; }
    const operation_id = ++this.exportOperation;
    this.update({ exportStatus: "preparing", exportMessage: "保存ファイルの検証を開始しています。" });
    try { this.worker.postMessage({ type: "export", run_id: this.state.runId, operation_id }); }
    catch (error) { this.update({ exportStatus: "error", exportMessage: `保存の要求に失敗しました：${String(error)}` }); }
  }
  dispose() { this.release(); ++this.runId; this.state = initial; }
}
