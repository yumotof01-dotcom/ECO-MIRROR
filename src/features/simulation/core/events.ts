import { isObject, requireSimulation } from "./errors.ts";
import type { CoreEvent } from "./types.ts";

/** This is a derived-sequence check, not the full 3,882-row loader. Gaps are valid in scopes. */
export function validateEventSequence(events: readonly CoreEvent[], stage = "events"): void {
  requireSimulation(Array.isArray(events) && events.length <= 3882, "SOURCE_ORDER", stage, "expected at most 3882 source-ordered records");
  let previous = 0;
  const ids = new Set<string>();
  for (const event of events) {
    requireSimulation(isObject(event), "SOURCE_ORDER", stage, "expected event object");
    const n = event.source_record_number;
    requireSimulation(typeof n === "number" && Number.isSafeInteger(n) && n > previous && n <= 3882, "SOURCE_ORDER", stage, `source_record_number ${String(n)}: expected increasing unique original numbers in 1..3882`);
    requireSimulation(typeof event.record_id === "string" && event.record_id.length > 0 && !ids.has(event.record_id), "SOURCE_ORDER", stage, `source record ${n}: missing/duplicate record_id`);
    for (const side of ["plant", "visitor"] as const) {
      const raw = event[`${side}_label_raw`];
      requireSimulation(typeof raw === "string" && raw === raw.trim() && /^[\x20-\x7e]+$/.test(raw) && event[`${side}_label_id`] === `${side}:${raw}`, "INVALID_NUMERIC_RESULT", stage, `source record ${n}: ${side} ID must preserve the verbatim ASCII label`);
    }
    previous = n;
    ids.add(event.record_id);
  }
}

export function validateSubset(reference: readonly CoreEvent[], sample: readonly CoreEvent[]): void {
  validateEventSequence(reference, "reference");
  requireSimulation(Array.isArray(sample), "NOT_A_SUBSET", "subset", "expected sample array");
  const seen = new Set<string>();
  const source = new Map(reference.map(event => [event.record_id, event]));
  for (const event of sample) {
    requireSimulation(isObject(event) && typeof event.record_id === "string" && !seen.has(event.record_id), "NOT_A_SUBSET", "subset", `duplicate/invalid sample record ${event?.source_record_number}`);
    const original = source.get(event.record_id);
    // All observation fields are primitive: changing any field invalidates membership.
    requireSimulation(original && Reflect.ownKeys(original).length === Reflect.ownKeys(event).length
      && Object.keys(original).every(key => original[key as keyof CoreEvent] === event[key as keyof CoreEvent]), "NOT_A_SUBSET", "subset", `source record ${event.source_record_number}: outside reference or modified event`);
    seen.add(event.record_id);
  }
  validateEventSequence(sample, "subset");
}
