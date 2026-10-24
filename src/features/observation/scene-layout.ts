import type { VisualNode } from "../visualization/adapter";
export interface ScenePoint {
  readonly x: number;
  readonly y: number;
}
export const SCENE = { width: 1100, height: 650 } as const;
/** Reference IDs alone determine positions. No trial, counts, viewport, clock or PRNG. */
export function sceneLayout(
  nodes: readonly Pick<VisualNode, "id" | "side">[],
): ReadonlyMap<string, ScenePoint> {
  const sorted = [...nodes].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
  const positions = new Map<string, ScenePoint>();
  sorted.forEach((node, i) => {
    if (positions.has(node.id)) throw new Error("Duplicate scene node ID");
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const radius = Math.sqrt((i + 0.7) / Math.max(1, sorted.length));
    positions.set(node.id, {
      x: 550 + Math.cos(angle) * 440 * radius,
      y: 325 + Math.sin(angle) * 255 * radius,
    });
  });
  return positions;
}
