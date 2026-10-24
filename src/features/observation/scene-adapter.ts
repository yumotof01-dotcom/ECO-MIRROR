import type { ComparisonData, VisualNode } from "../visualization/adapter";
/** Display-only sums of validated pair weights; never written back to RunResult. */
export function nodeDetail(data: ComparisonData, node: VisualNode) {
  const links = data.links.filter(
    (l) => l.plantId === node.id || l.visitorId === node.id,
  );
  return {
    referenceRecords: links.reduce((s, l) => s + l.referenceCount, 0),
    sampleRecords: links.reduce((s, l) => s + l.sampleCount, 0),
    partners: links.map((l) => ({
      node: data.nodes.find(
        (n) => n.id === (node.side === "plant" ? l.visitorId : l.plantId),
      )!,
      referenceCount: l.referenceCount,
      sampleCount: l.sampleCount,
    })),
  };
}
