/**
 * Rutas de administración global (super_admin only). Bajo `AdminLayout`.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12).
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLayout } from "@/features/admin/components/AdminLayout";

const AdminDashboard = lazy(() => import("@/features/admin/routes/AdminDashboard"));
const AdminOrganizaciones = lazy(() => import("@/features/admin/routes/AdminOrganizaciones"));
const AdminOrgDetalle = lazy(() => import("@/features/admin/routes/AdminOrgDetalle"));
const AdminUsuarios = lazy(() => import("@/features/admin/routes/AdminUsuarios"));
const AdminConfiguracion = lazy(() => import("@/features/admin/routes/AdminConfiguracion"));
const AdminDiagnostico = lazy(() => import("@/features/admin/routes/Diagnostico"));
const AdminAuditoriaPlataforma = lazy(() => import("@/features/admin/routes/AdminAuditoriaPlataforma"));

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
