/**
 * FIX C6 — CANON ÚNICO de conversión de moneda del ERP.
 *
 * Política (la única válida):
 *   1. MXN → factor 1 (`fuente: 'moneda-local'`).
 *   2. USD/EUR → requieren un TC explícito y confiable: `tcValido(tc)` y `tc > 1`
 *      (1 USD nunca es 1 MXN; un TC ≤ 1 para moneda extranjera es dato corrupto).
 *   3. Sin TC confiable NO se suma: `completo: false` con `monto: 0`. El consumidor
 *      decide (excluir y contar, marcar en UI o bloquear). Nunca se simula 1:1.
 *   4. El fallback (p. ej. TC del día) sólo aplica si se pasa explícito y queda
 *      auditado en `fuente: 'tc-fallback'`.
 *
 * Prohibido reimplementar esta lógica fuera de `src/lib/financial/`.
 */
import { tcValido } from "@/lib/financial/tcValido";
import { roundMoney } from "@/lib/financial/financialUtils";

export type FuenteConversion = "moneda-local" | "tc-directo" | "tc-fallback" | "sin-tc";

export interface ConversionMxn {
  /** MXN equivalente; 0 cuando `completo` es false (NO es el monto nativo). */
  monto: number;
  /** TC aplicado (1 para MXN; null si no hubo conversión posible). */
  tc: number | null;
  fuente: FuenteConversion;
  /** false = no hubo TC confiable y el monto NO debe sumarse a totales MXN. */
  completo: boolean;
}

export interface TiposCambio {
  usd?: number | null;
  eur?: number | null;
}

function normalizarMoneda(moneda: string | null | undefined): string {
  const m = (moneda ?? "").trim().toUpperCase();
  return m === "" ? "MXN" : m;
}

/** TC confiable para moneda extranjera: finito, > 0 y > 1 (política 2). */
export function tcConfiable(v: unknown): number | null {
  const tc = tcValido(v);
  return tc !== null && tc > 1 ? tc : null;
}

/** Convierte un monto a MXN. Única vía autorizada de conversión a MXN. */
export function aMxn(
  monto: number | null | undefined,
  moneda: string | null | undefined,
  tipoCambio: number | null | undefined,
  opts?: { fallback?: number | null },
): ConversionMxn {
  const bruto = Number(monto ?? 0);
  const m = Number.isFinite(bruto) ? bruto : 0;
  if (normalizarMoneda(moneda) === "MXN") {
    return { monto: m, tc: 1, fuente: "moneda-local", completo: true };
  }
  const directo = tcConfiable(tipoCambio);
  if (directo) return { monto: m * directo, tc: directo, fuente: "tc-directo", completo: true };

  const fb = tcConfiable(opts?.fallback);
  if (fb) return { monto: m * fb, tc: fb, fuente: "tc-fallback", completo: true };

  return { monto: 0, tc: null, fuente: "sin-tc", completo: false };
}

/** Tipo de cambio de `moneda` a MXN según las tasas disponibles. */
function tcDeMoneda(moneda: string | null | undefined, tasas: TiposCambio): number | null {
  const mon = normalizarMoneda(moneda);
  if (mon === "MXN") return 1;
  if (mon === "USD") return tcConfiable(tasas.usd);
  if (mon === "EUR") return tcConfiable(tasas.eur);
  return null;
}

/**
 * Factor para convertir de `origen` a `destino` usando MXN como puente.
 * `null` cuando falta un TC confiable en cualquiera de las dos patas.
 */
export function factorEntreMonedas(
  origen: string | null | undefined,
  destino: string | null | undefined,
  tasas: TiposCambio,
): number | null {
  if (normalizarMoneda(origen) === normalizarMoneda(destino)) return 1;
  const tcOrigen = tcDeMoneda(origen, tasas);
  const tcDestino = tcDeMoneda(destino, tasas);
  if (!tcOrigen || !tcDestino) return null;
  return tcOrigen / tcDestino;
}

export interface ResultadoConversion {
  /** Monto en MXN, o `null` si faltaba un tipo de cambio válido. */
  mxn: number | null;
  /** `true` cuando la moneda es extranjera y no había TC utilizable. */
  tcFaltante: boolean;
}

/** Variante con las tasas agrupadas (USD/EUR) que usan los reportes. */
export function convertirMxn(
  monto: number | null | undefined,
  moneda: string | null | undefined,
  tc: TiposCambio,
): ResultadoConversion {
  const mon = normalizarMoneda(moneda);
  const tasa = mon === "USD" ? tc.usd : mon === "EUR" ? tc.eur : null;
  const res = aMxn(monto, mon, mon === "MXN" ? 1 : tasa);
  return res.completo ? { mxn: res.monto, tcFaltante: false } : { mxn: null, tcFaltante: true };
}

export interface TotalMxn {
  /** Suma en MXN de los montos convertibles. */
  total: number;
  /** Cuántos montos se excluyeron por falta de tipo de cambio. */
  sinTipoCambio: number;
  /** Monto nominal (sin convertir) de lo excluido, por moneda. */
  excluidoPorMoneda: Record<string, number>;
}

/** Suma una lista de montos a MXN, separando lo que no se pudo convertir. */
export function sumarEnMxn<T>(
  items: readonly T[],
  get: (item: T) => { monto: number | null | undefined; moneda: string | null | undefined; tc?: TiposCambio },
  tcPorDefecto: TiposCambio = {},
): TotalMxn {
  let total = 0;
  let sinTipoCambio = 0;
  const excluidoPorMoneda: Record<string, number> = {};

  for (const item of items) {
    const { monto, moneda, tc } = get(item);
    const res = convertirMxn(monto, moneda, tc ?? tcPorDefecto);
    if (res.mxn === null) {
      sinTipoCambio += 1;
      const clave = normalizarMoneda(moneda);
      excluidoPorMoneda[clave] = (excluidoPorMoneda[clave] ?? 0) + Number(monto ?? 0);
      continue;
    }
    total += res.mxn;
  }

  return { total: roundMoney(total), sinTipoCambio, excluidoPorMoneda };
}
