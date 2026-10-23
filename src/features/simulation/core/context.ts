import { SCHEMA_VERSION, SOURCE, TRANSFORM_VERSION } from "../../data/contract.ts";
import { hasKeys, isObject, requireSimulation } from "./errors.ts";
import type { DataIdentity, RunContext } from "./types.ts";

export const SPECIFICATION_PATHS = Object.freeze([
  "model-specification.md", "metrics.md", "randomness.md", "repetitions.md", "reproducibility.md",
  "edge-cases.md", "scientific-limitations.md", "worked-examples.md", "conformance-fixtures.json",
].map(name => `docs/simulation/${name}`));

export const EXPECTED_DATA_IDENTITY: DataIdentity = Object.freeze({
  dataset_id: SOURCE.dataset_id, archive_doi: SOURCE.doi, archive_version: 1, source_sha256: SOURCE.sha256,
  normalized_events_sha256: "17c87b30f3f66f8d3537123c75ea29a8d3193f9f1f0381a8e48460fd3f73d58c",
  taxa_sha256: "10d4fc491c12718d21e4fb2ee9d65876084bbf7e2d122a63e31f33e1d441453d",
  data_schema_version: SCHEMA_VERSION, transform_version: TRANSFORM_VERSION,
  transform_git_revision: "c286c76e3a6d0e28ae9a22b7efd3686ca4f54f94", taxonomy_mode: "verbatim-raw-labels-v1",
});

/** Syntax/identity only: Git existence and file bytes must be checked by the caller. */
export function validateContext(context: unknown): asserts context is RunContext {
  requireSimulation(isObject(context) && hasKeys(context, ["implementation_git_revision", "specification_sha256", "data_identity"]), "INVALID_CONTEXT", "context", "expected revision, specification hashes and data identity");
  requireSimulation(typeof context.implementation_git_revision === "string" && /^[a-f0-9]{40}$/.test(context.implementation_git_revision), "INVALID_CONTEXT", "context", "implementation revision must identify a real committed snapshot (verified at the boundary)");
  requireSimulation(isObject(context.specification_sha256) && hasKeys(context.specification_sha256, SPECIFICATION_PATHS)
    && Object.values(context.specification_sha256).every(hash => typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash)), "INVALID_CONTEXT", "context", "expected SHA-256 for each of the nine normative files");
  requireSimulation(isObject(context.data_identity) && hasKeys(context.data_identity, Object.keys(EXPECTED_DATA_IDENTITY))
    && Object.entries(EXPECTED_DATA_IDENTITY).every(([key, value]) => (context.data_identity as Record<string, unknown>)[key] === value), "INVALID_CONTEXT", "context", "data identity differs from the selected phase-4 snapshot");
}
