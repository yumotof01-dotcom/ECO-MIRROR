import { loadObservationData } from "../data/index";
import { runSingleTrial } from "../simulation/core/run";
import { runRepeatedTrials } from "../simulation/core/repeated";
import { sha256Text } from "../simulation/hash";
import { validateContext } from "../simulation/core/context";
import type { ObservationData } from "../data/index";
import type { RunResult } from "../simulation/core/types";
import type { BrowserMetadata } from "./metadata";
import type { ExecutionInput, ReadyPayload, WorkerRequest, WorkerResponse } from "./protocol";
import { normalizeExecutionInput } from "./input";
import { validateCompletedResult } from "./validate";
import { prepareArtifacts } from "./export";

interface Dependencies {
  metadata: () => Promise<BrowserMetadata>;
  load?: () => Promise<ObservationData>;
}

/** One lifetime / one execution. Complete results never leave this worker-owned instance. */
export class ExecutionRuntime {
  private runId: number | null = null;
  private result: RunResult | null = null;
  private input: ExecutionInput | null = null;
  private metadata: BrowserMetadata | null = null;
  private exporting = false;
  private readonly post: (message: WorkerResponse) => void;
  private readonly dependencies: Dependencies;
  constructor(post: (message: WorkerResponse) => void, dependencies: Dependencies) { this.post = post; this.dependencies = dependencies; }

  async handle(message: WorkerRequest): Promise<void> {
    const stage = message.type === "start" ? "run" : message.type;
    try {
      if (!Number.isSafeInteger(message.run_id) || message.run_id < 1) throw new Error("無効な実行IDです。");
      if (message.type === "start") {
        if (this.runId !== null) throw new Error("1つのWorkerを別の実行に再利用できません。");
        this.runId = message.run_id;
        this.input = normalizeExecutionInput(message.input);
        this.post({ type: "phase", run_id: message.run_id, phase: "loading", message: "データと実装の来歴を確認しています。" });
        const metadata = await this.dependencies.metadata();
        if (!metadata.context) throw new Error(metadata.reason ?? "計算来歴を検証できませんでした。");
        validateContext(metadata.context); this.metadata = metadata;
        const data = await (this.dependencies.load ?? loadObservationData)();
        this.post({ type: "phase", run_id: message.run_id, phase: "running", message: `実データから${this.input.mode === "single_trial" ? 1 : this.input.request.repetitions}試行を計算しています。` });
        const start = performance.now();
        const result = this.input.mode === "single_trial"
          ? await runSingleTrial(data, this.input.request, metadata.context, sha256Text)
          : await runRepeatedTrials(data, this.input.request, metadata.context, sha256Text);
        await validateCompletedResult(result, this.input, metadata.context, sha256Text);
        this.result = result;
        const { trials, ...header } = result;
        const distribution = trials.map(t => {
          if (!t.pair_retention_pct) throw new Error("成功した試行の保持率が欠けています。");
          return { trial_index: t.trial_index, pair_count: t.sample.pair_count, pair_retention_pct: t.pair_retention_pct };
        });
        const base = { header, trial: trials[0] ?? null, distribution, metadata, calculation_ms: performance.now() - start };
        const payload: ReadyPayload = { ...base, ui_payload_bytes: new TextEncoder().encode(JSON.stringify(base)).length };
        this.post({ type: "ready", run_id: message.run_id, payload });
        return;
      }
      if (message.run_id !== this.runId) return;
      if (!this.result || !this.input || !this.metadata) throw new Error("完了した実行がありません。");
      if (!Number.isSafeInteger(message.operation_id) || message.operation_id < 1) throw new Error("無効な操作IDです。");
      if (message.type === "trial") {
        const t = message.trial_index;
        if (!Number.isSafeInteger(t) || t < 0 || t >= this.result.trials.length) throw new Error("存在しない試行番号です。");
        this.post({ type: "trial_ready", run_id: message.run_id, operation_id: message.operation_id, trial: this.result.trials[t] });
      } else if (message.type === "export") {
        if (this.exporting) throw new Error("保存ファイルを準備中です。");
        this.exporting = true;
        try {
          await validateCompletedResult(this.result, this.input, this.metadata.context!, sha256Text);
          const artifacts = await prepareArtifacts(this.result, this.metadata, text => this.post({ type: "export_phase", run_id: message.run_id, operation_id: message.operation_id, message: text }));
          this.post({ type: "export_ready", run_id: message.run_id, operation_id: message.operation_id, ...artifacts });
        } finally { this.exporting = false; }
      } else throw new Error("未知のWorkerメッセージです。");
    } catch (error) {
      this.post({ type: "error", run_id: message.run_id, stage, ...(message.type === "start" ? {} : { operation_id: message.operation_id }), message: error instanceof Error ? error.message : String(error) });
    }
  }
}
