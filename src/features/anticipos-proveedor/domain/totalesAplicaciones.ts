/**
 * Subtotales de anticipos aplicados a una factura, agrupados por moneda.
 *
 * Una misma factura puede recibir anticipos en monedas distintas (la RPC guarda
 * `moneda_aplicada` = moneda del anticipo). Sumar todo en la moneda de la
 * primera fila ocultaba las demás, así que se reporta un subtotal por moneda.
 */
export interface AplicacionMonto {
  monto_aplicado: number | string;
  moneda_aplicada: string;
}

export interface SubtotalMoneda {
  moneda: string;
  total: number;
}

export function subtotalesPorMoneda(aplicaciones: AplicacionMonto[]): SubtotalMoneda[] {
  const acc = new Map<string, number>();
  for (const a of aplicaciones) {
    const moneda = a.moneda_aplicada;
    acc.set(moneda, (acc.get(moneda) ?? 0) + Number(a.monto_aplicado));
  }
  return [...acc.entries()]
    .map(([moneda, total]) => ({ moneda, total }))
    .sort((x, y) => x.moneda.localeCompare(y.moneda));
}
