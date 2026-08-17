/**
 * Elige qué renglón de conceptos resaltar cuando la suma de líneas no cuadra
 * con el subtotal de la factura (v13.629.0).
 *
 * Heurística: el renglón sospechoso es el de mayor total de línea, porque un
 * dedazo en el importe o la cantidad casi siempre infla una sola partida.
 * Función pura para poder probarla sin UI.
 */
import { calcularCuadreConceptos, totalLinea } from "./cuadreConceptos";

export interface LineaResaltable {
  key: string;
  monto: number;
  cantidad?: number | null;
}

export function keyRenglonSospechoso(
  subtotal: number,
  lineas: ReadonlyArray<LineaResaltable>,
): string | null {
  if (lineas.length === 0) return null;
  const cuadre = calcularCuadreConceptos(subtotal, lineas);
  if (cuadre.estado === "cuadrado" || cuadre.estado === "sin_conceptos") return null;

  let peor: LineaResaltable | null = null;
  let peorTotal = -Infinity;
  for (const l of lineas) {
    const t = Math.abs(totalLinea(l));
    if (t > peorTotal) {
      peorTotal = t;
      peor = l;
    }
  }
  return peor?.key ?? null;
}
