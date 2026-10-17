import specificationFixtures from "../../docs/simulation/conformance-fixtures.json" with { type: "json" };
import { ROUNDS, TREATMENTS } from "../../src/features/data/contract.ts";
import type { CoreEvent, Selection } from "../../src/features/simulation/core/types.ts";
import { sha256 } from "../data/io.ts";

// Specification fixtures are never supplied to the production dataset loader.
export const fixtures = specificationFixtures;
export const toy: readonly CoreEvent[] = Object.freeze(fixtures.toy_records.map((row: { id: number; plant: string; visitor: string }) => Object.freeze({
  source_record_number: row.id, record_id: `synthetic-fixture:record:${row.id}`,
  plant_label_raw: row.plant, visitor_label_raw: row.visitor, plant_label_id: `plant:${row.plant}`, visitor_label_id: `visitor:${row.visitor}`,
})));
export const allSelection: Selection = {
  years: [2014, 2015], plot_ids: Array.from({ length: 24 }, (_, i) => String(i + 1)), treatments: [...TREATMENTS],
  rounds_by_year: { 2014: [...ROUNDS[2014]], 2015: [...ROUNDS[2015]] },
};
export const copy = <T>(value: T): T => structuredClone(value);
export { sha256 };
