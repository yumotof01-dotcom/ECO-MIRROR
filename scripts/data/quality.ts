import { BASIC_TYPES, COLUMNS, ROUNDS, SOURCE, requireData } from "../../src/features/data/contract.ts";
import type { RawLabel } from "../../src/features/data/types.ts";
import type { SourceRow } from "./csv.ts";

// Code-point ordering is explicit and independent of the machine's locale.
export function compareValues(a: string | number, b: string | number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function group<K extends keyof SourceRow>(rows: readonly SourceRow[], keys: readonly K[]): (Pick<SourceRow, K> & { record_count: number })[] {
  const groups = new Map<string, { values: (string | number)[]; count: number }>();
  for (const row of rows) {
    const values = keys.map(key => row[key]);
    const key = JSON.stringify(values);
    const entry = groups.get(key) ?? { values, count: 0 };
    entry.count++;
    groups.set(key, entry);
  }
  return [...groups.values()].sort((a, b) => {
    for (let index = 0; index < keys.length; index++) {
      const order = compareValues(a.values[index], b.values[index]);
      if (order) return order;
    }
    return 0;
  }).map(({ values, count }) => ({ ...Object.fromEntries(keys.map((key, index) => [key, values[index]])), record_count: count }) as Pick<SourceRow, K> & { record_count: number });
}

export function labelInventory(rows: readonly SourceRow[], side: "plant" | "visitor"): RawLabel[] {
  const field = side === "plant" ? "Plant" : "Specimen_ID";
  return [...new Set(rows.map(row => row[field]))].sort(compareValues).map(raw => {
    const subset = rows.filter(row => row[field] === raw);
    const flags: string[] = [];
    if (raw.endsWith("_sp")) flags.push("unresolved_sp_label");
    if (["Bellardia_vulgaris_viarum", "Bombus_terrestris_lucorum", "Syrphus_vitripennis_rectus"].includes(raw)) flags.push("combined_label_requires_review");
    if (raw.endsWith("_sl")) flags.push("broad_sense_label_requires_review");
    return {
      label_id: `${side}:${raw}`, raw_label: raw, record_count: subset.length,
      year_2014: subset.filter(row => row.Year === 2014).length,
      year_2015: subset.filter(row => row.Year === 2015).length,
      basic_types: side === "visitor" ? [...new Set(subset.map(row => row.Basic_Type))].sort(compareValues) : [],
      label_flags: flags,
    };
  });
}

/** Audit counts only. These are not estimates of true species or ecosystem health. */
export function auditRows(rows: readonly SourceRow[]) {
  const exactCounts = new Map<string, number>();
  for (const row of rows) {
    const key = JSON.stringify(COLUMNS.map(column => row[column]));
    exactCounts.set(key, (exactCounts.get(key) ?? 0) + 1);
  }
  const repeated = [...exactCounts.values()].filter(count => count > 1);
  const yearPlot = group(rows, ["Year", "Plot", "Treatment"]);
  const yearPlotRound = group(rows, ["Year", "Plot", "Round"]);
  const present = new Set(rows.map(row => `${row.Year}:${row.Plot}:${row.Round}`));
  const withoutRecords = ([2014, 2015] as const).flatMap(Year => Array.from({ length: 24 }, (_, index) => index + 1).flatMap(Plot => ROUNDS[Year].filter(Round => !present.has(`${Year}:${Plot}:${Round}`)).map(Round => ({ Year, Plot, Round: Number(Round), status: "no_record_effort_unknown" }))));
  const plotConflicts = group(rows, ["Year", "Plot"]).filter(cell => yearPlot.filter(row => row.Year === cell.Year && row.Plot === cell.Plot).length !== 1).map(cell => [cell.Year, cell.Plot]);
  const basicConflicts = Object.fromEntries(labelInventory(rows, "visitor").filter(label => label.basic_types.length !== 1).map(label => [label.raw_label, label.basic_types]));
  const treatmentChanges = Array.from({ length: 24 }, (_, index) => index + 1).filter(plot => new Set(rows.filter(row => row.Plot === plot).map(row => row.Treatment)).size !== 1);
  return {
    record_count: rows.length,
    columns: COLUMNS.map(name => ({ name, type: ["Year", "Plot", "Round"].includes(name) ? "integer" : "string", distinct_count: new Set(rows.map(row => row[name])).size, empty_cell_count: 0, missing_marker_count: 0, outer_whitespace_count: 0 })),
    exact_row_repeats: { unique_seven_column_rows: exactCounts.size, repeated_groups: repeated.length, rows_in_repeated_groups: repeated.reduce((sum, count) => sum + count, 0), excess_if_deduplicated: rows.length - exactCounts.size, maximum_multiplicity: Math.max(0, ...exactCounts.values()), policy: "retain_all_rows" },
    plant_label_count: new Set(rows.map(row => row.Plant)).size,
    visitor_label_count: new Set(rows.map(row => row.Specimen_ID)).size,
    observed_pair_count: new Set(rows.map(row => JSON.stringify([row.Plant, row.Specimen_ID]))).size,
    basic_type_conflicts: basicConflicts,
    year_plot_treatment_conflicts: plotConflicts,
    treatment_changes_between_years: treatmentChanges,
    year_summary: ([2014, 2015] as const).map(Year => {
      const subset = rows.filter(row => row.Year === Year);
      return { Year, record_count: subset.length, plant_label_count: new Set(subset.map(row => row.Plant)).size, visitor_label_count: new Set(subset.map(row => row.Specimen_ID)).size, observed_pair_count: new Set(subset.map(row => JSON.stringify([row.Plant, row.Specimen_ID]))).size, plot_count: new Set(subset.map(row => row.Plot)).size, round_labels: [...new Set(subset.map(row => row.Round))].sort(compareValues), plot_round_cells_with_records: new Set(subset.map(row => `${row.Plot}:${row.Round}`)).size };
    }),
    year_treatment_counts: group(rows, ["Year", "Treatment"]),
    year_plot_counts: yearPlot,
    year_round_counts: group(rows, ["Year", "Round"]),
    year_plot_round_counts: yearPlotRound,
    plot_round_cells_without_records: withoutRecords,
    basic_type_counts: BASIC_TYPES.map(Basic_Type => ({ Basic_Type, record_count: rows.filter(row => row.Basic_Type === Basic_Type).length })),
    plant_inventory: labelInventory(rows, "plant").map(({ label_id: _id, ...label }) => label),
    visitor_inventory: labelInventory(rows, "visitor").map(({ label_id: _id, ...label }) => label),
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => compareValues(a, b));
    return "{" + entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",") + "}";
  }
  return JSON.stringify(value) ?? "undefined";
}

export function verifyAudit(rows: readonly SourceRow[], reference: Record<string, unknown>) {
  requireData(rows.length === SOURCE.record_count, "RECORD_COUNT", `expected ${SOURCE.record_count} records, received ${rows.length}`);
  const quality = auditRows(rows);
  for (const [key, actual] of Object.entries(quality)) {
    requireData(canonical(actual) === canonical(reference[key]), "AUDIT_MISMATCH", `phase-3 profile differs at ${key}; no rows or labels were repaired`);
  }
  return quality;
}
