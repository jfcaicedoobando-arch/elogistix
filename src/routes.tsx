/**
 * Orchestrator de rutas. Compone los grupos por guarda + layout.
 */
import { Routes } from "react-router-dom";
import { publicRoutes } from "./routes/publicRoutes";
import { portalRoutes } from "./routes/portalRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { appRoutes } from "./routes/appRoutes";
import { agenteRoutes } from "./routes/agenteRoutes";

export const AppRoutes = () => (
  <Routes>
    {portalRoutes}
    {agenteRoutes}
    {adminRoutes}
    {appRoutes}
    {publicRoutes}
  </Routes>
);
