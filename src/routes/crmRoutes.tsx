/**
 * Sub-árbol de rutas del CRM. Extraído de `appRoutes.tsx` en v13.56.2
 * (auditoría — paso 9) para mantener el archivo raíz ≤200 líneas.
 *
 * Estos elementos `<Route>` se montan dentro del `<Route path="/crm">` de
 * `appRoutes.tsx`. No incluyen `Layout` ni `ProtectedRoute`: heredan los
 * de la ruta padre.
 */
import { Fragment } from "react";
import { Route, Navigate } from "react-router-dom";
import {
  CrmDashboard, CrmMiDia, Leads, LeadDetalle,
  Oportunidades, OportunidadDetalle, ActividadesCrm, AnaliticaCrm, CrmConfiguracion,
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
    <Route path="analitica" element={<AnaliticaCrm />} />
    <Route path="forecast" element={<Navigate to="/crm/analitica?tab=forecast" replace />} />
    <Route path="reportes" element={<Navigate to="/crm/analitica?tab=embudo" replace />} />
    <Route path="configuracion" element={<CrmConfiguracion />} />
  </Fragment>
);
