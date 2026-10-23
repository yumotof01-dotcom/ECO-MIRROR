import { BASIC_TYPES, ROUNDS, SCHEMA_VERSION, SOURCE, TRANSFORM_VERSION, TREATMENTS, requireData } from "./contract.ts";
import type { DatasetIdentity, ObservationData, ObservationEvent, RawLabel } from "./types.ts";

function object(value: unknown, where: string): asserts value is Record<string, unknown> {
  requireData(value !== null && typeof value === "object" && !Array.isArray(value), "DATA_SHAPE", `${where}: expected object`);
}

export function validateIdentity(value: unknown): asserts value is DatasetIdentity & Record<string, unknown> {
  object(value, "dataset");
  requireData(value.dataset_id === SOURCE.dataset_id && value.source_sha256 === SOURCE.sha256 && value.schema_version === SCHEMA_VERSION && value.transform_version === TRANSFORM_VERSION, "DATA_IDENTITY", "dataset, source hash or schema/transform version differs from the selected archive");
}

function text(value: unknown, where: string): asserts value is string {
  requireData(typeof value === "string" && value.length > 0 && value === value.trim() && !["na", "n/a", "null", "(null)", "nan", "none"].includes(value.toLowerCase()), "DATA_LABEL", `${where}: expected verbatim non-missing label`);
}

const EVENT_KEYS = ["source_record_number", "record_id", "year", "plot_id", "round_label", "plot_year_id", "observation_group_id", "treatment", "plant_label_raw", "visitor_label_raw", "plant_label_id", "visitor_label_id", "basic_type_raw", "observed_at", "actual_effort_minutes", "block_id"];

function validateEvent(value: unknown, index: number): asserts value is ObservationEvent {
  object(value, `event ${index + 1}`);
  requireData(Object.keys(value).length === EVENT_KEYS.length && EVENT_KEYS.every(key => Object.hasOwn(value, key)), "DATA_SHAPE", `event ${index + 1}: fields differ from schema`);
  requireData(value.source_record_number === index + 1 && value.record_id === `sha256:${SOURCE.sha256}:record:${index + 1}`, "DATA_TRACE", `event ${index + 1}: source order/record ID differs`);
  requireData(value.year === 2014 || value.year === 2015, "DATA_YEAR", `event ${index + 1}: unsupported year`);
  requireData(typeof value.plot_id === "string" && /^(?:[1-9]|1[0-9]|2[0-4])$/.test(value.plot_id), "DATA_PLOT", `event ${index + 1}: invalid plot ID`);
  requireData(typeof value.round_label === "string" && (ROUNDS[value.year] as readonly string[]).includes(value.round_label), "DATA_ROUND", `event ${index + 1}: invalid round for year`);
  requireData(value.plot_year_id === `${value.year}:plot:${value.plot_id}` && value.observation_group_id === `${value.plot_year_id}:round:${value.round_label}`, "DATA_GROUP", `event ${index + 1}: inconsistent group ID`);
  text(value.plant_label_raw, `event ${index + 1} plant`);
  text(value.visitor_label_raw, `event ${index + 1} visitor`);
  requireData(value.plant_label_id === `plant:${value.plant_label_raw}` && value.visitor_label_id === `visitor:${value.visitor_label_raw}`, "DATA_LABEL_ID", `event ${index + 1}: label ID differs from verbatim label`);
  requireData((TREATMENTS as readonly unknown[]).includes(value.treatment) && (BASIC_TYPES as readonly unknown[]).includes(value.basic_type_raw), "DATA_ENUM", `event ${index + 1}: unknown treatment/basic type`);
  requireData(value.observed_at === null && value.actual_effort_minutes === null && value.block_id === null, "DATA_UNKNOWN", `event ${index + 1}: survey information must remain unknown`);
}

function validateLabels(value: unknown, side: "plant" | "visitor", events: readonly ObservationEvent[]): asserts value is readonly RawLabel[] {
  requireData(Array.isArray(value), "DATA_TAXA", `${side}: expected array`);
  const actual = new Map<string, { count: number; y2014: number; y2015: number; types: Set<string> }>();
  for (const event of events) {
    const raw = side === "plant" ? event.plant_label_raw : event.visitor_label_raw;
    const entry = actual.get(raw) ?? { count: 0, y2014: 0, y2015: 0, types: new Set<string>() };
    entry.count++;
    if (event.year === 2014) entry.y2014++; else entry.y2015++;
    if (side === "visitor") entry.types.add(event.basic_type_raw);
    actual.set(raw, entry);
  }
  const expectedLabels = [...actual.keys()].sort();
  requireData(value.length === expectedLabels.length, "DATA_TAXA", `${side}: dictionary/event label count differs`);
  value.forEach((entry: unknown, index: number) => {
    object(entry, `${side} label ${index + 1}`);
    const raw = expectedLabels[index];
    const counts = actual.get(raw)!;
    requireData(entry.raw_label === raw && entry.label_id === `${side}:${raw}`, "DATA_TAXA", `${side} label ${index + 1}: dictionary must preserve distinct labels and code-point order`);
    requireData(entry.record_count === counts.count && entry.year_2014 === counts.y2014 && entry.year_2015 === counts.y2015 && JSON.stringify(entry.basic_types) === JSON.stringify([...counts.types].sort()), "DATA_TAXA", `${side}:${raw}: dictionary counts/basic types differ from events`);
    requireData(Array.isArray(entry.label_flags) && entry.label_flags.every(flag => typeof flag === "string"), "DATA_TAXA", `${side}:${raw}: invalid review flags`);
  });
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}

/** Runtime validation is required; JSON type assertions alone do not validate data. */
export function validateObservationData(dataset: unknown, taxa: unknown): ObservationData {
  validateIdentity(dataset);
  validateIdentity(taxa);
  requireData(Array.isArray(dataset.events) && dataset.events.length === SOURCE.record_count, "DATA_RECORD_COUNT", `expected ${SOURCE.record_count} events`);
  dataset.events.forEach(validateEvent);
  const events = dataset.events as ObservationEvent[];
  requireData(events.filter(event => event.year === 2014).length === 1687 && events.filter(event => event.year === 2015).length === 2195 && new Set(events.map(event => event.plant_label_raw)).size === 20 && new Set(events.map(event => event.visitor_label_raw)).size === 104 && new Set(events.map(event => JSON.stringify([event.plant_label_raw, event.visitor_label_raw]))).size === 257 && new Set(events.map(event => event.plot_year_id)).size === 48, "DATA_AUDIT", "loaded events differ from selected phase-3 audit totals");
  validateLabels(taxa.plants, "plant", events);
  validateLabels(taxa.visitors, "visitor", events);
  return freezeDeep({ dataset, taxa } as unknown as ObservationData);
}
