/**
 * AUD-UTIL-MES: en la vista "Míos" los importes de "Arribos este mes" deben
 * salir de los embarques propios, no del total de la organización. Suma la
 * lista ya filtrada por operador. Los gastos fijos son de toda la empresa,
 * por eso se ponen en 0 (la tarjeta muestra "—").
 */
export interface FilaProfitMes {
  ventaMXN: number;
  costoMXN: number;
  ventaUSD: number;
  costoUSD: number;
  ventaMxnFromUsd: number;
  costoMxnFromUsd: number;
  ventaMxnFromEur: number;
  costoMxnFromEur: number;
  ventaMxnNative: number;
  costoMxnNative: number;
}

const CAMPOS = [
  "ventaMXN", "costoMXN", "ventaUSD", "costoUSD",
  "ventaMxnFromUsd", "costoMxnFromUsd", "ventaMxnFromEur",
  "costoMxnFromEur", "ventaMxnNative", "costoMxnNative",
] as const;

export function sumarArribosPropios(filas: readonly FilaProfitMes[]) {
  const t = Object.fromEntries(CAMPOS.map((c) => [c, 0])) as Record<(typeof CAMPOS)[number], number>;
  for (const f of filas) {
    for (const c of CAMPOS) t[c] += Number(f[c]) || 0;
  }
  return {
    ventaMXN: t.ventaMXN,
    costoMXN: t.costoMXN,
    profitMXN: t.ventaMXN - t.costoMXN,
    profitUSD: t.ventaUSD - t.costoUSD,
    ventaMxnFromUsd: t.ventaMxnFromUsd,
    costoMxnFromUsd: t.costoMxnFromUsd,
    ventaMxnFromEur: t.ventaMxnFromEur,
    costoMxnFromEur: t.costoMxnFromEur,
    ventaMxnNative: t.ventaMxnNative,
    costoMxnNative: t.costoMxnNative,
    gastosOperativosMXN: 0,
  };
}
