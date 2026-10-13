import { CAP_LOTES_DURO } from "@/constants/queryCaps";
import { ResultadoTruncadoError } from "./assertNotTruncated";

type Clave = readonly string[];
interface RespuestaPagina<T> { data: T[] | null; error: { message: string } | null }
interface Opciones { lote?: number; capDuro?: number; signal?: AbortSignal }

export function conAbortSignal<Q extends { abortSignal(signal: AbortSignal): Q }>(query: Q, signal?: AbortSignal): Q {
  signal?.throwIfAborted();
  return signal ? query.abortSignal(signal) : query;
}

/** Cursor estricto sobre columnas no nulas e inmutables, en orden ascendente. */
export function aplicarCursor<Q extends { gt(col: string, value: string): Q; or(filter: string): Q }>(
  query: Q, columnas: readonly string[], despues: Clave | null,
): Q {
  if (!despues) return query;
  if (columnas.length === 1) return query.gt(columnas[0], despues[0]);
  const literal = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  const alternativas = columnas.map((col, i) => {
    const mayor = `${col}.gt.${literal(despues[i])}`;
    const iguales = columnas.slice(0, i).map((previa, j) => `${previa}.eq.${literal(despues[j])}`);
    return iguales.length ? `and(${[...iguales, mayor].join(",")})` : mayor;
  });
  return query.or(alternativas.join(","));
}

function comparar(a: Clave, b: Clave): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function validarAvance(contexto: string, actual: Clave, ultima: Clave | null): void {
  if (!actual.length || actual.some(valor => typeof valor !== "string" || !valor)
    || (ultima && (actual.length !== ultima.length || comparar(actual, ultima) <= 0))) {
    throw new Error(`La consulta '${contexto}' no avanzó con una clave única y ordenada.`);
  }
}

/**
 * Evita desplazamientos por altas/bajas anteriores al cursor. No crea un
 * snapshot: altas posteriores pueden aparecer y cambios de filtros/valores
 * entre peticiones siguen siendo visibles. Claves UUID canónicas o text ASCII.
 */
export async function leerPaginasPorClave<T>(
  contexto: string,
  pagina: (despues: Clave | null, lote: number) => PromiseLike<RespuestaPagina<T>>,
  clave: (fila: T) => Clave,
  { lote = 1000, capDuro = CAP_LOTES_DURO, signal }: Opciones = {},
): Promise<T[]> {
  const filas: T[] = [];
  let ultima: Clave | null = null;
  for (;;) {
    signal?.throwIfAborted();
    const { data, error } = await pagina(ultima, lote);
    signal?.throwIfAborted();
    if (error) throw error;
    const recibidas = data ?? [];
    for (const fila of recibidas) {
      const actual = clave(fila);
      validarAvance(contexto, actual, ultima);
      filas.push(fila);
      ultima = [...actual];
    }
    if (filas.length >= capDuro) throw new ResultadoTruncadoError(contexto, capDuro);
    if (recibidas.length < lote) return filas;
  }
}
