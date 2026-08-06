/**
 * Tokens de densidad y hover para TODAS las tablas del ERP.
 *
 * Regla única (v13.435.0):
 *  - `TABLE_DENSITY.listado`  → páginas de listado a pantalla completa
 *    (Clientes, Cotizaciones, Facturas emitidas, CRM, admin…). Filas de
 *    40 px, texto base: cómodo para escanear y hacer clic.
 *  - `TABLE_DENSITY.embebida` → tablas dentro de una card, tab, diálogo,
 *    dashboard o drilldown, donde el espacio vertical es escaso. Filas de
 *    32 px, texto xs.
 *
 * Nunca pasar el string literal (`density={TABLE_DENSITY.embebida}`) en features: usar
 * estas constantes para que un cambio de escala se aplique en un solo lugar.
 * La prueba de arquitectura `table-density-tokens.test.ts` lo verifica.
 */
import type { TableDensity } from "./types";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

export const TABLE_DENSITY = {
  /** Listados de página completa. */
  listado: "comfortable",
  /** Tablas embebidas en cards, tabs, diálogos y dashboards. */
  embebida: "compact",
} as const satisfies Record<string, TableDensity>;

export type TableDensityPreset = (typeof TABLE_DENSITY)[keyof typeof TABLE_DENSITY];

/**
 * Hover de fila. Fuente única: el mismo tinte de `ui/table.tsx` para que
 * `DataTable`, `DetailTable` y tablas con markup propio se sientan iguales.
 */
export const ROW_HOVER = "hover:bg-primary/5";
export const ROW_HOVER_NONE = "hover:bg-transparent";
