import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { App } from "./App";
import { DashboardPage } from "../pages/DashboardPage";
import { NewExperimentPage } from "../pages/NewExperimentPage";
import { ExperimentDetailPage } from "../pages/ExperimentDetailPage";
import { SettingsPage } from "../pages/SettingsPage";
import { BeeImportPage } from "../pages/BeeImportPage";
import { AlexaLabPage } from "../pages/AlexaLabPage";
import { LegalPage } from "../pages/LegalPage";

function HomePage() {
  const location = useLocation();
  if (new URLSearchParams(location.search).has("experiment") || new URLSearchParams(location.search).has("session")) {
    return <Navigate to={`/lab${location.search}`} replace />;
  }
  return <DashboardPage />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "lab",
        element: <AlexaLabPage />,
      },
      {
        path: "experiments",
        element: <DashboardPage />,
      },
      {
        path: "new",
        element: <NewExperimentPage />,
      },
      {
        path: "experiments/:id",
        element: <ExperimentDetailPage />,
      },
      {
        path: "bee",
        element: <BeeImportPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "privacy",
        element: <LegalPage kind="privacy" />,
      },
      {
        path: "terms",
        element: <LegalPage kind="terms" />,
      },
    ],
  },
]);
