// UIの下書きのみ。サンプリング・乱数生成・分析の計算は工程5以降に実装する。
export interface SimulationDraft {
  observationRate: number;
  repetitions: string;
  seed: string;
}

export const initialDraft: Readonly<SimulationDraft> = {
  observationRate: 50,
  repetitions: "100",
  seed: "42",
};

export function isIntegerInRange(value: string, min: number, max: number) {
  return (
    /^\d+$/.test(value) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) >= min &&
    Number(value) <= max
  );
}
