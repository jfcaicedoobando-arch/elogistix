/**
 * FIX-11 (auditoría): política unificada anti "TC=1 silencioso".
 *
 * Devuelve el tipo de cambio si es un número finito y positivo; en cualquier
 * otro caso devuelve `null`. NUNCA colapses a `1` para monedas extranjeras:
 * sumar USD/EUR con TC=1 mezcla monedas y multiplica utilidades por ~20×.
 *
 * Uso recomendado:
 *   const tc = tcValido(embarque.tipo_cambio_usd);
 *   if (!tc) return { montoMxn: null, tcMissing: true };
 *   return { montoMxn: montoUsd * tc, tcMissing: false };
 */
export function tcValido(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Azúcar para MXN: siempre 1; útil en callsites polimórficos. */
export function tcParaMoneda(moneda: string | null | undefined, tc: unknown): number | null {
  if (moneda === "MXN") return 1;
  return tcValido(tc);
}
