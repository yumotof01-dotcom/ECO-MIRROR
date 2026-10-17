import { Link } from "react-router-dom";
import { BotanicalIllustration } from "../components/BotanicalIllustration";
import { Icon } from "../components/Icon";

const steps = [
  {
    number: "01",
    icon: "layers",
    title: "実データから始める",
    text: "植物と昆虫の公開訪花データを使い、記録された関係を出発点にします。",
  },
  {
    number: "02",
    icon: "scan",
    title: "観測の条件を変える",
    text: "観測量や偏りを変えたとき、どの関係が見えにくくなるかを調べます。",
  },
  {
    number: "03",
    icon: "chart",
    title: "判断の前に、確かめる",
    text: "見え方の違いを比較し、観測不足を生態系の変化と取り違えるリスクを考えます。",
  },
] as const;

export function HomePage() {
  return (
    <div className="home-page">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> ECOLOGY THROUGH OBSERVATION
          </p>
          <h1 id="home-title">
            見えている自然が、
            <br />
            すべてとは
            <br className="desktop-break" />
            限らない。
          </h1>
          <p className="hero-description">
            花に来る昆虫。そこに見える、小さなつながり。
            <br className="wide-break" />
            観測のしかたが変わると、関係の見え方も変わるのでしょうか。
          </p>
          <p className="hero-description secondary">
            ECO MIRRORは、実データと再現可能な数理計算で
            <br className="wide-break" />
            その問いを確かめるためのWebシミュレーターです。
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/simulation">
              観測条件を見てみる
              <Icon name="arrow" />
            </Link>
            <Link className="text-link" to="/research">
              研究の背景を読む
              <Icon name="arrow" />
            </Link>
          </div>
          <p className="hero-note">
            現在は開発基盤のプレビューです。計算はまだ実行できません。
          </p>
        </div>
        <BotanicalIllustration />
      </section>
      <section className="approach" aria-labelledby="approach-title">
        <div className="section-kicker">
          <p className="eyebrow">THE APPROACH</p>
          <h2 id="approach-title">「いない」と決める、その前に。</h2>
        </div>
        <div className="approach-grid">
          {steps.map((step) => (
            <article className="approach-item" key={step.number}>
              <div className="step-top">
                <span>{step.number}</span>
                <Icon name={step.icon} />
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>
      <aside className="foundation-note">
        <div>
          <p className="eyebrow">WHERE WE ARE</p>
          <h2>問いを確かめるための、土台づくり。</h2>
          <p>
            いま使えるのは、画面の移動と観測条件の下書きです。
            <br />
            公開データの接続と計算機能は、次の工程から順に開発します。
          </p>
        </div>
        <Link to="/research" className="button button-light">
          現在の範囲を確認
          <Icon name="arrow" />
        </Link>
      </aside>
    </div>
  );
}
