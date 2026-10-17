// @vitest-environment node
import { describe, expect, it } from "vitest";
import { COLUMNS } from "../../src/features/data/contract.ts";
import { parseSourceCsv } from "./csv.ts";

// Deliberately synthetic fixtures: never exported to the app or processed dataset.
const header = COLUMNS.join(",");
const line = "2014,2,1,Plant_sp,Visitor_sp,Hoverfly,Heat+Water";
const csv = (...lines: string[]) => `${header}\r\n${lines.join("\r\n")}\r\n`;

describe("strict CSV syntax and source domain", () => {
  it("uses CSV quoting rules, including commas and escaped quotes", () => {
    const [row] = parseSourceCsv(csv('2014,2,1,"Plant, label","Visitor_""label""",Hoverfly,Heat+Water'));
    expect(row.Plant).toBe("Plant, label");
    expect(row.Specimen_ID).toBe('Visitor_"label"');
  });

  it("retains identical records separately and in original order", () => {
    const rows = parseSourceCsv(csv(line, line, line.replace("Plant_sp", "Plant_species")));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(rows[1]);
    expect(rows[0]).not.toBe(rows[1]);
    expect(rows[2].Plant).toBe("Plant_species");
  });

  it("keeps similar but distinct verbatim labels", () => {
    const rows = parseSourceCsv(csv(line.replace("Visitor_sp", "Aglais_io"), line.replace("Visitor_sp", "Inachis_io"), line.replace("Visitor_sp", "Lucilia_ceasar"), line.replace("Visitor_sp", "Lucilia_caesar")));
    expect(rows.map(row => row.Specimen_ID)).toEqual(["Aglais_io", "Inachis_io", "Lucilia_ceasar", "Lucilia_caesar"]);
  });

  it("retains year-specific round labels without renumbering", () => {
    const rows = parseSourceCsv(csv(line.replace(",2,1,", ",2,9,"), line.replace("2014", "2015").replace(",2,1,", ",2,2,")));
    expect(rows.map(row => [row.Year, row.Round])).toEqual([[2014, 9], [2015, 2]]);
    expect(() => parseSourceCsv(csv(line.replace(",2,1,", ",2,2,")))).toThrow(/CSV_ROUND.*2014/);
    expect(() => parseSourceCsv(csv(line.replace("2014", "2015").replace(",2,1,", ",2,9,")))).toThrow(/CSV_ROUND.*2015/);
  });

  it.each([
    ["missing column", csv(line.substring(0, line.lastIndexOf(","))), /CSV_COLUMNS.*record 1/],
    ["extra column", csv(`${line},extra`), /CSV_COLUMNS/],
    ["wrong header", csv(line).replace("Specimen_ID", "Visitor"), /CSV_HEADER/],
    ["missing header column", csv(line).replace(",Treatment", ""), /CSV_HEADER/],
    ["invalid year", csv(line.replace("2014", "year")), /CSV_INTEGER.*Year/],
    ["invalid plot", csv(line.replace(",2,1,", ",two,1,")), /CSV_INTEGER.*Plot/],
    ["invalid round", csv(line.replace(",2,1,", ",2,1.5,")), /CSV_INTEGER.*Round/],
    ["year code instead of calendar year", csv(line.replace("2014", "1")), /CSV_YEAR/],
    ["plot out of range", csv(line.replace(",2,1,", ",25,1,")), /CSV_PLOT/],
    ["empty cell", csv(line.replace("Plant_sp", "")), /CSV_MISSING.*Plant/],
    ["missing marker", csv(line.replace("Visitor_sp", "NA")), /CSV_MISSING.*Specimen_ID/],
    ["outer whitespace", csv(line.replace("Plant_sp", " Plant_sp")), /CSV_WHITESPACE/],
    ["unknown basic type", csv(line.replace("Hoverfly", "Unknown")), /CSV_BASIC_TYPE/],
    ["unknown treatment", csv(line.replace("Heat+Water", "Unknown")), /CSV_TREATMENT/],
    ["blank record", csv(line, "", line), /CSV_COLUMNS.*record 2/],
    ["broken quote", csv(line.replace("Plant_sp", '"Plant_sp')), /CSV_SYNTAX/],
  ])("rejects %s with a meaningful error", (_name, input, expected) => {
    expect(() => parseSourceCsv(input)).toThrow(expected);
  });
});
