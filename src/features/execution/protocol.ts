import type { Fraction, RepeatedTrialRequest, RunResult, SingleTrialRequest, TrialResult } from "../simulation/core/types";
import type { BrowserMetadata } from "./metadata";

export type ExecutionInput = { readonly mode: "single_trial"; readonly request: SingleTrialRequest } | { readonly mode: "repeated_trials"; readonly request: RepeatedTrialRequest };
/** An explicit fragment, never presented or exported as a complete RunResult. */
export type RunHeader = RunResult extends infer T ? T extends RunResult ? Omit<T, "trials"> : never : never;
export interface DistributionValue { readonly trial_index: number; readonly pair_count: number; readonly pair_retention_pct: Fraction }
export interface ReadyPayload {
  readonly header: RunHeader;
  readonly trial: TrialResult | null;
  readonly distribution: readonly DistributionValue[];
  readonly metadata: BrowserMetadata;
  readonly calculation_ms: number;
  readonly ui_payload_bytes: number;
}
export type WorkerRequest =
  | { readonly type: "start"; readonly run_id: number; readonly input: ExecutionInput }
  | { readonly type: "trial"; readonly run_id: number; readonly operation_id: number; readonly trial_index: number }
  | { readonly type: "export"; readonly run_id: number; readonly operation_id: number };
export interface ExportInfo { readonly result_sha256: string; readonly result_bytes: number; readonly serialization_ms: number; readonly hashing_ms: number }
export type WorkerResponse =
  | { readonly type: "phase"; readonly run_id: number; readonly phase: "loading" | "running"; readonly message: string }
  | { readonly type: "ready"; readonly run_id: number; readonly payload: ReadyPayload }
  | { readonly type: "trial_ready"; readonly run_id: number; readonly operation_id: number; readonly trial: TrialResult }
  | { readonly type: "export_phase"; readonly run_id: number; readonly operation_id: number; readonly message: string }
  | { readonly type: "export_ready"; readonly run_id: number; readonly operation_id: number; readonly info: ExportInfo; readonly result: Blob; readonly provenance: Blob; readonly csv: Blob }
  | { readonly type: "error"; readonly run_id: number; readonly stage: "run" | "trial" | "export"; readonly operation_id?: number; readonly message: string };

export interface WorkerPort {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: WorkerRequest): void;
  terminate(): void;
}
