/**
 * Valor real de una oportunidad ganada a partir de sus cotizaciones aceptadas.
 * Usa subtotal (antes de IVA), igual que el valor estimado. No mezcla monedas:
 * suma las aceptadas en la moneda de la oportunidad; si ninguna coincide, usa
 * la aceptada más reciente con su moneda.
 */
export interface CotizacionValor {
  estado: string;
  subtotal: number | null;
  moneda: string | null;
  updated_at: string | null;
}

const ACEPTADAS = new Set(["Aceptada", "En operación"]);

export function calcularValorReal(
  cotizaciones: CotizacionValor[],
  monedaOportunidad: string | null,
): { valor: number; moneda: string | null } | null {
  const aceptadas = cotizaciones.filter((c) => ACEPTADAS.has(c.estado) && Number(c.subtotal) > 0);
  if (aceptadas.length === 0) return null;
  const mismas = aceptadas.filter((c) => c.moneda === monedaOportunidad);
  if (mismas.length > 0) {
    const centavos = mismas.reduce((acc, c) => acc + Math.round(Number(c.subtotal) * 100), 0);
    return { valor: centavos / 100, moneda: monedaOportunidad };
  }
  const reciente = [...aceptadas].sort((a, b) =>
    String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")),
  )[0];
  return { valor: Number(reciente.subtotal), moneda: reciente.moneda };
}
