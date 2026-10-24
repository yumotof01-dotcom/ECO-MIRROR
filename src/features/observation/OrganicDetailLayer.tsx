import { useState } from "react";
import type { ComparisonData, VisualNode } from "../visualization/adapter";
import { nodeDetail } from "./scene-adapter";
export function OrganicDetailLayer({
  data,
  node,
  onClose,
  onSelect,
}: {
  data: ComparisonData;
  node: VisualNode;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState("観測記録"),
    detail = nodeDetail(data, node);
  return (
    <aside className="organic-detail" aria-label="選択ノードの詳細">
      <button
        className="detail-close"
        onClick={onClose}
        aria-label="詳細を閉じる"
      >
        ×
      </button>
      <p className="ob-eyebrow">選択した原分類ラベル</p>
      <span className={`species-symbol ${node.side}`} aria-hidden="true">
        {node.side === "plant" ? "◇" : "○"}
      </span>
      <h2>{node.label}</h2>
      <p className="detail-kind">
        {node.side === "plant" ? "植物" : "昆虫"} · 原表記のまま表示
      </p>
      <div className="detail-tabs" role="group" aria-label="詳細表示">
        {["観測記録", "相手", "解説"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "観測記録" ? (
        <dl>
          <div>
            <dt>比較基準の訪花記録</dt>
            <dd>{detail.referenceRecords}件</dd>
          </div>
          <div>
            <dt>抽出後の訪花記録</dt>
            <dd>{detail.sampleRecords}件</dd>
          </div>
          <div>
            <dt>相手の原ラベル数</dt>
            <dd>
              {node.referencePartners} → {node.samplePartners}
            </dd>
          </div>
          <div>
            <dt>原ID</dt>
            <dd className="raw-id">{node.id}</dd>
          </div>
        </dl>
      ) : tab === "相手" ? (
        <>
          <p className="ob-small">相手ごとの記録件数：基準 → 抽出後</p>
          <ul className="partner-list">
            {detail.partners.map((p) => (
              <li key={p.node.id}>
                <button onClick={() => onSelect(p.node.id)}>
                  <span>{p.node.label}</span>
                  <span>
                    {p.referenceCount} → {p.sampleCount}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="detail-science">
          <p>
            ノードの記録件数は、検証済みの関係線の重みを合計した表示用の値です。個体数や受粉成功数ではありません。
          </p>
          <p>
            確定した分類ランク・和名・写真の対応情報はありません。原ラベルは確定種名とは限りません。
          </p>
          <p>未確認の関係は、自然界の不在・消滅を意味しません。</p>
        </div>
      )}
    </aside>
  );
}
