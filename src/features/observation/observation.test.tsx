import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { adaptRunResult } from "../visualization/adapter";
import type { ComparisonData } from "../visualization/adapter";
import type { RunResult } from "../simulation/core/types";
import half from "../../../docs/simulation/phase7-verification/half-result.json";
import full from "../../../docs/simulation/phase7-verification/full-result.json";
import zero from "../../../docs/simulation/phase7-verification/zero-result.json";
import { sceneLayout } from "./scene-layout";
import { INITIAL_TRANSFORM, zoomAt, pinchTransform } from "./scene-transform";
import { nodeDetail } from "./scene-adapter";
import { ObservationScene } from "./ObservationScene";
import { OrganicDetailLayer } from "./OrganicDetailLayer";
const data = (value: unknown, index = 0) =>
  adaptRunResult(value as RunResult, index) as ComparisonData;
const d = data(half);
describe("deterministic observation scene over verified real result fragments", () => {
  it("uses stable reference IDs independent of input ordering and trial", () => {
    const a = sceneLayout(d.nodes);
    expect([...a]).toEqual([...sceneLayout([...d.nodes].reverse())]);
    expect([...a]).toEqual([...sceneLayout(data(half, 1).nodes)]);
    expect(a.size).toBe(124);
    for (const p of a.values()) {
      expect(p.x).toBeGreaterThan(50);
      expect(p.x).toBeLessThan(1050);
      expect(p.y).toBeGreaterThan(30);
      expect(p.y).toBeLessThan(620);
    }
  });
  it("keeps all and only 257 real reference pairs, with 74 missing at 50%", () => {
    const { container } = render(
      <ObservationScene
        data={d}
        selected={null}
        onSelect={vi.fn()}
        mode="sample"
      />,
    );
    expect(container.querySelectorAll("[data-scene-link]")).toHaveLength(257);
    expect(container.querySelectorAll('[data-missing="true"]')).toHaveLength(
      74,
    );
    expect(container.querySelectorAll("[data-scene-node]")).toHaveLength(124);
  });
  it("retains reference pairs at 0%, and exactly matches reference at 100%", () => {
    const { container, rerender } = render(
      <ObservationScene
        data={data(zero)}
        selected={null}
        onSelect={vi.fn()}
        mode="difference"
      />,
    );
    expect(container.querySelectorAll('[data-missing="true"]')).toHaveLength(
      257,
    );
    rerender(
      <ObservationScene
        data={data(full)}
        selected={null}
        onSelect={vi.fn()}
        mode="sample"
      />,
    );
    expect(container.querySelectorAll('[data-missing="true"]')).toHaveLength(0);
  });
  it("comparison view changes do not move any node or mutate formal results", () => {
    const before = JSON.stringify(half),
      { container, rerender } = render(
        <ObservationScene
          data={d}
          selected={null}
          onSelect={vi.fn()}
          mode="reference"
        />,
      );
    const coords = () =>
      [...container.querySelectorAll("[data-scene-node]")].map((n) => [
        n.getAttribute("data-scene-node"),
        n.getAttribute("data-x"),
        n.getAttribute("data-y"),
      ]);
    const initial = coords();
    rerender(
      <ObservationScene
        data={d}
        selected={null}
        onSelect={vi.fn()}
        mode="difference"
      />,
    );
    expect(coords()).toEqual(initial);
    expect(JSON.stringify(half)).toBe(before);
  });
  it("keyboard selection, search and zoom preserve every source pair and metric", () => {
    const select = vi.fn(),
      before = JSON.stringify(d),
      { container } = render(
        <ObservationScene
          data={d}
          selected={null}
          onSelect={select}
          mode="sample"
        />,
      );
    const n = container.querySelector("[data-scene-node]")!;
    fireEvent.keyDown(n, { key: "Enter" });
    expect(select).toHaveBeenLastCalledWith(d.nodes[0].id);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Bombus" },
    });
    expect(screen.getByText(/件一致/)).toHaveTextContent("一致");
    fireEvent.click(screen.getByRole("button", { name: "拡大" }));
    expect(screen.getByLabelText("現在の表示倍率")).toHaveTextContent("125%");
    fireEvent.click(screen.getByRole("button", { name: "表示をリセット" }));
    expect(screen.getByLabelText("現在の表示倍率")).toHaveTextContent("100%");
    expect(container.querySelectorAll("[data-scene-link]")).toHaveLength(257);
    expect(JSON.stringify(d)).toBe(before);
  });
  it("only selects known IDs through the accessible alternative", () => {
    const onSelect = vi.fn();
    render(
      <ObservationScene
        data={d}
        selected={null}
        onSelect={onSelect}
        mode="sample"
      />,
    );
    fireEvent.change(screen.getByLabelText("ノードを選択"), {
      target: { value: d.nodes[3].id },
    });
    expect(onSelect).toHaveBeenLastCalledWith(d.nodes[3].id);
  });
  it("derives each node record sum from exact pair weights without taxonomic inventions", () => {
    const p = d.nodes[0],
      detail = nodeDetail(d, p);
    expect(detail.referenceRecords).toBe(2);
    expect(detail.sampleRecords).toBe(1);
    expect(detail.partners).toHaveLength(p.referencePartners);
    expect(
      d.nodes
        .filter((n) => n.side === "plant")
        .reduce((s, n) => s + nodeDetail(d, n).referenceRecords, 0),
    ).toBe(3882);
    expect(
      d.nodes
        .filter((n) => n.side === "plant")
        .reduce((s, n) => s + nodeDetail(d, n).sampleRecords, 0),
    ).toBe(1941);
  });
  it("shows exact details, partners and scientific limits with working tabs", () => {
    render(
      <OrganicDetailLayer
        data={d}
        node={d.nodes[0]}
        onClose={vi.fn()}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading")).toHaveTextContent(d.nodes[0].label);
    expect(screen.getByText("2件")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "相手" }));
    expect(screen.getByRole("list").children).toHaveLength(
      d.nodes[0].referencePartners,
    );
    fireEvent.click(screen.getByRole("button", { name: "解説" }));
    expect(screen.getByText(/確定した分類ランク/)).toBeVisible();
  });
  it("zooms about an anchor and clamps the visual scale", () => {
    expect(zoomAt(INITIAL_TRANSFORM, 100).scale).toBe(4);
    expect(zoomAt(INITIAL_TRANSFORM, 0.001).scale).toBe(0.65);
    expect(zoomAt(INITIAL_TRANSFORM, 2, { x: 100, y: 100 })).toEqual({
      scale: 2,
      x: -100,
      y: -100,
    });
  });
  it("pinch combines anchor-preserving zoom and midpoint translation", () => {
    expect(
      pinchTransform(
        INITIAL_TRANSFORM,
        { x: 100, y: 100 },
        { x: 120, y: 130 },
        2,
      ),
    ).toEqual({ scale: 2, x: -80, y: -70 });
  });
});
