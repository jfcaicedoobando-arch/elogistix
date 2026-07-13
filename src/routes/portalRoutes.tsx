/**
 * Rutas del Portal del Cliente. Todas bajo `PortalProtectedRoute` + `PortalLayout`.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12).
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import { PortalProtectedRoute } from "@/features/auth/components/PortalProtectedRoute";
import PortalLayout from "@/features/portal/components/PortalLayout";

const PortalDashboard = lazy(() => import("@/features/portal/routes/PortalDashboard"));
const PortalEmbarques = lazy(() => import("@/features/portal/routes/PortalEmbarques"));
const PortalEmbarqueDetalle = lazy(() => import("@/features/portal/routes/PortalEmbarqueDetalle"));
const PortalCotizaciones = lazy(() => import("@/features/portal/routes/PortalCotizaciones"));
const PortalCotizacionDetalle = lazy(() => import("@/features/portal/routes/PortalCotizacionDetalle"));
const PortalFacturas = lazy(() => import("@/features/portal/routes/PortalFacturas"));
const PortalFacturaDetalle = lazy(() => import("@/features/portal/routes/PortalFacturaDetalle"));
const PortalEstadoCuenta = lazy(() => import("@/features/portal/routes/PortalEstadoCuenta"));
const PortalPerfil = lazy(() => import("@/features/portal/routes/PortalPerfil"));

export const portalRoutes = (
  <Route
    element={
      <PortalProtectedRoute>
        <PortalLayout />
      </PortalProtectedRoute>
    }
  >
    <Route path="/portal" element={<PortalDashboard />} />
    <Route path="/portal/embarques" element={<PortalEmbarques />} />
    <Route path="/portal/embarques/:id" element={<PortalEmbarqueDetalle />} />
    <Route path="/portal/cotizaciones" element={<PortalCotizaciones />} />
    <Route path="/portal/cotizaciones/:id" element={<PortalCotizacionDetalle />} />
    <Route path="/portal/facturas" element={<PortalFacturas />} />
    <Route path="/portal/facturas/:id" element={<PortalFacturaDetalle />} />
    <Route path="/portal/estado-de-cuenta" element={<PortalEstadoCuenta />} />
    <Route path="/portal/perfil" element={<PortalPerfil />} />
  </Route>
);
