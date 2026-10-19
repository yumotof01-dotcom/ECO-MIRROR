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
    text: "比較する年・区画・処理・調査回と残す記録の割合を選び、確認できる関係の違いを調べます。",
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
              シミュレーションを始める
              <Icon name="arrow" />
            </Link>
            <Link className="text-link" to="/research">
              研究の背景を読む
              <Icon name="arrow" />
            </Link>
          </div>
          <p className="hero-note">
            英国の実データ3,882記録を使用します。全記録も自然界の完全な真値ではなく、訪花は受粉成功を証明しません。
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
          <h2>記録から、比較して確かめる。</h2>
          <p>
            条件を選び、単一・反復試行を実行して、ネットワークと統計を比較できます。
            <br />
            結果と再現用JSON・来歴は端末へ保存できます。処理はブラウザ内で行い、データを外部サーバーへ送りません。
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
