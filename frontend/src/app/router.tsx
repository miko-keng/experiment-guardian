import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { DashboardPage } from "../pages/DashboardPage";
import { NewExperimentPage } from "../pages/NewExperimentPage";
import { ExperimentDetailPage } from "../pages/ExperimentDetailPage";
import { SettingsPage } from "../pages/SettingsPage";
import { BeeImportPage } from "../pages/BeeImportPage";
import { AlexaLabPage } from "../pages/AlexaLabPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
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
    ],
  },
]);
