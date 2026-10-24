import { Link, NavLink, Outlet } from "react-router-dom";
import { ForestBackground } from "../features/observation/ForestBackground";
import { navigation } from "../app/navigation";
import "../features/observation/observation.css";
export function AppLayout() {
  return (
    <div className="observation-shell">
      <ForestBackground />
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <header className="observation-header">
        <Link to="/" className="observation-brand">
          <span className="brand-leaf" aria-hidden="true">
            ♧
          </span>
          <span>
            ECO MIRROR<small>見えなかった、つながりを見つける</small>
          </span>
          <span className="sr-only"> ホーム</span>
        </Link>
        <nav aria-label="メインナビゲーション">
          {navigation.map((n) => (
            <NavLink key={n.path} to={n.path} end={n.path === "/"}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <Link className="ob-settings-link" to="/simulation">
          観測条件 <span aria-hidden="true">⚙</span>
        </Link>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
