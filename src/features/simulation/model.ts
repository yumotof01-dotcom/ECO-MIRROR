import { ROUNDS, TREATMENTS } from "../data/contract";
import { normalizeSelection } from "./core/inputs";
import type { Selection } from "./core/types";
import type { ExecutionInput } from "../execution/protocol";

// Editable UI values stay separate from the normalized, immutable execution request.
export interface SimulationDraft {
  observationRate: number;
  repetitions: string;
  seed: string;
  mode: "single_trial" | "repeated_trials";
  selection: Selection;
}

export const initialDraft: Readonly<SimulationDraft> = {
  observationRate: 50,
  repetitions: "100",
  seed: "42",
  mode: "repeated_trials",
  selection: { years: [2014, 2015], plot_ids: Array.from({ length: 24 }, (_, i) => String(i + 1)), treatments: [...TREATMENTS], rounds_by_year: { 2014: [...ROUNDS[2014]], 2015: [...ROUNDS[2015]] } },
};

export const freshDraft = (): SimulationDraft => structuredClone(initialDraft);

export function isIntegerInRange(value: string, min: number, max: number) {
  return (
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) >= min &&
    Number(value) <= max
  );
}

export function draftErrors(draft: SimulationDraft): string[] {
  const errors: string[] = [];
  if (!isIntegerInRange(draft.seed, 0, 4294967295)) errors.push("乱数シードは0〜4,294,967,295の整数を、数字だけで入力してください。空欄・空白・小数・指数表記は使えません。");
  if (draft.mode === "repeated_trials" && !isIntegerInRange(draft.repetitions, 1, 1000)) errors.push("反復回数は1〜1,000の整数を、数字だけで入力してください。");
  if (!Number.isSafeInteger(draft.observationRate) || draft.observationRate < 0 || draft.observationRate > 100) errors.push("観測割合は0〜100%の整数を指定してください。");
  if (!["single_trial", "repeated_trials"].includes(draft.mode)) errors.push("実行モードを選択してください。");
  if (!draft.selection.years.length) errors.push("観測年を選択してください。");
  if (!draft.selection.plot_ids.length) errors.push("調査区画を1つ以上選択してください。");
  if (!draft.selection.treatments.length) errors.push("実験条件を1つ以上選択してください。");
  for (const year of draft.selection.years) if (!draft.selection.rounds_by_year[year]?.length) errors.push(`${year}年の調査回を1つ以上選択してください。`);
  try { normalizeSelection(draft.selection); } catch { if (!errors.length) errors.push("年・区画・実験条件・年別調査回の選択が不正です。"); }
  return errors;
}

export function draftToInput(draft: SimulationDraft): ExecutionInput {
  const errors = draftErrors(draft); if (errors.length) throw new Error(errors.join(" "));
  const request = { selection: normalizeSelection(draft.selection), rate_percent: draft.observationRate, master_seed: Number(draft.seed) };
  return draft.mode === "single_trial" ? { mode: draft.mode, request } : { mode: draft.mode, request: { ...request, repetitions: Number(draft.repetitions) } };
}
export function draftFromInput(input: ExecutionInput): SimulationDraft {
  return { selection: structuredClone(input.request.selection), observationRate: input.request.rate_percent, seed: String(input.request.master_seed), mode: input.mode, repetitions: String(input.mode === "repeated_trials" ? input.request.repetitions : 100) };
}
