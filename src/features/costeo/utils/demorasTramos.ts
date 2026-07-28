/**
 * B-096: validación de tramos de demoras sin solapes.
 * El motor `_calcular_demoras_montos_contenedor` resuelve solapes con
 * `ORDER BY desde_dia DESC LIMIT 1` (determinista pero silencioso): la UI
 * debe impedir capturarlos. Los días se cuentan desde el primer día con cargo.
 */

export interface TramoDias {
  desde_dia: number;
  hasta_dia: number | null;
}

/** Fin efectivo del tramo (null = sin límite). */
const fin = (t: TramoDias): number => t.hasta_dia ?? Number.POSITIVE_INFINITY;

/** Dos tramos se solapan si sus rangos [desde, hasta] se intersectan. */
export function tramosSeSolapan(a: TramoDias, b: TramoDias): boolean {
  return a.desde_dia <= fin(b) && b.desde_dia <= fin(a);
}

/**
 * Primer par de tramos solapados (posiciones 1-based para el mensaje),
 * o null si el tabulador es válido. También detecta rangos invertidos
 * (hasta < desde, que la BD rechaza con CHECK pero sin mensaje de negocio).
 */
export function encontrarSolapeTramos(
  tramos: TramoDias[],
): { i: number; j: number; invertido?: boolean } | null {
  for (let i = 0; i < tramos.length; i++) {
    const t = tramos[i];
    if (t.hasta_dia !== null && t.hasta_dia < t.desde_dia) {
      return { i: i + 1, j: i + 1, invertido: true };
    }
    for (let j = i + 1; j < tramos.length; j++) {
      if (tramosSeSolapan(t, tramos[j])) return { i: i + 1, j: j + 1 };
    }
  }
  return null;
}

/** Dos rangos de vigencia (fechas ISO YYYY-MM-DD, hasta null = abierto) se traslapan. */
export function vigenciasSeSolapan(
  aDesde: string,
  aHasta: string | null,
  bDesde: string,
  bHasta: string | null,
): boolean {
  const aFin = aHasta ?? "9999-12-31";
  const bFin = bHasta ?? "9999-12-31";
  return aDesde <= bFin && bDesde <= aFin;
}
