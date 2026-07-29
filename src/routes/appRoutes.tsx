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
  Cxp, Compras, CxpAging, CxcAging, CxpPorCapturar, CxpPorPagar, Cartera,
  ComprasPagos, ComprasNotasCredito, ComprasReportes, ComprasPorAprobar, ComprasConciliacion, AnticiposProveedor,
  Tesoreria, TesoreriaCuentas, TesoreriaConciliacion, TesoreriaFlujo, TesoreriaPagosProgramados, Comisiones,
  CosteoTarifas, CosteoBuscar, CosteoRutas, CosteoAgentes, CosteoNavieras, CosteoDemorasVenta,
  Usuarios, Configuracion,
  CrmLayout,
  DireccionDashboard,
} from "./appRoutes.lazy";
import { crmChildRoutes } from "./crmRoutes";

const guarded = (roles: AppRole[], element: ReactNode) => (
  <ProtectedRoute allowedRoles={roles}>{element}</ProtectedRoute>
);

const TESORERIA_ROLES: AppRole[] = ["admin", "super_admin", "contador", "tesorero"];

const FINANCE_READ_ROLES: AppRole[] = [
  "admin", "super_admin", "admin_org",
  "contador", "tesorero", "auxiliar_contable", "ejecutivo_cobranza",
  "gerente_operaciones", "gerente_visor",
];
const TESORERIA_READ_ROLES: AppRole[] = [...TESORERIA_ROLES, "admin_org", "gerente_operaciones", "gerente_visor"];
const PROFIT_READ_ROLES: AppRole[] = [...TESORERIA_ROLES, "admin_org", "gerente_operaciones", "gerente_visor", "gerente_comercial"];
const COMPRAS_READ_ROLES: AppRole[] = [
  ...TESORERIA_ROLES, "auxiliar_contable", "admin_org", "gerente_operaciones", "gerente_visor",
];
const COMPRAS_WRITE_ROLES: AppRole[] = [
  "admin", "super_admin", "admin_org", "contador", "tesorero", "auxiliar_contable",
];

/**
 * Q-11 (v13.341.0) — Paridad sidebar ↔ rutas. Antes, muchas rutas operativas
 * quedaban sin `allowedRoles`: el sidebar las ocultaba, pero cualquier rol podía
 * entrar escribiendo la URL. Estos sets replican exactamente lo que cada
 * builder de `sidebarRoleBuilders.ts` expone.
 */
const ADMINS: AppRole[] = ["admin", "admin_org", "super_admin"];
const GERENTES: AppRole[] = ["gerente_operaciones", "gerente_comercial", "gerente_visor"];

const EMBARQUES_ROLES: AppRole[] = [
  ...ADMINS, "operador", "coordinador_logistico", "customer_service", "viewer",
  "contador", "gerente_operaciones", "gerente_comercial", "gerente_visor",
];
const COTIZACIONES_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "customer_service", "viewer", "operador",
  "coordinador_logistico", "ejecutivo_pricing", "gerente_operaciones", "gerente_comercial",
  "gerente_visor",
];
const FACTURACION_ROLES: AppRole[] = [
  ...ADMINS, "contador", "tesorero", "ejecutivo_cobranza", "operador",
  "coordinador_logistico", "gerente_operaciones", "gerente_visor",
];
const CLIENTES_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "customer_service", "viewer", "operador", "coordinador_logistico",
  "ejecutivo_pricing", "contador", "ejecutivo_cobranza", ...GERENTES,
];
const COSTEO_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "operador", "coordinador_logistico", "ejecutivo_pricing",
  "gerente_comercial",
];
const COMISIONES_ROLES: AppRole[] = [
  ...ADMINS, "contador", "tesorero", "gerente_comercial", "gerente_operaciones", "gerente_visor",
];
const REPORTES_ROLES: AppRole[] = [
  ...ADMINS, "ejecutivo_pricing", "contador", "tesorero", ...GERENTES,
];
const CRM_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "gerente_comercial", "gerente_operaciones",
];
const BITACORA_ROLES: AppRole[] = [...ADMINS, "contador", "tesorero", ...GERENTES];
const PROVEEDORES_ROLES: AppRole[] = [...COMPRAS_READ_ROLES, "ejecutivo_pricing"];

export const appRoutes = (
  <Route
    element={
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    }
  >
    <Route path="/inicio" element={<Dashboard />} />
    <Route path="/dashboard" element={guarded(["admin", "admin_org", "super_admin", "gerente_comercial", "gerente_visor", "gerente_operaciones"], <DireccionDashboard />)} />
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
    <Route path="/compras/por-capturar" element={guarded(COMPRAS_WRITE_ROLES.concat(["gerente_operaciones", "gerente_visor"]), <CxpPorCapturar />)} />
    <Route path="/compras/por-aprobar" element={guarded(COMPRAS_READ_ROLES, <ComprasPorAprobar />)} />
    <Route path="/compras/por-pagar" element={guarded(["admin", "super_admin", "admin_org", "tesorero", "gerente_operaciones", "gerente_visor"], <CxpPorPagar />)} />
    <Route path="/compras/anticipos" element={guarded(COMPRAS_READ_ROLES, <AnticiposProveedor />)} />
    <Route path="/compras/facturas" element={guarded(FINANCE_READ_ROLES, <Cxp />)} />
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
    <Route path="/cartera" element={guarded(["admin", "super_admin", "admin_org", "contador", "tesorero", "ejecutivo_cobranza", "gerente_operaciones", "gerente_visor"], <Cartera />)} />
    <Route path="/cobranza/aging" element={guarded(["admin", "super_admin", "admin_org", "contador", "tesorero", "ejecutivo_cobranza", "gerente_operaciones", "gerente_visor"], <CxcAging />)} />

    <Route path="/tesoreria" element={guarded(TESORERIA_READ_ROLES, <Tesoreria />)} />
    <Route path="/tesoreria/cuentas" element={guarded(TESORERIA_READ_ROLES, <TesoreriaCuentas />)} />
    <Route path="/tesoreria/conciliacion" element={guarded(TESORERIA_READ_ROLES, <TesoreriaConciliacion />)} />
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
    <Route path="/sentry" element={guarded(["admin", "admin_org", "super_admin"], <SentryDiagnostico />)} />
    <Route path="/crm" element={guarded(CRM_ROLES, <CrmLayout />)}>{crmChildRoutes}</Route>
    <Route path="/bitacora" element={guarded(BITACORA_ROLES, <Bitacora />)} />
    {/* Sentry -3W: enlaces viejos apuntaban a /sistema/bitacora (404). */}
    <Route path="/sistema/bitacora" element={<Navigate to="/bitacora" replace />} />

    <Route path="/papelera" element={guarded(["admin", "super_admin"], <Papelera />)} />
    <Route path="/idempotencia" element={guarded(["admin", "super_admin"], <Idempotencia />)} />
    <Route path="/auditoria" element={guarded(["admin", "admin_org", "viewer", "customer_service"], <Auditoria />)} />
    <Route path="/usuarios" element={guarded(["admin", "admin_org", "super_admin"], <Usuarios />)} />
    <Route path="/configuracion" element={guarded(["admin", "admin_org", "contador", "super_admin"], <Configuracion />)} />
  </Route>
);
