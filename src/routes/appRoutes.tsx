/**
 * Rutas principales de la aplicación (operativos autenticados). Bajo
 * `ProtectedRoute` + `Layout`. Incluye el sub-árbol del CRM anidado bajo /crm.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12). Los `lazy(...)` viven en
 * `./appRoutes.lazy.ts` para mantener este archivo ≤200 líneas.
 */
import { Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  Dashboard, Operaciones, Reportes, Bitacora, Ayuda,
  Papelera, Idempotencia, Auditoria, SentryDiagnostico,
  Embarques, EmbarqueDetalle, NuevoEmbarque, EditarEmbarque,
  Cotizaciones, NuevaCotizacion, NuevaCotizacionInformativa, CotizacionDetalle, EditarCotizacion, PdfPreviewCotizacion,
  Clientes, ClienteDetalle, Proveedores, ProveedorDetalle,
  Facturacion, FacturaDetalle,
  ProfitProyeccion, ProfitEstadoResultados, ProfitPresupuesto, ProfitDashboardEjecutivo,
  Cxp, Tesoreria, TesoreriaCuentas, TesoreriaConciliacion, TesoreriaFlujo, Comisiones,
  CosteoTarifas, CosteoBuscar, CosteoRutas, CosteoAgentes, CosteoNavieras, CosteoDemorasVenta,
  Usuarios, Configuracion,
  CrmLayout, CrmDashboard, CrmMiDia, Leads, LeadDetalle,
  Oportunidades, OportunidadDetalle, ActividadesCrm, AnaliticaCrm, CrmConfiguracion,
} from "./appRoutes.lazy";

export const appRoutes = (
  <Route
    element={
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    }
  >
    <Route path="/inicio" element={<Dashboard />} />
    <Route path="/operaciones" element={<Operaciones />} />
    <Route path="/embarques" element={<Embarques />} />
    <Route path="/embarques/nuevo" element={<NuevoEmbarque />} />
    <Route path="/embarques/:id" element={<EmbarqueDetalle />} />
    <Route path="/embarques/:id/editar" element={<EditarEmbarque />} />
    <Route path="/facturacion" element={<Facturacion />} />
    <Route path="/facturacion/:id" element={<FacturaDetalle />} />
    <Route
      path="/cxp"
      element={
        <ProtectedRoute allowedRoles={["admin", "super_admin", "contador", "tesorero"]}>
          <Cxp />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tesoreria"
      element={
        <ProtectedRoute allowedRoles={["admin", "super_admin", "contador", "tesorero"]}>
          <Tesoreria />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tesoreria/cuentas"
      element={
        <ProtectedRoute allowedRoles={["admin", "super_admin", "contador", "tesorero"]}>
          <TesoreriaCuentas />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tesoreria/conciliacion"
      element={
        <ProtectedRoute allowedRoles={["admin", "super_admin", "contador", "tesorero"]}>
          <TesoreriaConciliacion />
        </ProtectedRoute>
      }
    />
    <Route
      path="/tesoreria/flujo"
      element={
        <ProtectedRoute allowedRoles={["admin", "super_admin", "contador", "tesorero"]}>
          <TesoreriaFlujo />
        </ProtectedRoute>
      }
    />

    <Route
      path="/comisiones"
      element={<Comisiones />}
    />
    <Route path="/costeo" element={<Navigate to="/costeo/tarifas" replace />} />
    <Route path="/costeo/tarifas" element={<CosteoTarifas />} />
    <Route path="/costeo/buscar" element={<CosteoBuscar />} />
    <Route path="/costeo/rutas" element={<CosteoRutas />} />
    <Route path="/costeo/agentes" element={<CosteoAgentes />} />
    <Route path="/costeo/navieras" element={<CosteoNavieras />} />
    <Route path="/costeo/demoras-venta" element={<CosteoDemorasVenta />} />
    <Route path="/profit" element={<Navigate to="/profit/dashboard" replace />} />
    <Route
      path="/profit/dashboard"
      element={
        <ProtectedRoute allowedRoles={["admin", "super_admin", "contador", "tesorero"]}>
          <ProfitDashboardEjecutivo />
        </ProtectedRoute>
      }
    />
    <Route path="/profit/proyeccion" element={<ProfitProyeccion />} />
    <Route path="/profit/estado-resultados" element={<ProfitEstadoResultados />} />
    <Route
      path="/profit/presupuesto"
      element={
        <ProtectedRoute allowedRoles={["admin", "super_admin", "contador", "tesorero"]}>
          <ProfitPresupuesto />
        </ProtectedRoute>
      }
    />

    <Route path="/clientes" element={<Clientes />} />
    <Route path="/clientes/:id" element={<ClienteDetalle />} />
    <Route path="/proveedores" element={<Proveedores />} />
    <Route path="/proveedores/:id" element={<ProveedorDetalle />} />
    <Route path="/cotizaciones" element={<Cotizaciones />} />
    <Route path="/cotizaciones/nueva" element={<NuevaCotizacion />} />
    <Route path="/cotizaciones/nueva/tarifario" element={<NuevaCotizacionInformativa />} />
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
