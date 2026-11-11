import { wrapReactRouterRouting } from "@sentry/react/react-router";
import type { ComponentProps } from "react";
import type { Routes } from "react-router";

// El SDK agrega su reporter junto al componente envuelto. Las rutas reales
// ya están montadas en AppRoutes y conservan su estado cuando se activa Sentry.
const EmptyRoutes: typeof Routes = () => null;
const SentryRouteReporter = wrapReactRouterRouting(EmptyRoutes);

export default function RouteReporter(props: ComponentProps<typeof Routes>) {
  return <SentryRouteReporter {...props} />;
}
