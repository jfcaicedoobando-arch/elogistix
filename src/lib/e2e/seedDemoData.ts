/**
 * src/lib/e2e/seedDemoData.ts
 *
 * Módulo puro (sin red, sin Supabase) con la "forma" de los datos semilla
 * de la organización demo E2E. `scripts/e2e/seed-demo.ts` importa estas
 * constantes y las inserta vía `psql` (upsert por clave natural).
 *
 * Se mantiene aquí (dentro de `src/`) — y no directamente en el script —
 * porque vitest sólo recolecta `src/**\/*.{test,spec}.ts`: así el test
 * unitario que valida su forma corre en la suite normal, sin tocar la DB.
 *
 * Catálogos (navieras/agentes/rutas/tarifas/productos) y entidades
 * (cuentas/tipo de cambio/cliente/proveedor) viven en módulos hermanos;
 * este archivo re-exporta todo para no romper consumidores existentes.
 */

export {
  SEED_NAVIERAS, SEED_AGENTES, SEED_RUTAS, SEED_TARIFAS, SEED_PRODUCTOS_SERVICIOS,
} from "./seedDemoData.catalogos";

export {
  SEED_CUENTAS_BANCARIAS, SEED_TIPO_CAMBIO, SEED_CLIENTE, SEED_PROVEEDOR,
} from "./seedDemoData.entidades";

import {
  SEED_NAVIERAS, SEED_AGENTES, SEED_RUTAS, SEED_TARIFAS, SEED_PRODUCTOS_SERVICIOS,
} from "./seedDemoData.catalogos";
import {
  SEED_CUENTAS_BANCARIAS, SEED_TIPO_CAMBIO, SEED_CLIENTE, SEED_PROVEEDOR,
} from "./seedDemoData.entidades";

/** Agrupa toda la semilla — útil para validaciones de forma en un solo lugar. */
export const SEED_DEMO_DATA = {
  navieras: SEED_NAVIERAS,
  agentes: SEED_AGENTES,
  rutas: SEED_RUTAS,
  tarifas: SEED_TARIFAS,
  productosServicios: SEED_PRODUCTOS_SERVICIOS,
  cuentasBancarias: SEED_CUENTAS_BANCARIAS,
  tipoCambio: SEED_TIPO_CAMBIO,
  cliente: SEED_CLIENTE,
  proveedor: SEED_PROVEEDOR,
} as const;
