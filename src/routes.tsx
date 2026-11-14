/**
 * Orchestrator de rutas. Compone los grupos por guarda + layout.
 */
import { Routes } from "react-router";
import { lazy, Suspense, useSyncExternalStore } from "react";
import { getSentryReady, subscribeSentryReady } from "@/lib/observability/sentry/runtimeState";
import { publicRoutes } from "./routes/publicRoutes";
import { portalRoutes } from "./routes/portalRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { appRoutes } from "./routes/appRoutes";
import { agenteRoutes } from "./routes/agenteRoutes";
import { brokerRoutes } from "./routes/brokerRoutes";

const SentryRouteReporter = lazy(() => import("@/lib/observability/sentry/RouteReporter"));
const routeElements = <>{portalRoutes}{agenteRoutes}{brokerRoutes}{adminRoutes}{appRoutes}{publicRoutes}</>;

function RouteTelemetry() {
  const ready = useSyncExternalStore(subscribeSentryReady, getSentryReady, () => false);
  return ready ? <SentryRouteReporter>{routeElements}</SentryRouteReporter> : null;
}

export const AppRoutes = () => (
  <>
    <Routes>{routeElements}</Routes>
    <Suspense fallback={null}><RouteTelemetry /></Suspense>
  </>
);
