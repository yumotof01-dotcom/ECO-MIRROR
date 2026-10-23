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
            実データと明示した数理手法を使い、同じデータ・条件・計算版から計算を再現します。生成AIで未知の関係を予測することはありません。
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
          <h2 id="references-title">採用データと、参照先。</h2>
        </div>
        <p className="reference-intro">
          Moss & Evans (2022)の英国実験の訪花記録を使用します。大学保管v1の版・ハッシュを検証し、植物20・昆虫104の原ラベルと3,882行を保持します。原ラベル数は確定種数ではありません。
        </p>
        <p className="reference-intro"><a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">利用条件：CC BY 4.0（新しいタブ）</a>。加工は原ラベルを保持した正規化、イベントの非復元抽出、ネットワーク集計、反復統計と描画です。英国の実験から日本の再生草原を直接評価する資料ではありません。元著者が本アプリを承認・推奨していることを意味しません。</p>
        <p className="reference-intro">同値の行も個別記録として保持します。2014年と2015年のRoundは別ラベルで扱います。元記録のない15調査単位は、調査実施と訪花0件の区別がつかないため補完しません。抽出割合は調査時間ではなく、分位範囲は生態系の95%信頼区間ではありません。</p>
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
          <h2>実データの計算・比較・保存まで。</h2>
          <p>
            単一・反復試行、固定配置のネットワーク比較、反復統計、正式JSON・来歴・CSVの保存を接続しました。処理はブラウザ内で完結します。実地の観測過程の妥当性、科学的レビュー、一般公開は今後の工程です。
          </p>
        </div>
        <Link to="/simulation" className="text-link">
          観測条件を設定する
          <Icon name="arrow" />
        </Link>
      </aside>
    </div>
  );
}
