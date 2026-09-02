/**
 * Lectura COMPLETA de una consulta PostgREST por páginas (`.range`).
 *
 * PostgREST corta toda respuesta en `max-rows` (1000 por defecto) SIN error, así
 * que un `.select()` sin paginación puede devolver un subconjunto mudo. Cuando
 * sobre esas filas se calcula dinero (KPIs, saldos, márgenes) el resultado es
 * incorrecto en silencio. Este helper pide lotes consecutivos hasta recibir uno
 * incompleto, propaga cualquier error y falla visible si el acumulado alcanza el
 * tope duro (`CAP_LOTES_DURO`) en vez de devolver un parcial.
 */
import { CAP_LOTES_DURO } from "@/constants/queryCaps";
import { ResultadoTruncadoError } from "./assertNotTruncated";

/** Tamaño de lote por petición. No es un cap: se piden lotes hasta agotar. */
export const LOTE_PAGINADO = 1000;

interface RespuestaPagina<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export interface OpcionesPaginado {
  /** Filas por petición. */
  lote?: number;
  /** Tope duro de filas acumuladas; al alcanzarlo se lanza. */
  capDuro?: number;
}

/**
 * Lee todas las páginas de `pagina(desde, hasta)`.
 *
 * @param contexto Identificador para el mensaje de error (p. ej. `"direccion.ventas"`).
 */
export async function leerTodasLasPaginas<T>(
  contexto: string,
  pagina: (desde: number, hasta: number) => PromiseLike<RespuestaPagina<T>>,
  opciones: OpcionesPaginado = {},
): Promise<T[]> {
  const lote = opciones.lote ?? LOTE_PAGINADO;
  const capDuro = opciones.capDuro ?? CAP_LOTES_DURO;
  const acumulado: T[] = [];
  for (let desde = 0; ; desde += lote) {
    const { data, error } = await pagina(desde, desde + lote - 1);
    if (error) throw error;
    const filas = data ?? [];
    acumulado.push(...filas);
    if (acumulado.length >= capDuro) throw new ResultadoTruncadoError(contexto, capDuro);
    if (filas.length < lote) return acumulado;
  }
}
