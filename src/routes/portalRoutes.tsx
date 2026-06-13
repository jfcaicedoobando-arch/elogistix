/**
 * Rutas del Portal del Cliente. Todas bajo `PortalProtectedRoute` + `PortalLayout`.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12).
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import { PortalProtectedRoute } from "@/components/auth/PortalProtectedRoute";
import PortalLayout from "@/features/portal/components/PortalLayout";

const PortalDashboard = lazy(() => import("@/pages/portal/PortalDashboard"));
const PortalEmbarques = lazy(() => import("@/pages/portal/PortalEmbarques"));
const PortalEmbarqueDetalle = lazy(() => import("@/pages/portal/PortalEmbarqueDetalle"));
const PortalCotizaciones = lazy(() => import("@/pages/portal/PortalCotizaciones"));
const PortalCotizacionDetalle = lazy(() => import("@/pages/portal/PortalCotizacionDetalle"));
const PortalFacturas = lazy(() => import("@/pages/portal/PortalFacturas"));
const PortalFacturaDetalle = lazy(() => import("@/pages/portal/PortalFacturaDetalle"));
const PortalPerfil = lazy(() => import("@/pages/portal/PortalPerfil"));

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
    <Route path="/portal/perfil" element={<PortalPerfil />} />
  </Route>
);
