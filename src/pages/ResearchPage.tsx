import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";
import { references, scientificNotes } from "../content/research";

export function ResearchPage() {
  return (
    <div className="inner-page research-page">
      <PageHeading eyebrow="03 / RESEARCH NOTES" title="根拠と、限界をたどる。">
        何を使って確かめるのか。どこまで言えるのか。
        <br />
        ECO MIRRORが大切にする、研究の前提をまとめました。
      </PageHeading>
      <section className="research-purpose" aria-labelledby="purpose-title">
        <p className="eyebrow">OUR QUESTION</p>
        <h2 id="purpose-title">
          関係が減ったのか。
          <br />
          それとも、見えていないのか。
        </h2>
        <div>
          <p>
            植物と昆虫の訪花関係を、観測条件の違いから見つめ直す。観測不足による誤った判断のリスクを減らすことが、このプロジェクトの目的です。
          </p>
          <p>
            実データと明示した数理手法を使い、同じデータ・条件・手法の版から計算を再現できる構造を目指します。生成AIで未知の関係を予測することはありません。
          </p>
        </div>
      </section>
      <section className="research-section" aria-labelledby="notes-title">
        <div className="section-kicker">
          <p className="eyebrow">SCIENTIFIC NOTES</p>
          <h2 id="notes-title">解釈の前に、押さえておくこと。</h2>
        </div>
        <div className="scientific-notes">
          {scientificNotes.map((note, index) => (
            <article key={note.title}>
              <span className="note-number">0{index + 1}</span>
              <div>
                <h3>{note.title}</h3>
                <p>{note.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="research-section" aria-labelledby="references-title">
        <div className="section-kicker">
          <p className="eyebrow">SOURCES & REFERENCES</p>
          <h2 id="references-title">参照先と、データの準備状況。</h2>
        </div>
        <p className="reference-intro">
          現在、アプリに接続済みのデータセットはありません。以下は調査対象・背景資料であり、このアプリの分析結果ではありません。
        </p>
        <div className="reference-list">
          {references.map((reference) => (
            <article key={reference.id}>
              <span className="reference-id">[{reference.id}]</span>
              <div>
                <p className="reference-kind">{reference.kind}</p>
                <h3>
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {reference.title}
                    <Icon name="external" width="16" height="16" />
                    <span className="sr-only">（新しいタブで開きます）</span>
                  </a>
                </h3>
                <p>{reference.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <aside className="scope-note">
        <div>
          <p className="eyebrow">CURRENT SCOPE</p>
          <h2>いまは、工程1・2まで。</h2>
          <p>
            要件・研究方針の整理と、開発環境・4画面の基盤を整備しています。データの取得、計算、分析結果の生成は今後の工程です。
          </p>
        </div>
        <Link to="/simulation" className="text-link">
          画面の基盤を見る
          <Icon name="arrow" />
        </Link>
      </aside>
    </div>
  );
}
