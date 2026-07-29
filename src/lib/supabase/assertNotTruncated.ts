/**
 * FIX C3 (S6-01) — Guarda anti-truncado silencioso de PostgREST.
 *
 * PostgREST corta toda respuesta a `max-rows` (default 1000) SIN error.
 * Toda query que calcula dinero sobre `data` debe verificar que no recibió
 * exactamente el cap pedido: si `data.length === limit`, el servidor pudo
 * haber truncado y cualquier SUM/KPI en cliente sería una cifra muda e
 * incorrecta. La política del ERP es fail-visible: lanzar, y que la UI
 * muestre el error en vez del total equivocado.
 */

export class ResultadoTruncadoError extends Error {
  readonly code = "LC_RESULTADO_TRUNCADO" as const;
  constructor(
    public readonly contexto: string,
    public readonly limite: number,
  ) {
    super(
      `LC_RESULTADO_TRUNCADO: la consulta '${contexto}' devolvió exactamente ` +
        `${limite} filas (posible truncado de PostgREST). Migra el agregado a SQL ` +
        `(RPC) o pagina con .range(); nunca sumes dinero sobre un subconjunto.`,
    );
    this.name = "ResultadoTruncadoError";
  }
}

/**
 * Verifica que `rows` no llegó al cap de la query. Devuelve las filas si el
 * resultado es completo; lanza `ResultadoTruncadoError` si pudo estar truncado.
 *
 * Uso:
 *   const LIMITE = 2000;
 *   const { data, error } = await query.limit(LIMITE);
 *   if (error) throw error;
 *   assertNotTruncated(data, LIMITE, "modulo.consulta");
 */
export function assertNotTruncated<T>(
  rows: readonly T[] | null | undefined,
  limite: number,
  contexto: string,
): T[] {
  const data = (rows ?? []) as T[];
  if (limite > 0 && data.length >= limite) {
    throw new ResultadoTruncadoError(contexto, limite);
  }
  return data;
}
