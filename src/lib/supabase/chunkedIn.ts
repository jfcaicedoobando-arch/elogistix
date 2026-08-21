/**
 * Helpers para consultas Supabase con filtros `.in(...)` sobre listas grandes.
 *
 * PostgREST envía el filtro en la URL: con cientos de UUIDs la petición
 * revienta el límite de longitud (HTTP 414) o degrada el plan de consulta.
 * Estos helpers parten la lista en lotes y agregan los resultados.
 */

/** Tamaño máximo de IDs por petición. 200 UUIDs ≈ 7.4 KB de URL. */
export const IN_CHUNK_SIZE = 200;

/** Parte una lista en lotes de `size` elementos (sin duplicados). */
export function chunkIds<T>(ids: readonly T[], size: number = IN_CHUNK_SIZE): T[][] {
  const unicos = Array.from(new Set(ids));
  if (unicos.length === 0) return [];
  const lotes: T[][] = [];
  for (let i = 0; i < unicos.length; i += size) {
    lotes.push(unicos.slice(i, i + size));
  }
  return lotes;
}

/**
 * Ejecuta `fetcher` por lote y concatena las filas resultantes.
 * Devuelve `[]` cuando no hay IDs (evita una consulta inútil).
 */
export async function fetchInChunks<TId, TRow>(
  ids: readonly TId[],
  fetcher: (lote: TId[]) => Promise<TRow[]>,
  size: number = IN_CHUNK_SIZE,
): Promise<TRow[]> {
  const lotes = chunkIds(ids, size);
  if (lotes.length === 0) return [];
  const resultados = await Promise.all(lotes.map((lote) => fetcher(lote)));
  return resultados.flat();
}

/**
 * Ejecuta `counter` por lote y suma los conteos.
 * Devuelve `0` cuando no hay IDs (evita una consulta inútil).
 */
export async function countInChunks<TId>(
  ids: readonly TId[],
  counter: (lote: TId[]) => Promise<number>,
  size: number = IN_CHUNK_SIZE,
): Promise<number> {
  const lotes = chunkIds(ids, size);
  if (lotes.length === 0) return 0;
  const conteos = await Promise.all(lotes.map((lote) => counter(lote)));
  return conteos.reduce((acc, n) => acc + n, 0);
}
