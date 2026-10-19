import { Link, NavLink, Outlet } from "react-router-dom";
import { navigation } from "../app/navigation";
import { Icon } from "./Icon";

export function AppLayout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <header className="site-header">
        <Link to="/" className="brand" aria-label="ECO MIRROR A CLOSER LOOK AT NATURE ホーム">
          <span className="brand-mark">
            <Icon name="sprout" />
          </span>
          <span>
            ECO MIRROR
            <span className="brand-subtitle">A CLOSER LOOK AT NATURE</span>
          </span>
        </Link>
        <nav aria-label="メインナビゲーション">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <span className="build-label">
          <span className="status-dot" />
          公開前の機能統合版
        </span>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <Link className="footer-brand" to="/">
            ECO MIRROR<span>観測を、問い直す。</span>
          </Link>
          <p>
            実データと、再現可能な計算から。
            <br />
            生成AIによる予測は行いません。
          </p>
        </div>
        <div className="footer-bottom">
          <span>植物と昆虫の関係を考える、観測シミュレーター</span>
          <span>第9工程 · 公開前検証</span>
        </div>
      </footer>
    </div>
  );
}
