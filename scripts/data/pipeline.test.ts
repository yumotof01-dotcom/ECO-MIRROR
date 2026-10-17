// @vitest-environment node
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { COLUMNS, SOURCE } from "../../src/features/data/contract.ts";
import { validateObservationData } from "../../src/features/data/validate.ts";
import { parseSourceCsv } from "./csv.ts";
import { RAW_DIR, PROFILE_PATH, readBytes, readJson, verifyArchiveMetadata, verifySourceBytes, verifySourceMetadata } from "./io.ts";
import { buildArtifacts } from "./pipeline.ts";
import { verifyAudit } from "./quality.ts";

const raw = await readBytes(`${RAW_DIR}/${SOURCE.filename}`);
const reference = await readJson(PROFILE_PATH);
const result = buildArtifacts(raw, reference);

describe("fixed university archive and full phase-3 audit", () => {
  it("checks exact size, SHA-256, MD5, license evidence and retrieval provenance", async () => {
    expect(verifySourceBytes(raw)).toEqual({ size: SOURCE.size, sha256: SOURCE.sha256, md5: SOURCE.md5 });
    await expect(verifySourceMetadata()).resolves.toMatchObject({ dataset_id: SOURCE.dataset_id, version: 1 });
  });

  it("stops on a same-size hash mismatch before parsing", () => {
    const altered = Buffer.from(raw);
    altered[100] ^= 1;
    expect(() => buildArtifacts(altered, reference)).toThrow(/SOURCE_SHA256/);
  });

  it("stops on a file size mismatch", () => {
    expect(() => verifySourceBytes(raw.subarray(0, -1))).toThrow(/SOURCE_SIZE/);
  });

  it("rejects changed archive metadata or an unconfirmed license", async () => {
    const metadata = await readJson(`${RAW_DIR}/archive-metadata.json`);
    expect(() => verifyArchiveMetadata({ ...metadata, version: 2 })).toThrow(/ARCHIVE_METADATA/);
    expect(() => verifyArchiveMetadata({ ...metadata, license: { name: "unknown" } })).toThrow(/SOURCE_LICENSE/);
  });

  it("matches all phase-3 bins, inventories and scientific audit counts", () => {
    for (const [key, value] of Object.entries(result.quality)) expect(value, key).toEqual(reference[key]);
    expect(result.quality).toMatchObject({ record_count: 3882, plant_label_count: 20, visitor_label_count: 104, observed_pair_count: 257 });
    expect(result.quality.year_summary.map(year => [year.Year, year.record_count])).toEqual([[2014, 1687], [2015, 2195]]);
    expect(result.quality.year_plot_counts).toHaveLength(48);
    expect(result.quality.year_plot_round_counts).toHaveLength(321);
  });

  it("preserves each original seven-column record, ordinal, order and unique ID", () => {
    const table = parse(raw.toString("utf8")) as string[][];
    expect(table[0]).toEqual(COLUMNS);
    expect(result.dataset.events).toHaveLength(table.length - 1);
    result.dataset.events.forEach((event, index) => {
      expect([String(event.year), event.plot_id, event.round_label, event.plant_label_raw, event.visitor_label_raw, event.basic_type_raw, event.treatment], `source record ${index + 1}`).toEqual(table[index + 1]);
      expect(event.source_record_number).toBe(index + 1);
      expect(event.record_id).toBe(`sha256:${SOURCE.sha256}:record:${index + 1}`);
      expect([event.observed_at, event.actual_effort_minutes, event.block_id]).toEqual([null, null, null]);
    });
    expect(new Set(result.dataset.events.map(event => event.record_id)).size).toBe(3882);
  });

  it("retains all 1,930 excess same-content rows and original taxon distinctions", () => {
    expect(result.quality.exact_row_repeats).toMatchObject({ unique_seven_column_rows: 1952, repeated_groups: 708, excess_if_deduplicated: 1930, maximum_multiplicity: 18 });
    expect(result.taxa.visitors.find(label => label.raw_label === "Aglais_io")?.record_count).toBe(1);
    expect(result.taxa.visitors.find(label => label.raw_label === "Inachis_io")?.record_count).toBe(2);
    expect(result.taxa.visitors.find(label => label.raw_label === "Bombus_terrestris_lucorum")?.record_count).toBe(160);
    expect(result.taxa.plants.find(label => label.raw_label === "Chrysanthemum_segetum")?.record_count).toBe(2637);
  });

  it("records all 15 no-record combinations as effort unknown, without inventing events", () => {
    expect(result.quality.plot_round_cells_without_records).toHaveLength(15);
    expect(result.quality.plot_round_cells_without_records.every(cell => cell.status === "no_record_effort_unknown")).toBe(true);
    for (const cell of result.quality.plot_round_cells_without_records) {
      expect(result.dataset.events.some(event => event.year === cell.Year && event.plot_id === String(cell.Plot) && event.round_label === String(cell.Round))).toBe(false);
    }
  });

  it("fails loudly if record count or a reference audit bin differs", () => {
    const rows = parseSourceCsv(raw.toString("utf8"));
    expect(() => verifyAudit(rows.slice(1), reference)).toThrow(/RECORD_COUNT.*3882.*3881/);
    expect(() => verifyAudit(rows, { ...reference, observed_pair_count: 258 })).toThrow(/AUDIT_MISMATCH.*observed_pair_count/);
    const moved = rows.map((row, index) => index === 0 ? { ...row, Plot: 1 } : row);
    expect(() => verifyAudit(moved, reference)).toThrow(/AUDIT_MISMATCH/);
  });

  it("reproduces every artifact byte from the same input without changing raw bytes", () => {
    const before = Buffer.from(raw);
    expect(buildArtifacts(raw, reference).files).toEqual(result.files);
    expect(raw.equals(before)).toBe(true);
    expect(result.files["events.json"]).not.toMatch(/retrieved_at|generated_at|timestamp/);
  });

  it("validates the browser contract and freezes all records and dictionaries", () => {
    const loaded = validateObservationData(JSON.parse(result.files["events.json"]), JSON.parse(result.files["taxa.json"]));
    expect(Object.isFrozen(loaded.dataset.events)).toBe(true);
    expect(Object.isFrozen(loaded.dataset.events[0])).toBe(true);
    expect(Object.isFrozen(loaded.taxa.visitors[0].basic_types)).toBe(true);
  });

  it.each([
    ["record ordinal", (event: Record<string, unknown>) => { event.source_record_number = 2; }, /DATA_TRACE/],
    ["inferred effort", (event: Record<string, unknown>) => { event.actual_effort_minutes = 20; }, /DATA_UNKNOWN/],
    ["modified label ID", (event: Record<string, unknown>) => { event.plant_label_id = "plant:corrected_name"; }, /DATA_LABEL_ID/],
    ["unexpected field", (event: Record<string, unknown>) => { event.health = 1; }, /DATA_SHAPE/],
  ])("rejects a corrupt processed %s", (_name, alter, error) => {
    const dataset = JSON.parse(result.files["events.json"]);
    alter(dataset.events[0]);
    expect(() => validateObservationData(dataset, JSON.parse(result.files["taxa.json"]))).toThrow(error);
  });
});
