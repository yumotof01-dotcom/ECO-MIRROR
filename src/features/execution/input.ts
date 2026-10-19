import { normalizeRequest } from "../simulation/core/inputs";
import { normalizeRepeatedRequest } from "../simulation/core/repeated";
import type { ExecutionInput } from "./protocol";

export function normalizeExecutionInput(input: ExecutionInput): ExecutionInput {
  if (!input || Object.keys(input).sort().join(",") !== "mode,request") throw new Error("実行モードと条件を指定してください。");
  if (input.mode === "single_trial") return { mode: input.mode, request: normalizeRequest(input.request) };
  if (input.mode === "repeated_trials") return { mode: input.mode, request: normalizeRepeatedRequest(input.request) };
  throw new Error("単一試行または反復試行を選択してください。");
}

/** Stable small request identity; no full-result serialization on the main thread. */
export function inputKey(input: ExecutionInput): string { return JSON.stringify(normalizeExecutionInput(input)); }
