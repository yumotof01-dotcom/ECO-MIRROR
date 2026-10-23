import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "../components/AppLayout";
import { SimulationDraftProvider } from "../features/simulation/SimulationDraftContext";
import { HomePage } from "../pages/HomePage";
import { SimulationPage } from "../pages/SimulationPage";
import { ResultsPage } from "../pages/ResultsPage";
import { ResearchPage } from "../pages/ResearchPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { navigation } from "./navigation";

function PageEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = navigation.find((item) => item.path === pathname);
    document.title = `${page?.title ?? "ページが見つかりません"} | ECO MIRROR`;
    document.getElementById("main-content")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <SimulationDraftProvider>
      <PageEffects />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="simulation" element={<SimulationPage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </SimulationDraftProvider>
  );
}
