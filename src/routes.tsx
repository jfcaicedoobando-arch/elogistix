/**
 * Orchestrator de rutas. Compone los grupos por guarda + layout.
 */
import { Routes } from "react-router";
import { useSyncExternalStore } from "react";
import { getSentryReady, subscribeSentryReady } from "@/lib/observability/sentry/runtimeState";
import { wrapReactRouterRouting } from "@sentry/react/react-router";
import { publicRoutes } from "./routes/publicRoutes";
import { portalRoutes } from "./routes/portalRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { appRoutes } from "./routes/appRoutes";
import { agenteRoutes } from "./routes/agenteRoutes";

const SentryRoutes = wrapReactRouterRouting(Routes);

export const AppRoutes = () => {
  // SDK loads after paint. Re-render the wrapper without remounting route state.
  useSyncExternalStore(subscribeSentryReady, getSentryReady, () => false);
  return (
  <SentryRoutes>
    {portalRoutes}
    {agenteRoutes}
    {adminRoutes}
    {appRoutes}
    {publicRoutes}
  </SentryRoutes>
  );
};
