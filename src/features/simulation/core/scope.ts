import type { ObservationEvent } from "../../data/index.ts";
import { normalizeSelection } from "./inputs.ts";
import { validateEventSequence } from "./events.ts";
import { idsHash } from "./serialization.ts";
import type { NoRecordGroup, ScopeSummary, Sha256 } from "./types.ts";

/** Caller supplies the validated full source, never a sample or synthetic ObservationData. */
export async function selectScope(source: readonly ObservationEvent[], selectionInput: unknown, sha256: Sha256) {
  validateEventSequence(source, "scope");
  const selection = normalizeSelection(selectionInput);
  const events = source.filter(e => selection.years.includes(e.year) && selection.plot_ids.includes(e.plot_id)
    && selection.treatments.includes(e.treatment) && selection.rounds_by_year[e.year]!.includes(e.round_label));
  const treatmentByYearPlot = new Map(source.map(e => [e.plot_year_id, e.treatment]));
  const presentGroups = new Set(source.map(e => e.observation_group_id));
  const no_record_groups: NoRecordGroup[] = [];
  for (const year of selection.years) {
    for (const plot_id of selection.plot_ids) {
      const treatment = treatmentByYearPlot.get(`${year}:plot:${plot_id}`);
      if (!treatment || !selection.treatments.includes(treatment)) continue;
      for (const round_label of selection.rounds_by_year[year]!) {
        if (!presentGroups.has(`${year}:plot:${plot_id}:round:${round_label}`)) {
          no_record_groups.push({ year, plot_id, round_label, status: "no_record_effort_unknown" });
        }
      }
    }
  }
  const scope: ScopeSummary = {
    scope_mode: selection.years.length === 1 ? "single_year_records" : "pooled_records",
    eligible_source_record_numbers: events.map(e => e.source_record_number),
    eligible_ids_sha256: await idsHash(events.map(e => e.record_id), sha256),
    records_by_year: selection.years.map(year => ({ year, record_count: events.filter(e => e.year === year).length })),
    plot_year_count: new Set(events.map(e => e.plot_year_id)).size,
    observation_group_count: new Set(events.map(e => e.observation_group_id)).size,
    no_record_groups,
  };
  return { events, selection, scope };
}
