/**
 * Helper puro compartido: agrupa importes por moneda SIN sumar monedas
 * distintas entre sí (no hay TC histórico canónico en el CRM). Ver también
 * `pipelineMoneda.ts`, que sí convierte a MXN cuando se cuenta con T/C real.
 */

export interface ImporteConMoneda {
  monto: number | null | undefined;
  moneda: string | null | undefined;
}

/** Suma por moneda (normalizada a mayúsculas, default "MXN" si falta). */
export function agruparMontosPorMoneda(items: readonly ImporteConMoneda[]): Map<string, number> {
  const acc = new Map<string, number>();
  for (const item of items) {
    const monto = Number(item.monto ?? 0);
    const moneda = (item.moneda ?? "MXN").toUpperCase();
    acc.set(moneda, (acc.get(moneda) ?? 0) + monto);
  }
  return acc;
}

export interface SubtotalMoneda {
  moneda: string;
  total: number;
}

/** Versión en arreglo ordenado alfabéticamente, lista para renderizar. */
export function agruparMontosPorMonedaOrdenado(items: readonly ImporteConMoneda[]): SubtotalMoneda[] {
  return [...agruparMontosPorMoneda(items).entries()]
    .map(([moneda, total]) => ({ moneda, total }))
    .sort((a, b) => a.moneda.localeCompare(b.moneda));
}
