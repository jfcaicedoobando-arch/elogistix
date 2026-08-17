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
import { notifyWarning } from "@/lib/ui/appFeedback";

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
 * Variante NO bloqueante de `assertNotTruncated` para listados de trabajo
 * (bandejas, catálogos, selects) donde cortar la respuesta no corrompe un
 * cálculo de dinero pero sí puede ocultar registros: muestra un aviso
 * "mostrando los primeros N; refina tu búsqueda" en vez de lanzar.
 *
 * Uso:
 *   const { data, error } = await query.limit(LIMITE);
 *   if (error) throw error;
 *   warnIfTruncated(data, LIMITE, "modulo.consulta");
 */
export function warnIfTruncated(
  rows: readonly unknown[] | null | undefined,
  limite: number,
  contexto: string,
): void {
  if (limite > 0 && (rows?.length ?? 0) >= limite) {
    notifyWarning(undefined, {
      title: "Lista posiblemente incompleta",
      description:
        `Mostrando los primeros ${limite} registros de '${contexto}'; ` +
        "refina tu búsqueda o aplica filtros para ver el resto.",
    });
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
