/**
 * Rutas del Portal del Agente de Carga. Todas bajo `AgenteProtectedRoute`.
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import { AgenteProtectedRoute } from "@/features/auth/components/AgenteProtectedRoute";

const AgenteLayout = lazy(() => import("@/features/portal-agente/components/AgenteLayout"));
const AgenteInicio = lazy(() => import("@/features/portal-agente/routes/AgenteInicio"));
const AgenteTarifas = lazy(() => import("@/features/portal-agente/routes/AgenteTarifas"));
const AgenteGarantias = lazy(() => import("@/features/portal-agente/routes/AgenteGarantias"));
const AgenteEmbarques = lazy(() => import("@/features/portal-agente/routes/AgenteEmbarques"));
const AgentePerfil = lazy(() => import("@/features/portal-agente/routes/AgentePerfil"));

export const agenteRoutes = (
  <Route
    element={
      <AgenteProtectedRoute>
        <AgenteLayout />
      </AgenteProtectedRoute>
    }
  >
    <Route path="/agente" element={<AgenteInicio />} />
    <Route path="/agente/tarifas" element={<AgenteTarifas />} />
    <Route path="/agente/garantias" element={<AgenteGarantias />} />
    <Route path="/agente/embarques" element={<AgenteEmbarques />} />
    <Route path="/agente/perfil" element={<AgentePerfil />} />
  </Route>
);
