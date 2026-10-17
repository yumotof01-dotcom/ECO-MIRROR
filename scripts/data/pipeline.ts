import { SCHEMA_VERSION, SOURCE, TRANSFORM_VERSION } from "../../src/features/data/contract.ts";
import type { ObservationDataset, RawLabelDictionary } from "../../src/features/data/types.ts";
import { parseSourceCsv } from "./csv.ts";
import type { SourceRow } from "./csv.ts";
import { RAW_DIR, PROFILE_PATH, codeProvenance, jsonBytes, readBytes, sha256, verifySourceBytes, verifySourceMetadata } from "./io.ts";
import { labelInventory, verifyAudit } from "./quality.ts";

export const identity = { dataset_id: SOURCE.dataset_id, source_sha256: SOURCE.sha256, schema_version: SCHEMA_VERSION, transform_version: TRANSFORM_VERSION };

/** Pure mapping: source order, source labels, duplicates and unknowns are preserved. */
export function normalizeRows(rows: readonly SourceRow[]): ObservationDataset {
  return { ...identity, events: rows.map((row, index) => ({
    source_record_number: index + 1,
    record_id: `sha256:${SOURCE.sha256}:record:${index + 1}`,
    year: row.Year, plot_id: String(row.Plot), round_label: String(row.Round),
    plot_year_id: `${row.Year}:plot:${row.Plot}`,
    observation_group_id: `${row.Year}:plot:${row.Plot}:round:${row.Round}`,
    treatment: row.Treatment, plant_label_raw: row.Plant, visitor_label_raw: row.Specimen_ID,
    plant_label_id: `plant:${row.Plant}`, visitor_label_id: `visitor:${row.Specimen_ID}`,
    basic_type_raw: row.Basic_Type,
    observed_at: null, actual_effort_minutes: null, block_id: null,
  })) };
}

/** Single production entry: source verification precedes parsing and all outputs. */
export function buildArtifacts(bytes: Uint8Array, reference: Record<string, unknown>) {
  verifySourceBytes(bytes);
  const rows = parseSourceCsv(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const quality = verifyAudit(rows, reference);
  const dataset = normalizeRows(rows);
  const taxa: RawLabelDictionary = { ...identity, plants: labelInventory(rows, "plant"), visitors: labelInventory(rows, "visitor") };
  const files: Record<string, string> = {
    "events.json": jsonBytes(dataset),
    "taxa.json": jsonBytes(taxa),
    "quality.json": jsonBytes({ ...identity, ...quality }),
  };
  const outputs = Object.fromEntries(Object.entries(files).map(([name, content]) => [name, { sha256: sha256(content), bytes: Buffer.byteLength(content) }]));
  files["artifacts.json"] = jsonBytes({ ...identity, outputs });
  return { files, dataset, taxa, quality, outputs };
}

/** Acquisition time is read from the separate source record, never generated here. */
export async function buildProvenance(result: ReturnType<typeof buildArtifacts>) {
  const source = await verifySourceMetadata();
  const code = await codeProvenance();
  return { ...identity, ...code,
    source: { path: `${RAW_DIR}/${SOURCE.filename}`, url: SOURCE.url, doi: SOURCE.doi, version: SOURCE.version, sha256: SOURCE.sha256, source_metadata_path: `${RAW_DIR}/source.json`, source_metadata_sha256: sha256(await readBytes(`${RAW_DIR}/source.json`)), retrieved_at_utc: source.retrieved_at_utc },
    phase3_profile_sha256: sha256(await readBytes(PROFILE_PATH)),
    serialization: "UTF-8; LF; JSON.stringify(value, null, 2) + final LF; fixed property order; source event order; code-point sorted label dictionaries; no timestamps in artifacts",
    taxonomy_version: "verbatim-raw-labels-v1",
    commands: ["npm ci", "npm run data:fetch", "npm run data:normalize", "npm run data:check", "npm test", "npm run build"],
    outputs: { ...result.outputs, "artifacts.json": { sha256: sha256(result.files["artifacts.json"]), bytes: Buffer.byteLength(result.files["artifacts.json"]) } },
    changes: "All 3,882 source records retained in source order; strict integer conversion and traceable IDs added; label dictionaries and audit counts derived. No taxonomic correction, deduplication, zero filling or inferred survey information. UK experiment flower visits; not evidence of successful pollination or Japanese grassland condition.",
    attribution: source.attribution,
  };
}
