/**
 * Rutas de administración global (super_admin only). Bajo `AdminLayout`.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12).
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/features/admin/components/AdminLayout";

const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminOrganizaciones = lazy(() => import("@/pages/admin/AdminOrganizaciones"));
const AdminOrgDetalle = lazy(() => import("@/pages/admin/AdminOrgDetalle"));
const AdminUsuarios = lazy(() => import("@/pages/admin/AdminUsuarios"));
const AdminConfiguracion = lazy(() => import("@/pages/admin/AdminConfiguracion"));
const AdminDiagnostico = lazy(() => import("@/pages/admin/Diagnostico"));
const AdminAuditoriaPlataforma = lazy(() => import("@/pages/admin/AdminAuditoriaPlataforma"));

export const adminRoutes = (
  <Route
    element={
      <ProtectedRoute allowedRoles={["super_admin"]}>
        <AdminLayout />
      </ProtectedRoute>
    }
  >
    <Route path="/admin" element={<AdminDashboard />} />
    <Route path="/admin/organizaciones" element={<AdminOrganizaciones />} />
    <Route path="/admin/organizaciones/:id" element={<AdminOrgDetalle />} />
    <Route path="/admin/usuarios" element={<AdminUsuarios />} />
    <Route path="/admin/auditoria" element={<AdminAuditoriaPlataforma />} />
    <Route path="/admin/configuracion" element={<AdminConfiguracion />} />
    <Route path="/admin/diagnostico" element={<AdminDiagnostico />} />
  </Route>
);
