/**
 * Rutas principales de la aplicación (operativos autenticados). Bajo
 * `ProtectedRoute` + `Layout`. Incluye el sub-árbol del CRM anidado bajo /crm.
 *
 * v13.175.0 — Rediseño Compras (Ola A):
 *   - Módulo unificado bajo `/compras/*`: dashboard, bandejas (por-capturar,
 *     por-aprobar, por-pagar), facturas, pagos, notas-credito, proveedores,
 *     aging, reportes.
 *   - Redirects preservando querystring desde `/cxp`, `/cxp/por-capturar`,
 *     `/cxp/por-pagar`, `/proveedores`, `/proveedores/:id`.
 *   - `ComprasTabStrip` eliminado. Navegación 100% por sidebar.
 */
import type { ReactNode } from "react";
import { Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ProtectedRoute } from "@/features/auth/components/ProtectedRoute";
import { RedirectPreserveSearch } from "@/routes/RedirectPreserveSearch";
import type { AppRole } from "@/types/appRole";
import {
  Dashboard, Operaciones, Reportes, CierreMensual, Bitacora, Ayuda,
  Papelera, Idempotencia, Auditoria, SentryDiagnostico,
  Embarques, EmbarqueDetalle, NuevoEmbarque, EditarEmbarque,
  Cotizaciones, NuevaCotizacion, NuevaCotizacionInformativa, CotizacionDetalle, EditarCotizacion, CotizacionPlantillas, PdfPreviewCotizacion,
  Clientes, ClienteDetalle, Proveedores, ProveedorDetalle,
  Facturacion, FacturaDetalle, EstadoCuentaInterno, ProformaDetalle, ProformasListado,
  ProfitProyeccion, ProfitEstadoResultados, ProfitPresupuesto, ProfitDashboardEjecutivo,
  Cxp, FacturaProveedorDetalle, Compras, CxpAging, CxcAging, CxpPorCapturar, CxpBuzonEntrantes, CxpPorPagar, Cartera,
  ComprasPagos, ComprasNotasCredito, ComprasReportes, ComprasPorAprobar, ComprasConciliacion, AnticiposProveedor,
  Tesoreria, TesoreriaCuentas, TesoreriaConciliacion, TesoreriaEstadoCuenta, TesoreriaPagos, TesoreriaFlujo, TesoreriaPagosProgramados, Comisiones,
  CosteoTarifas, CosteoBuscar, CosteoRutas, CosteoAgentes, CosteoNavieras, CosteoDemorasVenta,
  Usuarios, Configuracion,
  CrmLayout,
  DireccionDashboard,
} from "./appRoutes.lazy";
import { crmChildRoutes } from "./crmRoutes";

const guarded = (roles: AppRole[], element: ReactNode) => (
  <ProtectedRoute allowedRoles={roles} inline>{element}</ProtectedRoute>
);

import {
  FINANCE_READ_ROLES, TESORERIA_READ_ROLES, PROFIT_READ_ROLES,
  COMPRAS_READ_ROLES, EMBARQUES_ROLES, COTIZACIONES_ROLES,
  FACTURACION_ROLES, CLIENTES_ROLES, COSTEO_ROLES, COMISIONES_ROLES, REPORTES_ROLES,
  CRM_ROLES, BITACORA_ROLES, PROVEEDORES_ROLES,
  DASHBOARD_DIRECCION_ROLES, CARTERA_ROLES, COMPRAS_POR_CAPTURAR_ROLES, COMPRAS_POR_PAGAR_ROLES,
  SENTRY_ROLES, PAPELERA_ROLES, IDEMPOTENCIA_ROLES, AUDITORIA_ROLES, USUARIOS_ROLES, CONFIGURACION_ROLES,
} from "@/lib/access/roleRouteMatrix";

export const appRoutes = (
  <Route
    element={
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    }
  >
    <Route path="/inicio" element={<Dashboard />} />
    <Route path="/dashboard" element={guarded(DASHBOARD_DIRECCION_ROLES, <DireccionDashboard />)} />
    <Route path="/operaciones" element={<Operaciones />} />
    <Route path="/embarques" element={guarded(EMBARQUES_ROLES, <Embarques />)} />
    <Route path="/embarques/nuevo" element={guarded(EMBARQUES_ROLES, <NuevoEmbarque />)} />
    <Route path="/embarques/:id" element={guarded(EMBARQUES_ROLES, <EmbarqueDetalle />)} />
    <Route path="/embarques/:id/editar" element={guarded(EMBARQUES_ROLES, <EditarEmbarque />)} />
    <Route path="/facturacion" element={guarded(FACTURACION_ROLES, <Facturacion />)} />
    <Route path="/facturacion/:id" element={guarded(FACTURACION_ROLES, <FacturaDetalle />)} />
    <Route path="/proformas" element={guarded(FACTURACION_ROLES, <ProformasListado />)} />
    <Route path="/proformas/:id" element={guarded(FACTURACION_ROLES, <ProformaDetalle />)} />

    {/* ── Módulo Compras (v13.175.0 — rediseño Ola A) ────────────────── */}
    <Route path="/compras" element={guarded(COMPRAS_READ_ROLES, <Compras />)} />
    <Route path="/compras/por-capturar" element={guarded(COMPRAS_POR_CAPTURAR_ROLES, <CxpPorCapturar />)} />
    <Route path="/compras/buzon" element={guarded(COMPRAS_POR_CAPTURAR_ROLES, <CxpBuzonEntrantes />)} />
    <Route path="/compras/por-aprobar" element={guarded(COMPRAS_READ_ROLES, <ComprasPorAprobar />)} />
    <Route path="/compras/por-pagar" element={guarded(COMPRAS_POR_PAGAR_ROLES, <CxpPorPagar />)} />
    <Route path="/compras/anticipos" element={guarded(COMPRAS_READ_ROLES, <AnticiposProveedor />)} />
    <Route path="/compras/facturas" element={guarded(FINANCE_READ_ROLES, <Cxp />)} />
    <Route path="/compras/facturas/:id" element={guarded(FINANCE_READ_ROLES, <FacturaProveedorDetalle />)} />

    <Route path="/compras/pagos" element={guarded(FINANCE_READ_ROLES, <ComprasPagos />)} />
    <Route path="/compras/notas-credito" element={guarded(FINANCE_READ_ROLES, <ComprasNotasCredito />)} />
    <Route path="/compras/proveedores" element={guarded(PROVEEDORES_ROLES, <Proveedores />)} />
    <Route path="/compras/proveedores/:id" element={guarded(PROVEEDORES_ROLES, <ProveedorDetalle />)} />
    <Route path="/compras/aging" element={guarded(COMPRAS_READ_ROLES, <CxpAging />)} />
    <Route path="/compras/reportes" element={guarded(FINANCE_READ_ROLES, <ComprasReportes />)} />
    <Route path="/compras/conciliacion" element={guarded(COMPRAS_READ_ROLES, <ComprasConciliacion />)} />

    {/* Redirects legacy — preservan querystring (ej: ?aprobacion=pendiente) */}
    <Route path="/cxp" element={<RedirectPreserveSearch to="/compras/facturas" />} />
    <Route path="/cxp/por-capturar" element={<RedirectPreserveSearch to="/compras/por-capturar" />} />
    <Route path="/cxp/por-pagar" element={<RedirectPreserveSearch to="/compras/por-pagar" />} />
    <Route path="/proveedores" element={<RedirectPreserveSearch to="/compras/proveedores" />} />
    <Route path="/proveedores/:id" element={<ProveedorDetalle />} />

    {/* v13.145.10 — bandeja eliminada; se redirige a /proformas con filtro Aceptada. */}
    <Route path="/facturacion/por-emitir" element={<Navigate to="/proformas?estado=aceptada" replace />} />
    <Route path="/cartera" element={guarded(CARTERA_ROLES, <Cartera />)} />
    <Route path="/cobranza/aging" element={guarded(CARTERA_ROLES, <CxcAging />)} />

    <Route path="/tesoreria" element={guarded(TESORERIA_READ_ROLES, <Tesoreria />)} />
    <Route path="/tesoreria/cuentas" element={guarded(TESORERIA_READ_ROLES, <TesoreriaCuentas />)} />
    <Route path="/tesoreria/conciliacion" element={guarded(TESORERIA_READ_ROLES, <TesoreriaConciliacion />)} />
    <Route path="/tesoreria/estado-cuenta" element={guarded(TESORERIA_READ_ROLES, <TesoreriaEstadoCuenta />)} />
    <Route path="/tesoreria/pagos" element={guarded(TESORERIA_READ_ROLES, <TesoreriaPagos />)} />

    <Route path="/tesoreria/flujo" element={guarded(TESORERIA_READ_ROLES, <TesoreriaFlujo />)} />
    <Route path="/tesoreria/pagos-programados" element={guarded(TESORERIA_READ_ROLES, <TesoreriaPagosProgramados />)} />

    <Route path="/comisiones" element={guarded(COMISIONES_ROLES, <Comisiones />)} />
    <Route path="/costeo" element={<Navigate to="/costeo/tarifas" replace />} />
    <Route path="/costeo/tarifas" element={guarded(COSTEO_ROLES, <CosteoTarifas />)} />
    <Route path="/costeo/buscar" element={guarded(COSTEO_ROLES, <CosteoBuscar />)} />
    <Route path="/costeo/rutas" element={guarded(COSTEO_ROLES, <CosteoRutas />)} />
    <Route path="/costeo/agentes" element={guarded(COSTEO_ROLES, <CosteoAgentes />)} />
    <Route path="/costeo/navieras" element={guarded(COSTEO_ROLES, <CosteoNavieras />)} />
    <Route path="/costeo/demoras-venta" element={guarded(COSTEO_ROLES, <CosteoDemorasVenta />)} />

    <Route path="/profit" element={<Navigate to="/profit/dashboard" replace />} />
    <Route path="/profit/dashboard" element={guarded(PROFIT_READ_ROLES, <ProfitDashboardEjecutivo />)} />
    <Route path="/profit/proyeccion" element={guarded(PROFIT_READ_ROLES, <ProfitProyeccion />)} />
    <Route path="/profit/estado-resultados" element={guarded(PROFIT_READ_ROLES, <ProfitEstadoResultados />)} />
    <Route path="/profit/presupuesto" element={guarded(PROFIT_READ_ROLES, <ProfitPresupuesto />)} />

    <Route path="/clientes" element={guarded(CLIENTES_ROLES, <Clientes />)} />
    <Route path="/clientes/:id" element={guarded(CLIENTES_ROLES, <ClienteDetalle />)} />
    <Route path="/clientes/:clienteId/estado-de-cuenta" element={guarded(FINANCE_READ_ROLES, <EstadoCuentaInterno />)} />
    <Route path="/cotizaciones" element={guarded(COTIZACIONES_ROLES, <Cotizaciones />)} />
    <Route path="/cotizaciones/nueva" element={guarded(COTIZACIONES_ROLES, <NuevaCotizacion />)} />
    <Route path="/cotizaciones/plantillas" element={guarded(COTIZACIONES_ROLES, <CotizacionPlantillas />)} />
    <Route path="/cotizaciones/nueva/tarifario" element={guarded(COTIZACIONES_ROLES, <NuevaCotizacionInformativa />)} />
    <Route path="/cotizaciones/:id" element={guarded(COTIZACIONES_ROLES, <CotizacionDetalle />)} />
    <Route path="/cotizaciones/:id/editar" element={guarded(COTIZACIONES_ROLES, <EditarCotizacion />)} />
    <Route path="/dev/pdf-preview/cotizacion/:id" element={guarded(COTIZACIONES_ROLES, <PdfPreviewCotizacion />)} />
    <Route path="/reportes/rentabilidad" element={guarded(REPORTES_ROLES, <Reportes />)} />
    <Route path="/reportes/cierre-mensual" element={guarded(REPORTES_ROLES, <CierreMensual />)} />
    <Route path="/reportes" element={<Navigate to="/reportes/rentabilidad" replace />} />
    <Route path="/rentabilidad" element={<Navigate to="/reportes/rentabilidad" replace />} />
    <Route path="/ayuda" element={<Ayuda />} />
    <Route path="/sentry" element={guarded(SENTRY_ROLES, <SentryDiagnostico />)} />
    <Route path="/crm" element={guarded(CRM_ROLES, <CrmLayout />)}>{crmChildRoutes}</Route>
    <Route path="/bitacora" element={guarded(BITACORA_ROLES, <Bitacora />)} />
    {/* Sentry -3W: enlaces viejos apuntaban a /sistema/bitacora (404). */}
    <Route path="/sistema/bitacora" element={<Navigate to="/bitacora" replace />} />

    <Route path="/papelera" element={guarded(PAPELERA_ROLES, <Papelera />)} />
    <Route path="/idempotencia" element={guarded(IDEMPOTENCIA_ROLES, <Idempotencia />)} />
    <Route path="/auditoria" element={guarded(AUDITORIA_ROLES, <Auditoria />)} />
    <Route path="/usuarios" element={guarded(USUARIOS_ROLES, <Usuarios />)} />
    <Route path="/configuracion" element={guarded(CONFIGURACION_ROLES, <Configuracion />)} />
  </Route>
);
