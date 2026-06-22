/**
 * Rutas principales de la aplicación (operativos autenticados). Bajo
 * `ProtectedRoute` + `Layout`. Incluye el sub-árbol del CRM anidado bajo /crm.
 * Extraído de `src/routes.tsx` en 11.65.0 (D12). Los `lazy(...)` viven en
 * `./appRoutes.lazy.ts`. En 13.56.8 se introdujo el helper `guarded()` para
 * colapsar las rutas con `allowedRoles` a una sola línea cada una.
 */
import type { ReactNode } from "react";
import { Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import type { AppRole } from "@/types/appRole";
import {
  Dashboard, Operaciones, Reportes, CierreMensual, Bitacora, Ayuda,
  Papelera, Idempotencia, Auditoria, SentryDiagnostico,
  Embarques, EmbarqueDetalle, NuevoEmbarque, EditarEmbarque,
  Cotizaciones, NuevaCotizacion, NuevaCotizacionInformativa, CotizacionDetalle, EditarCotizacion, PdfPreviewCotizacion,
  Clientes, ClienteDetalle, Proveedores, ProveedorDetalle,
  Facturacion, FacturaDetalle, ProformaDetalle, ProformasListado,
  ProfitProyeccion, ProfitEstadoResultados, ProfitPresupuesto, ProfitDashboardEjecutivo,
  Cxp, Compras, CxpPorCapturar, CxpPorPagar, FacturacionPorEmitir, Cartera,
  Tesoreria, TesoreriaCuentas, TesoreriaConciliacion, TesoreriaFlujo, Comisiones,
  CosteoTarifas, CosteoBuscar, CosteoRutas, CosteoAgentes, CosteoNavieras, CosteoDemorasVenta,
  Usuarios, Configuracion,
  CrmLayout,
} from "./appRoutes.lazy";
import { crmChildRoutes } from "./crmRoutes";

const guarded = (roles: AppRole[], element: ReactNode) => (
  <ProtectedRoute allowedRoles={roles}>{element}</ProtectedRoute>
);

const TESORERIA_ROLES: AppRole[] = ["admin", "super_admin", "contador", "tesorero"];

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
    <Route path="/proformas" element={<ProformasListado />} />
    <Route path="/proformas/:id" element={<ProformaDetalle />} />

    <Route path="/compras" element={guarded([...TESORERIA_ROLES, "auxiliar_contable", "admin_org"], <Compras />)} />
    <Route path="/cxp" element={guarded([...TESORERIA_ROLES, "auxiliar_contable"], <Cxp />)} />
    <Route path="/cxp/por-capturar" element={guarded(["admin", "super_admin", "admin_org", "contador", "auxiliar_contable", "tesorero"], <CxpPorCapturar />)} />
    <Route path="/cxp/por-pagar" element={guarded(["admin", "super_admin", "admin_org", "tesorero"], <CxpPorPagar />)} />
    <Route path="/facturacion/por-emitir" element={guarded(["admin", "super_admin", "admin_org", "contador"], <FacturacionPorEmitir />)} />
    <Route path="/cartera" element={guarded(["admin", "super_admin", "admin_org", "contador", "ejecutivo_cobranza"], <Cartera />)} />

    <Route path="/tesoreria" element={guarded(TESORERIA_ROLES, <Tesoreria />)} />
    <Route path="/tesoreria/cuentas" element={guarded(TESORERIA_ROLES, <TesoreriaCuentas />)} />
    <Route path="/tesoreria/conciliacion" element={guarded(TESORERIA_ROLES, <TesoreriaConciliacion />)} />
    <Route path="/tesoreria/flujo" element={guarded(TESORERIA_ROLES, <TesoreriaFlujo />)} />

    <Route path="/comisiones" element={<Comisiones />} />
    <Route path="/costeo" element={<Navigate to="/costeo/tarifas" replace />} />
    <Route path="/costeo/tarifas" element={<CosteoTarifas />} />
    <Route path="/costeo/buscar" element={<CosteoBuscar />} />
    <Route path="/costeo/rutas" element={<CosteoRutas />} />
    <Route path="/costeo/agentes" element={<CosteoAgentes />} />
    <Route path="/costeo/navieras" element={<CosteoNavieras />} />
    <Route path="/costeo/demoras-venta" element={<CosteoDemorasVenta />} />

    <Route path="/profit" element={<Navigate to="/profit/dashboard" replace />} />
    <Route path="/profit/dashboard" element={guarded(TESORERIA_ROLES, <ProfitDashboardEjecutivo />)} />
    <Route path="/profit/proyeccion" element={<ProfitProyeccion />} />
    <Route path="/profit/estado-resultados" element={<ProfitEstadoResultados />} />
    <Route path="/profit/presupuesto" element={guarded(TESORERIA_ROLES, <ProfitPresupuesto />)} />

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
    <Route path="/reportes/cierre-mensual" element={<CierreMensual />} />
    <Route path="/reportes" element={<Navigate to="/reportes/rentabilidad" replace />} />
    <Route path="/rentabilidad" element={<Navigate to="/reportes/rentabilidad" replace />} />
    <Route path="/ayuda" element={<Ayuda />} />
    <Route path="/sentry" element={<SentryDiagnostico />} />
    <Route path="/crm" element={<CrmLayout />}>{crmChildRoutes}</Route>
    <Route path="/bitacora" element={<Bitacora />} />

    <Route path="/papelera" element={guarded(["admin", "super_admin"], <Papelera />)} />
    <Route path="/idempotencia" element={guarded(["admin", "super_admin"], <Idempotencia />)} />
    <Route path="/auditoria" element={guarded(["admin", "admin_org", "viewer", "customer_service"], <Auditoria />)} />
    <Route path="/usuarios" element={guarded(["admin"], <Usuarios />)} />
    <Route path="/configuracion" element={guarded(["admin"], <Configuracion />)} />
  </Route>
);
