import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { RunResult } from "../simulation/core/types";
import { adaptRunResult } from "./adapter";
import type { ComparisonData, VisualLink, VisualNode } from "./adapter";
import { createBipartiteLayout, linkPath, linkWidth } from "./layout";
import type { BipartiteLayout } from "./layout";
import "./network.css";

type Selection = { kind: "node" | "link"; id: string } | null;
const sideName = (node: VisualNode) => node.side === "plant" ? "植物" : "昆虫";

interface DiagramProps {
  data: ComparisonData;
  layout: BipartiteLayout;
  mode: "reference" | "sample";
  links: readonly VisualLink[];
  selected: Selection;
  query: string;
  zoom: number;
  onSelect: (selection: Selection) => void;
}

function NetworkDiagram({ data, layout, mode, links, selected, query, zoom, onSelect }: DiagramProps) {
  const uid = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState(0);
  const reference = mode === "reference";
  const nodes = new Map(data.nodes.map(n => [n.id, n]));
  const maximum = Math.max(...data.links.map(l => l.referenceCount));
  const title = reference ? "A · 選択範囲の全観測記録" : `B · 部分抽出した記録（試行 ${data.trial.trial_index}）`;
  const items = [...data.nodes.map(n => ({ kind: "node" as const, id: n.id })), ...links.map(l => ({ kind: "link" as const, id: l.id }))];
  const focusIndex = Math.min(active, items.length - 1);
  const activate = (i: number) => { setActive(i); onSelect(items[i]); };
  const keyDown = (event: KeyboardEvent<SVGGElement>, i: number) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(i); return; }
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" || event.key === "ArrowRight" ? (i + 1) % items.length : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (i - 1 + items.length) % items.length : null;
    if (next !== null) {
      event.preventDefault(); setActive(next);
      const target = svg.current?.querySelector<SVGGElement>(`[data-focus-index="${next}"]`);
      target?.focus(); target?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }
  };
  const interactive = (i: number) => ({
    role: "button" as const, tabIndex: i === focusIndex ? 0 : -1,
    "data-focus-index": i, "aria-pressed": selected?.kind === items[i].kind && selected.id === items[i].id,
    onFocus: () => setActive(i), onClick: () => activate(i), onKeyDown: (e: KeyboardEvent<SVGGElement>) => keyDown(e, i),
  });
  const highlight = (link: VisualLink) => {
    if (selected?.kind === "link") return selected.id === link.id;
    if (selected?.kind === "node") return selected.id === link.plantId || selected.id === link.visitorId;
    return !!query && [link.plantId, link.visitorId].some(id => nodes.get(id)!.label.toLocaleLowerCase("en").includes(query));
  };
  return <section className="em-diagram" aria-label={title}>
    <h3>{title}</h3>
    <p>{reference ? data.reference.event_count : data.trial.sample.event_count} 記録 · {reference ? data.reference.pair_count : data.trial.sample.pair_count} 観測ペア</p>
    <svg ref={svg} viewBox={`0 0 ${layout.width} ${layout.height}`} width={layout.width * zoom} height={layout.height * zoom} role="group" aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-description`} data-network={mode}>
      <title id={`${uid}-title`}>{title}</title>
      <desc id={`${uid}-description`}>左が植物、右が訪花昆虫の原分類ラベル。実線は記録された関係、破線は今回の抽出で未確認の基準関係。Tabで図に入り、矢印キーでノード・リンクを移動、EnterかSpaceで詳細を表示します。</desc>
      <text x="270" y="25" textAnchor="end" className="em-column-title">植物の原ラベル</text>
      <text x="530" y="25" className="em-column-title">昆虫の原ラベル</text>
      {links.map((link, linkIndex) => {
        const count = reference ? link.referenceCount : link.sampleCount;
        const missing = !reference && count === 0;
        const plant = nodes.get(link.plantId)!, visitor = nodes.get(link.visitorId)!;
        const path = linkPath(layout.positions.get(link.plantId)!, layout.positions.get(link.visitorId)!);
        const i = data.nodes.length + linkIndex;
        const emphasized = highlight(link);
        return <g key={link.id} {...interactive(i)} aria-label={`関係：${plant.label} × ${visitor.label}。全記録 ${link.referenceCount} 件、抽出 ${link.sampleCount} 件。${link.sampleCount > 0 ? "抽出でも確認" : "今回の抽出で未確認"}`} className={`em-link ${missing ? "em-missing" : "em-observed"} ${emphasized ? "em-highlight" : ""}`} data-pair={link.id} data-reference-count={link.referenceCount} data-sample-count={link.sampleCount} data-observed={count > 0}>
          <path className="em-link-hit" d={path} strokeWidth="14" />
          <path className="em-link-line" d={path} strokeWidth={linkWidth(count, maximum)} strokeDasharray={missing ? "5 5" : undefined} />
        </g>;
      })}
      {data.nodes.map((node, i) => {
        const position = layout.positions.get(node.id)!;
        const missing = !reference && node.samplePartners === 0;
        const match = !!query && node.label.toLocaleLowerCase("en").includes(query);
        return <g key={node.id} {...interactive(i)} aria-label={`${sideName(node)}：${node.label}。相手ラベル数 全記録 ${node.referencePartners}、抽出 ${node.samplePartners}`} transform={`translate(${position.x} ${position.y})`} className={`em-node em-${node.side} ${missing ? "em-inactive" : ""} ${match ? "em-match" : ""}`} data-node-id={node.id} data-x={position.x} data-y={position.y} data-active={reference || node.samplePartners > 0}>
          <rect x={node.side === "plant" ? -262 : -12} y="-13" width="274" height="26" rx="4" className="em-node-hit" />
          <circle r="5" />
          <text x={node.side === "plant" ? -14 : 14} y="4" textAnchor={node.side === "plant" ? "end" : "start"}>{node.label}</text>
          {missing && <title>今回の抽出では記録なし。自然界での不在を意味しません。</title>}
        </g>;
      })}
    </svg>
  </section>;
}

export function NetworkLegend() {
  return <div className="em-legend" aria-label="図の凡例">
    <span><i className="em-legend-plant" />植物の原ラベル</span>
    <span><i className="em-legend-visitor" />昆虫の原ラベル</span>
    <span><i className="em-legend-line" />実線：その図の記録で確認</span>
    <span><i className="em-legend-dash" />破線：今回の抽出で未確認</span>
    <span><i className="em-legend-empty" />白抜き点：今回の抽出では記録なし</span>
    <span>線の太さ：訪花記録数（共通の平方根スケール）</span>
  </div>;
}

function Details({ data, selected }: { data: ComparisonData; selected: Selection }) {
  const node = selected?.kind === "node" ? data.nodes.find(n => n.id === selected.id) : null;
  const link = selected?.kind === "link" ? data.links.find(l => l.id === selected.id) : null;
  const label = (id: string) => data.nodes.find(n => n.id === id)!.label;
  return <section className="em-details" aria-label="選択したノード・リンクの詳細" aria-live="polite" aria-atomic="true">
    <h3>選択した記録の詳細</h3>
    {node ? <><p>{sideName(node)} · <strong>{node.label}</strong></p><dl>
      <dt>原ラベルID</dt><dd><code>{node.id}</code></dd>
      <dt>全記録の相手ラベル数</dt><dd>{node.referencePartners}</dd>
      <dt>抽出後の相手ラベル数</dt><dd>{node.samplePartners}</dd>
    </dl></> : link ? <><p><strong>{label(link.plantId)} × {label(link.visitorId)}</strong></p><dl>
      <dt>植物の原ラベルID</dt><dd><code>{link.plantId}</code></dd>
      <dt>昆虫の原ラベルID</dt><dd><code>{link.visitorId}</code></dd>
      <dt>全記録の訪花記録数</dt><dd>{link.referenceCount}</dd>
      <dt>抽出後の訪花記録数</dt><dd>{link.sampleCount}</dd>
      <dt>今回の抽出でも確認</dt><dd>{link.sampleCount > 0 ? "確認された" : "未確認（自然界での消滅を意味しません）"}</dd>
    </dl></> : <p>図をクリックするか、矢印キーとEnter / Space、または下の選択リストで詳細を確認できます。</p>}
  </section>;
}

function Comparison({ data, onTrialChange }: { data: ComparisonData; onTrialChange?: (index: number) => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selection>(null);
  const [focusOnly, setFocusOnly] = useState(false);
  const [zoom, setZoom] = useState(1);
  const viewport = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => createBipartiteLayout(data.nodes), [data.reference]);
  const uid = useId();
  const search = query.trim().toLocaleLowerCase("en");
  const matchingNodes = data.nodes.filter(n => !search || n.label.toLocaleLowerCase("en").includes(search));
  const selectedNode = selected?.kind === "node" ? selected.id : null;
  const links = focusOnly && selectedNode ? data.links.filter(l => l.plantId === selectedNode || l.visitorId === selectedNode) : data.links;
  const selectItem = (value: Selection) => { setSelected(value); if (value?.kind !== "node") setFocusOnly(false); };
  const choose = (value: string) => {
    const i = Number(value);
    if (value === "") { selectItem(null); return; }
    selectItem({ kind: "node", id: matchingNodes[i].id });
  };
  const focusNode = () => {
    const target = [...(viewport.current?.querySelectorAll<SVGGElement>('[data-network="reference"] [data-node-id]') ?? [])].find(n => n.dataset.nodeId === selectedNode);
    target?.focus(); target?.scrollIntoView?.({ block: "center", inline: "nearest" });
  };
  return <div className="em-network-comparison">
    <div className="em-comparison-intro"><p className="em-eyebrow">OBSERVATION / COMPARISON</p><h2>記録を減らすと、見える関係はどう変わるか。</h2><p>同じ位置に並ぶ原ラベルと、記録された訪花関係を比較します。</p></div>
    <dl className="em-metrics" aria-label="表示フィルター適用前の計算指標">
      <div><dt>全記録の観測ペア</dt><dd>{data.reference.pair_count}<small> 組</small></dd></div>
      <div><dt>抽出後の観測ペア</dt><dd>{data.trial.sample.pair_count}<small> 組</small></dd></div>
      <div><dt>抽出では未確認のペア</dt><dd>{data.trial.lost_pair_count}<small> 組</small></dd></div>
      <div><dt>抽出記録 / 基準記録</dt><dd>{data.trial.sample.event_count}<small> / {data.reference.event_count}</small></dd></div>
    </dl>
    <fieldset className="em-controls"><legend>表示の調整（計算結果は変更しません）</legend>
      <label htmlFor={`${uid}-trial`}>表示する試行番号<select id={`${uid}-trial`} value={data.trial.trial_index} disabled={!onTrialChange} onChange={e => onTrialChange?.(Number(e.target.value))}>{data.trialIndices.map(t => <option key={t} value={t}>試行 {t}</option>)}</select></label>
      <label htmlFor={`${uid}-search`}>原ラベルを検索<input id={`${uid}-search`} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="例：Bombus" /></label>
      <label htmlFor={`${uid}-node`}>ノードの詳細を選択（{matchingNodes.length}候補）<select id={`${uid}-node`} value={selectedNode && matchingNodes.some(n => n.id === selectedNode) ? matchingNodes.findIndex(n => n.id === selectedNode) : ""} onChange={e => choose(e.target.value)}><option value="">選択してください</option>{matchingNodes.map((n, i) => <option key={n.id} value={i}>{sideName(n)} · {n.label}</option>)}</select></label>
      <button type="button" onClick={focusNode} disabled={!selectedNode}>選択ノードを図で確認</button>
      <label className="em-checkbox"><input type="checkbox" checked={focusOnly} disabled={!selectedNode} onChange={e => setFocusOnly(e.target.checked)} />選択ノードに接続する線だけを表示</label>
      <label htmlFor={`${uid}-zoom`}>拡大率 {Math.round(zoom * 100)}%<input id={`${uid}-zoom`} type="range" min="0.75" max="1.75" step="0.25" value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label>
      <button type="button" onClick={() => { setQuery(""); setSelected(null); setFocusOnly(false); setZoom(1); }}>表示をリセット</button>
    </fieldset>
    <Details data={data} selected={selected} />
    <label className="em-link-selector" htmlFor={`${uid}-link`}>リンクの詳細を選択（全{data.links.length}組）<select id={`${uid}-link`} value={selected?.kind === "link" ? data.links.findIndex(l => l.id === selected.id) : ""} onChange={e => selectItem(e.target.value === "" ? null : { kind: "link", id: data.links[Number(e.target.value)].id })}><option value="">選択してください</option>{data.links.map((l, i) => <option key={l.id} value={i}>{data.nodes.find(n => n.id === l.plantId)!.label} × {data.nodes.find(n => n.id === l.visitorId)!.label}：全{l.referenceCount} / 抽出{l.sampleCount}</option>)}</select></label>
    <NetworkLegend />
    <p className="em-display-count" role="status">図の表示対象：基準{links.length} / {data.links.length}ペア、抽出で確認{links.filter(l => l.sampleCount > 0).length}ペア、破線{links.filter(l => l.sampleCount === 0).length}ペア。上の指標は全対象の計算値です。</p>
    <p id={`${uid}-navigation`} className="em-navigation-help">図の枠内を縦・横にスクロールできます。Tabで各図へ入り、矢印キーで移動、Home / Endで先頭・末尾、Enter / Spaceで詳細。線が重なる場合は選択リストや表示絞り込みを使えます。</p>
    <div ref={viewport} className="em-network-viewport" tabIndex={0} role="region" aria-label="左右共通スクロールのネットワーク比較図" aria-describedby={`${uid}-navigation`}>
      <div className="em-network-panels">
        <NetworkDiagram data={data} layout={layout} mode="reference" links={links} selected={selected} query={search} zoom={zoom} onSelect={selectItem} />
        <NetworkDiagram data={data} layout={layout} mode="sample" links={links} selected={selected} query={search} zoom={zoom} onSelect={selectItem} />
      </div>
    </div>
    <div className="em-scientific-note"><p>この図は、選択された観測記録と、その一部を抽出した記録を比較したものです。表示されない関係が、自然界に存在しないことを意味するものではありません。</p><p>分類ラベルは確定種名とは限りません。線の太さは訪花記録数であり、受粉成功・送粉効率・生態学的な重要度を示しません。指定割合{data.ratePercent}%は調査時間の割合ではありません。</p></div>
    <p className="em-source">データセット：<code>{data.datasetId}</code> · <a href={`https://doi.org/${encodeURI(data.archiveDoi)}`}>大学保管版 DOI {data.archiveDoi}</a></p>
  </div>;
}

/** Controlled trial selection; the component never invokes the simulation engine. */
export function NetworkComparison({ result, trialIndex = 0, onTrialChange }: { result: RunResult; trialIndex?: number; onTrialChange?: (index: number) => void }) {
  const view = useMemo(() => {
    try { return { data: adaptRunResult(result, trialIndex), error: null }; }
    catch (error) { return { data: null, error: error instanceof Error ? error.message : "結果を検証できませんでした" }; }
  }, [result, trialIndex]);
  if (view.error) return <div className="em-network-state" role="alert"><h2>ネットワークを表示できません</h2><p>{view.error}</p><p>不整合な結果を補正して表示することはできません。</p></div>;
  if (!view.data || view.data.status === "empty_scope") return <div className="em-network-state" role="status"><h2>選択範囲に観測記録がありません</h2><p>empty_scope：比較する試行は生成されていません。訪花0件や自然界での不在を示す結果ではありません。</p></div>;
  return <Comparison key={result.scope.eligible_ids_sha256} data={view.data} onTrialChange={onTrialChange} />;
}
