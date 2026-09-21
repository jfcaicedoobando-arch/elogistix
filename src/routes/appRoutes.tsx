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
import {
  Dashboard, Operaciones, Reportes, ReportesCartera, CierreMensual, Bitacora,
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
import { getRouteRoles, type RouteAccessKey } from "@/lib/access/roleRouteMatrix";

/**
 * Paso 13 — El guard NO decide roles: recibe la clave canónica de ruta y la
 * política sale de `ROLE_ROUTE_MATRIX` vía `getRouteRoles`. Así router, sidebar
 * y búsqueda consumen una sola decisión ruta→roles.
 */
const guarded = (ruta: RouteAccessKey, element: ReactNode) => (
  <ProtectedRoute allowedRoles={getRouteRoles(ruta)} inline>{element}</ProtectedRoute>
);


export const appRoutes = (
  <Route
    element={
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    }
  >
    <Route path="/inicio" element={guarded("/inicio", <Dashboard />)} />
    <Route path="/dashboard" element={guarded("/dashboard", <DireccionDashboard />)} />
    <Route path="/operaciones" element={guarded("/operaciones", <Operaciones />)} />
    <Route path="/embarques" element={guarded("/embarques", <Embarques />)} />
    <Route path="/embarques/nuevo" element={guarded("/embarques/nuevo", <NuevoEmbarque />)} />
    <Route path="/embarques/:id" element={guarded("/embarques/:id", <EmbarqueDetalle />)} />
    <Route path="/embarques/:id/editar" element={guarded("/embarques/:id/editar", <EditarEmbarque />)} />
    <Route path="/facturacion" element={guarded("/facturacion", <Facturacion />)} />
    <Route path="/facturacion/:id" element={guarded("/facturacion/:id", <FacturaDetalle />)} />
    {/* VF-20: el vendedor consulta proformas en sólo lectura (escritura sigue
        restringida por RLS y por los guards de permiso de la UI). */}
    <Route path="/proformas" element={guarded("/proformas", <ProformasListado />)} />
    <Route path="/proformas/:id" element={guarded("/proformas/:id", <ProformaDetalle />)} />

    {/* ── Módulo Compras (v13.175.0 — rediseño Ola A) ────────────────── */}
    <Route path="/compras" element={guarded("/compras", <Compras />)} />
    <Route path="/compras/por-capturar" element={guarded("/compras/por-capturar", <CxpPorCapturar />)} />
    <Route path="/compras/buzon" element={guarded("/compras/buzon", <CxpBuzonEntrantes />)} />
    <Route path="/compras/por-aprobar" element={guarded("/compras/por-aprobar", <ComprasPorAprobar />)} />
    <Route path="/compras/por-pagar" element={guarded("/compras/por-pagar", <CxpPorPagar />)} />
    <Route path="/compras/anticipos" element={guarded("/compras/anticipos", <AnticiposProveedor />)} />
    <Route path="/compras/facturas" element={guarded("/compras/facturas", <Cxp />)} />
    <Route path="/compras/facturas/:id" element={guarded("/compras/facturas/:id", <FacturaProveedorDetalle />)} />

    <Route path="/compras/pagos" element={guarded("/compras/pagos", <ComprasPagos />)} />
    <Route path="/compras/notas-credito" element={guarded("/compras/notas-credito", <ComprasNotasCredito />)} />
    <Route path="/compras/proveedores" element={guarded("/compras/proveedores", <Proveedores />)} />
    <Route path="/compras/proveedores/:id" element={guarded("/compras/proveedores/:id", <ProveedorDetalle />)} />
    <Route path="/compras/aging" element={guarded("/compras/aging", <CxpAging />)} />
    <Route path="/compras/reportes" element={guarded("/compras/reportes", <ComprasReportes />)} />
    <Route path="/compras/conciliacion" element={guarded("/compras/conciliacion", <ComprasConciliacion />)} />

    {/* Redirects legacy — preservan querystring (ej: ?aprobacion=pendiente) */}
    <Route path="/cxp" element={<RedirectPreserveSearch to="/compras/facturas" />} />
    <Route path="/cxp/por-capturar" element={<RedirectPreserveSearch to="/compras/por-capturar" />} />
    <Route path="/cxp/por-pagar" element={<RedirectPreserveSearch to="/compras/por-pagar" />} />
    <Route path="/proveedores" element={<RedirectPreserveSearch to="/compras/proveedores" />} />
    <Route path="/proveedores/:id" element={guarded("/proveedores/:id", <ProveedorDetalle />)} />

    {/* v13.145.10 — bandeja eliminada; se redirige a /proformas con filtro Aceptada. */}
    <Route path="/facturacion/por-emitir" element={<Navigate to="/proformas?estado=aceptada" replace />} />
    {/* UX-02: /cobranza es la ruta canónica; /cartera queda como alias legacy. */}
    <Route path="/cobranza" element={guarded("/cobranza", <Cartera />)} />
    <Route path="/cartera" element={<RedirectPreserveSearch to="/cobranza" />} />
    <Route path="/cobranza/aging" element={guarded("/cobranza/aging", <CxcAging />)} />

    <Route path="/tesoreria" element={guarded("/tesoreria", <Tesoreria />)} />
    <Route path="/tesoreria/cuentas" element={guarded("/tesoreria/cuentas", <TesoreriaCuentas />)} />
    <Route path="/tesoreria/conciliacion" element={guarded("/tesoreria/conciliacion", <TesoreriaConciliacion />)} />
    <Route path="/tesoreria/estado-cuenta" element={guarded("/tesoreria/estado-cuenta", <TesoreriaEstadoCuenta />)} />
    <Route path="/tesoreria/pagos" element={guarded("/tesoreria/pagos", <TesoreriaPagos />)} />

    <Route path="/tesoreria/flujo" element={guarded("/tesoreria/flujo", <TesoreriaFlujo />)} />
    <Route path="/tesoreria/pagos-programados" element={guarded("/tesoreria/pagos-programados", <TesoreriaPagosProgramados />)} />

    <Route path="/comisiones" element={guarded("/comisiones", <Comisiones />)} />
    <Route path="/costeo" element={<Navigate to="/costeo/tarifas" replace />} />
    <Route path="/costeo/tarifas" element={guarded("/costeo/tarifas", <CosteoTarifas />)} />
    <Route path="/costeo/buscar" element={guarded("/costeo/buscar", <CosteoBuscar />)} />
    <Route path="/costeo/rutas" element={guarded("/costeo/rutas", <CosteoRutas />)} />
    <Route path="/costeo/agentes" element={guarded("/costeo/agentes", <CosteoAgentes />)} />
    <Route path="/costeo/navieras" element={guarded("/costeo/navieras", <CosteoNavieras />)} />
    <Route path="/costeo/demoras-venta" element={guarded("/costeo/demoras-venta", <CosteoDemorasVenta />)} />

    <Route path="/profit" element={<Navigate to="/profit/dashboard" replace />} />
    <Route path="/profit/dashboard" element={guarded("/profit/dashboard", <ProfitDashboardEjecutivo />)} />
    <Route path="/profit/proyeccion" element={guarded("/profit/proyeccion", <ProfitProyeccion />)} />
    <Route path="/profit/estado-resultados" element={guarded("/profit/estado-resultados", <ProfitEstadoResultados />)} />
    <Route path="/profit/presupuesto" element={guarded("/profit/presupuesto", <ProfitPresupuesto />)} />

    <Route path="/clientes" element={guarded("/clientes", <Clientes />)} />
    <Route path="/clientes/:id" element={guarded("/clientes/:id", <ClienteDetalle />)} />
    <Route path="/clientes/:clienteId/estado-de-cuenta" element={guarded("/clientes/:clienteId/estado-de-cuenta", <EstadoCuentaInterno />)} />
    <Route path="/cotizaciones" element={guarded("/cotizaciones", <Cotizaciones />)} />
    <Route path="/cotizaciones/nueva" element={guarded("/cotizaciones/nueva", <NuevaCotizacion />)} />
    <Route path="/cotizaciones/plantillas" element={guarded("/cotizaciones/plantillas", <CotizacionPlantillas />)} />
    <Route path="/cotizaciones/nueva/tarifario" element={guarded("/cotizaciones/nueva/tarifario", <NuevaCotizacionInformativa />)} />
    <Route path="/cotizaciones/:id" element={guarded("/cotizaciones/:id", <CotizacionDetalle />)} />
    <Route path="/cotizaciones/:id/editar" element={guarded("/cotizaciones/:id/editar", <EditarCotizacion />)} />
    {/* UX-26: preview de PDF sólo en dev (mismo patrón que /logo-preview); en producción cae al 404. */}
    {import.meta.env.DEV && <Route path="/dev/pdf-preview/cotizacion/:id" element={guarded("/dev/pdf-preview/cotizacion/:id", <PdfPreviewCotizacion />)} />}
    <Route path="/reportes/rentabilidad" element={guarded("/reportes/rentabilidad", <Reportes />)} />
    <Route path="/reportes/cierre-mensual" element={guarded("/reportes/cierre-mensual", <CierreMensual />)} />
    <Route path="/reportes/cartera" element={guarded("/reportes/cartera", <ReportesCartera />)} />
    <Route path="/reportes" element={<Navigate to="/reportes/rentabilidad" replace />} />
    <Route path="/rentabilidad" element={<Navigate to="/reportes/rentabilidad" replace />} />
    {/* VT-10: /ayuda se movió a `publicRoutes` (acceso anónimo, layout público). */}
    <Route path="/sentry" element={guarded("/sentry", <SentryDiagnostico />)} />
    <Route path="/crm" element={guarded("/crm", <CrmLayout />)}>{crmChildRoutes}</Route>
    <Route path="/bitacora" element={guarded("/bitacora", <Bitacora />)} />
    {/* Sentry -3W: enlaces viejos apuntaban a /sistema/bitacora (404). */}
    <Route path="/sistema/bitacora" element={<Navigate to="/bitacora" replace />} />

    <Route path="/papelera" element={guarded("/papelera", <Papelera />)} />
    <Route path="/idempotencia" element={guarded("/idempotencia", <Idempotencia />)} />
    <Route path="/auditoria" element={guarded("/auditoria", <Auditoria />)} />
    <Route path="/usuarios" element={guarded("/usuarios", <Usuarios />)} />
    <Route path="/configuracion" element={guarded("/configuracion", <Configuracion />)} />
  </Route>
);
