/**
 * Orchestrator de rutas. Compone los 4 grupos definidos por guarda + layout.
 * Cada grupo es un Fragment de `<Route>` evaluado por react-router v6.
 * Ver split en 11.65.0 (D12).
 */
import { Routes } from "react-router-dom";
import { publicRoutes } from "./routes/publicRoutes";
import { portalRoutes } from "./routes/portalRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { appRoutes } from "./routes/appRoutes";

export const AppRoutes = () => (
  <Routes>
    {portalRoutes}
    {adminRoutes}
    {appRoutes}
    {publicRoutes}
  </Routes>
);
