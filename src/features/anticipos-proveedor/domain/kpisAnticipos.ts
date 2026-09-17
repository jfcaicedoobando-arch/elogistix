/**
 * Agregados de los KPIs de anticipos (puro, MNY P1.3).
 *
 * Reglas: un anticipo cancelado no cuenta para nada; un anticipo devuelto ya no
 * es dinero adelantado vigente y su monto devuelto NUNCA es "aplicado a
 * facturas" (lo aplicado real ya viene neto de la devolución).
 */
export interface FilaKpiAnticipo {
  estado: string;
  moneda: string;
  monto: number | string;
  disponible: number;
  aplicado: number;
}

export interface KpisAnticipos<T> {
  vigentes: T[];
  pendientes: number;
  disponible: Array<[string, number]>;
  anticipado: Array<[string, number]>;
  aplicado: Array<[string, number]>;
}

function sumaPorMoneda<T extends FilaKpiAnticipo>(
  rows: T[],
  campo: (r: T) => number,
): Array<[string, number]> {
  const acc = new Map<string, number>();
  for (const r of rows) acc.set(r.moneda, (acc.get(r.moneda) ?? 0) + campo(r));
  return [...acc.entries()].filter(([, v]) => Math.abs(v) > 0.005);
}

export function calcularKpisAnticipos<T extends FilaKpiAnticipo>(rows: T[]): KpisAnticipos<T> {
  const noCancelados = rows.filter((a) => a.estado !== "cancelado");
  const vigentes = noCancelados.filter((a) => a.estado !== "devuelto");
  return {
    vigentes,
    pendientes: vigentes.filter((a) => a.disponible > 0).length,
    disponible: sumaPorMoneda(vigentes, (a) => a.disponible),
    anticipado: sumaPorMoneda(vigentes, (a) => Number(a.monto)),
    aplicado: sumaPorMoneda(noCancelados, (a) => a.aplicado),
  };
}
