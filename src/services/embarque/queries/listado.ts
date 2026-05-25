/**
 * Queries de listado de embarques (barrel re-export).
 *
 * v8.173.0 (Ola B.4): `fetchEmbarquesPaginados` consume el RPC consolidado
 * `embarques_listado` que devuelve filas + conteos de costos/documentos +
 * total_count en una sola llamada.
 *
 * Dividido en módulos para mantener archivos ≤200 líneas (Power of 10):
 *   - `./paginados`: listado paginado + tipos y whitelist de ordenamiento
 *   - `./exportListado`: trae todos los embarques sin paginar (CSV export)
 *   - `./extras`: relacionados por BL y extras de liquidación/docs
 */
export * from "./paginados";
export * from "./exportListado";
export * from "./extras";
