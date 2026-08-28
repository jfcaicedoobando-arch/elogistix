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
 * QA B-07 — Roles que pueden ver COSTO, utilidad y margen.
 *
 * `FINANCE_VIEWERS` habilita la vista financiera (venta, cobranza), pero los
 * roles puramente comerciales (`vendedor`, `ejecutivo_pricing`) no deben ver el
 * costo del proveedor ni la utilidad: sólo el lado de venta.
 *
 * C9 (Ola E2 · B) — excepción de producto: el `vendedor` SÍ ve el costo y el
 * margen de las cotizaciones que él creó (usa `puedeVerCostosCotizacion`).
 * Espejo en la base de datos: `public.puede_ver_costos_cotizacion()` y
 * `public.puede_ver_costos_cotizacion_propia()`; al cambiar esta lista hay que
 * cambiar también esas funciones.
 */
export const COST_VIEWERS: readonly AppRole[] = FINANCE_VIEWERS.filter(
  (r) => r !== "vendedor" && r !== "ejecutivo_pricing",
);

/**
 * C9 — ¿este usuario ve costo/margen de una cotización concreta?
 *
 * Analogía: el vendedor puede abrir el sobre de costos de los expedientes que
 * él armó, pero no los de sus compañeros.
 */
export function puedeVerCostosCotizacion(
  rol: AppRole | null,
  esCotizacionPropia: boolean,
): boolean {
  if (!rol) return false;
  if (COST_VIEWERS.includes(rol)) return true;
  return rol === "vendedor" && esCotizacionPropia;
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
 * `public.crm_tomar_lead()` (has_role 'vendedor', migración 20260821144907) —
 * al cambiar esta lista hay que cambiar también esa RPC.
 */
export const CRM_TOMAR_LEAD: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "gerente_comercial",
  "vendedor",
];

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
