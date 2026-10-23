import type { ObservationEvent, ObservationYear, Treatment } from "../../data/index.ts";

/** Lower-level fixtures/scopes are deliberately not ObservationData. */
export type CoreEvent = Pick<ObservationEvent, "source_record_number" | "record_id" | "plant_label_raw" | "visitor_label_raw" | "plant_label_id" | "visitor_label_id">;

export interface Selection {
  readonly years: readonly ObservationYear[];
  readonly plot_ids: readonly string[];
  readonly treatments: readonly Treatment[];
  readonly rounds_by_year: Readonly<Partial<Record<ObservationYear, readonly string[]>>>;
}

export interface Fraction { readonly numerator: string; readonly denominator: string }
export interface SqrtFraction { readonly radicand: Fraction }
export type MetricKey = "event_count" | "plant_label_count" | "visitor_label_count" | "pair_count" | "lost_pair_count" | "pair_retention_pct" | "connectance_fixed";
export interface ScalarSummary {
  readonly valid_count: number;
  readonly mean: Fraction;
  readonly sample_variance: Fraction | null;
  readonly sample_sd: SqrtFraction | null;
  readonly min: Fraction;
  readonly max: Fraction;
  readonly quantiles: readonly { readonly probability: Fraction; readonly value: Fraction }[];
  readonly undefined_reasons: Readonly<{ sample_variance?: "insufficient_trials"; sample_sd?: "insufficient_trials" }>;
}
export type RepetitionSummary = Readonly<Record<MetricKey, ScalarSummary>>;
export interface PartnerCount { readonly label_id: string; readonly partner_count: number }
export interface PairWeight { readonly plant_label_id: string; readonly visitor_label_id: string; readonly record_count: number }
export interface NetworkSummary {
  readonly event_count: number;
  readonly plant_label_count: number;
  readonly visitor_label_count: number;
  readonly pair_count: number;
  readonly connectance_fixed: Fraction | null;
  readonly plant_partner_counts: readonly PartnerCount[];
  readonly visitor_partner_counts: readonly PartnerCount[];
  readonly pair_weights: readonly PairWeight[];
  readonly undefined_reasons: Readonly<{ connectance_fixed?: "zero_reference_nodes" }>;
}
export interface TrialResult {
  readonly trial_index: number;
  readonly initstate_u64_hex: string;
  readonly initseq_u64_hex: string;
  readonly random_word_count: number;
  readonly sampled_source_record_numbers: readonly number[];
  readonly sampled_ids_sha256: string;
  readonly sample: NetworkSummary;
  readonly lost_pair_count: number;
  readonly pair_retention_pct: Fraction | null;
  readonly undefined_reasons: Readonly<{ pair_retention_pct?: "zero_reference_pairs" }>;
}

export interface DataIdentity {
  readonly dataset_id: string;
  readonly archive_doi: string;
  readonly archive_version: 1;
  readonly source_sha256: string;
  readonly normalized_events_sha256: string;
  readonly taxa_sha256: string;
  readonly data_schema_version: string;
  readonly transform_version: string;
  readonly transform_git_revision: string;
  readonly taxonomy_mode: "verbatim-raw-labels-v1";
}
export interface RunContext {
  readonly implementation_git_revision: string;
  readonly specification_sha256: Readonly<Record<string, string>>;
  readonly data_identity: DataIdentity;
}
export interface NoRecordGroup {
  readonly year: ObservationYear;
  readonly plot_id: string;
  readonly round_label: string;
  readonly status: "no_record_effort_unknown";
}
export interface ScopeSummary {
  readonly scope_mode: "pooled_records" | "single_year_records";
  readonly eligible_source_record_numbers: readonly number[];
  readonly eligible_ids_sha256: string;
  readonly records_by_year: readonly { readonly year: ObservationYear; readonly record_count: number }[];
  readonly plot_year_count: number;
  readonly observation_group_count: number;
  readonly no_record_groups: readonly NoRecordGroup[];
}
export interface SingleTrialRequest {
  readonly selection: Selection;
  readonly rate_percent: number;
  readonly master_seed: number;
}

export interface RepeatedTrialRequest extends SingleTrialRequest { readonly repetitions: number }

interface RunResultBase {
  readonly result_schema_version: "1.0.0";
  readonly specification_versions: Readonly<{ model: "1.0.0"; metrics: "1.0.0"; randomness: "1.0.0"; repetitions: "1.0.0"; serialization: "1.0.0" }>;
  readonly implementation_git_revision: string;
  readonly specification_sha256: Readonly<Record<string, string>>;
  readonly data_identity: DataIdentity;
  readonly selection: Selection;
  readonly scope: ScopeSummary;
  readonly sampling: Readonly<{
    unit: "event"; replacement: false; algorithm: "partial-fisher-yates-forward"; rounding: "nearest-half-up";
    rate_percent: number; eligible_record_count: number; sample_record_count: number | null; actual_record_pct: Fraction | null;
  }>;
  readonly randomness: Readonly<{ algorithm: "pcg-xsh-rr-64-32"; master_seed: number; stream_offset: 54 }>;
  readonly status: "success" | "empty_scope";
  readonly reference: NetworkSummary | null;
  readonly trials: readonly TrialResult[];
}
export interface SingleRunResult extends RunResultBase {
  readonly execution_mode: "single_trial";
  readonly requested_repetitions: 1;
  readonly summary: null;
  readonly summary_reason: "repetition_not_requested" | "empty_scope";
}
export interface RepeatedRunResult extends RunResultBase {
  readonly execution_mode: "repeated_trials";
  readonly requested_repetitions: number;
  readonly summary: RepetitionSummary | null;
  readonly summary_reason: null | "empty_scope";
}
export type RunResult = SingleRunResult | RepeatedRunResult;

/** Hashing is supplied by the boundary; core has no crypto/DOM/fs/network dependency. */
export type Sha256 = (utf8Text: string) => string | Promise<string>;
