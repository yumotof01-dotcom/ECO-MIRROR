import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import type { RunResult } from "../simulation/core/types";
import { NetworkComparison } from "./NetworkComparison";
import halfJson from "../../../docs/simulation/phase7-verification/half-result.json";
import fullJson from "../../../docs/simulation/phase7-verification/full-result.json";
import zeroJson from "../../../docs/simulation/phase7-verification/zero-result.json";
import emptyJson from "../../../docs/simulation/phase7-verification/empty-result.json";
const half = halfJson as unknown as RunResult;
const full = fullJson as unknown as RunResult;
const zero = zeroJson as unknown as RunResult;
const empty = emptyJson as unknown as RunResult;

describe("accessible comparison of calculated real networks", () => {
  it("renders exact observed/ghost pair counts with a shared coordinate map and meaningful legend", () => {
    const start = performance.now();
    const { container } = render(<NetworkComparison result={half} />);
    const original = container.querySelector('[data-network="reference"]')!, sample = container.querySelector('[data-network="sample"]')!;
    expect(original.querySelectorAll('[data-pair]')).toHaveLength(257);
    expect(sample.querySelectorAll('[data-observed="true"]')).toHaveLength(183);
    expect(sample.querySelectorAll('.em-missing')).toHaveLength(74);
    expect(sample.querySelectorAll('[stroke-dasharray="5 5"]')).toHaveLength(74);
    const points = (parent: Element) => [...parent.querySelectorAll('[data-node-id]')].map(n => [n.getAttribute('data-node-id'), n.getAttribute('transform')]);
    expect(points(sample)).toEqual(points(original));
    expect(screen.getByLabelText("図の凡例")).toHaveTextContent("破線：今回の抽出で未確認");
    expect(screen.getByLabelText("表示フィルター適用前の計算指標")).toHaveTextContent("257");
    expect(screen.getByText(/自然界に存在しないことを意味するものではありません/)).toBeInTheDocument();
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    console.info(`full comparison DOM: ${container.querySelectorAll('*').length} elements, ${Math.round(performance.now() - start)}ms in jsdom`);
  });
  it("selects nodes and links with keyboard, supports arrow navigation and native selection alternatives", () => {
    const { container } = render(<NetworkComparison result={half} />);
    const original = container.querySelector('[data-network="reference"]')!;
    const firstNode = original.querySelector<SVGGElement>('[data-node-id]')!;
    firstNode.focus(); fireEvent.keyDown(firstNode, { key: "Enter" });
    const details = screen.getByRole("region", { name: "選択したノード・リンクの詳細" });
    expect(details).toHaveTextContent(firstNode.dataset.nodeId!);
    fireEvent.keyDown(firstNode, { key: "ArrowDown" });
    expect(original.querySelector('[data-focus-index="1"]')).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    const last = original.querySelector<SVGGElement>('[data-focus-index="380"]')!;
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: " " });
    expect(details).toHaveTextContent("抽出後の訪花記録数");
    expect(details).toHaveAttribute("aria-live", "polite");
    fireEvent.change(screen.getByLabelText(/リンクの詳細を選択/), { target: { value: "0" } });
    expect(details).toHaveTextContent(String(half.reference!.pair_weights[0].record_count));
  });
  it("searches/highlights verbatim labels and filters display only, keeping metrics unchanged", () => {
    const { container } = render(<NetworkComparison result={half} />);
    const metrics = screen.getByLabelText("表示フィルター適用前の計算指標").textContent;
    fireEvent.change(screen.getByLabelText("原ラベルを検索"), { target: { value: "Bombus" } });
    expect(container.querySelectorAll('.em-match').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-pair]')).toHaveLength(514);
    const select = screen.getByRole("combobox", { name: /ノードの詳細を選択/ });
    expect(within(select).getAllByRole("option").length).toBeLessThan(125);
    fireEvent.change(select, { target: { value: "0" } });
    fireEvent.click(screen.getByLabelText("選択ノードに接続する線だけを表示"));
    expect(container.querySelectorAll('[data-pair]').length).toBeLessThan(514);
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(248);
    expect(screen.getByLabelText("表示フィルター適用前の計算指標").textContent).toBe(metrics);
    fireEvent.click(screen.getByRole("button", { name: "表示をリセット" }));
    expect(container.querySelectorAll('[data-pair]')).toHaveLength(514);
  });
  it("opens a missing link by click and keeps zero distinct from missing detail", () => {
    const { container } = render(<NetworkComparison result={half} />);
    const missing = container.querySelector<SVGGElement>('[data-network="sample"] .em-missing')!;
    fireEvent.click(missing);
    const details = screen.getByRole("region", { name: "選択したノード・リンクの詳細" });
    expect(details).toHaveTextContent("未確認（自然界での消滅を意味しません）");
    expect(details.querySelectorAll('dd')[3]).toHaveTextContent(/^0$/);
    expect(missing).toHaveAttribute("aria-pressed", "true");
  });
  it("clears node-only filtering when a link is selected and leaves overall metrics unchanged", () => {
    const { container } = render(<NetworkComparison result={half} />);
    const metrics = screen.getByLabelText("表示フィルター適用前の計算指標").textContent;
    fireEvent.change(screen.getByRole("combobox", { name: /ノードの詳細を選択/ }), { target: { value: "0" } });
    fireEvent.click(screen.getByLabelText("選択ノードに接続する線だけを表示"));
    expect(container.querySelectorAll('[data-pair]')).toHaveLength(4);
    fireEvent.change(screen.getByRole("combobox", { name: /リンクの詳細を選択/ }), { target: { value: "0" } });
    expect(container.querySelectorAll('[data-pair]')).toHaveLength(514);
    expect(screen.getByLabelText("選択ノードに接続する線だけを表示")).not.toBeChecked();
    expect(screen.getByLabelText("表示フィルター適用前の計算指標").textContent).toBe(metrics);
  });
  it("updates existing trial details without moving any node or mutating the result", () => {
    const before = JSON.stringify(half);
    function Controlled() { const [trial, setTrial] = useState(0); return <NetworkComparison result={half} trialIndex={trial} onTrialChange={setTrial} />; }
    const { container } = render(<Controlled />);
    const positions = () => [...container.querySelectorAll('[data-node-id]')].map(n => n.getAttribute('transform'));
    const original = positions();
    fireEvent.change(screen.getByLabelText("表示する試行番号"), { target: { value: "1" } });
    expect(positions()).toEqual(original);
    expect(container.querySelectorAll('[data-network="sample"] [data-observed="true"]')).toHaveLength(182);
    expect(screen.getByLabelText("表示フィルター適用前の計算指標")).toHaveTextContent("182");
    expect(JSON.stringify(half)).toBe(before);
  });
  it.each([[zero, 257, 0], [full, 0, 257]] as const)("handles a boundary extraction without hiding baseline nodes", (result, missing, observed) => {
    const { container } = render(<NetworkComparison result={result} />);
    expect(container.querySelectorAll('[data-network="sample"] .em-missing')).toHaveLength(missing);
    expect(container.querySelectorAll('[data-network="sample"] [data-observed="true"]')).toHaveLength(observed);
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(248);
  });
  it("separates empty_scope and invalid result states from a successful empty extraction", () => {
    const { container, rerender } = render(<NetworkComparison result={empty} />);
    expect(screen.getByRole("status")).toHaveTextContent("empty_scope");
    expect(container.querySelector('svg')).toBeNull();
    rerender(<NetworkComparison result={half} trialIndex={99} />);
    expect(screen.getByRole("alert")).toHaveTextContent("requested trial does not exist");
    expect(container.querySelector('svg')).toBeNull();
  });
  it("keeps full labels accessible at narrow widths and changes only SVG scale on zoom", () => {
    const { container } = render(<NetworkComparison result={half} />);
    const diagram = container.querySelector('svg')!, box = diagram.getAttribute('viewBox');
    fireEvent.change(screen.getByLabelText(/拡大率/), { target: { value: "1.5" } });
    expect(diagram.getAttribute('viewBox')).toBe(box);
    expect(diagram).toHaveAttribute('width', '1230');
    expect(screen.getByRole("region", { name: "左右共通スクロールのネットワーク比較図" })).toHaveAttribute("tabindex", "0");
    expect(container.querySelectorAll('[data-node-id]')).toHaveLength(248);
    expect(within(screen.getByRole("combobox", { name: /リンクの詳細を選択/ })).getAllByRole("option")).toHaveLength(258);
  });
});
