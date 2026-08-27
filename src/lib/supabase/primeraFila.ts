/**
 * Normaliza el resultado de un `update(...).select()`: Supabase devuelve un
 * arreglo, pero algunos mocks y variantes con `.single()` devuelven la fila
 * suelta. Analogía: aceptamos tanto una caja con un documento dentro como el
 * documento solo.
 *
 * Devuelve `null` cuando no se tocó ninguna fila (bloqueo optimista H5).
 */
export function primeraFila<T>(data: T[] | T | null | undefined): T | null {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) return data.length > 0 ? data[0] : null;
  return data;
}
