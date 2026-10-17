import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PageHeading } from "../components/PageHeading";

export function ResultsPage() {
  return (
    <div className="inner-page">
      <PageHeading eyebrow="02 / ANALYSIS" title="見え方の違いを、読み解く。">
        データと条件をそろえて、観測による違いを比較するための画面です。
      </PageHeading>
      <section className="results-panel" aria-labelledby="results-title">
        <div className="panel-heading">
          <h2 id="results-title">分析結果</h2>
          <span className="small-tag">未実行</span>
        </div>
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="chart" width="36" height="36" />
          </span>
          <p className="eyebrow">WAITING FOR REAL DATA</p>
          <h3>分析結果はまだありません。</h3>
          <p>
            公開データは未接続で、計算機能も未実装です。
            <br />
            結果が得られるまで、指標やグラフは表示しません。
          </p>
          <Link className="button button-primary" to="/simulation">
            観測条件の画面へ
            <Icon name="arrow" />
          </Link>
        </div>
        <div className="results-footnote">
          <span>結果データがないため、書き出しは利用できません。</span>
          <button type="button" disabled className="button button-outline">
            結果を書き出す
          </button>
        </div>
      </section>
      <section
        className="future-results"
        aria-labelledby="future-results-title"
      >
        <h2 id="future-results-title">今後、この画面で確かめたいこと</h2>
        <div className="future-grid">
          <article>
            <span>比較の視点 01</span>
            <h3>見つかった関係</h3>
            <p>
              元の記録と抽出後の記録で、確認できる植物と昆虫の関係がどう違うか。
            </p>
          </article>
          <article>
            <span>比較の視点 02</span>
            <h3>繰り返したときの幅</h3>
            <p>
              同じ条件で抽出を繰り返した場合に、見え方がどのくらい揺れるか。
            </p>
          </article>
          <article>
            <span>比較の視点 03</span>
            <h3>計算のたどり方</h3>
            <p>
              使用データの出典、条件、乱数シード、手法の版を確認できること。
            </p>
          </article>
        </div>
        <p className="field-help">
          いずれも今後の実装予定です。採用する指標と計算方法は、データを確認して定義します。
        </p>
      </section>
    </div>
  );
}
