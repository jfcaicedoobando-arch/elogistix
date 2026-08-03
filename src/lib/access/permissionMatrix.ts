/**
 * Matriz de capacidades por rol (datos puros, sin React).
 *
 * Se separa de `usePermissions` para respetar el límite de tamaño de archivo
 * (Power of 10) y permitir tests de la matriz sin montar el contexto de auth.
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

export const SALES: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "vendedor",
  "ejecutivo_pricing",
];

export const COTIZAR_SIN_DESGLOSE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
];

// v13.303.26 — eliminado `CREAR_EMBARQUE_LIBRE`: la política tarifa-first no admite
// excepciones, todo embarque nuevo nace de una cotización aceptada.

export const OVERRIDE_TARIFA_PRICING: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
];

// v13.54.0 — Bloque Q: separación de responsabilidades financieras.
// El auxiliar captura, el tesorero paga; el contador emite, cobranza cobra.
export const EMITIR_FACTURA_CLIENTE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
];

export const CAPTURAR_FACTURA_PROVEEDOR: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "auxiliar_contable",
];

export const PAGAR_PROVEEDOR: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "tesorero",
];

// v13.310.0 — Q-04: segregación de funciones. Quien captura la factura (auxiliar
// contable) NO puede aprobarla; el tesorero (paga) tampoco aprueba: sólo lee
// `proveedor_facturas`. Espejo de `aprobar_factura_proveedor` (BD), que ahora
// rechaza a tesorero y al usuario que capturó la factura (LC_SOD_VIOLATION).
export const APROBAR_FACTURA_PROVEEDOR: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
];

// v13.213.40 — auxiliar_contable NO registra cobros (separación de responsabilidades):
// sólo captura facturas de proveedor. Cobros los registran contador + ejecutivo_cobranza.
export const REGISTRAR_COBRO: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "ejecutivo_cobranza",
];

// v13.106.4 — El cierre de embarques pasa de finanzas a operaciones.
export const CERRAR_EMBARQUE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
];

// v13.118.0 — Handoff cotización → embarque (Vendedor confirma con cliente y
// pasa el balón al Coordinador Logístico para ejecutar).
export const HANDOFF_COTIZACION: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "gerente_operaciones",
  "coordinador_logistico",
  "vendedor",
];

// v13.145.8 — Aceptar/Rechazar proforma manualmente (cuando el cliente
// confirma por WhatsApp/llamada/email) queda limitado a admins y gerentes.
export const RESPONDER_PROFORMA_MANUAL: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "gerente_operaciones",
];

// FIX C1 (S5-01) — Espejo UI del guard SQL de `eliminar_embarque_completo`:
// super_admin o admin/operador (jerarquía `has_role`) de la misma organización.
export const ELIMINAR_EMBARQUE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
  "operador",
  "ejecutivo_pricing",
];

/**
 * Alta/edición/baja de cuentas bancarias.
 * El tesorero administra la operación bancaria del tenant, así que además de
 * los administradores puede gestionar el catálogo de cuentas. El contador
 * conserva sólo consulta (política de lectura en la base).
 */
export const ADMIN_CUENTAS_BANCARIAS: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "tesorero",
];

/**
 * v13.397.3 — Espejo UI del guard SQL `_assert_writer` usado por la RPC
 * `conciliar_tesoreria_proveedor`. Tesorero y roles de sólo lectura NO pueden
 * ejecutar la conciliación (la BD responde 42501), así que la UI no debe
 * lanzarla ni ofrecer el botón.
 */
export const CONCILIAR_TESORERIA: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "operador",
  "contador",
  "auxiliar_contable",
];

export const hasRole = (list: readonly AppRole[], role: AppRole | null | undefined) =>
  !!role && list.includes(role);
