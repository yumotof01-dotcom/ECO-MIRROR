import { parse } from "csv-parse/sync";
import { BASIC_TYPES, COLUMNS, ROUNDS, TREATMENTS, requireData, DataValidationError } from "../../src/features/data/contract.ts";
import type { BasicType, ObservationYear, Treatment } from "../../src/features/data/types.ts";

export interface SourceRow {
  readonly Year: ObservationYear;
  readonly Plot: number;
  readonly Round: number;
  readonly Plant: string;
  readonly Specimen_ID: string;
  readonly Basic_Type: BasicType;
  readonly Treatment: Treatment;
}

export function validateSourceCells(cells: readonly unknown[], recordNumber: number): SourceRow {
  const where = `CSV record ${recordNumber} (header excluded)`;
  requireData(cells.length === 7, "CSV_COLUMNS", `${where}: expected 7 columns, received ${cells.length}`);
  cells.forEach((value, index) => {
    requireData(typeof value === "string", "CSV_TYPE", `${where}, ${COLUMNS[index]}: expected string`);
    requireData(!["", "na", "n/a", "null", "(null)", "nan", "none"].includes(value.trim().toLowerCase()), "CSV_MISSING", `${where}, ${COLUMNS[index]}: unexpected missing value`);
    requireData(value === value.trim(), "CSV_WHITESPACE", `${where}, ${COLUMNS[index]}: outer whitespace is not corrected`);
  });
  const [yearText, plotText, roundText, plant, visitor, basicType, treatment] = cells as string[];
  for (const [column, value] of [["Year", yearText], ["Plot", plotText], ["Round", roundText]]) {
    requireData(/^[1-9][0-9]*$/.test(value), "CSV_INTEGER", `${where}, ${column}: invalid integer ${JSON.stringify(value)}`);
  }
  const year = Number(yearText);
  requireData(year === 2014 || year === 2015, "CSV_YEAR", `${where}: unsupported Year ${yearText}`);
  const plot = Number(plotText);
  requireData(Number.isSafeInteger(plot) && plot >= 1 && plot <= 24, "CSV_PLOT", `${where}: Plot must be 1–24`);
  requireData((ROUNDS[year] as readonly string[]).includes(roundText), "CSV_ROUND", `${where}: Round ${roundText} is not a source label for ${year}`);
  requireData((BASIC_TYPES as readonly string[]).includes(basicType), "CSV_BASIC_TYPE", `${where}: unsupported Basic_Type ${basicType}`);
  requireData((TREATMENTS as readonly string[]).includes(treatment), "CSV_TREATMENT", `${where}: unsupported Treatment ${treatment}`);
  return { Year: year, Plot: plot, Round: Number(roundText), Plant: plant, Specimen_ID: visitor, Basic_Type: basicType as BasicType, Treatment: treatment as Treatment };
}

/** Low-level syntax validation; production entry always verifies source bytes first. */
export function parseSourceCsv(text: string): SourceRow[] {
  let table: unknown[][];
  try {
    table = parse(text, { bom: false, columns: false, skip_empty_lines: false, relax_column_count: true, trim: false }) as unknown[][];
  } catch (error) {
    throw new DataValidationError("CSV_SYNTAX", error instanceof Error ? error.message : String(error));
  }
  requireData(table.length > 0 && JSON.stringify(table[0]) === JSON.stringify(COLUMNS), "CSV_HEADER", `expected ordered columns ${COLUMNS.join(", ")}`);
  return table.slice(1).map((cells, index) => validateSourceCells(cells, index + 1));
}
