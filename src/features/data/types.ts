import type { BASIC_TYPES, TREATMENTS } from "./contract.ts";

export type ObservationYear = 2014 | 2015;
export type Treatment = (typeof TREATMENTS)[number];
export type BasicType = (typeof BASIC_TYPES)[number];

/** A source record, not an identified individual or a successful pollination. */
export interface ObservationEvent {
  readonly source_record_number: number;
  readonly record_id: string;
  readonly year: ObservationYear;
  readonly plot_id: string;
  readonly round_label: string;
  readonly plot_year_id: string;
  readonly observation_group_id: string;
  readonly treatment: Treatment;
  readonly plant_label_raw: string;
  readonly visitor_label_raw: string;
  readonly plant_label_id: string;
  readonly visitor_label_id: string;
  readonly basic_type_raw: BasicType;
  readonly observed_at: null;
  readonly actual_effort_minutes: null;
  readonly block_id: null;
}

export interface DatasetIdentity {
  readonly dataset_id: string;
  readonly source_sha256: string;
  readonly schema_version: string;
  readonly transform_version: string;
}

export interface ObservationDataset extends DatasetIdentity {
  readonly events: readonly ObservationEvent[];
}

/** IDs identify verbatim labels on each side, not accepted biological species. */
export interface RawLabel {
  readonly label_id: string;
  readonly raw_label: string;
  readonly record_count: number;
  readonly year_2014: number;
  readonly year_2015: number;
  readonly basic_types: readonly BasicType[];
  readonly label_flags: readonly string[];
}

export interface RawLabelDictionary extends DatasetIdentity {
  readonly plants: readonly RawLabel[];
  readonly visitors: readonly RawLabel[];
}

export interface ObservationData {
  readonly dataset: ObservationDataset;
  readonly taxa: RawLabelDictionary;
}
