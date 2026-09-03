/**
 * Matriz de capacidades por rol (datos puros, sin React).
 *
 * Se separa de `usePermissions` para respetar el límite de tamaño de archivo
 * (Power of 10) y permitir tests de la matriz sin montar el contexto de auth.
 *
 * v13.489.5 — el archivo superó 200 líneas: las capacidades se mueven a
 * `permissionMatrix.finanzas.ts` y `permissionMatrix.operaciones.ts`; aquí
 * quedan los grupos de roles y el barrel de re-exports (API pública estable).
 */
import type { AppRole } from "@/types/appRole";

export const TENANT_ADMINS: readonly AppRole[] = ["super_admin", "admin_org", "admin"];

export const OPERATIONS: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "gerente_comercial",
  "coordinador_logistico",
  "operador",
  "ejecutivo_pricing",
  "vendedor",
];

export const FINANCE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "tesorero",
  "auxiliar_contable",
  "ejecutivo_cobranza",
];

export const FINANCE_VIEWERS: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "gerente_visor",
  "gerente_comercial",
  "contador",
  "tesorero",
  "auxiliar_contable",
  "ejecutivo_cobranza",
  "ejecutivo_pricing",
  "vendedor",
];

/**
 * Roles que pueden ver COSTO, utilidad y margen.
 *
 * C9 (decisión 2026-08-29): gerencia, finanzas y ventas — TODOS ven costos y
 * márgenes de cualquier cotización. Se elimina la excepción de "sólo las
 * cotizaciones propias" para el vendedor.
 *
 * Espejo en la base de datos: `public.puede_ver_costos_cotizacion()`; al
 * cambiar esta lista hay que cambiar también esa función.
 *
 * Se copia la lista (no se re-exporta el mismo binding) para que los dos
 * conceptos —"ve finanzas" y "ve costos"— sigan siendo nombres distintos si en
 * el futuro divergen, y para no dejar un export duplicado (knip `duplicates`).
 */
export const COST_VIEWERS: readonly AppRole[] = [...FINANCE_VIEWERS];


/**
 * C9 — ¿este usuario ve costo/margen de una cotización?
 *
 * Desde v13.796.0 la visibilidad depende sólo del rol (gerencia, finanzas y
 * ventas); ya no importa quién creó la cotización. Se conserva el segundo
 * parámetro por compatibilidad con los llamadores existentes.
 */
export function puedeVerCostosCotizacion(
  rol: AppRole | null,
  _esCotizacionPropia?: boolean,
): boolean {
  if (!rol) return false;
  return COST_VIEWERS.includes(rol);
}




/**
 * Roles con escritura en el expediente (documentos de cliente/proveedor y
 * contactos de proveedor). Espejo EXACTO de las policies RLS de
 * `cliente_documentos`, `proveedor_contactos`, `proveedor_documentos` y del
 * storage `clientes/` + `proveedores/` (R3BD-01 y R4BD-04, migración
 * 20260824050000). Al cambiar esta lista hay que cambiar también esas policies.
 */
export const EXPEDIENTE_ESCRITURA: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "operador",
  "contador",
];

/**

 * Roles con escritura en cotizaciones. Espejo en la base de datos:
 * `public.puede_escribir_cotizaciones()` (v13.750.0) — al cambiar esta lista,
 * actualizar también esa función para no desincronizar UI y RLS.
 *
 * v13.750.0 — se añaden los roles operativos (coordinador logístico, gerente de
 * operaciones, operador y customer service): la ruta `/cotizaciones/nueva` ya
 * estaba abierta para ellos, pero el guardado fallaba con RLS 42501.
 */
export const SALES: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "vendedor",
  "ejecutivo_pricing",
  "coordinador_logistico",
  "gerente_operaciones",
  "operador",
  "customer_service",
];


/**
 * P0 — Roles que pueden DAR DE ALTA clientes (alta manual, importación CSV y
 * conversión Prospecto → Cliente). Espejo EXACTO del `has_any_role_in_org` de
 * `public.convertir_prospecto_a_cliente_rpc`: administración/dirección,
 * operación y contabilidad. Ventas, pricing, tesorería y cobranza NO dan de
 * alta clientes. Al cambiar esta lista hay que cambiar también esa RPC.
 */
export const ALTA_CLIENTES: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
  "operador",
  "contador",
  "auxiliar_contable",
];

export {
  CRM_CONFIG,
  CRM_TOMAR_LEAD,
  CRM_GESTION_TODOS_LEADS,
  CRM_CREAR_LEAD,
  CRM_STAFF_REGISTROS,
  CRM_ESCRITURA_REGISTROS,
  CRM_REASIGNAR_VENDEDOR,
} from "./permissionMatrix.crm";

export {
  ADMIN_CUENTAS_BANCARIAS,
  APROBAR_FACTURA_PROVEEDOR,
  CAPTURAR_FACTURA_PROVEEDOR,
  CAPTURAR_MOVIMIENTO_BANCARIO,
  CONCILIAR_TESORERIA,
  EMITIR_FACTURA_CLIENTE,
  OPERAR_REFACTURACION,
  PROFORMAS_ESCRITURA,

  PAGAR_PROVEEDOR,
  REGISTRAR_COBRO,
} from "./permissionMatrix.finanzas";

export {
  CERRAR_EMBARQUE,
  COTIZAR_SIN_DESGLOSE,
  ELIMINAR_EMBARQUE,
  HANDOFF_COTIZACION,
  OVERRIDE_TARIFA_PRICING,
  RESPONDER_PROFORMA_MANUAL,
  SUBIR_FACTURA_ENTRANTE_EMBARQUE,
  ADJUNTAR_XML_FACTURA_ENTRANTE,
  CONFIGURAR_AUTORIZACION_CLIENTE,
} from "./permissionMatrix.operaciones";

export const hasRole = (list: readonly AppRole[], role: AppRole | null | undefined) =>
  !!role && list.includes(role);
