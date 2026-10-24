import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, KeyboardEvent } from "react";
import type { ComparisonData } from "../visualization/adapter";
import { sceneLayout, SCENE } from "./scene-layout";
import { INITIAL_TRANSFORM, pinchTransform, zoomAt } from "./scene-transform";
import type { SceneTransform } from "./scene-transform";
export type ComparisonMode = "reference" | "sample" | "difference";
export function ObservationScene({
  data,
  selected,
  onSelect,
  mode,
}: {
  data: ComparisonData;
  selected: string | null;
  onSelect: (id: string | null) => void;
  mode: ComparisonMode;
}) {
  const layout = useMemo(
    () => sceneLayout(data.nodes),
    [data.nodes.map((n) => n.id).join("\0")],
  );
  const [transform, setTransform] = useState<SceneTransform>({
      ...INITIAL_TRANSFORM,
    }),
    [search, setSearch] = useState(""),
    [connected, setConnected] = useState(false),
    [focusIndex, setFocusIndex] = useState(0);
  const svg = useRef<SVGSVGElement>(null),
    points = useRef(new Map<number, { x: number; y: number }>()),
    last = useRef({ x: 0, y: 0 }),
    suppress = useRef(false),
    origin = useRef({ x: 0, y: 0 });
  const gesture = useRef<{
    transform: SceneTransform;
    center: { x: number; y: number };
    distance: number;
  } | null>(null);
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const identity = data.nodes.map((n) => n.id).join("\0");
  useEffect(() => {
    setTransform({ ...INITIAL_TRANSFORM });
    onSelect(null);
    setFocusIndex(0);
  }, [identity]);
  const logical = (clientX: number, clientY: number) => {
    const s = svg.current!,
      matrix = s.getScreenCTM?.();
    if (matrix) {
      const p = new DOMPoint(clientX, clientY).matrixTransform(
        matrix.inverse(),
      );
      return { x: p.x, y: p.y };
    }
    const rect = s.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * 1100) / rect.width,
      y: ((clientY - rect.top) * 650) / rect.height,
    };
  };
  const pairGeometry = () => {
    const [a, b] = [...points.current.values()];
    return {
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      distance: Math.hypot(a.x - b.x, a.y - b.y),
    };
  };
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    if (!points.current.size) {
      suppress.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
    }
    const p = logical(e.clientX, e.clientY);
    points.current.set(e.pointerId, p);
    last.current = p;
    // Capture on the pressed node so a stationary tap still produces its click.
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (points.current.size === 2) {
      suppress.current = true;
      gesture.current = { transform: transformRef.current, ...pairGeometry() };
    }
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!points.current.has(e.pointerId)) return;
    const p = logical(e.clientX, e.clientY);
    points.current.set(e.pointerId, p);
    if (
      Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 5
    )
      suppress.current = true;
    if (points.current.size >= 2 && gesture.current) {
      const g = pairGeometry(),
        start = gesture.current;
      if (start.distance > 0)
        setTransform(
          pinchTransform(
            start.transform,
            start.center,
            g.center,
            g.distance / start.distance,
          ),
        );
    } else if (suppress.current) {
      const dx = p.x - last.current.x, dy = p.y - last.current.y;
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    }
    last.current = p;
  };
  const up = (e: ReactPointerEvent<SVGSVGElement>) => {
    points.current.delete(e.pointerId);
    gesture.current = null;
    const remaining = [...points.current.values()][0];
    if (remaining) last.current = remaining;
  };
  useEffect(() => {
    const s = svg.current;
    if (!s) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && !s.contains(document.activeElement))
        return;
      e.preventDefault();
      const point = logical(e.clientX, e.clientY);
      setTransform((t) =>
        zoomAt(t, t.scale * Math.exp(-e.deltaY * 0.002), point),
      );
    };
    s.addEventListener("wheel", wheel, { passive: false });
    return () => s.removeEventListener("wheel", wheel);
  }, []);
  const focusNode = (id: string) => {
    const p = layout.get(id)!;
    setTransform((t) => {
      const x = p.x * t.scale + t.x,
        y = p.y * t.scale + t.y;
      return x < 45 || x > 1055 || y < 45 || y > 605
        ? { ...t, x: 550 - p.x * t.scale, y: 325 - p.y * t.scale }
        : t;
    });
  };
  const key = (e: KeyboardEvent<SVGSVGElement>) => {
    if (["+", "=", "-", "0"].includes(e.key)) {
      e.preventDefault();
      setTransform((t) =>
        e.key === "0"
          ? { ...INITIAL_TRANSFORM }
          : zoomAt(t, t.scale * (e.key === "-" ? 0.8 : 1.25)),
      );
    }
    if (
      [
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "ArrowUp",
        "Home",
        "End",
      ].includes(e.key)
    ) {
      e.preventDefault();
      const delta = e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1;
      const i =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? data.nodes.length - 1
            : (focusIndex + delta + data.nodes.length) % data.nodes.length;
      setFocusIndex(i);
      svg.current
        ?.querySelector<SVGGElement>(`[data-scene-index="${i}"]`)
        ?.focus();
    }
  };
  const max = Math.max(1, ...data.links.map((l) => l.referenceCount));
  const matches = data.nodes.filter(
    (n) => search && n.label.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="observation-network" aria-label="訪花関係の観測空間">
      <div className="scene-toolbar">
        <label>
          原ラベルを検索
          <input
            type="search"
            value={search}
            placeholder="例：Bombus"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="scene-node-select">
          ノードを選択
          <select
            aria-label="ノードを選択"
            value={selected ?? ""}
            onChange={(e) => {
              onSelect(e.target.value || null);
              if (e.target.value) focusNode(e.target.value);
            }}
          >
            <option value="">すべての原ラベル</option>
            {data.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.side === "plant" ? "植物" : "昆虫"} · {n.label}
              </option>
            ))}
          </select>
        </label>
        <label className="scene-filter">
          <input
            type="checkbox"
            checked={connected}
            onChange={(e) => setConnected(e.target.checked)}
          />
          選択ノードの接続線のみ
        </label>
      </div>
      {search && (
        <div className="search-matches" role="status">
          {matches.length}件一致
          {matches.slice(0, 12).map((n) => (
            <button
              key={n.id}
              onClick={() => {
                onSelect(n.id);
                focusNode(n.id);
              }}
            >
              {n.label}
            </button>
          ))}
          {matches.length > 12 && (
            <span>全候補はノード選択から確認できます。</span>
          )}
        </div>
      )}
      <div className="scene-canvas">
        <svg
          ref={svg}
          viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
          role="group"
          aria-label="植物と昆虫の訪花ネットワーク"
          tabIndex={0}
          onKeyDown={key}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onClick={(e) => {
            if (
              !(e.target as Element).closest("[data-scene-node]") &&
              !suppress.current
            )
              onSelect(null);
          }}
        >
          <title>実記録から計算した訪花ネットワーク</title>
          <desc>
            植物は葉形、昆虫は円形。矢印キーで原ラベルを移動し、EnterまたはSpaceで詳細を選択。プラス・マイナスで拡大縮小、0でリセットできます。
          </desc>
          <g
            data-scene-transform={`${transform.x},${transform.y},${transform.scale}`}
            transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}
          >
            {data.links.map((l) => {
              const a = layout.get(l.plantId)!,
                b = layout.get(l.visitorId)!,
                missing = l.sampleCount === 0;
              const count =
                mode === "reference" ? l.referenceCount : l.sampleCount;
              const focus =
                !selected || l.plantId === selected || l.visitorId === selected;
              const active =
                (!connected || !selected || focus) &&
                (mode !== "difference" || missing);
              return (
                <path
                  key={l.id}
                  data-scene-link={l.id}
                  data-sample-count={l.sampleCount}
                  data-missing={missing}
                  d={`M${a.x} ${a.y} Q${(a.x + b.x) / 2 + 18} ${(a.y + b.y) / 2 - 25} ${b.x} ${b.y}`}
                  fill="none"
                  stroke={
                    mode === "reference"
                      ? "#b4cea0"
                      : missing
                        ? "#a6c9c3"
                        : "#c3dba3"
                  }
                  strokeWidth={1 + 2.8 * Math.sqrt((count || 1) / max)}
                  strokeDasharray={
                    mode !== "reference" && missing ? "3 6" : undefined
                  }
                  opacity={
                    active
                      ? focus
                        ? missing && mode === "sample"
                          ? 0.16
                          : 0.5
                        : 0.075
                      : 0
                  }
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {data.nodes.map((n, i) => {
              const p = layout.get(n.id)!,
                isSelected = n.id === selected,
                match = matches.some((m) => m.id === n.id),
                isPlant = n.side === "plant";
              return (
                <g
                  key={n.id}
                  role="button"
                  aria-label={`${isPlant ? "植物" : "昆虫"} ${n.label} の詳細`}
                  aria-pressed={isSelected}
                  tabIndex={i === focusIndex ? 0 : -1}
                  className={`scene-node ${n.side} ${isSelected ? "selected" : ""}`}
                  data-scene-node={n.id}
                  data-scene-index={i}
                  data-x={p.x}
                  data-y={p.y}
                  transform={`translate(${p.x} ${p.y})`}
                  onFocus={() => {
                    setFocusIndex(i);
                    focusNode(n.id);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!suppress.current) onSelect(n.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(n.id);
                    }
                  }}
                >
                  <title>
                    {n.label}：比較基準の相手{n.referencePartners}、抽出後
                    {n.samplePartners}
                  </title>
                  <circle r="20" className="node-hit" fill="transparent" />
                  {(isSelected || match) && (
                    <circle
                      r={isSelected ? 25 : 19}
                      className="node-ring"
                      fill="none"
                      stroke="#d9f1b1"
                      strokeWidth="1.5"
                    />
                  )}
                  {isPlant ? (
                    <path
                      d="M0 -12 C18 -9 15 8 0 14 C-15 6 -16 -8 0 -12Z"
                      fill={
                        n.samplePartners === 0 && mode !== "reference"
                          ? "#1d4641"
                          : "#91b995"
                      }
                      stroke="#cae6b5"
                      strokeWidth="1.2"
                    />
                  ) : (
                    <>
                      <ellipse
                        rx="10"
                        ry="6"
                        transform="rotate(-35)"
                        fill="#b5bd87"
                        fillOpacity=".65"
                      />
                      <ellipse
                        rx="10"
                        ry="6"
                        transform="rotate(35)"
                        fill="#b5bd87"
                        fillOpacity=".65"
                      />
                      <circle
                        r="5"
                        fill={
                          n.samplePartners === 0 && mode !== "reference"
                            ? "#27453b"
                            : "#dbc27c"
                        }
                        stroke="#f2dfac"
                      />
                    </>
                  )}
                  {(isSelected || match) && (
                    <text x="30" y="4" className="scene-label">
                      {n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
        <div className="scene-zoom" role="group" aria-label="表示倍率">
          <button
            onClick={() => setTransform((t) => zoomAt(t, t.scale * 1.25))}
            aria-label="拡大"
          >
            ＋
          </button>
          <output aria-label="現在の表示倍率">
            {Math.round(transform.scale * 100)}%
          </output>
          <button
            onClick={() => setTransform((t) => zoomAt(t, t.scale * 0.8))}
            aria-label="縮小"
          >
            −
          </button>
          <button onClick={() => setTransform({ ...INITIAL_TRANSFORM })}>
            表示をリセット
          </button>
        </div>
      </div>
      <p className="scene-legend">
        <span>◇ 植物</span>
        <span>○ 昆虫</span>
        <span>実線：確認された訪花</span>
        <span>破線：抽出で未確認</span>
        <span>線の太さ：訪花記録件数</span>
      </p>
      <p className="scene-help">
        ドラッグで移動・2本指で拡大。図にフォーカス後のホイール／Ctrl＋ホイールでズーム。キーボードは矢印・Enter・＋／−・0。図の操作は計算を変更しません。
      </p>
    </section>
  );
}
