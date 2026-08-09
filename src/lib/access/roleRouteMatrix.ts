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

const ADMINS: AppRole[] = ["admin", "admin_org", "super_admin"];
const GERENTES: AppRole[] = ["gerente_operaciones", "gerente_comercial", "gerente_visor"];

export const TESORERIA_ROLES: AppRole[] = ["admin", "super_admin", "contador", "tesorero"];
export const FINANCE_READ_ROLES: AppRole[] = [
  ...ADMINS, "contador", "tesorero", "auxiliar_contable", "ejecutivo_cobranza",
  "gerente_operaciones", "gerente_visor",
];
export const TESORERIA_READ_ROLES: AppRole[] = [...TESORERIA_ROLES, "admin_org", "gerente_operaciones", "gerente_visor"];
export const PROFIT_READ_ROLES: AppRole[] = [...TESORERIA_ROLES, "admin_org", "gerente_operaciones", "gerente_visor", "gerente_comercial"];
export const COMPRAS_READ_ROLES: AppRole[] = [
  ...TESORERIA_ROLES, "auxiliar_contable", "admin_org", "gerente_operaciones", "gerente_visor",
];
export const COMPRAS_WRITE_ROLES: AppRole[] = [
  "admin", "super_admin", "admin_org", "contador", "tesorero", "auxiliar_contable",
];

export const EMBARQUES_ROLES: AppRole[] = [
  ...ADMINS, "operador", "coordinador_logistico", "customer_service", "viewer",
  "contador", "gerente_operaciones", "gerente_comercial", "gerente_visor",
  // R-11: ventas/pricing necesitan consultar el estatus del embarque que
  // cotizaron. El acceso de escritura sigue restringido por las RLS.
  "ejecutivo_pricing", "vendedor",
];
export const COTIZACIONES_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "customer_service", "viewer", "operador",
  "coordinador_logistico", "ejecutivo_pricing", "gerente_operaciones", "gerente_comercial",
  "gerente_visor",
];
export const FACTURACION_ROLES: AppRole[] = [
  ...ADMINS, "contador", "tesorero", "ejecutivo_cobranza", "operador",
  "coordinador_logistico", "gerente_operaciones", "gerente_visor",
];
export const CLIENTES_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "customer_service", "viewer", "operador", "coordinador_logistico",
  "ejecutivo_pricing", "contador", "ejecutivo_cobranza", ...GERENTES,
];
export const COSTEO_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "operador", "coordinador_logistico", "ejecutivo_pricing",
  "gerente_comercial",
];
export const COMISIONES_ROLES: AppRole[] = [
  ...ADMINS, "contador", "tesorero", "gerente_comercial", "gerente_operaciones", "gerente_visor",
];
export const REPORTES_ROLES: AppRole[] = [
  ...ADMINS, "ejecutivo_pricing", "contador", "tesorero", ...GERENTES,
];
export const CRM_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "gerente_comercial", "gerente_operaciones",
];
export const BITACORA_ROLES: AppRole[] = [...ADMINS, "contador", "tesorero", ...GERENTES];
export const PROVEEDORES_ROLES: AppRole[] = [...COMPRAS_READ_ROLES, "ejecutivo_pricing"];
export const COMPRAS_HUB_ROLES: AppRole[] = [...COMPRAS_READ_ROLES];
export const COMPRAS_AGING_ROLES: AppRole[] = [...COMPRAS_READ_ROLES];


export const DASHBOARD_DIRECCION_ROLES: AppRole[] = ["admin", "admin_org", "super_admin", "gerente_comercial", "gerente_visor", "gerente_operaciones"];
// v13.369.1 — El gerente comercial consulta el estado de cuenta de sus
// clientes (cartera + antigüedad de saldos); acceso de sólo lectura.
export const CARTERA_ROLES: AppRole[] = ["admin", "super_admin", "admin_org", "contador", "tesorero", "ejecutivo_cobranza", "gerente_operaciones", "gerente_visor", "gerente_comercial"];
export const COMPRAS_POR_CAPTURAR_ROLES: AppRole[] = [...COMPRAS_WRITE_ROLES, "gerente_operaciones", "gerente_visor"];
export const COMPRAS_POR_PAGAR_ROLES: AppRole[] = ["admin", "super_admin", "admin_org", "tesorero", "gerente_operaciones", "gerente_visor"];
export const SENTRY_ROLES: AppRole[] = ["admin", "admin_org", "super_admin"];
export const PAPELERA_ROLES: AppRole[] = ["admin", "super_admin"];
export const IDEMPOTENCIA_ROLES: AppRole[] = ["admin", "super_admin"];
export const AUDITORIA_ROLES: AppRole[] = ["admin", "admin_org", "super_admin", "viewer", "customer_service"];
export const USUARIOS_ROLES: AppRole[] = ["admin", "admin_org", "super_admin"];
export const CONFIGURACION_ROLES: AppRole[] = ["admin", "admin_org", "contador", "super_admin"];

/**
 * M11 — `/inicio` y `/operaciones` ya no son de acceso libre. Se listan con
 * todos los roles internos (los portales `cliente` y `agente_carga` viven en
 * `/portal` y `/agente` y quedan fuera).
 */
export const ROLES_INTERNOS: AppRole[] = [
  "admin", "admin_org", "super_admin", "operador", "coordinador_logistico",
  "customer_service", "viewer", "contador", "tesorero", "auxiliar_contable",
  "ejecutivo_cobranza", "ejecutivo_pricing", "vendedor",
  "gerente_operaciones", "gerente_comercial", "gerente_visor",
];
export const INICIO_ROLES: AppRole[] = [...ROLES_INTERNOS];
export const OPERACIONES_ROLES: AppRole[] = [...ROLES_INTERNOS];

/**
 * Rutas sin restricción de rol (fail-closed: lo que no está en la matriz ni
 * en esta lista se deniega). Sólo utilidades sin datos de negocio.
 */
export const RUTAS_LIBRES: readonly string[] = Object.freeze([
  "/",
  "/ayuda",
]);

/** Prefijos reservados a la consola de plataforma (dueño Libre Carga). */
export const PREFIJOS_PLATAFORMA: readonly string[] = Object.freeze(["/admin"]);

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
  "/proformas": FACTURACION_ROLES,
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
