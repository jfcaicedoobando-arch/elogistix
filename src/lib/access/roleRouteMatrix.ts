/**
 * Q-11 (remanente) — Matriz rol→ruta como fuente única.
 *
 * Antes, los sets de roles vivían duplicados/dispersos entre
 * `appRoutes.tsx` (guards) y `sidebarRoleBuilders.ts` (menú), lo que
 * permitía que ambos se desincronizaran. Este módulo centraliza, por ruta
 * base, qué roles tienen acceso. `appRoutes.tsx` lo usa para los guards y
 * el sidebar lo usa (vía `hasRouteAccess`) para no listar ítems muertos.
 */
import type { AppRole } from "@/types/appRole";
import {
  INICIO_ROLES, OPERACIONES_ROLES, DASHBOARD_DIRECCION_ROLES, EMBARQUES_ROLES,
  FACTURACION_ROLES, PROFORMAS_READ_ROLES, COMPRAS_HUB_ROLES, COMPRAS_POR_CAPTURAR_ROLES,
  COMPRAS_READ_ROLES, COMPRAS_POR_PAGAR_ROLES, FINANCE_READ_ROLES, PROVEEDORES_ROLES,
  COMPRAS_AGING_ROLES, CARTERA_ROLES, TESORERIA_READ_ROLES, COMISIONES_ROLES,
  COSTEO_ROLES, PROFIT_READ_ROLES, CLIENTES_ROLES, COTIZACIONES_ROLES, REPORTES_ROLES,
  CRM_ROLES, BITACORA_ROLES, SENTRY_ROLES, PAPELERA_ROLES, IDEMPOTENCIA_ROLES,
  AUDITORIA_ROLES, USUARIOS_ROLES, CONFIGURACION_ROLES, RUTAS_LIBRES, PREFIJOS_PLATAFORMA,
} from "./roleRouteSets";

export * from "./roleRouteSets";

/**
 * Mapa `ruta base → roles permitidos`. Toda ruta con datos de negocio debe
 * estar listada aquí; `hasRouteAccess` deniega lo no listado (M11).
 */
export const ROLE_ROUTE_MATRIX: Readonly<Record<string, AppRole[]>> = Object.freeze({
  "/inicio": INICIO_ROLES,
  "/operaciones": OPERACIONES_ROLES,
  "/dashboard": DASHBOARD_DIRECCION_ROLES,
  "/embarques": EMBARQUES_ROLES,
  "/embarques/nuevo": EMBARQUES_ROLES,
  "/facturacion": FACTURACION_ROLES,
  "/facturacion/por-emitir": FACTURACION_ROLES,
  "/proformas": PROFORMAS_READ_ROLES,
  "/compras": COMPRAS_HUB_ROLES,
  "/compras/por-capturar": COMPRAS_POR_CAPTURAR_ROLES,
  "/compras/buzon": COMPRAS_POR_CAPTURAR_ROLES,
  "/compras/por-aprobar": COMPRAS_READ_ROLES,
  "/compras/por-pagar": COMPRAS_POR_PAGAR_ROLES,
  "/compras/anticipos": COMPRAS_READ_ROLES,
  "/compras/facturas": FINANCE_READ_ROLES,
  "/compras/pagos": FINANCE_READ_ROLES,
  "/compras/notas-credito": FINANCE_READ_ROLES,
  "/compras/proveedores": PROVEEDORES_ROLES,
  "/compras/aging": COMPRAS_AGING_ROLES,
  "/compras/reportes": FINANCE_READ_ROLES,
  "/compras/conciliacion": COMPRAS_READ_ROLES,
  "/cobranza": CARTERA_ROLES,
  // Alias legacy: redirige a /cobranza (UX-02).
  "/cartera": CARTERA_ROLES,
  "/cobranza/aging": CARTERA_ROLES,
  "/tesoreria": TESORERIA_READ_ROLES,
  "/tesoreria/cuentas": TESORERIA_READ_ROLES,
  "/tesoreria/conciliacion": TESORERIA_READ_ROLES,
  "/tesoreria/estado-cuenta": TESORERIA_READ_ROLES,
  "/tesoreria/pagos": TESORERIA_READ_ROLES,
  "/tesoreria/flujo": TESORERIA_READ_ROLES,
  "/tesoreria/pagos-programados": TESORERIA_READ_ROLES,
  "/comisiones": COMISIONES_ROLES,
  "/costeo": COSTEO_ROLES,
  "/costeo/tarifas": COSTEO_ROLES,
  "/costeo/buscar": COSTEO_ROLES,
  "/costeo/rutas": COSTEO_ROLES,
  "/costeo/agentes": COSTEO_ROLES,
  "/costeo/navieras": COSTEO_ROLES,
  "/costeo/demoras-venta": COSTEO_ROLES,
  "/profit": PROFIT_READ_ROLES,
  "/profit/dashboard": PROFIT_READ_ROLES,
  "/profit/proyeccion": PROFIT_READ_ROLES,
  "/profit/estado-resultados": PROFIT_READ_ROLES,
  "/profit/presupuesto": PROFIT_READ_ROLES,
  "/clientes": CLIENTES_ROLES,
  "/cotizaciones": COTIZACIONES_ROLES,
  "/cotizaciones/nueva": COTIZACIONES_ROLES,
  "/cotizaciones/nueva/tarifario": COTIZACIONES_ROLES,
  "/cotizaciones/plantillas": COTIZACIONES_ROLES,
  "/reportes/rentabilidad": REPORTES_ROLES,
  "/reportes/cierre-mensual": REPORTES_ROLES,
  "/reportes/cartera": REPORTES_ROLES,
  "/crm": CRM_ROLES,
  "/bitacora": BITACORA_ROLES,
  "/sentry": SENTRY_ROLES,
  "/papelera": PAPELERA_ROLES,
  "/idempotencia": IDEMPOTENCIA_ROLES,
  "/auditoria": AUDITORIA_ROLES,
  "/usuarios": USUARIOS_ROLES,
  "/configuracion": CONFIGURACION_ROLES,
  // Alias legacy que sólo redirigen a su ruta nueva; heredan los mismos roles.
  "/cxp": COMPRAS_HUB_ROLES,
  "/cxp/por-capturar": COMPRAS_POR_CAPTURAR_ROLES,
  "/cxp/por-pagar": COMPRAS_POR_PAGAR_ROLES,
  "/proveedores": PROVEEDORES_ROLES,
  "/rentabilidad": REPORTES_ROLES,
  "/reportes": REPORTES_ROLES,
  "/sistema/bitacora": BITACORA_ROLES,
});

/** Quita querystring de una URL de sidebar (ej. `/proformas?estado=aceptada`). */
function basePath(url: string): string {
  return url.split("?")[0] ?? url;
}

/**
 * ¿El rol tiene acceso a la ruta? Fail-closed (M11): si la ruta no está en la
 * matriz y no es una ruta libre, se deniega el acceso.
 */
export function hasRouteAccess(role: AppRole | null | undefined, url: string): boolean {
  const path = basePath(url);
  if (PREFIJOS_PLATAFORMA.some((p) => path === p || path.startsWith(`${p}/`))) {
    return role === "super_admin";
  }
  const allowed = ROLE_ROUTE_MATRIX[path];
  if (!allowed) return RUTAS_LIBRES.includes(path);
  if (!role) return false;
  return allowed.includes(role);
}

