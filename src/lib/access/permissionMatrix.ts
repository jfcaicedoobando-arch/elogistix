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
 * Ola 6 (O6.3) — Roles que configuran el CRM (`/crm/configuracion`:
 * etapas del pipeline, motivos de pérdida, metas, presupuesto). Espejo de la
 * policy "Tenant admin crm_etapas_pipeline" (migración 20260821145033) — al
 * cambiar esta lista hay que cambiar también esa policy.
 */
export const CRM_CONFIG: readonly AppRole[] = [...TENANT_ADMINS, "gerente_comercial"];

/**
 * Ola 6 (O6.1) — Roles que pueden tomar leads de la bolsa común. Espejo de
 * `public.crm_tomar_lead()` (has_any_role_in_org 'vendedor'/'admin' en la
 * organización del lead, v13.823.60) — al cambiar esta lista hay que cambiar
 * también esa RPC.
 */
export const CRM_TOMAR_LEAD: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "vendedor",
];

/**
 * v13.823.60 — Roles que gestionan CUALQUIER lead de su organización (editar,
 * eliminar, calificar, lote). Espejo de la policy "Gestion leads in-org
 * crm_leads" y de la autorización de `crm_calificar_prospecto`.
 */
export const CRM_GESTION_TODOS_LEADS: readonly AppRole[] = [
  ...TENANT_ADMINS,
  "gerente_comercial",
];

/**
 * v13.823.60 — Roles que pueden crear leads. Espejo del WITH CHECK de las
 * policies de escritura: gestión total in-org, o vendedor efectivo (que sólo
 * puede insertar un lead propio).
 */
export const CRM_CREAR_LEAD: readonly AppRole[] = [
  ...CRM_GESTION_TODOS_LEADS,
  "vendedor",
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

/**
 * Espejo EXACTO de las policies de escritura de `crm_oportunidades` y
 * `crm_actividades`: el CRUD "staff" es de administración/dirección, gerencia
 * comercial y operador. `vendedor` sólo escribe sus propios registros.
 *
 * NO reutilizar `canEdit`/`canEditCrm` para estas acciones: esos permisos son
 * amplios (operaciones + finanzas) y ofrecían formularios que la RLS rechazaba
 * (p. ej. `gerente_operaciones`). Al cambiar estas listas hay que cambiar
 * también esas policies.
 */
export const CRM_STAFF_REGISTROS: readonly AppRole[] = [
  ...TENANT_ADMINS,
  "gerente_comercial",
  "operador",
];

/** Roles que pueden crear oportunidades/actividades (staff + vendedor propio). */
export const CRM_ESCRITURA_REGISTROS: readonly AppRole[] = [
  ...CRM_STAFF_REGISTROS,
  "vendedor",
];

/**
 * Reasignar el vendedor/owner de un registro CRM: sólo quien puede gestionar
 * CUALQUIER registro. Un vendedor conserva su asignación pero no la cambia.
 */
export const CRM_REASIGNAR_VENDEDOR: readonly AppRole[] = [...CRM_STAFF_REGISTROS];




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
