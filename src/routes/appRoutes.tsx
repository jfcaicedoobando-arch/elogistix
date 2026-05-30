/**
 * Rutas principales de la aplicación (operativos autenticados). Bajo
 * `ProtectedRoute` + `Layout`. Incluye el sub-árbol del CRM anidado bajo /crm.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12).
 */
import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const Dashboard = lazy(() => import("@/pages/dashboard/Dashboard"));
const Operaciones = lazy(() => import("@/pages/dashboard/Operaciones"));
const Reportes = lazy(() => import("@/pages/dashboard/Reportes"));
const Bitacora = lazy(() => import("@/pages/dashboard/Bitacora"));
const Ayuda = lazy(() => import("@/pages/dashboard/Ayuda"));

const Papelera = lazy(() => import("@/pages/admin/Papelera"));
const Idempotencia = lazy(() => import("@/pages/admin/Idempotencia"));
const Auditoria = lazy(() => import("@/pages/Auditoria"));
const SentryDiagnostico = lazy(() => import("@/pages/admin/SentryDiagnostico"));

const Embarques = lazy(() => import("@/pages/embarques/Embarques"));
const EmbarqueDetalle = lazy(() => import("@/pages/embarques/EmbarqueDetalle"));
const NuevoEmbarque = lazy(() => import("@/pages/embarques/NuevoEmbarque"));
const EditarEmbarque = lazy(() => import("@/pages/embarques/EditarEmbarque"));

const Cotizaciones = lazy(() => import("@/pages/cotizaciones/Cotizaciones"));
const NuevaCotizacion = lazy(() => import("@/pages/cotizaciones/NuevaCotizacion"));
const CotizacionDetalle = lazy(() => import("@/pages/cotizaciones/CotizacionDetalle"));
const EditarCotizacion = lazy(() => import("@/pages/cotizaciones/EditarCotizacion"));
const PdfPreviewCotizacion = lazy(() => import("@/pages/dev/PdfPreviewCotizacion"));

const Clientes = lazy(() => import("@/pages/clientes/Clientes"));
const ClienteDetalle = lazy(() => import("@/pages/clientes/ClienteDetalle"));
const Proveedores = lazy(() => import("@/pages/proveedores/Proveedores"));
const ProveedorDetalle = lazy(() => import("@/pages/proveedores/ProveedorDetalle"));
const Facturacion = lazy(() => import("@/pages/facturacion/Facturacion"));
const FacturaDetalle = lazy(() => import("@/pages/facturacion/FacturaDetalle"));
const ProfitProyeccion = lazy(() => import("@/pages/profit/ProfitProyeccion"));
const ProfitEstadoResultados = lazy(() => import("@/pages/profit/ProfitEstadoResultados"));

const Usuarios = lazy(() => import("@/pages/admin-org/Usuarios"));
const Configuracion = lazy(() => import("@/pages/admin-org/Configuracion"));

// CRM — anidado bajo /crm con CrmLayout
const CrmLayout = lazy(() => import("@/pages/crm/CrmLayout"));
const CrmDashboard = lazy(() => import("@/pages/crm/CrmDashboard"));
const CrmMiDia = lazy(() => import("@/pages/crm/MiDia"));
const Leads = lazy(() => import("@/pages/crm/Leads"));
const LeadDetalle = lazy(() => import("@/pages/crm/LeadDetalle"));
const Oportunidades = lazy(() => import("@/pages/crm/Oportunidades"));
const OportunidadDetalle = lazy(() => import("@/pages/crm/OportunidadDetalle"));
const ActividadesCrm = lazy(() => import("@/pages/crm/Actividades"));
const AnaliticaCrm = lazy(() => import("@/pages/crm/Analitica"));
const CrmConfiguracion = lazy(() => import("@/pages/crm/Configuracion"));

export const appRoutes = (
  <Route
    element={
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    }
  >
    <Route path="/" element={<Dashboard />} />
    <Route path="/operaciones" element={<Operaciones />} />
    <Route path="/embarques" element={<Embarques />} />
    <Route path="/embarques/nuevo" element={<NuevoEmbarque />} />
    <Route path="/embarques/:id" element={<EmbarqueDetalle />} />
    <Route path="/embarques/:id/editar" element={<EditarEmbarque />} />
    <Route path="/facturacion" element={<Facturacion />} />
    <Route path="/facturacion/:id" element={<FacturaDetalle />} />
    <Route path="/profit" element={<Navigate to="/profit/proyeccion" replace />} />
    <Route path="/profit/proyeccion" element={<ProfitProyeccion />} />
    <Route path="/profit/estado-resultados" element={<ProfitEstadoResultados />} />
    <Route path="/clientes" element={<Clientes />} />
    <Route path="/clientes/:id" element={<ClienteDetalle />} />
    <Route path="/proveedores" element={<Proveedores />} />
    <Route path="/proveedores/:id" element={<ProveedorDetalle />} />
    <Route path="/cotizaciones" element={<Cotizaciones />} />
    <Route path="/cotizaciones/nueva" element={<NuevaCotizacion />} />
    <Route path="/cotizaciones/:id" element={<CotizacionDetalle />} />
    <Route path="/cotizaciones/:id/editar" element={<EditarCotizacion />} />
    <Route path="/dev/pdf-preview/cotizacion/:id" element={<PdfPreviewCotizacion />} />
    <Route path="/reportes/rentabilidad" element={<Reportes />} />
    <Route path="/reportes" element={<Navigate to="/reportes/rentabilidad" replace />} />
    <Route path="/rentabilidad" element={<Navigate to="/reportes/rentabilidad" replace />} />
    <Route path="/ayuda" element={<Ayuda />} />
    <Route path="/sentry" element={<SentryDiagnostico />} />
    <Route path="/crm" element={<CrmLayout />}>
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
    </Route>
    <Route path="/bitacora" element={<Bitacora />} />
    <Route
      path="/papelera"
      element={
        <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
          <Papelera />
        </ProtectedRoute>
      }
    />
    <Route
      path="/idempotencia"
      element={
        <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
          <Idempotencia />
        </ProtectedRoute>
      }
    />
    <Route path="/auditoria" element={<Auditoria />} />
    <Route
      path="/usuarios"
      element={
        <ProtectedRoute allowedRoles={["admin"]}>
          <Usuarios />
        </ProtectedRoute>
      }
    />
    <Route
      path="/configuracion"
      element={
        <ProtectedRoute allowedRoles={["admin"]}>
          <Configuracion />
        </ProtectedRoute>
      }
    />
  </Route>
);
