/** Fixed university archive v1. A different snapshot requires an explicit new contract. */
export const SOURCE = {
  dataset_id: "moss-evans-2022-flower-visits-v1",
  title: "Climate change impacts on plant-pollinator interactions and functioning - experiment data",
  creators: ["Ellen Moss", "Darren Evans"],
  doi: "10.25405/data.ncl.17430548.v1",
  version: 1,
  file_id: 34178859,
  filename: "Raw_InteractionData_BothYears.csv",
  url: "https://ndownloader.figshare.com/files/34178859",
  metadata_url: "https://api.figshare.com/v2/articles/17430548/versions/1",
  size: 254165,
  sha256: "c2d7023215fb885070caf6603886bce10e965732e3cc2465111e9d73cad9ab9a",
  md5: "6f083ca81e9bc14c3bbd5806aecb62e8",
  record_count: 3882,
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
} as const;

export const SCHEMA_VERSION = "1.0.0";
export const TRANSFORM_VERSION = "ccpp-verbatim-v1";
export const COLUMNS = ["Year", "Plot", "Round", "Plant", "Specimen_ID", "Basic_Type", "Treatment"] as const;
export const ROUNDS = { 2014: ["1", "3", "4", "5", "7", "8", "9"], 2015: ["1", "2", "3", "4", "5", "6", "7"] } as const;
export const TREATMENTS = ["Control", "Heat", "Heat+Water", "Water"] as const;
export const BASIC_TYPES = ["Bumblebee", "Butterfly", "Fly", "Honeybee", "Hoverfly", "Moth", "Parasitoid", "Social_Wasp", "Solitary_Bee", "Solitary_Wasp"] as const;

export class DataValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = "DataValidationError";
    this.code = code;
  }
}

export function requireData(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new DataValidationError(code, message);
}
