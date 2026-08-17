/**
 * Capacidades financieras por rol (datos puros, sin React).
 *
 * v13.54.0 — Bloque Q: separación de responsabilidades financieras.
 * El auxiliar captura, el tesorero paga; el contador emite, cobranza cobra.
 */
import type { AppRole } from "@/types/appRole";

export const EMITIR_FACTURA_CLIENTE: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
];

/**
 * VF-20 — Escritura sobre proformas (enviar al cliente, convertir, registrar
 * respuesta manual). Espejo de las policies RLS `Tenant write/update/delete
 * proformas`. El vendedor tiene acceso de SÓLO LECTURA a `/proformas`
 * (`PROFORMAS_READ_ROLES` en `roleRouteMatrix.ts`), por lo que NO aparece aquí.
 */
export const PROFORMAS_ESCRITURA: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "operador",
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

/**
 * v13.588.0 — Operar casos de refacturación (cambiar receptor del CFDI y
 * reasignar el pago). Espejo de `public._assert_refacturador`: administradores
 * del tenant y todos los roles contables (contador y auxiliar contable).
 */
export const OPERAR_REFACTURACION: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "auxiliar_contable",
];


// v13.213.40 — auxiliar_contable NO registra cobros (separación de responsabilidades):
// sólo captura facturas de proveedor.
// FE-10 (v13.537.0) — el tesorero SÍ aplica pagos: la política de la base
// (`es_escritor_financiero`) lo autoriza a escribir en `pagos_factura`, así que
// la UI ya no le esconde el botón (antes veía la factura pendiente sin poder
// registrar el cobro que sí podía ejecutar).
export const REGISTRAR_COBRO: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "contador",
  "tesorero",
  "ejecutivo_cobranza",
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

/**
 * v13.489.0 — Espejo UI de la política RLS de INSERT/UPDATE en
 * `bbva_movimientos` ("Tesoreria write/update bbva_movimientos"): tesorero,
 * contador y auxiliar contable capturan, editan e importan movimientos
 * bancarios de su organización, además de los administradores del tenant.
 */
export const CAPTURAR_MOVIMIENTO_BANCARIO: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "tesorero",
  "contador",
  "auxiliar_contable",
];
