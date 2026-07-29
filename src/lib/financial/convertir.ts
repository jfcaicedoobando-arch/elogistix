/**
 * FIX C6 — Canon único de conversión a MXN.
 *
 * Regla no negociable: una moneda extranjera SIN tipo de cambio válido nunca
 * se suma como si fuera MXN (TC=1). Se reporta aparte para que la UI pueda
 * advertir "hay montos sin tipo de cambio" en lugar de mostrar cifras falsas.
 *
 * Usa este módulo en vez de llamar `convertirAMXN` con `?? 1`.
 */
import { convertirAMXN, type Moneda } from "@/lib/financial/financialUtils";
import { tcValido } from "@/lib/financial/tcValido";

export interface TiposCambio {
  usd?: number | null;
  eur?: number | null;
}

export interface ResultadoConversion {
  /** Monto en MXN, o `null` si faltaba un tipo de cambio válido. */
  mxn: number | null;
  /** `true` cuando la moneda es extranjera y no había TC utilizable. */
  tcFaltante: boolean;
}

function normalizarMoneda(moneda: string | null | undefined): Moneda {
  const m = (moneda ?? "MXN").toUpperCase();
  return (m === "USD" || m === "EUR" ? m : "MXN") as Moneda;
}

/** Convierte un monto a MXN aplicando el canon (nunca colapsa a TC=1). */
export function convertirMxn(
  monto: number | null | undefined,
  moneda: string | null | undefined,
  tc: TiposCambio,
): ResultadoConversion {
  const valor = Number(monto ?? 0);
  const seguro = Number.isFinite(valor) ? valor : 0;
  const mon = normalizarMoneda(moneda);
  if (mon === "MXN") return { mxn: seguro, tcFaltante: false };

  const tasa = mon === "USD" ? tcValido(tc.usd) : tcValido(tc.eur);
  if (!tasa) return { mxn: null, tcFaltante: true };

  return {
    mxn: convertirAMXN(seguro, mon, mon === "USD" ? tasa : 0, mon === "EUR" ? tasa : 0),
    tcFaltante: false,
  };
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

  return { total: Math.round(total * 100) / 100, sinTipoCambio, excluidoPorMoneda };
}
