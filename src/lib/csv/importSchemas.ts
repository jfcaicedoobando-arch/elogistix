/**
 * Bloque 3.1 — Mapeo de filas CSV → payload validable para mutaciones de
 * clientes y proveedores. Devuelve `{ valid, invalid }` para que la UI muestre
 * conteos y errores legibles antes de tocar la base.
 *
 * Las claves esperadas en el CSV son las columnas normalizadas por
 * `normalizeHeader` (lowercase + snake_case sin acentos). La plantilla que
 * descarga el usuario usa exactamente esos nombres.
 *
 * Dividido por dominio para mantener archivos ≤200 LOC (Power of 10).
 */
export type {
  ImportPreview,
  ImportRowError,
  
  
} from "./importSchemasShared";
export * from "./importSchemaCliente";
export * from "./importSchemaProveedor";
