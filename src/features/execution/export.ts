import { asciiCompare, isObject } from "../simulation/core/errors";
import { canonicalJson } from "../simulation/core/serialization";
import { SOURCE } from "../data/contract";
import type { RunResult } from "../simulation/core/types";
import type { BrowserMetadata } from "./metadata";
import type { ExportInfo } from "./protocol";

/** Same serialization 1.0.0 bytes as canonicalJson, without cloning the complete object. */
function* tokens(value: unknown, level: number, ancestors: Set<object>): Generator<string> {
  if (value === null || typeof value === "string" || typeof value === "boolean") { yield JSON.stringify(value); return; }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("EXPORT_VALUE: nonnegative safe integer required");
    yield JSON.stringify(value === 0 ? 0 : value); return;
  }
  if (!Array.isArray(value) && !isObject(value)) throw new Error("EXPORT_VALUE: plain JSON value required");
  if (ancestors.has(value)) throw new Error("EXPORT_VALUE: cyclic object");
  ancestors.add(value);
  const array = Array.isArray(value);
  // JSON.stringify enumerates integer-index object keys numerically even after canonical sorting.
  const keys = array ? Array.from({ length: value.length }, (_, i) => String(i)) : Object.keys(Object.fromEntries(Object.keys(value).sort(asciiCompare).map(key => [key, null])));
  if (Reflect.ownKeys(value).length !== keys.length + (array ? 1 : 0) || keys.some(key => !Object.hasOwn(value, key))) throw new Error("EXPORT_VALUE: sparse array or extra properties");
  if (!array && keys.some(key => !/^[\x20-\x7e]*$/.test(key))) throw new Error("EXPORT_VALUE: object keys must be ASCII");
  const open = array ? "[" : "{", close = array ? "]" : "}";
  if (!keys.length) { yield open + close; ancestors.delete(value); return; }
  yield open + "\n";
  for (let i = 0; i < keys.length; i++) {
    yield "  ".repeat(level + 1);
    if (!array) yield JSON.stringify(keys[i]) + ": ";
    yield* tokens((value as Record<string, unknown>)[keys[i]], level + 1, ancestors);
    yield i === keys.length - 1 ? "\n" : ",\n";
  }
  yield "  ".repeat(level) + close; ancestors.delete(value);
}

export function canonicalBlob(value: unknown): Blob {
  const encoder = new TextEncoder(), parts: BlobPart[] = [];
  let buffer = "";
  for (const token of tokens(value, 0, new Set())) {
    buffer += token;
    // Flush only complete JSON tokens: never split a UTF-16 surrogate pair.
    if (buffer.length >= 65536) { parts.push(encoder.encode(buffer)); buffer = ""; }
  }
  parts.push(encoder.encode(buffer + "\n"));
  return new Blob(parts, { type: "application/json;charset=utf-8" });
}

export async function blobSha256(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("CRYPTO_UNAVAILABLE: SHA-256を利用できません。");
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, "0")).join("");
}

export function trialsCsv(result: RunResult): string {
  const rows: (string | number)[][] = [["trial_index", "event_count_records", "plant_label_count_raw_labels", "visitor_label_count_raw_labels", "pair_count_pairs", "lost_pair_count_pairs", "pair_retention_pct_numerator", "pair_retention_pct_denominator", "pair_retention_unit", "connectance_fixed_numerator", "connectance_fixed_denominator", "connectance_unit"]];
  for (const trial of result.trials) rows.push([trial.trial_index, trial.sample.event_count, trial.sample.plant_label_count, trial.sample.visitor_label_count, trial.sample.pair_count, trial.lost_pair_count, trial.pair_retention_pct?.numerator ?? "", trial.pair_retention_pct?.denominator ?? "", "percent", trial.sample.connectance_fixed?.numerator ?? "", trial.sample.connectance_fixed?.denominator ?? "", "dimensionless"]);
  return rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\r\n") + "\r\n";
}

/** Caller validates the complete immutable core result before this boundary. */
export async function prepareArtifacts(result: RunResult, metadata: BrowserMetadata, phase: (message: string) => void) {
  if (metadata.verification !== "verified" || !metadata.context || !metadata.application_git_revision || !metadata.data_provenance_sha256) throw new Error("UNVERIFIED_BUILD: 検証済みの実装だけを正式保存できます。");
  phase("全試行の正式JSONを作成しています。");
  const start = performance.now(), body = canonicalBlob(result), serialization_ms = performance.now() - start;
  phase("正式JSONのSHA-256を計算しています。");
  const hashStart = performance.now(), result_sha256 = await blobSha256(body), hashing_ms = performance.now() - hashStart;
  phase("出典・来歴と派生CSVを作成しています。");
  const provenance = {
    result_sha256, data_provenance_sha256: metadata.data_provenance_sha256, created_at_utc: new Date().toISOString(), runtime: typeof navigator === "undefined" ? "Node test boundary" : navigator.userAgent,
    code_input_sha256: metadata.code_input_sha256, application_git_revision: metadata.application_git_revision, application_input_sha256: metadata.application_input_sha256,
    attribution: { creators: SOURCE.creators, title: SOURCE.title, year: 2022, archive_doi: SOURCE.doi, archive_version: SOURCE.version, license: SOURCE.license, source_url: SOURCE.url, source_metadata_path: `data/raw/${SOURCE.dataset_id}/source.json`, changes: "Verbatim-label event selection without replacement, network summaries, conditional-model statistics and visualization. UK experiment visits, not pollination success or Japanese grassland condition. No endorsement implied." },
    commands: ["npm ci", "npm run check", "node scripts/simulation/verify.ts", "node scripts/simulation/verify-repeated.ts"],
    reproduction: { mode: result.execution_mode, request: { selection: result.selection, rate_percent: result.sampling.rate_percent, master_seed: result.randomness.master_seed, ...(result.execution_mode === "repeated_trials" ? { repetitions: result.requested_repetitions } : {}) } },
    csv_format: "CSV is derived. Retention and connectance have exact decimal-integer numerator/denominator columns. Retention unit is percent, connectance dimensionless. No rounded display values.",
  };
  const info: ExportInfo = { result_sha256, result_bytes: body.size, serialization_ms, hashing_ms };
  return { result: body, provenance: new Blob([canonicalJson(provenance)], { type: "application/json;charset=utf-8" }), csv: new Blob([trialsCsv(result)], { type: "text/csv;charset=utf-8" }), info };
}
