import type { VisualNode } from "./adapter";

export interface Position { readonly x: number; readonly y: number }
export interface BipartiteLayout {
  readonly width: number;
  readonly height: number;
  readonly positions: ReadonlyMap<string, Position>;
}
/** Reference-only coordinates. CSS size, search and trial index never enter this map. */
export function createBipartiteLayout(nodes: readonly Pick<VisualNode, "id" | "side">[]): BipartiteLayout {
  const width = 820, row = 30, top = 54;
  const positions = new Map<string, Position>();
  const maxRows = Math.max(nodes.filter(n => n.side === "plant").length, nodes.filter(n => n.side === "visitor").length);
  for (const side of ["plant", "visitor"] as const) {
    const ordered = nodes.filter(n => n.side === side).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    for (const [i, node] of ordered.entries()) {
      if (positions.has(node.id)) throw new Error("Duplicate layout node ID");
      const y = top + (ordered.length === 1 ? (maxRows - 1) * row / 2 : i * (maxRows - 1) * row / (ordered.length - 1));
      positions.set(node.id, { x: side === "plant" ? 270 : 530, y });
    }
  }
  return { width, height: Math.max(240, top + Math.max(0, maxRows - 1) * row + 45), positions };
}

/** Common reference maximum: equal visit-record counts always have equal widths. */
export function linkWidth(count: number, referenceMaximum: number): number {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(referenceMaximum) || referenceMaximum < 1 || count > referenceMaximum) throw new Error("Invalid display weight");
  return count === 0 ? 1 : 1 + 5 * Math.sqrt(count / referenceMaximum);
}

export function linkPath(plant: Position, visitor: Position): string {
  const middle = (plant.x + visitor.x) / 2;
  return `M ${plant.x} ${plant.y} C ${middle} ${plant.y}, ${middle} ${visitor.y}, ${visitor.x} ${visitor.y}`;
}
