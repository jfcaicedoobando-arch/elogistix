/**
 * Sub-árbol de rutas del CRM. Extraído de `appRoutes.tsx` en v13.56.2
 * (auditoría — paso 9) para mantener el archivo raíz ≤200 líneas.
 *
 * Estos elementos `<Route>` se montan dentro del `<Route path="/crm">` de
 * `appRoutes.tsx`. No incluyen `Layout` ni `ProtectedRoute`: heredan los
 * de la ruta padre. Excepción Ola 6 (O6.3): `configuracion` añade un
 * ProtectedRoute inline con CRM_CONFIGURACION_ROLES (subconjunto de CRM_ROLES).
 */
import { Fragment } from "react";
import { Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { CRM_CONFIGURACION_ROLES } from "@/lib/access/roleRouteMatrix";
import {
  CrmDashboard, CrmMiDia, Leads, LeadDetalle,
  Oportunidades, OportunidadDetalle, ActividadesCrm, AnaliticaCrm, CrmConfiguracion, CrmHigiene,
} from "./appRoutes.lazy";

export const crmChildRoutes = (
  <Fragment>
    <Route index element={<CrmDashboard />} />
    <Route path="mi-dia" element={<CrmMiDia />} />
    <Route path="leads" element={<Leads />} />
    <Route path="leads/:id" element={<LeadDetalle />} />
    <Route path="oportunidades" element={<Oportunidades />} />
    <Route path="oportunidades/:id" element={<OportunidadDetalle />} />
    <Route path="actividades" element={<ActividadesCrm />} />
    <Route path="higiene" element={<CrmHigiene />} />
    <Route path="analitica" element={<AnaliticaCrm />} />
    <Route path="forecast" element={<Navigate to="/crm/analitica" replace />} />
    <Route path="reportes" element={<Navigate to="/crm/analitica?tab=embudo" replace />} />
    {/* V-02 (auditoría visual 2026-08-21): `/crm/pipeline` daba 404; el Kanban
        vive en `/crm/oportunidades`. */}
    <Route path="pipeline" element={<Navigate to="/crm/oportunidades" replace />} />

    {/* Ola 6 (O6.3): configuración del CRM gateada a admin del tenant +
        gerencia comercial; el ícono del header usa el mismo permiso. */}
    <Route
      path="configuracion"
      element={
        <ProtectedRoute allowedRoles={CRM_CONFIGURACION_ROLES} inline>
          <CrmConfiguracion />
        </ProtectedRoute>
      }
    />
  </Fragment>
);
