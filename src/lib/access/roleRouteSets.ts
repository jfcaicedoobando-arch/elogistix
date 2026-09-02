/**
 * Q-11 — Conjuntos de roles por área y listas de rutas libres/plataforma.
 * Extraído de `roleRouteMatrix.ts` para respetar el límite de 200 líneas.
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
/**
 * VF-20 — El vendedor consulta `/proformas` en SÓLO LECTURA (da seguimiento
 * comercial a las proformas de sus clientes). La escritura sigue restringida:
 * las policies RLS de `proformas` (write/update/delete) no incluyen `vendedor`
 * y los controles de edición de la UI se ocultan vía `usePermissions`.
 */
export const PROFORMAS_READ_ROLES: AppRole[] = [...FACTURACION_ROLES, "vendedor"];
export const CLIENTES_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "customer_service", "viewer", "operador", "coordinador_logistico",
  "ejecutivo_pricing", "contador", "ejecutivo_cobranza", ...GERENTES,
];
export const COSTEO_ROLES: AppRole[] = [
  ...ADMINS, "vendedor", "operador", "coordinador_logistico", "ejecutivo_pricing",
  "gerente_comercial", "gerente_operaciones",
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
/**
 * Ola 6 (O6.3) — `/crm/configuracion` queda restringida a administración del
 * tenant + gerencia comercial (espejo de CRM_CONFIG en permissionMatrix.ts y
 * de la policy "Tenant admin crm_etapas_pipeline").
 */
export const CRM_CONFIGURACION_ROLES: AppRole[] = [...ADMINS, "gerente_comercial"];
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
