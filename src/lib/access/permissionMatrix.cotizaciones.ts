/**
 * Capacidades del ciclo Cotización → Cliente → Embarque (datos puros).
 *
 * Extraído de `permissionMatrix.ts` (Power of 10: ≤200 líneas). Cada lista es
 * espejo EXACTO de una RPC/policy de la base: al cambiar una lista aquí hay que
 * cambiar también la función indicada, o la UI mostrará acciones que el backend
 * rechaza con 42501.
 */
import type { AppRole } from "@/types/appRole";

/**
 * P0 — Roles que pueden DAR DE ALTA clientes (alta manual, importación CSV y
 * conversión Prospecto → Cliente). Espejo EXACTO del `has_any_role_in_org` de
 * `public.convertir_prospecto_a_cliente_rpc`: administración/dirección,
 * operación y contabilidad. Ventas, pricing, tesorería y cobranza NO dan de
 * alta clientes.
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
 * Roles que pueden ACEPTAR/RECHAZAR una cotización. Espejo EXACTO de
 * `public.aceptar_cotizacion_version`: administración/dirección + comercial y
 * operación. Finanzas (contador, tesorero, cobranza) NO acepta cotizaciones.
 */
export const ACEPTAR_COTIZACION: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_comercial",
  "vendedor",
  "operador",
  "gerente_operaciones",
];

/**
 * Roles que pueden generar el embarque borrador desde una cotización. Espejo
 * EXACTO de `public.crear_embarque_borrador_core`: super admin, administración
 * de la empresa (`admin_org` y el rol legado `admin`) y operación
 * (`gerente_operaciones`, `coordinador_logistico`, `operador`).
 */
export const CREAR_EMBARQUE_BORRADOR: readonly AppRole[] = [
  "super_admin",
  "admin_org",
  "admin",
  "gerente_operaciones",
  "coordinador_logistico",
  "operador",
];
